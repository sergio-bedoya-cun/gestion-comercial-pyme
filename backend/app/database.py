from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# SQLite para desarrollo (archivo local), fácil de cambiar a PostgreSQL
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./gestion_comercial.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}  # solo necesario para SQLite
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependencia para inyectar la sesión en cada endpoint
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
