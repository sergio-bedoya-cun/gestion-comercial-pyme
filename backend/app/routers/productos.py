from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from app.database import get_db
from app.models.producto import Producto, Categoria
from app.models.inventario import Inventario
from app.schemas.producto import ProductoCreate, ProductoOut, InventarioOut
from fastapi import APIRouter, Depends, HTTPException
from app.schemas.producto import ProductoCreate
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/productos", tags=["Productos"])

@router.get("/", response_model=List[ProductoOut])
def listar_productos(solo_activos: bool = True, db: Session = Depends(get_db)):
    q = db.query(Producto)
    if solo_activos:
        q = q.filter(Producto.activo == True)
    return q.order_by(Producto.nombre).all()

@router.get("/{producto_id}", response_model=ProductoOut)
def obtener_producto(producto_id: int, db: Session = Depends(get_db)):
    prod = db.query(Producto).filter(Producto.id == producto_id).first()
    if not prod:
        raise HTTPException(404, "Producto no encontrado")
    return prod

@router.post("/", response_model=ProductoOut, status_code=201)
def crear_producto(prod_in: ProductoCreate, db: Session = Depends(get_db)):
    existente = db.query(Producto).filter(Producto.codigo == prod_in.codigo).first()
    if existente:
        raise HTTPException(400, f"Ya existe un producto con código {prod_in.codigo}")
    prod = Producto(**prod_in.model_dump())
    db.add(prod)
    db.flush()
    # Crear inventario vacío automáticamente
    inv = Inventario(producto_id=prod.id, cantidad=0, stock_minimo=5)
    db.add(inv)
    db.commit()
    db.refresh(prod)
    return prod

@router.get("/inventario/alertas")
def alertas_stock(db: Session = Depends(get_db)):
    items = (db.query(Inventario)
               .filter(Inventario.cantidad <= Inventario.stock_minimo)
               .all())
    resultado = []
    for i in items:
        prod = db.query(Producto).filter(Producto.id == i.producto_id).first()
        resultado.append({
            "producto_id":   i.producto_id,
            "nombre":        prod.nombre if prod else None,
            "codigo":        prod.codigo if prod else None,
            "cantidad":      i.cantidad,
            "stock_minimo":  i.stock_minimo,
            "unidad_medida": i.unidad_medida,
            "alerta":        True
        })
    return resultado

class ProductoUpdate(BaseModel):
    nombre:        Optional[str]   = None
    precio_compra: Optional[float] = None
    precio_venta:  Optional[float] = None
    categoria_id:  Optional[int]   = None
    descripcion:   Optional[str]   = None
    activo:        Optional[bool]  = None

@router.put("/{producto_id}", response_model=ProductoOut)
def actualizar_producto(
    producto_id: int,
    datos: ProductoUpdate,
    db:    Session = Depends(get_db)
):
    prod = db.query(Producto).filter(Producto.id == producto_id).first()
    if not prod:
        raise HTTPException(404, "Producto no encontrado")
    for campo, valor in datos.model_dump(exclude_none=True).items():
        setattr(prod, campo, valor)
    db.commit()
    db.refresh(prod)
    return prod

@router.delete("/{producto_id}")
def eliminar_producto(producto_id: int, db: Session = Depends(get_db)):
    prod = db.query(Producto).filter(Producto.id == producto_id).first()
    if not prod:
        raise HTTPException(404, "Producto no encontrado")
    prod.activo = False   # soft delete — no borra el historial de ventas
    db.commit()
    return {"mensaje": f"Producto '{prod.nombre}' desactivado correctamente"}