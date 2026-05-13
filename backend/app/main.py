from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine
import app.models  # registra todos los modelos

# Crea todas las tablas en la BD al iniciar (solo si no existen)
from app.database import Base
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Sistema de Gestión Comercial",
    description="API para gestión de ventas, inventario y predicción de demanda",
    version="1.0.0"
)

# CORS: permite que React (en cualquier puerto) consuma la API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # en producción cambia esto por tu dominio real
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"mensaje": "API de gestión comercial activa", "version": "1.0.0"}

@app.get("/health")
def health():
    return {"status": "ok"}
