from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Inventario(Base):
    __tablename__ = "inventario"

    id              = Column(Integer, primary_key=True, index=True)
    producto_id     = Column(Integer, ForeignKey("productos.id"), unique=True)
    cantidad        = Column(Float, nullable=False, default=0)
    stock_minimo    = Column(Float, nullable=False, default=5)   # alerta si baja de aquí
    stock_maximo    = Column(Float, nullable=True)
    unidad_medida   = Column(String(30), default="unidad")       # unidad, kg, litro...
    ultima_entrada  = Column(DateTime(timezone=True), nullable=True)
    actualizado_en  = Column(DateTime(timezone=True), onupdate=func.now())

    producto        = relationship("Producto", back_populates="inventario")
    movimientos     = relationship("MovimientoInventario", back_populates="inventario")


class MovimientoInventario(Base):
    """Registro de cada entrada/salida de inventario — útil para auditoría"""
    __tablename__ = "movimientos_inventario"

    id              = Column(Integer, primary_key=True, index=True)
    inventario_id   = Column(Integer, ForeignKey("inventario.id"))
    tipo            = Column(String(20))   # entrada | salida | ajuste
    cantidad        = Column(Float, nullable=False)
    motivo          = Column(String(150), nullable=True)
    fecha           = Column(DateTime(timezone=True), server_default=func.now())

    inventario      = relationship("Inventario", back_populates="movimientos")