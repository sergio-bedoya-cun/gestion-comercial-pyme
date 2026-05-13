# Importar todos los modelos para que SQLAlchemy los registre al crear las tablas
from app.models.usuario import Usuario
from app.models.producto import Categoria, Producto
from app.models.inventario import Inventario, MovimientoInventario
from app.models.venta import Venta, DetalleVenta