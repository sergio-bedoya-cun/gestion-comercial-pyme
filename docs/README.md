# Sistema de Gestión Comercial con Analítica Predictiva

**Trabajo de grado — Ingeniería de Sistemas**

Sistema web de gestión comercial orientado a pequeños negocios, con módulo
de analítica predictiva para forecasting de demanda. Compara Prophet vs SARIMA
vs XGBoost sobre series de tiempo de ventas.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | Python 3.11 + FastAPI |
| Frontend | React 18 + TailwindCSS + Recharts |
| Base de datos | SQLite (desarrollo) |
| Módulo predictivo | Prophet · SARIMA · XGBoost |
| Entorno | VS Code local + GitHub |

---

## Módulos del sistema

1. **Dashboard** — KPIs en tiempo real, gráfica de ingresos, alertas de stock y forecast
2. **Ventas** — Registro y historial de transacciones con paginación
3. **Inventario** — Control de stock con alertas y ajuste de movimientos
4. **Productos** — Catálogo con búsqueda y cálculo de margen
5. **Predicciones** — Comparación de modelos ML y métricas operacionales
6. **Reportes** — Dashboard de analítica con exportación PDF y CSV. Incluye resumen ejecutivo, productos más vendidos (últimos 30 días), evolución de ventas por período y rotación de inventario con alertas de stock.

---

## Resultados del módulo predictivo

| Modelo | MAE | RMSE | MAPE |
|--------|-----|------|------|
| XGBoost | $84.266 | $107.552 | 46.7% |
| SARIMA | $88.023 | $107.149 | 53.1% |
| Prophet | $120.390 | $140.680 | 74.4% |

**Métricas operacionales simuladas (365 días):**
- Reducción de quiebres de stock: **97%**
- Reducción de unidades perdidas: **97.8%**
- Aumento de stock de seguridad: **130.8%** *(trade-off esperado)*

---

## Cómo ejecutar el proyecto

### Requisitos
- Python 3.11
- Node.js 18+
- Git

### Backend

```bash
cd backend
venv\Scripts\activate          # Windows
source venv/bin/activate       # Mac/Linux
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Abre `http://localhost:5173` en el navegador.

### Generar datos sintéticos (primera vez)

```bash
# Activar venv
cd backend && venv\Scripts\activate

# Crear tablas
python -c "import sys; sys.path.insert(0,'.'); from app.database import engine, Base; import app.models; Base.metadata.create_all(bind=engine)"

# Generar datos de 12 meses
cd .. && python ml/data/generar_datos.py

# Entrenar modelos y calcular métricas
python ml/notebooks/01_exploracion.py
python ml/notebooks/02_modelos.py
python ml/notebooks/03_metricas_operacionales.py
```

### API REST

Documentación Swagger disponible en `http://localhost:8000/docs`