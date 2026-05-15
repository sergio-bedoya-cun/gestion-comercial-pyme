"""
Parte 1: Exploración y preparación de la serie de tiempo de ventas.
Ejecutar desde la raíz del proyecto con el venv activo.
"""
import sys, os

base = os.path.dirname(os.path.abspath(__file__))
backend_path = os.path.normpath(os.path.join(base, '..', '..', 'backend'))
sys.path.insert(0, backend_path)

# Apuntar a la BD correcta
db_path = os.path.join(backend_path, 'gestion_comercial.db')
os.environ['DATABASE_URL'] = f'sqlite:///{db_path}'
print(f"Usando BD: {db_path}")

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.venta import Venta

# ── 1. Extraer ventas de la BD ────────────────────────────────────────────────
db: Session = SessionLocal()
ventas = db.query(Venta).filter(Venta.estado == "completada").all()
db.close()

df = pd.DataFrame([{
    'fecha': v.fecha,
    'total': v.total
} for v in ventas])

df['fecha'] = pd.to_datetime(df['fecha'])
df = df.sort_values('fecha')

# ── 2. Agregar por día (serie de tiempo diaria) ───────────────────────────────
serie_diaria = (df
    .groupby(df['fecha'].dt.date)
    .agg(ingresos=('total', 'sum'), n_ventas=('total', 'count'))
    .reset_index()
    .rename(columns={'fecha': 'ds'})
)
serie_diaria['ds'] = pd.to_datetime(serie_diaria['ds'])
serie_diaria = serie_diaria.sort_values('ds').reset_index(drop=True)

print("Serie de tiempo diaria:")
print(f"  Período:     {serie_diaria['ds'].min().date()} → {serie_diaria['ds'].max().date()}")
print(f"  Días totales: {len(serie_diaria)}")
print(f"  Ingreso diario promedio: ${serie_diaria['ingresos'].mean():,.0f} COP")
print(f"  Ingreso diario máximo:   ${serie_diaria['ingresos'].max():,.0f} COP")
print(f"  Ingreso diario mínimo:   ${serie_diaria['ingresos'].min():,.0f} COP")
print()
print(serie_diaria.tail(10))

# ── 3. Visualización exploratoria ────────────────────────────────────────────
fig, axes = plt.subplots(3, 1, figsize=(14, 12))
fig.suptitle('Exploración de la Serie de Tiempo de Ventas', fontsize=14, y=0.98)

# Gráfica 1 — serie completa
axes[0].plot(serie_diaria['ds'], serie_diaria['ingresos'],
             color='#3b82f6', linewidth=0.8, alpha=0.8)
axes[0].fill_between(serie_diaria['ds'], serie_diaria['ingresos'],
                     alpha=0.15, color='#3b82f6')
ma7 = serie_diaria['ingresos'].rolling(7).mean()
axes[0].plot(serie_diaria['ds'], ma7, color='#ef4444',
             linewidth=2, label='Media móvil 7 días')
axes[0].set_title('Ingresos diarios — 12 meses')
axes[0].set_ylabel('COP')
axes[0].legend()
axes[0].xaxis.set_major_formatter(mdates.DateFormatter('%b %Y'))
axes[0].grid(axis='y', alpha=0.3)

# Gráfica 2 — ventas por día de la semana
serie_diaria['dia_semana'] = serie_diaria['ds'].dt.dayofweek
dias_labels = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']
por_dia = serie_diaria.groupby('dia_semana')['ingresos'].mean()
colores = ['#94a3b8']*5 + ['#3b82f6', '#3b82f6']
axes[1].bar(dias_labels, por_dia.values, color=colores, edgecolor='white')
axes[1].set_title('Ingreso promedio por día de la semana')
axes[1].set_ylabel('COP promedio')
axes[1].grid(axis='y', alpha=0.3)

# Gráfica 3 — ventas por mes
serie_diaria['mes'] = serie_diaria['ds'].dt.to_period('M')
por_mes = serie_diaria.groupby('mes')['ingresos'].sum()
meses_str = [str(m) for m in por_mes.index]
axes[2].bar(meses_str, por_mes.values, color='#8b5cf6', edgecolor='white')
axes[2].set_title('Ingresos totales por mes')
axes[2].set_ylabel('COP total')
axes[2].tick_params(axis='x', rotation=45)
axes[2].grid(axis='y', alpha=0.3)

plt.tight_layout()
output_path = os.path.join(base, '..', 'data', 'exploracion_serie.png')
os.makedirs(os.path.dirname(output_path), exist_ok=True)
plt.savefig(output_path, dpi=150, bbox_inches='tight')
print(f"\nGráfica guardada en: {os.path.normpath(output_path)}")

# ── 4. Guardar serie limpia para los modelos ──────────────────────────────────
csv_path = os.path.join(base, '..', 'data', 'serie_ventas.csv')
serie_diaria.to_csv(csv_path, index=False)
print(f"Serie guardada en:   {os.path.normpath(csv_path)}")