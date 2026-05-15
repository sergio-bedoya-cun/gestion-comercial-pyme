"""
Parte 2: Entrenamiento y comparación de modelos predictivos.
Prophet vs SARIMA vs XGBoost — métricas MAE, RMSE, MAPE
"""
import sys, os, warnings
warnings.filterwarnings('ignore')

base = os.path.dirname(os.path.abspath(__file__))
backend_path = os.path.normpath(os.path.join(base, '..', '..', 'backend'))
sys.path.insert(0, backend_path)

# Apuntar a la BD correcta
db_path = os.path.join(backend_path, 'gestion_comercial.db')
os.environ['DATABASE_URL'] = f'sqlite:///{db_path}'
print(f"Usando BD: {db_path}")

# Ruta del CSV generado por 01_exploracion.py
data_path = os.path.normpath(os.path.join(base, '..', 'data', 'serie_ventas.csv'))
print(f"Leyendo serie desde: {data_path}")

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from sklearn.metrics import mean_absolute_error, mean_squared_error

# ── Cargar serie ──────────────────────────────────────────────────────────────
df = pd.read_csv(data_path, parse_dates=['ds'])
df = df[['ds', 'ingresos']].sort_values('ds').reset_index(drop=True)

# Normalizar a miles de COP para mejorar la precisión de los modelos
ESCALA = 1000
df['ingresos'] = df['ingresos'] / ESCALA
print(f"Serie normalizada a miles COP. Media: {df['ingresos'].mean():,.1f}k")

# Train/test split: últimos 30 días como test
HORIZONTE = 30
train = df.iloc[:-HORIZONTE].copy()
test  = df.iloc[-HORIZONTE:].copy()

print(f"Train: {len(train)} días  |  Test: {len(test)} días")
print(f"Período test: {test['ds'].min().date()} → {test['ds'].max().date()}\n")

# ── Métricas ──────────────────────────────────────────────────────────────────
def calcular_metricas(real, pred, nombre):
    # Desnormalizar para métricas en COP reales
    real_cop = real * ESCALA
    pred_cop = pred * ESCALA
    mae  = mean_absolute_error(real_cop, pred_cop)
    rmse = np.sqrt(mean_squared_error(real_cop, pred_cop))
    # MAPE robusto: evita división por valores pequeños
    mask = real_cop > real_cop.mean() * 0.1
    mape = np.mean(np.abs((real_cop[mask] - pred_cop[mask]) /
                           real_cop[mask])) * 100
    print(f"{nombre:15s} → MAE: ${mae:>12,.0f}  RMSE: ${rmse:>12,.0f}  MAPE: {mape:.2f}%")
    return {'modelo': nombre, 'MAE': mae, 'RMSE': rmse, 'MAPE': mape}

resultados = []
predicciones = {}

# ═══════════════════════════════════════════════════════════════════════════════
# MODELO 1 — PROPHET
# ═══════════════════════════════════════════════════════════════════════════════
print("=" * 60)
print("Entrenando Prophet...")
from prophet import Prophet

df_prophet = train.rename(columns={'ingresos': 'y'})

modelo_prophet = Prophet(
    yearly_seasonality  = True,
    weekly_seasonality  = True,
    daily_seasonality   = False,
    seasonality_mode    = 'multiplicative',
    changepoint_prior_scale = 0.05
)
modelo_prophet.fit(df_prophet)

future  = modelo_prophet.make_future_dataframe(periods=HORIZONTE)
forecast = modelo_prophet.predict(future)
pred_prophet = forecast.tail(HORIZONTE)['yhat'].values
pred_prophet = np.maximum(pred_prophet, 0)  # sin negativos

predicciones['Prophet'] = pred_prophet
resultados.append(calcular_metricas(test['ingresos'].values, pred_prophet, 'Prophet'))

# ═══════════════════════════════════════════════════════════════════════════════
# MODELO 2 — SARIMA
# ═══════════════════════════════════════════════════════════════════════════════
print("\nEntrenando SARIMA (puede tardar 1-2 min)...")
from statsmodels.tsa.statespace.sarimax import SARIMAX

modelo_sarima = SARIMAX(
    train['ingresos'],
    order=(1, 1, 1),           # p,d,q
    seasonal_order=(1, 1, 1, 7), # P,D,Q,s (estacionalidad semanal)
    enforce_stationarity  = False,
    enforce_invertibility = False
)
resultado_sarima = modelo_sarima.fit(disp=False)
pred_sarima = resultado_sarima.forecast(steps=HORIZONTE)
pred_sarima = np.maximum(pred_sarima.values, 0)

predicciones['SARIMA'] = pred_sarima
resultados.append(calcular_metricas(test['ingresos'].values, pred_sarima, 'SARIMA'))

# ═══════════════════════════════════════════════════════════════════════════════
# MODELO 3 — XGBOOST
# ═══════════════════════════════════════════════════════════════════════════════
print("\nEntrenando XGBoost...")
import xgboost as xgb

def crear_features(df_in):
    d = df_in.copy()
    d['dia_semana'] = d['ds'].dt.dayofweek
    d['dia_mes']    = d['ds'].dt.day
    d['mes']        = d['ds'].dt.month
    d['dia_año']    = d['ds'].dt.dayofyear
    d['semana_año'] = d['ds'].dt.isocalendar().week.astype(int)
    d['es_finde']   = (d['dia_semana'] >= 5).astype(int)
    d['es_quincena']= d['dia_mes'].isin([14,15,16,29,30,1]).astype(int)
    # Lags
    for lag in [1, 7, 14, 30]:
        d[f'lag_{lag}'] = d['ingresos'].shift(lag)
    # Rolling
    for w in [7, 14, 30]:
        d[f'roll_mean_{w}'] = d['ingresos'].shift(1).rolling(w).mean()
        d[f'roll_std_{w}']  = d['ingresos'].shift(1).rolling(w).std()
    return d

df_feat = crear_features(df.copy())
feature_cols = [c for c in df_feat.columns
                if c not in ['ds', 'ingresos', 'dia_semana', 'mes']]

train_feat = df_feat.iloc[:-HORIZONTE].dropna()
test_feat  = df_feat.iloc[-HORIZONTE:].fillna(method='ffill').fillna(0)

X_train = train_feat[feature_cols]
y_train = train_feat['ingresos']
X_test  = test_feat[feature_cols]

modelo_xgb = xgb.XGBRegressor(
    n_estimators     = 300,
    max_depth        = 5,
    learning_rate    = 0.05,
    subsample        = 0.8,
    colsample_bytree = 0.8,
    random_state     = 42,
    verbosity        = 0
)
modelo_xgb.fit(X_train, y_train)
pred_xgb = np.maximum(modelo_xgb.predict(X_test), 0)

predicciones['XGBoost'] = pred_xgb
resultados.append(calcular_metricas(test['ingresos'].values, pred_xgb, 'XGBoost'))

# ═══════════════════════════════════════════════════════════════════════════════
# TABLA DE RESULTADOS
# ═══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("RESUMEN COMPARATIVO")
print("=" * 60)
df_res = pd.DataFrame(resultados).set_index('modelo')
print(df_res.to_string())

mejor_mae  = df_res['MAE'].idxmin()
mejor_rmse = df_res['RMSE'].idxmin()
mejor_mape = df_res['MAPE'].idxmin()
print(f"\nMejor MAE:  {mejor_mae}")
print(f"Mejor RMSE: {mejor_rmse}")
print(f"Mejor MAPE: {mejor_mape}")

# ═══════════════════════════════════════════════════════════════════════════════
# VISUALIZACIÓN COMPARATIVA
# ═══════════════════════════════════════════════════════════════════════════════
colores = {'Prophet': '#3b82f6', 'SARIMA': '#ef4444', 'XGBoost': '#10b981'}

fig = plt.figure(figsize=(16, 14))
gs  = gridspec.GridSpec(3, 2, figure=fig)
fig.suptitle('Comparación de Modelos Predictivos — Serie de Ventas',
             fontsize=14, y=0.98)

# Gráfica 1 — predicciones vs real (ocupa toda la fila superior)
ax1 = fig.add_subplot(gs[0, :])
ultimos_60 = df.iloc[-60:]
ax1.plot(ultimos_60['ds'], ultimos_60['ingresos'],
         color='#1e293b', linewidth=1.5, label='Real', zorder=5)
for nombre, pred in predicciones.items():
    ax1.plot(test['ds'], pred, linewidth=2,
             color=colores[nombre], label=nombre,
             linestyle='--' if nombre != 'Prophet' else '-')
ax1.axvline(test['ds'].iloc[0], color='gray',
            linestyle=':', alpha=0.7, label='Inicio test')
ax1.set_title('Predicciones vs Valores Reales (últimos 60 días)')
ax1.set_ylabel('Ingresos COP')
ax1.legend()
ax1.grid(axis='y', alpha=0.3)

# Gráfica 2 — barras MAE
ax2 = fig.add_subplot(gs[1, 0])
modelos = df_res.index.tolist()
bars = ax2.bar(modelos, df_res['MAE'],
               color=[colores[m] for m in modelos], edgecolor='white')
ax2.set_title('MAE (menor es mejor)')
ax2.set_ylabel('COP')
for bar, val in zip(bars, df_res['MAE']):
    ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1000,
             f'${val:,.0f}', ha='center', va='bottom', fontsize=9)
ax2.grid(axis='y', alpha=0.3)

# Gráfica 3 — barras RMSE
ax3 = fig.add_subplot(gs[1, 1])
bars = ax3.bar(modelos, df_res['RMSE'],
               color=[colores[m] for m in modelos], edgecolor='white')
ax3.set_title('RMSE (menor es mejor)')
ax3.set_ylabel('COP')
for bar, val in zip(bars, df_res['RMSE']):
    ax3.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1000,
             f'${val:,.0f}', ha='center', va='bottom', fontsize=9)
ax3.grid(axis='y', alpha=0.3)

# Gráfica 4 — barras MAPE
ax4 = fig.add_subplot(gs[2, 0])
bars = ax4.bar(modelos, df_res['MAPE'],
               color=[colores[m] for m in modelos], edgecolor='white')
ax4.set_title('MAPE % (menor es mejor)')
ax4.set_ylabel('Porcentaje %')
for bar, val in zip(bars, df_res['MAPE']):
    ax4.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.1,
             f'{val:.2f}%', ha='center', va='bottom', fontsize=9)
ax4.grid(axis='y', alpha=0.3)

# Gráfica 5 — errores absolutos por día
ax5 = fig.add_subplot(gs[2, 1])
for nombre, pred in predicciones.items():
    errores = np.abs(test['ingresos'].values - pred)
    ax5.plot(test['ds'], errores, color=colores[nombre],
             linewidth=1.5, label=nombre)
ax5.set_title('Error absoluto por día durante el test')
ax5.set_ylabel('|Error| COP')
ax5.legend()
ax5.grid(axis='y', alpha=0.3)

plt.tight_layout()
output = os.path.join(base, '..', 'data', 'comparacion_modelos.png')
plt.savefig(output, dpi=150, bbox_inches='tight')
print(f"\nGráfica comparativa guardada en: {os.path.normpath(output)}")

# ── Guardar resultados ────────────────────────────────────────────────────────
csv_out = os.path.join(base, '..', 'data', 'resultados_modelos.csv')
df_res.to_csv(csv_out)
print(f"Resultados guardados en:        {os.path.normpath(csv_out)}")