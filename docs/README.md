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

| Modelo  | MAE        | RMSE        | MAPE filtrado | MAPE completo |
|---------|-----------|-------------|---------------|---------------|
| XGBoost | $82.455   | $106.835    | 46.1%         | 357.2%        |
| SARIMA  | $88.023   | $107.149    | 53.1%         | 265.2%        |
| Prophet | $120.390  | $140.680    | 74.4%         | 341.3%        |

**Métricas operacionales simuladas (365 días):**
- Reducción de quiebres de stock: **96.1%**
- Reducción de unidades perdidas: **96.5%**
- Aumento de stock de seguridad: **133.6%** *(trade-off esperado)*
- Balance económico neto: **$7.066.580 COP** a favor del sistema predictivo

---

## Cómo ejecutar el proyecto

### Requisitos
- Python 3.11
- Node.js 18+
- Git

### Instalación de dependencias

```bash
cd backend
python -m venv venv
venv\Scripts\activate       # Windows
source venv/bin/activate    # Mac/Linux
pip install -r requirements.txt
```

```bash
cd frontend
npm install
```

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
npm run dev
```

Abre `http://localhost:5173` en el navegador.

### Generar datos sintéticos (primera vez)

```bash
# Activar venv primero
cd backend
venv\Scripts\activate       # Windows
source venv/bin/activate    # Mac/Linux
cd ..

# Generar 12 meses de datos e inventario inicial
python ml/data/generar_datos.py

# Opcional — análisis exploratorio (genera gráficas descriptivas)
python ml/notebooks/01_exploracion.py

# Entrenar modelos y calcular métricas (requiere venv activo)
python ml/notebooks/02_modelos.py
python ml/notebooks/03_metricas_operacionales.py
```

### API REST

Documentación Swagger disponible en `http://localhost:8000/docs`  
El sistema expone 26 endpoints distribuidos en 5 módulos funcionales.
