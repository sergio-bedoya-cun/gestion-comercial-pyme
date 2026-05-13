from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Venta(Base):
    __tablename__ = "ventas"

    id              = Column(Integer, primary_key=True, index=True)
    usuario_id      = Column(Integer, ForeignKey("usuarios.id"))
    cliente_nombre  = Column(String(150), nullable=True)   # venta puede ser anónima
    total           = Column(Float, nullable=False)
    descuento       = Column(Float, default=0.0)
    metodo_pago     = Column(String(30), default="efectivo")  # efectivo | tarjeta | otro
    estado          = Column(String(20), default="completada") # completada | anulada
    notas           = Column(Text, nullable=True)
    fecha           = Column(DateTime(timezone=True), server_default=func.now())

    usuario         = relationship("Usuario", back_populates="ventas")
    detalles        = relationship("DetalleVenta", back_populates="venta",
                                   cascade="all, delete-orphan")


class DetalleVenta(Base):
    """Una fila por producto dentro de cada venta"""
    __tablename__ = "detalle_ventas"

    id              = Column(Integer, primary_key=True, index=True)
    venta_id        = Column(Integer, ForeignKey("ventas.id"))
    producto_id     = Column(Integer, ForeignKey("productos.id"))
    cantidad        = Column(Float, nullable=False)
    precio_unitario = Column(Float, nullable=False)  # precio al momento de la venta
    subtotal        = Column(Float, nullable=False)

    venta           = relationship("Venta", back_populates="detalles")
    producto        = relationship("Producto", back_populates="detalles_venta")