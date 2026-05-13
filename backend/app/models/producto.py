from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Categoria(Base):
    __tablename__ = "categorias"

    id          = Column(Integer, primary_key=True, index=True)
    nombre      = Column(String(80), unique=True, nullable=False)
    descripcion = Column(Text, nullable=True)
    creado_en   = Column(DateTime(timezone=True), server_default=func.now())

    productos   = relationship("Producto", back_populates="categoria")


class Producto(Base):
    __tablename__ = "productos"

    id              = Column(Integer, primary_key=True, index=True)
    codigo          = Column(String(50), unique=True, index=True, nullable=False)
    nombre          = Column(String(150), nullable=False)
    descripcion     = Column(Text, nullable=True)
    precio_compra   = Column(Float, nullable=False, default=0.0)
    precio_venta    = Column(Float, nullable=False)
    categoria_id    = Column(Integer, ForeignKey("categorias.id"), nullable=True)
    activo          = Column(Boolean, default=True)
    creado_en       = Column(DateTime(timezone=True), server_default=func.now())
    actualizado_en  = Column(DateTime(timezone=True), onupdate=func.now())

    categoria       = relationship("Categoria", back_populates="productos")
    inventario      = relationship("Inventario", back_populates="producto", uselist=False)
    detalles_venta  = relationship("DetalleVenta", back_populates="producto")