from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date
from typing import Optional, List
from app.database import get_db
from app.models.venta import Venta, DetalleVenta
from app.models.producto import Producto
from app.models.inventario import Inventario
from app.schemas.venta import VentaCreate, VentaOut, VentaResumen
from sqlalchemy.orm import joinedload
from datetime import timedelta

router = APIRouter(prefix="/ventas", tags=["Ventas"])

@router.get("/", response_model=List[VentaOut])
def listar_ventas(
    skip:        int            = 0,
    limit:       int            = 50,
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    db:          Session        = Depends(get_db)
):
    q = (db.query(Venta)
           .filter(Venta.estado == "completada")
           .options(joinedload(Venta.detalles)))
    if fecha_desde:
        q = q.filter(Venta.fecha >= datetime.combine(fecha_desde, datetime.min.time()))
    if fecha_hasta:
        q = q.filter(Venta.fecha <= datetime.combine(fecha_hasta, datetime.max.time()))
    return q.order_by(Venta.fecha.desc()).offset(skip).limit(limit).all()

@router.get("/resumen", response_model=VentaResumen)
def resumen_ventas(
    dias:        int            = 365,
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    db:          Session        = Depends(get_db)
):
    desde = datetime.now() - timedelta(days=dias) if not fecha_desde else \
            datetime.combine(fecha_desde, datetime.min.time())

    q = db.query(Venta).filter(Venta.estado == "completada",
                                Venta.fecha >= desde)
    if fecha_hasta:
        q = q.filter(Venta.fecha <= datetime.combine(fecha_hasta,
                                                      datetime.max.time()))
    total_ventas    = q.count()
    ingresos_total  = q.with_entities(func.sum(Venta.total)).scalar() or 0
    ticket_promedio = ingresos_total / total_ventas if total_ventas > 0 else 0

    return VentaResumen(
        total_ventas    = total_ventas,
        ingresos_total  = ingresos_total,
        ticket_promedio = round(ticket_promedio, 2)
    )

@router.post("/", response_model=VentaOut, status_code=201)
def crear_venta(venta_in: VentaCreate, db: Session = Depends(get_db)):
    total = 0
    detalles = []

    for item in venta_in.detalles:
        prod = db.query(Producto).filter(Producto.id == item.producto_id).first()
        if not prod:
            raise HTTPException(404, f"Producto {item.producto_id} no encontrado")

        subtotal = item.cantidad * item.precio_unitario
        total   += subtotal
        detalles.append(DetalleVenta(
            producto_id     = item.producto_id,
            cantidad        = item.cantidad,
            precio_unitario = item.precio_unitario,
            subtotal        = subtotal
        ))

        # Descontar del inventario automáticamente
        inv = db.query(Inventario).filter(
            Inventario.producto_id == item.producto_id).first()
        if inv:
            inv.cantidad = max(0, inv.cantidad - item.cantidad)

    total_final = total - venta_in.descuento
    venta = Venta(
        usuario_id     = 1,  # luego se reemplaza con el usuario del JWT
        cliente_nombre = venta_in.cliente_nombre,
        total          = round(total_final),
        descuento      = venta_in.descuento,
        metodo_pago    = venta_in.metodo_pago,
        estado         = "completada",
        notas          = venta_in.notas
    )
    db.add(venta)
    db.flush()

    for det in detalles:
        det.venta_id = venta.id
        db.add(det)

    db.commit()
    db.refresh(venta)
    return venta

@router.get("/ventas-por-dia")
def ventas_por_dia(dias: int = 30, db: Session = Depends(get_db)):
    """Retorna ventas agrupadas por día — para gráfica del dashboard"""
    desde = datetime.now() - timedelta(days=dias)
    rows = (db.query(
                func.date(Venta.fecha).label("dia"),
                func.count(Venta.id).label("cantidad"),
                func.sum(Venta.total).label("ingresos"))
            .filter(Venta.fecha >= desde, Venta.estado == "completada")
            .group_by(func.date(Venta.fecha))
            .order_by(func.date(Venta.fecha))
            .all())
    return [{"dia": str(r.dia), "cantidad": r.cantidad,
             "ingresos": r.ingresos} for r in rows]

@router.get("/{venta_id}", response_model=VentaOut)
def obtener_venta(venta_id: int, db: Session = Depends(get_db)):
    venta = db.query(Venta).filter(Venta.id == venta_id).first()
    if not venta:
        raise HTTPException(404, "Venta no encontrada")
    return venta

@router.get("/{venta_id}/detalle")
def detalle_venta(venta_id: int, db: Session = Depends(get_db)):
    from app.models.producto import Producto
    venta = db.query(Venta).filter(Venta.id == venta_id).first()
    if not venta:
        raise HTTPException(404, "Venta no encontrada")
    detalles = []
    for d in venta.detalles:
        prod = db.query(Producto).filter(Producto.id == d.producto_id).first()
        detalles.append({
            "producto_id":      d.producto_id,
            "nombre_producto":  prod.nombre if prod else f"Producto #{d.producto_id}",
            "codigo":           prod.codigo if prod else "—",
            "cantidad":         d.cantidad,
            "precio_unitario":  d.precio_unitario,
            "subtotal":         d.subtotal
        })
    return {
        "id":            venta.id,
        "fecha":         venta.fecha,
        "cliente_nombre": venta.cliente_nombre,
        "metodo_pago":   venta.metodo_pago,
        "descuento":     venta.descuento,
        "total":         venta.total,
        "detalles":      detalles
    }