from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Usuario(Base):
    __tablename__ = "usuarios"

    id          = Column(Integer, primary_key=True, index=True)
    nombre      = Column(String(100), nullable=False)
    email       = Column(String(150), unique=True, index=True, nullable=False)
    password    = Column(String(255), nullable=False)  # hasheado con bcrypt
    rol         = Column(String(20), default="vendedor")  # admin | vendedor
    activo      = Column(Boolean, default=True)
    creado_en   = Column(DateTime(timezone=True), server_default=func.now())

    ventas      = relationship("Venta", back_populates="usuario")