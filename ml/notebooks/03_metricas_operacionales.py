"""
Parte 3: Métricas operacionales simuladas.
Compara el comportamiento del inventario con y sin predicción predictiva.
"""
import sys, os, warnings
warnings.filterwarnings('ignore')

base         = os.path.dirname(os.path.abspath(__file__))
backend_path = os.path.normpath(os.path.join(base, '..', '..', 'backend'))
sys.path.insert(0, backend_path)

db_path = os.path.join(backend_path, 'gestion_comercial.db')
os.environ['DATABASE_URL'] = f'sqlite:///{db_path}'

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.venta import Venta, DetalleVenta
from app.models.inventario import Inventario

# ── 1. Cargar datos ───────────────────────────────────────────────────────────
db: Session = SessionLocal()

# Ventas por producto por día
rows = (db.query(
            DetalleVenta.producto_id,
            Venta.fecha,
            DetalleVenta.cantidad)
        .join(Venta, Venta.id == DetalleVenta.venta_id)
        .filter(Venta.estado == "completada")
        .all())

inventario_actual = {i.producto_id: i.cantidad
                     for i in db.query(Inventario).all()}
stock_minimo      = {i.producto_id: i.stock_minimo
                     for i in db.query(Inventario).all()}
db.close()

df = pd.DataFrame([{
    'producto_id': r.producto_id,
    'fecha':       pd.to_datetime(r.fecha).date(),
    'cantidad':    r.cantidad
} for r in rows])

# Demanda diaria por producto
demanda = (df.groupby(['producto_id', 'fecha'])['cantidad']
             .sum()
             .reset_index()
             .rename(columns={'fecha': 'ds', 'cantidad': 'demanda'}))
demanda['ds'] = pd.to_datetime(demanda['ds'])

productos = demanda['producto_id'].unique()
print(f"Productos analizados: {len(productos)}")
print(f"Período: {demanda['ds'].min().date()} → {demanda['ds'].max().date()}\n")

# ── 2. Simulación sin predicción (política reactiva) ─────────────────────────
def simular_sin_prediccion(demanda_prod, stock_inicial, stock_min,
                            lead_time=3, lote_reorden=50):
    """
    Política reactiva: reordena cuando el stock cae bajo el mínimo.
    lead_time: días que tarda en llegar el pedido
    lote_reorden: cantidad que se pide cada vez
    """
    fechas    = sorted(demanda_prod['ds'].unique())
    stock     = stock_inicial
    quiebres  = 0
    pedido_en = None
    unidades_perdidas    = 0
    exceso_inventario    = []
    dias_bajo_minimo     = 0

    for fecha in fechas:
        dem_hoy = demanda_prod[demanda_prod['ds'] == fecha]['demanda'].sum()

        # Llega el pedido
        if pedido_en and fecha >= pedido_en:
            stock    += lote_reorden
            pedido_en = None

        # Satisfacer demanda
        if stock >= dem_hoy:
            stock -= dem_hoy
        else:
            unidades_perdidas += (dem_hoy - stock)
            quiebres          += 1
            stock              = 0

        # Reorden reactivo
        if stock <= stock_min and pedido_en is None:
            pedido_en = fecha + pd.Timedelta(days=lead_time)
            dias_bajo_minimo += 1

        exceso_inventario.append(max(0, stock - stock_min * 3))

    return {
        'quiebres':           quiebres,
        'unidades_perdidas':  unidades_perdidas,
        'exceso_promedio':    np.mean(exceso_inventario),
        'dias_bajo_minimo':   dias_bajo_minimo
    }

# ── 3. Simulación con predicción (política proactiva) ────────────────────────
def simular_con_prediccion(demanda_prod, stock_inicial, stock_min,
                            lead_time=3, lote_reorden=50, ventana_pred=7):
    """
    Política proactiva: anticipa la demanda futura usando media móvil
    como proxy del modelo predictivo.
    """
    fechas    = sorted(demanda_prod['ds'].unique())
    stock     = stock_inicial
    quiebres  = 0
    pedido_en = None
    unidades_perdidas = 0
    exceso_inventario = []
    dias_bajo_minimo  = 0

    dem_series = demanda_prod.set_index('ds')['demanda']

    for i, fecha in enumerate(fechas):
        dem_hoy = demanda_prod[demanda_prod['ds'] == fecha]['demanda'].sum()

        # Llega el pedido
        if pedido_en and fecha >= pedido_en:
            stock    += lote_reorden
            pedido_en = None

        # Satisfacer demanda
        if stock >= dem_hoy:
            stock -= dem_hoy
        else:
            unidades_perdidas += (dem_hoy - stock)
            quiebres          += 1
            stock              = 0

        # Predicción: demanda esperada próximos lead_time días
        fechas_futuras  = [fecha + pd.Timedelta(days=d)
                           for d in range(1, lead_time + ventana_pred + 1)]
        dem_predicha    = dem_series.reindex(fechas_futuras).fillna(
                          dem_series.rolling(ventana_pred, min_periods=1).mean()
                          .iloc[-1] if len(dem_series) > 0 else stock_min
                          ).mean()

        # Reorden proactivo: si el stock no cubre la demanda predicha
        umbral = stock_min + dem_predicha * lead_time
        if stock <= umbral and pedido_en is None:
            pedido_en = fecha + pd.Timedelta(days=lead_time)
            dias_bajo_minimo += 1

        exceso_inventario.append(max(0, stock - stock_min * 3))

    return {
        'quiebres':          quiebres,
        'unidades_perdidas': unidades_perdidas,
        'exceso_promedio':   np.mean(exceso_inventario),
        'dias_bajo_minimo':  dias_bajo_minimo
    }

# ── 4. Ejecutar simulación para todos los productos ───────────────────────────
print("Simulando políticas de inventario...")
resultados = []

for prod_id in productos:
    dem_prod      = demanda[demanda['producto_id'] == prod_id].copy()
    stock_ini     = inventario_actual.get(prod_id, 50)
    stock_min_val = stock_minimo.get(prod_id, 10)

    sin_pred = simular_sin_prediccion(dem_prod, stock_ini, stock_min_val)
    con_pred = simular_con_prediccion(dem_prod, stock_ini, stock_min_val)

    resultados.append({
        'producto_id':              prod_id,
        'quiebres_sin_pred':        sin_pred['quiebres'],
        'quiebres_con_pred':        con_pred['quiebres'],
        'unidades_perdidas_sin':    sin_pred['unidades_perdidas'],
        'unidades_perdidas_con':    con_pred['unidades_perdidas'],
        'exceso_sin_pred':          sin_pred['exceso_promedio'],
        'exceso_con_pred':          con_pred['exceso_promedio'],
        'dias_bajo_min_sin':        sin_pred['dias_bajo_minimo'],
        'dias_bajo_min_con':        con_pred['dias_bajo_minimo'],
    })

df_res = pd.DataFrame(resultados)

# ── 5. Métricas agregadas ─────────────────────────────────────────────────────
total_quiebres_sin = df_res['quiebres_sin_pred'].sum()
total_quiebres_con = df_res['quiebres_con_pred'].sum()
reduccion_quiebres = ((total_quiebres_sin - total_quiebres_con)
                       / total_quiebres_sin * 100) if total_quiebres_sin > 0 else 0

total_perdidas_sin = df_res['unidades_perdidas_sin'].sum()
total_perdidas_con = df_res['unidades_perdidas_con'].sum()
reduccion_perdidas = ((total_perdidas_sin - total_perdidas_con)
                       / total_perdidas_sin * 100) if total_perdidas_sin > 0 else 0

exceso_sin = df_res['exceso_sin_pred'].mean()
exceso_con = df_res['exceso_con_pred'].mean()
reduccion_exceso = ((exceso_sin - exceso_con)
                    / exceso_sin * 100) if exceso_sin > 0 else 0

mejora_anticipacion = ((df_res['dias_bajo_min_sin'].sum()
                        - df_res['dias_bajo_min_con'].sum())
                        / df_res['dias_bajo_min_sin'].sum() * 100) \
                       if df_res['dias_bajo_min_sin'].sum() > 0 else 0

metricas_resumen = {
    'total_quiebres_sin_prediccion':    int(total_quiebres_sin),
    'total_quiebres_con_prediccion':    int(total_quiebres_con),
    'reduccion_quiebres_pct':           round(reduccion_quiebres, 1),
    'unidades_perdidas_sin_prediccion': round(total_perdidas_sin, 1),
    'unidades_perdidas_con_prediccion': round(total_perdidas_con, 1),
    'reduccion_perdidas_pct':           round(reduccion_perdidas, 1),
    'exceso_inventario_sin':            round(exceso_sin, 2),
    'exceso_inventario_con':            round(exceso_con, 2),
    'reduccion_sobreinventario_pct':    round(reduccion_exceso, 1),
    'mejora_anticipacion_pedidos_pct':  round(mejora_anticipacion, 1),
}

print("\n" + "=" * 55)
print("MÉTRICAS OPERACIONALES — IMPACTO DE LA PREDICCIÓN")
print("=" * 55)
print(f"Quiebres de stock sin predicción: {total_quiebres_sin:>6}")
print(f"Quiebres de stock con predicción: {total_quiebres_con:>6}")
print(f"Reducción de quiebres:            {reduccion_quiebres:>5.1f}%")
print(f"")
print(f"Unidades perdidas sin predicción: {total_perdidas_sin:>6.0f}")
print(f"Unidades perdidas con predicción: {total_perdidas_con:>6.0f}")
print(f"Reducción de pérdidas:            {reduccion_perdidas:>5.1f}%")
print(f"")
print(f"Sobreinventario promedio sin pred:{exceso_sin:>7.1f} uds")
print(f"Sobreinventario promedio con pred:{exceso_con:>7.1f} uds")
print(f"Reducción de sobreinventario:     {reduccion_exceso:>5.1f}%")
print(f"")
print(f"Mejora en anticipación de pedidos:{mejora_anticipacion:>5.1f}%")

# ── 6. Guardar JSON para la API ───────────────────────────────────────────────
import json
out_json = os.path.join(base, '..', 'data', 'metricas_operacionales.json')
with open(out_json, 'w') as f:
    json.dump(metricas_resumen, f, indent=2)
print(f"\nMétricas guardadas en: {os.path.normpath(out_json)}")

# ── 7. Visualización ──────────────────────────────────────────────────────────
fig, axes = plt.subplots(1, 3, figsize=(15, 5))
fig.suptitle('Impacto Operacional del Módulo Predictivo', fontsize=13)

categorias = ['Sin predicción', 'Con predicción']
colores    = ['#ef4444', '#22c55e']

# Quiebres
axes[0].bar(categorias,
            [total_quiebres_sin, total_quiebres_con],
            color=colores, edgecolor='white', width=0.5)
axes[0].set_title(f'Quiebres de stock\n↓ {reduccion_quiebres:.1f}%')
axes[0].set_ylabel('Eventos')
for i, v in enumerate([total_quiebres_sin, total_quiebres_con]):
    axes[0].text(i, v + 1, str(v), ha='center', fontweight='bold')
axes[0].grid(axis='y', alpha=0.3)

# Unidades perdidas
axes[1].bar(categorias,
            [total_perdidas_sin, total_perdidas_con],
            color=colores, edgecolor='white', width=0.5)
axes[1].set_title(f'Unidades perdidas\n↓ {reduccion_perdidas:.1f}%')
axes[1].set_ylabel('Unidades')
for i, v in enumerate([total_perdidas_sin, total_perdidas_con]):
    axes[1].text(i, v + 1, f'{v:.0f}', ha='center', fontweight='bold')
axes[1].grid(axis='y', alpha=0.3)

# Sobreinventario
axes[2].bar(categorias,
            [exceso_sin, exceso_con],
            color=colores, edgecolor='white', width=0.5)
axes[2].set_title(f'Sobreinventario promedio\n↓ {reduccion_exceso:.1f}%')
axes[2].set_ylabel('Unidades promedio')
for i, v in enumerate([exceso_sin, exceso_con]):
    axes[2].text(i, v + 0.1, f'{v:.1f}', ha='center', fontweight='bold')
axes[2].grid(axis='y', alpha=0.3)

plt.tight_layout()
out_png = os.path.join(base, '..', 'data', 'metricas_operacionales.png')
plt.savefig(out_png, dpi=150, bbox_inches='tight')
print(f"Gráfica guardada en:   {os.path.normpath(out_png)}")