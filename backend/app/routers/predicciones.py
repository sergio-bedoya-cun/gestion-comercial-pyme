from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.venta import Venta
import pandas as pd
import numpy as np
import os
import json
from datetime import datetime, timedelta

router = APIRouter(prefix="/predicciones", tags=["Predicciones"])

def obtener_serie(db: Session, dias: int = 365):
    """Extrae la serie de tiempo de ventas de la BD"""
    desde = datetime.now() - timedelta(days=dias)
    rows = (db.query(
                func.date(Venta.fecha).label("dia"),
                func.sum(Venta.total).label("ingresos"))
            .filter(Venta.fecha >= desde, Venta.estado == "completada")
            .group_by(func.date(Venta.fecha))
            .order_by(func.date(Venta.fecha))
            .all())
    df = pd.DataFrame([{"ds": pd.to_datetime(r.dia),
                         "y": float(r.ingresos)} for r in rows])
    return df

@router.get("/prophet")
def predecir_prophet(horizonte: int = 30, db: Session = Depends(get_db)):
    """Genera predicción con Prophet para los próximos N días"""
    try:
        from prophet import Prophet
        df = obtener_serie(db)
        if len(df) < 30:
            raise HTTPException(400, "Se necesitan al menos 30 días de datos")

        modelo = Prophet(
            yearly_seasonality      = True,
            weekly_seasonality      = True,
            daily_seasonality       = False,
            seasonality_mode        = 'multiplicative',
            changepoint_prior_scale = 0.05
        )
        modelo.fit(df)
        future   = modelo.make_future_dataframe(periods=horizonte)
        forecast = modelo.predict(future)

        historico = df.tail(60).rename(columns={'y': 'real'})
        pred_df   = forecast.tail(horizonte)[['ds', 'yhat', 'yhat_lower', 'yhat_upper']]
        pred_df['yhat']       = pred_df['yhat'].clip(lower=0)
        pred_df['yhat_lower'] = pred_df['yhat_lower'].clip(lower=0)
        pred_df['yhat_upper'] = pred_df['yhat_upper'].clip(lower=0)

        return {
            "modelo":    "Prophet",
            "horizonte": horizonte,
            "historico": historico.to_dict(orient='records'),
            "prediccion": pred_df.to_dict(orient='records'),
            "total_predicho": round(pred_df['yhat'].sum(), 2)
        }
    except Exception as e:
        raise HTTPException(500, f"Error en predicción: {str(e)}")

@router.get("/comparacion")
def comparar_modelos(db: Session = Depends(get_db)):
    """Lee los resultados del último entrenamiento guardado"""
    import os
    csv_path = os.path.join(
        os.path.dirname(__file__), '..', '..', '..',
        'ml', 'data', 'resultados_modelos.csv'
    )
    csv_path = os.path.normpath(csv_path)
    if not os.path.exists(csv_path):
        raise HTTPException(404,
            "Resultados no encontrados. Ejecuta ml/notebooks/02_modelos.py primero")
    df = pd.read_csv(csv_path, index_col=0)
    return df.reset_index().to_dict(orient='records')

@router.get("/metricas-operacionales")
def metricas_operacionales():
    json_path = os.path.normpath(os.path.join(
        os.path.dirname(__file__),
        '..', '..', '..', 'ml', 'data', 'metricas_operacionales.json'
    ))
    if not os.path.exists(json_path):
        return {
            "disponible": False,
            "mensaje": "Las métricas operacionales aún no han sido generadas. "
                       "Ejecuta ml/notebooks/03_metricas_operacionales.py para generarlas.",
            "datos": None
        }
    with open(json_path) as f:
        datos = json.load(f)
    return {"disponible": True, "mensaje": "OK", "datos": datos}


@router.get("/comparacion-completa")
def comparacion_completa():
    base_ml = os.path.normpath(os.path.join(
        os.path.dirname(__file__),
        '..', '..', '..', 'ml', 'data'
    ))
    csv_path  = os.path.join(base_ml, 'resultados_modelos.csv')
    json_path = os.path.join(base_ml, 'metricas_operacionales.json')

    faltantes = []
    if not os.path.exists(csv_path):
        faltantes.append("resultados_modelos.csv (ejecuta 02_modelos.py)")
    if not os.path.exists(json_path):
        faltantes.append("metricas_operacionales.json (ejecuta 03_metricas_operacionales.py)")

    if faltantes:
        return {
            "disponible":         False,
            "mensaje":            "Faltan archivos generados por los notebooks: "
                                  + ", ".join(faltantes),
            "metricas_ml":            [],
            "metricas_operacionales": {}
        }

    df = pd.read_csv(csv_path, index_col=0)
    with open(json_path) as f:
        operacionales = json.load(f)

    return {
        "disponible":             True,
        "mensaje":                "OK",
        "metricas_ml":            df.reset_index().to_dict(orient='records'),
        "metricas_operacionales": operacionales
    }

@router.get("/imagen-comparacion")
def imagen_comparacion():
    """Sirve la imagen comparativa generada por 02_modelos.py"""
    img_path = os.path.normpath(os.path.join(
        os.path.dirname(__file__),
        '..', '..', '..', 'ml', 'data', 'comparacion_modelos.png'
    ))
    if not os.path.exists(img_path):
        raise HTTPException(404,
            "Imagen no encontrada. Ejecuta ml/notebooks/02_modelos.py primero")
    return FileResponse(img_path, media_type="image/png",
                        filename="comparacion_modelos.png")