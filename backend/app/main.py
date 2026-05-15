from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
import app.models

Base.metadata.create_all(bind=engine)

from app.routers import ventas, productos, inventario, predicciones

app = FastAPI(
    title="Sistema de Gestión Comercial",
    description="API para gestión de ventas, inventario y predicción de demanda",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ventas.router)
app.include_router(productos.router)
app.include_router(inventario.router)
app.include_router(predicciones.router)

@app.get("/")
def root():
    return {"mensaje": "API activa", "version": "1.0.0"}

@app.get("/health")
def health():
    return {"status": "ok"}