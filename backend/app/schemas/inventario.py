from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class InventarioBase(BaseModel):
    cantidad:      float = Field(..., ge=0, description="Stock actual en unidades")
    stock_minimo:  float = Field(5.0, ge=0, description="Alerta de reposición al llegar a este nivel")
    stock_maximo:  Optional[float] = Field(None, ge=0, description="Capacidad máxima de almacenamiento")
    unidad_medida: str   = Field("unidad", description="Unidad de medida: unidad, kg, litro, etc.")


class InventarioUpdate(BaseModel):
    """Solo los campos que el usuario puede modificar directamente."""
    cantidad:      Optional[float] = Field(None, ge=0)
    stock_minimo:  Optional[float] = Field(None, ge=0)
    stock_maximo:  Optional[float] = Field(None, ge=0)
    unidad_medida: Optional[str]   = None


class InventarioOut(InventarioBase):
    id:             int
    producto_id:    int
    ultima_entrada: Optional[datetime] = None
    actualizado_en: Optional[datetime] = None

    class Config:
        from_attributes = True


class MovimientoCreate(BaseModel):
    """Registrar una entrada, salida o ajuste manual de inventario."""
    tipo:     str   = Field(..., pattern="^(entrada|salida|ajuste)$")
    cantidad: float = Field(..., gt=0)
    motivo:   Optional[str] = None


class MovimientoOut(MovimientoCreate):
    id:            int
    inventario_id: int
    fecha:         datetime

    class Config:
        from_attributes = True
