# Sistema de Gestión Comercial con Analítica Predictiva

Trabajo de grado — Ingeniería de Sistemas

## Descripción
Sistema web de gestión comercial orientado a pequeños negocios, con módulo
de analítica predictiva para forecasting de demanda. Compara Prophet vs SARIMA
y Prophet vs XGBoost sobre series de tiempo de ventas.

## Stack tecnológico
- **Backend:** Python 3.11 + FastAPI
- **Frontend:** React 18 + TailwindCSS + Recharts  
- **Base de datos:** SQLite (desarrollo) / PostgreSQL (producción)
- **Módulo predictivo:** Prophet, SARIMA, XGBoost
- **Entorno:** Google Colab + GitHub

## Módulos del sistema
1. Dashboard con KPIs en tiempo real
2. Registro y gestión de ventas
3. Gestión de inventario con alertas de stock
4. Catálogo de productos
5. Reportes y visualizaciones exportables
6. Predicción de demanda (núcleo investigativo)

## Ejecución
Ver `docs/instrucciones-colab.md` para ejecutar en Google Colab.
