from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.inventario import Inventario, MovimientoInventario
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/inventario", tags=["Inventario"])

class MovimientoIn(BaseModel):
    tipo:     str           # entrada | salida | ajuste
    cantidad: float
    motivo:   Optional[str] = None

@router.get("/")
def listar_inventario(db: Session = Depends(get_db)):
    from app.models.producto import Producto
    items = db.query(Inventario).all()
    resultado = []
    for i in items:
        prod = db.query(Producto).filter(Producto.id == i.producto_id).first()
        resultado.append({
            "producto_id":   i.producto_id,
            "nombre":        prod.nombre if prod else f"Producto #{i.producto_id}",
            "codigo":        prod.codigo if prod else "—",
            "activo":        prod.activo if prod else False,
            "cantidad":      i.cantidad,
            "stock_minimo":  i.stock_minimo,
            "stock_maximo":  i.stock_maximo,
            "unidad_medida": i.unidad_medida,
        })
    return resultado

@router.post("/{producto_id}/movimiento")
def registrar_movimiento(
    producto_id: int,
    mov: MovimientoIn,
    db: Session = Depends(get_db)
):
    inv = db.query(Inventario).filter(
        Inventario.producto_id == producto_id).first()
    if not inv:
        raise HTTPException(404, "Producto no encontrado en inventario")

    if mov.tipo == "entrada":
        inv.cantidad += mov.cantidad
    elif mov.tipo == "salida":
        if inv.cantidad < mov.cantidad:
            raise HTTPException(400, "Stock insuficiente para esta salida")
        inv.cantidad -= mov.cantidad
    elif mov.tipo == "ajuste":
        inv.cantidad = mov.cantidad
    else:
        raise HTTPException(400, "Tipo debe ser: entrada, salida o ajuste")

    movimiento = MovimientoInventario(
        inventario_id = inv.id,
        tipo          = mov.tipo,
        cantidad      = mov.cantidad,
        motivo        = mov.motivo
    )
    db.add(movimiento)
    db.commit()
    db.refresh(inv)
    return {"mensaje": "Movimiento registrado", "stock_actual": inv.cantidad}

@router.get("/{producto_id}/movimientos")
def historial_movimientos(
    producto_id: int,
    limite:      int     = 20,
    db:          Session = Depends(get_db)
):
    inv = db.query(Inventario).filter(
        Inventario.producto_id == producto_id).first()
    if not inv:
        raise HTTPException(404, "Producto no encontrado en inventario")

    movs = (db.query(MovimientoInventario)
              .filter(MovimientoInventario.inventario_id == inv.id)
              .order_by(MovimientoInventario.fecha.desc())
              .limit(limite)
              .all())

    return [{
        "id":       m.id,
        "tipo":     m.tipo,
        "cantidad": m.cantidad,
        "motivo":   m.motivo,
        "fecha":    m.fecha
    } for m in movs]