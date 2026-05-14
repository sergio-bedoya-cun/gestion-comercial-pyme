"""
Generador de datos sintéticos realistas para el sistema de gestión comercial.
Simula 12 meses de operación de una tienda de abarrotes/miscelánea pequeña.
"""
import sys
import os

# ── Configurar path ──────────────────────────────────────────────────────────
base = os.path.dirname(os.path.abspath(__file__))
backend_path = os.path.normpath(os.path.join(base, '..', '..', 'backend'))
sys.path.insert(0, backend_path)

# ── Forzar ruta absoluta de la BD ────────────────────────────────────────────
db_path = os.path.join(backend_path, 'gestion_comercial.db')
os.environ['DATABASE_URL'] = f'sqlite:///{db_path}'
print(f"Usando BD en: {db_path}")

import random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.database import engine, SessionLocal, Base
from app.models.usuario import Usuario
from app.models.producto import Categoria, Producto
from app.models.inventario import Inventario, MovimientoInventario
from app.models.venta import Venta, DetalleVenta
import bcrypt as bcrypt_lib

def hash_password(pwd: str) -> str:
    return bcrypt_lib.hashpw(pwd.encode('utf-8'), bcrypt_lib.gensalt()).decode('utf-8')

random.seed(42)
np.random.seed(42)

# Crear tablas si no existen
Base.metadata.create_all(bind=engine)
print("Tablas verificadas.")

db: Session = SessionLocal()

# ── 1. USUARIOS ──────────────────────────────────────────────────────────────
def crear_usuarios():
    usuarios = [
        Usuario(nombre="Admin Principal", email="admin@tienda.com",
                password=hash_password("admin123"), rol="admin"),
        Usuario(nombre="Vendedor 1",      email="vendedor1@tienda.com",
                password=hash_password("vend123"),  rol="vendedor"),
        Usuario(nombre="Vendedor 2",      email="vendedor2@tienda.com",
                password=hash_password("vend123"),  rol="vendedor"),
    ]
    db.add_all(usuarios)
    db.commit()
    print(f"  {len(usuarios)} usuarios creados")
    return usuarios

# ── 2. CATEGORÍAS Y PRODUCTOS ────────────────────────────────────────────────
CATALOGO = {
    "Bebidas":     [("Agua 500ml","AG500",800,1500),("Gaseosa 350ml","GS350",1200,2500),
                    ("Jugo Hit","JH250",900,1800),("Leche 1L","LE1LT",2800,4500)],
    "Snacks":      [("Papas Margarita","PM100",900,1800),("Chitos","CH50",600,1200),
                    ("Galletas Oreo","GO154",1500,2800),("Maní Salado","MN100",700,1400)],
    "Aseo":        [("Jabón Rey","JR200",1200,2500),("Shampoo H&S","SH180",8000,14000),
                    ("Papel Higiénico x4","PH4UN",3500,6500),("Detergente Ariel","DA500",5000,9000)],
    "Confitería":  [("Chocolatina Jet","CJ16",600,1200),("Bon Bon Bum","BB1UN",300,700),
                    ("Chicle Trident","CT5UN",500,1000),("Mentas","ME20",400,800)],
    "Granos":      [("Arroz x500g","AR500",1800,3200),("Lentejas x500g","LN500",2200,3800),
                    ("Frijol x500g","FR500",2500,4200),("Azúcar x500g","AZ500",1600,2800)],
}

def crear_productos():
    categorias_obj = {}
    productos_obj  = []

    for nombre_cat, items in CATALOGO.items():
        cat = Categoria(nombre=nombre_cat, descripcion=f"Categoría {nombre_cat}")
        db.add(cat)
        db.flush()
        categorias_obj[nombre_cat] = cat

        for nombre, codigo, p_compra, p_venta in items:
            prod = Producto(nombre=nombre, codigo=codigo,
                            precio_compra=p_compra, precio_venta=p_venta,
                            categoria_id=cat.id, activo=True)
            db.add(prod)
            db.flush()

            # Inventario inicial entre 20 y 100 unidades
            stock_inicial = random.randint(20, 100)
            inv = Inventario(producto_id=prod.id, cantidad=stock_inicial,
                             stock_minimo=10, stock_maximo=150,
                             unidad_medida="unidad",
                             ultima_entrada=datetime.now())
            db.add(inv)
            productos_obj.append(prod)

    db.commit()
    print(f"  {len(CATALOGO)} categorías y {len(productos_obj)} productos creados")
    return productos_obj

# ── 3. VENTAS CON ESTACIONALIDAD ─────────────────────────────────────────────
def crear_ventas(productos, usuarios):
    """
    Genera ventas diarias durante 12 meses con patrones realistas:
    - Más ventas fines de semana
    - Picos quincenales (días de pago: 15 y 30)
    - Temporada alta diciembre
    - Variación aleatoria diaria
    """
    fecha_inicio = datetime.now() - timedelta(days=365)
    vendedores   = [u for u in usuarios if u.rol == "vendedor"]
    total_ventas = 0

    for dia in range(365):
        fecha = fecha_inicio + timedelta(days=dia)

        # Factores de estacionalidad
        es_finde      = fecha.weekday() >= 5
        es_quincena   = fecha.day in [14, 15, 16, 29, 30, 1]
        es_diciembre  = fecha.month == 12
        es_navidad    = fecha.month == 12 and fecha.day in range(20, 32)

        base = 8
        if es_finde:     base += 4
        if es_quincena:  base += 5
        if es_diciembre: base += 3
        if es_navidad:   base += 6

        n_ventas = max(1, int(np.random.normal(base, 2)))

        for _ in range(n_ventas):
            hora   = random.randint(8, 20)
            minuto = random.randint(0, 59)
            fecha_venta = fecha.replace(hour=hora, minute=minuto)

            n_items  = random.randint(1, 5)
            items    = random.sample(productos, min(n_items, len(productos)))
            total    = 0
            detalles = []

            for prod in items:
                cantidad = random.randint(1, 4)
                # Pequeña variación de precio (±5%)
                precio = prod.precio_venta * random.uniform(0.95, 1.05)
                precio = round(precio / 100) * 100   # redondear a centenas (COP)
                subtotal = cantidad * precio
                total   += subtotal
                detalles.append(DetalleVenta(
                    producto_id     = prod.id,
                    cantidad        = cantidad,
                    precio_unitario = precio,
                    subtotal        = subtotal
                ))

            descuento   = total * random.choice([0, 0, 0, 0.05, 0.10])
            metodo_pago = random.choices(
                ["efectivo","tarjeta","transferencia"],
                weights=[60, 25, 15])[0]

            venta = Venta(
                usuario_id     = random.choice(vendedores).id,
                cliente_nombre = random.choice(
                    [None, "Cliente frecuente", "Juan García",
                     "María López", "Carlos Ruiz", None, None]),
                total          = round(total - descuento),
                descuento      = round(descuento),
                metodo_pago    = metodo_pago,
                estado         = "completada",
                fecha          = fecha_venta
            )
            db.add(venta)
            db.flush()

            for det in detalles:
                det.venta_id = venta.id
                db.add(det)

            total_ventas += 1

        # Commit cada semana para no sobrecargar memoria
        if dia % 7 == 0:
            db.commit()

    db.commit()
    print(f"  {total_ventas} ventas generadas en 365 días")

# ── 4. EJECUTAR TODO ─────────────────────────────────────────────────────────
print("Generando datos sintéticos...")
print("Creando usuarios...")
usuarios  = crear_usuarios()
print("Creando productos e inventario...")
productos = crear_productos()
print("Creando ventas (365 días)...")
crear_ventas(productos, usuarios)

# Resumen
total_ventas_bd  = db.query(Venta).count()
total_ingresos   = db.query(Venta).with_entities(
    __import__('sqlalchemy').func.sum(Venta.total)).scalar()

print("\nResumen final:")
print(f"  Usuarios:  {db.query(Usuario).count()}")
print(f"  Productos: {db.query(Producto).count()}")
print(f"  Ventas:    {total_ventas_bd}")
print(f"  Ingresos totales: ${total_ingresos:,.0f} COP")
db.close()