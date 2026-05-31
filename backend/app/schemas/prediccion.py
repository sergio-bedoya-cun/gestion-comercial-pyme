from pydantic import BaseModel, Field
from datetime import date
from typing import Optional


class PrediccionPunto(BaseModel):
    """Un punto individual de la serie de predicción."""
    ds:    date  = Field(..., description="Fecha del pronóstico")
    yhat:  float = Field(..., description="Valor predicho (unidades normalizadas)")
    yhat_lower: Optional[float] = Field(None, description="Límite inferior del intervalo de confianza")
    yhat_upper: Optional[float] = Field(None, description="Límite superior del intervalo de confianza")


class PrediccionRequest(BaseModel):
    """Parámetros para solicitar una predicción."""
    producto_id: int   = Field(..., description="ID del producto a predecir")
    dias:        int   = Field(30, ge=7, le=365, description="Horizonte de predicción en días")
    modelo:      str   = Field("prophet", pattern="^(prophet|sarima|xgboost)$",
                               description="Modelo a usar: prophet, sarima o xgboost")


class PrediccionOut(BaseModel):
    """Respuesta completa de una predicción con metadatos."""
    producto_id:   int
    producto_nombre: str
    modelo:        str
    dias:          int
    mae:           Optional[float] = Field(None, description="Error absoluto medio en COP")
    rmse:          Optional[float] = Field(None, description="Raíz del error cuadrático medio en COP")
    mape:          Optional[float] = Field(None, description="MAPE filtrado (excluye días de baja venta)")
    mape_completo: Optional[float] = Field(None, description="MAPE sin filtro, más conservador")
    predicciones:  list[PrediccionPunto]
