from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

class DetalleVentaBase(BaseModel):
    producto_id:     int
    cantidad:        float
    precio_unitario: float

class DetalleVentaOut(DetalleVentaBase):
    id:              int
    subtotal:        float
    nombre_producto: Optional[str] = None
    class Config:
        from_attributes = True

class VentaCreate(BaseModel):
    cliente_nombre: Optional[str] = None
    metodo_pago:    str = "efectivo"
    descuento:      float = 0.0
    notas:          Optional[str] = None
    detalles:       List[DetalleVentaBase]

class VentaOut(BaseModel):
    id:             int
    usuario_id:     int
    cliente_nombre: Optional[str]
    total:          float
    descuento:      float
    metodo_pago:    str
    estado:         str
    fecha:          datetime
    detalles:       List[DetalleVentaOut] = []
    class Config:
        from_attributes = True

class VentaResumen(BaseModel):
    total_ventas:   int
    ingresos_total: float
    ticket_promedio: float