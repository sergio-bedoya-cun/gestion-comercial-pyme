from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timedelta, date
from typing import Optional
from app.database import get_db
from app.models.venta import Venta, DetalleVenta
from app.models.producto import Producto, Categoria
from app.models.inventario import Inventario

router = APIRouter(prefix="/reportes", tags=["Reportes"])


@router.get("/productos-mas-vendidos")
def productos_mas_vendidos(
    limite:      int            = 10,
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    db:          Session        = Depends(get_db)
):
    q = (db.query(
             Producto.id,
             Producto.nombre,
             Producto.codigo,
             func.sum(DetalleVenta.cantidad).label("unidades_vendidas"),
             func.sum(DetalleVenta.subtotal).label("ingresos_total"))
         .join(DetalleVenta, DetalleVenta.producto_id == Producto.id)
         .join(Venta, Venta.id == DetalleVenta.venta_id)
         .filter(Venta.estado == "completada"))

    if fecha_desde:
        q = q.filter(Venta.fecha >= datetime.combine(fecha_desde, datetime.min.time()))
    if fecha_hasta:
        q = q.filter(Venta.fecha <= datetime.combine(fecha_hasta, datetime.max.time()))

    rows = (q.group_by(Producto.id)
             .order_by(desc("ingresos_total"))
             .limit(limite)
             .all())

    return [{"id": r.id, "nombre": r.nombre, "codigo": r.codigo,
             "unidades_vendidas": round(r.unidades_vendidas, 1),
             "ingresos_total":    round(r.ingresos_total, 0)} for r in rows]


@router.get("/ventas-por-periodo")
def ventas_por_periodo(
    periodo:     str            = Query("diario"),
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    db:          Session        = Depends(get_db)
):
    if periodo == "mensual":
        grupo = func.strftime('%Y-%m', Venta.fecha)
        label = "mes"
    elif periodo == "semanal":
        grupo = func.strftime('%Y-W%W', Venta.fecha)
        label = "semana"
    else:
        grupo = func.date(Venta.fecha)
        label = "dia"

    hoy = datetime.now()

    q = (db.query(
             grupo.label(label),
             func.count(Venta.id).label("cantidad_ventas"),
             func.sum(Venta.total).label("ingresos"),
             func.avg(Venta.total).label("ticket_promedio"))
         .filter(Venta.estado == "completada"))

    if fecha_desde:
        q = q.filter(Venta.fecha >= datetime.combine(fecha_desde,
                                                      datetime.min.time()))
    if fecha_hasta:
        q = q.filter(Venta.fecha <= datetime.combine(fecha_hasta,
                                                      datetime.max.time()))

    # Excluir período en curso (mes/semana incompleto)
    if periodo == "mensual":
        mes_actual = hoy.strftime('%Y-%m')
        q = q.filter(func.strftime('%Y-%m', Venta.fecha) != mes_actual)
    elif periodo == "semanal":
        semana_actual = hoy.strftime('%Y-W%W')
        q = q.filter(func.strftime('%Y-W%W', Venta.fecha) != semana_actual)
    elif periodo == "diario":
        q = q.filter(func.date(Venta.fecha) != func.date(hoy))

    rows = q.group_by(grupo).order_by(grupo).all()

    return [{"periodo":         str(r[0]),
             "cantidad_ventas": r.cantidad_ventas,
             "ingresos":        round(r.ingresos, 0),
             "ticket_promedio": round(r.ticket_promedio, 0)} for r in rows]


@router.get("/rotacion-inventario")
def rotacion_inventario(db: Session = Depends(get_db)):
    """
    Rotación = unidades vendidas en 30 días / stock actual
    Indica cuántas veces se renueva el inventario por mes
    """
    desde = datetime.now() - timedelta(days=30)

    ventas_30d = (db.query(
                      DetalleVenta.producto_id,
                      func.sum(DetalleVenta.cantidad).label("vendido_30d"))
                  .join(Venta, Venta.id == DetalleVenta.venta_id)
                  .filter(Venta.fecha >= desde, Venta.estado == "completada")
                  .group_by(DetalleVenta.producto_id)
                  .all())

    ventas_dict = {r.producto_id: r.vendido_30d for r in ventas_30d}

    inventario = (db.query(Inventario, Producto)
                  .join(Producto, Producto.id == Inventario.producto_id)
                  .all())

    resultado = []
    for inv, prod in inventario:
        vendido = ventas_dict.get(prod.id, 0)
        stock   = inv.cantidad
        rotacion = round(vendido / stock, 2) if stock > 0 else 0
        dias_agotamiento = round(stock / (vendido / 30), 0) \
                           if vendido > 0 else None

        resultado.append({
            "producto_id":      prod.id,
            "nombre":           prod.nombre,
            "codigo":           prod.codigo,
            "stock_actual":     stock,
            "vendido_30d":      round(vendido, 1),
            "rotacion_mensual": rotacion,
            "dias_agotamiento": dias_agotamiento,
            "estado":           "alto" if rotacion >= 1.5
                                else "normal" if rotacion >= 0.5
                                else "bajo"
        })

    return sorted(resultado, key=lambda x: x["rotacion_mensual"], reverse=True)


@router.get("/resumen-ejecutivo")
def resumen_ejecutivo(db: Session = Depends(get_db)):
    """KPIs ejecutivos para el encabezado del reporte"""
    hoy       = datetime.now()
    hace_30d  = hoy - timedelta(days=30)
    hace_60d  = hoy - timedelta(days=60)

    def kpis_periodo(desde, hasta):
        q = db.query(
                func.count(Venta.id),
                func.sum(Venta.total),
                func.avg(Venta.total)
            ).filter(Venta.fecha >= desde,
                     Venta.fecha <= hasta,
                     Venta.estado == "completada").first()
        return {
            "ventas":          q[0] or 0,
            "ingresos":        round(q[1] or 0, 0),
            "ticket_promedio": round(q[2] or 0, 0)
        }

    actual   = kpis_periodo(hace_30d, hoy)
    anterior = kpis_periodo(hace_60d, hace_30d)

    def variacion(actual, anterior):
        if anterior == 0:
            return 0
        return round((actual - anterior) / anterior * 100, 1)

    return {
        "periodo":          "Últimos 30 días",
        "actual":           actual,
        "anterior":         anterior,
        "variacion_ventas": variacion(actual["ventas"],   anterior["ventas"]),
        "variacion_ingresos": variacion(actual["ingresos"], anterior["ingresos"]),
        "variacion_ticket": variacion(actual["ticket_promedio"],
                                      anterior["ticket_promedio"])
    }