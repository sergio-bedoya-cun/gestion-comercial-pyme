from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class ProductoBase(BaseModel):
    nombre:       str
    codigo:       str
    precio_compra: float
    precio_venta: float
    categoria_id: Optional[int] = None

class ProductoCreate(ProductoBase):
    pass

class ProductoOut(ProductoBase):
    id:        int
    activo:    bool
    creado_en: datetime
    class Config:
        from_attributes = True

class InventarioOut(BaseModel):
    producto_id:   int
    cantidad:      float
    stock_minimo:  float
    unidad_medida: str
    alerta:        bool   # True si cantidad <= stock_minimo
    class Config:
        from_attributes = True