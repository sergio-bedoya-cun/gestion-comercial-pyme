import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid,
         Tooltip, ResponsiveContainer, Legend,
         BarChart, Bar } from 'recharts'
import api from '../services/api'

const fmt     = n => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(n)
const fmtNum  = n => new Intl.NumberFormat('es-CO').format(n)

// ── Tarjeta de métrica operacional ───────────────────────────────────────────
function MetricaCard({ titulo, sin, con, reduccion, unidad = '' }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <p className="text-sm font-medium text-slate-500 mb-3">{titulo}</p>
      <div className="flex justify-between items-end">
        <div>
          <p className="text-xs text-slate-400">Sin predicción</p>
          <p className="text-lg font-bold text-red-500">
            {fmtNum(sin)}{unidad}
          </p>
        </div>
        <div className="text-center px-3">
          <p className="text-2xl">→</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Con predicción</p>
          <p className="text-lg font-bold text-green-600">
            {fmtNum(con)}{unidad}
          </p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-slate-100">
        <span className="inline-flex items-center gap-1 bg-green-50
                         text-green-700 px-2 py-1 rounded-full text-xs
                         font-semibold">
          ↓ {reduccion}% de reducción
        </span>
      </div>
    </div>
  )
}

export default function Predicciones() {
  const [comparacion,  setComparacion]  = useState(null)
  const [forecast,     setForecast]     = useState(null)
  const [horizonte,    setHorizonte]    = useState(30)
  const [loading,      setLoading]      = useState(true)
  const [loadingPred,  setLoadingPred]  = useState(false)
  const [error,        setError]        = useState('')

  useEffect(() => {
    api.get('/predicciones/comparacion-completa')
      .then(r => setComparacion(r.data))
      .catch(() => setError(
        'Ejecuta los notebooks 02 y 03 para ver los resultados'))
      .finally(() => setLoading(false))
  }, [])

  const generarForecast = async () => {
    setLoadingPred(true)
    try {
      const r = await api.get(`/predicciones/prophet?horizonte=${horizonte}`)
      const historico  = r.data.historico.map(h => ({
        dia:   String(h.ds).slice(0, 10),
        real:  Math.round(h.real / 1000),
      }))
      const prediccion = r.data.prediccion.map(p => ({
        dia:   String(p.ds).slice(0, 10),
        pred:  Math.round(p.yhat / 1000),
        lower: Math.round(p.yhat_lower / 1000),
        upper: Math.round(p.yhat_upper / 1000),
      }))
      setForecast({ historico, prediccion,
                    total: r.data.total_predicho })
    } catch (e) {
      setError('Error generando predicción')
    } finally {
      setLoadingPred(false)
    }
  }

  const coloresModelo = {
    Prophet: '#8b5cf6',
    SARIMA:  '#ef4444',
    XGBoost: '#10b981'
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-slate-400">Cargando resultados...</p>
    </div>
  )

  const ml  = comparacion?.metricas_ml  ?? []
  const ops = comparacion?.metricas_operacionales ?? {}

  // Datos para gráfica de barras comparativa
  const datosMAE = ml.map(m => ({
    modelo: m.modelo,
    MAE:    Math.round(m.MAE),
    RMSE:   Math.round(m.RMSE),
    MAPE:   Math.round(m.MAPE * 10) / 10,
  }))

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">
          Módulo Predictivo
        </h2>
        <p className="text-slate-500 mt-1">
          Comparación Prophet vs SARIMA vs XGBoost —
          análisis de impacto operacional
        </p>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4
                        text-amber-700 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* ── Sección 1: Comparación de modelos ML ── */}
      <section>
        <h3 className="text-lg font-semibold text-slate-700 mb-4">
          1. Métricas de precisión de los modelos
        </h3>

        {/* Tabla */}
        <div className="bg-white border border-slate-200 rounded-xl
                        overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
              <tr>
                <th className="px-5 py-3 text-left">Modelo</th>
                <th className="px-5 py-3 text-right">MAE (COP)</th>
                <th className="px-5 py-3 text-right">RMSE (COP)</th>
                <th className="px-5 py-3 text-right">MAPE %</th>
                <th className="px-5 py-3 text-center">Ranking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...ml]
                .sort((a, b) => a.MAE - b.MAE)
                .map((m, i) => (
                <tr key={m.modelo}
                    className={i === 0 ? 'bg-green-50' : 'hover:bg-slate-50'}>
                  <td className="px-5 py-3 font-semibold"
                      style={{ color: coloresModelo[m.modelo] }}>
                    {m.modelo}
                  </td>
                  <td className="px-5 py-3 text-right font-mono">
                    {fmt(m.MAE)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono">
                    {fmt(m.RMSE)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono">
                    {m.MAPE.toFixed(1)}%
                  </td>
                  <td className="px-5 py-3 text-center">
                    {i === 0 && (
                      <span className="bg-green-100 text-green-700 px-2 py-1
                                       rounded-full text-xs font-semibold">
                        ✓ Mejor
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Gráfica barras MAE */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h4 className="font-medium text-slate-600 mb-4">
            MAE comparativo (menor es mejor)
          </h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={datosMAE} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"
                             horizontal={false}/>
              <XAxis type="number" tick={{ fontSize: 11 }}
                     tickFormatter={v => `$${(v/1000).toFixed(0)}k`}/>
              <YAxis type="category" dataKey="modelo" width={70}
                     tick={{ fontSize: 12, fontWeight: 600 }}/>
              <Tooltip formatter={v => [fmt(v), 'MAE']} />
              <Bar dataKey="MAE" radius={[0,4,4,0]}
                   fill="#3b82f6"
                   label={{ position: 'right', fontSize: 11,
                            formatter: v => `$${(v/1000).toFixed(0)}k` }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ── Sección 2: Métricas operacionales ── */}
      {Object.keys(ops).length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">
            2. Impacto operacional simulado
          </h3>
          <p className="text-slate-400 text-sm mb-4">
            Simulación de 365 días comparando política reactiva
            (sin predicción) vs política proactiva (con predicción)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricaCard
              titulo="Quiebres de stock"
              sin={ops.total_quiebres_sin_prediccion}
              con={ops.total_quiebres_con_prediccion}
              reduccion={ops.reduccion_quiebres_pct}
            />
            <MetricaCard
              titulo="Unidades perdidas por quiebre"
              sin={ops.unidades_perdidas_sin_prediccion}
              con={ops.unidades_perdidas_con_prediccion}
              reduccion={ops.reduccion_perdidas_pct}
              unidad=" uds"
            />
            <MetricaCard
              titulo="Sobreinventario promedio"
              sin={ops.exceso_inventario_sin}
              con={ops.exceso_inventario_con}
              reduccion={ops.reduccion_sobreinventario_pct}
              unidad=" uds"
            />
          </div>
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl
                          p-4 flex items-center gap-3">
            <span className="text-2xl">📦</span>
            <p className="text-sm text-blue-700">
                <strong>Trade-off inventario-servicio:</strong>{' '}
                La política proactiva reduce quiebres en {ops.reduccion_quiebres_pct}%
                manteniendo un mayor stock de seguridad, comportamiento esperado
                según la teoría clásica de gestión de inventarios.
            </p>
          </div>
        </section>
      )}

      {/* ── Sección 3: Forecast interactivo ── */}
      <section>
        <h3 className="text-lg font-semibold text-slate-700 mb-4">
          3. Forecast de ingresos — Prophet
        </h3>
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-4 mb-6">
            <div>
              <label className="text-sm font-medium text-slate-600">
                Horizonte de predicción
              </label>
              <select
                value={horizonte}
                onChange={e => setHorizonte(parseInt(e.target.value))}
                className="ml-3 border border-slate-200 rounded-lg px-3 py-1.5
                           text-sm focus:outline-none focus:ring-2
                           focus:ring-purple-500"
              >
                <option value={7}>7 días</option>
                <option value={14}>14 días</option>
                <option value={30}>30 días</option>
                <option value={60}>60 días</option>
                <option value={90}>90 días</option>
              </select>
            </div>
            <button
              onClick={generarForecast}
              disabled={loadingPred}
              className="px-5 py-2 text-sm font-medium bg-purple-600 text-white
                         rounded-lg hover:bg-purple-700 disabled:opacity-50
                         transition-colors"
            >
              {loadingPred ? 'Calculando...' : '🔮 Generar forecast'}
            </button>
            {forecast && (
              <div className="ml-auto text-right">
                <p className="text-xs text-slate-400">
                  Total predicho {horizonte} días
                </p>
                <p className="text-lg font-bold text-purple-600">
                  {fmt(forecast.total)}
                </p>
              </div>
            )}
          </div>

          {forecast ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={[
                ...forecast.historico.map(h => ({ ...h, tipo: 'histórico' })),
                ...forecast.prediccion.map(p => ({ ...p, tipo: 'predicción' }))
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="dia" tick={{ fontSize: 10 }}
                       interval={6} angle={-30} textAnchor="end" height={45}/>
                <YAxis tick={{ fontSize: 11 }}
                       tickFormatter={v => `$${v}k`}/>
                <Tooltip formatter={(v, n) => [`$${v}k`, n]} />
                <Legend />
                <Line type="monotone" dataKey="real"
                      stroke="#64748b" strokeWidth={1.5}
                      dot={false} name="Real histórico" />
                <Line type="monotone" dataKey="pred"
                      stroke="#8b5cf6" strokeWidth={2.5}
                      dot={false} name="Predicción Prophet"
                      strokeDasharray="6 3"/>
                <Line type="monotone" dataKey="upper"
                      stroke="#c4b5fd" strokeWidth={1}
                      strokeDasharray="3 3" dot={false}
                      name="Intervalo confianza" />
                <Line type="monotone" dataKey="lower"
                      stroke="#c4b5fd" strokeWidth={1}
                      strokeDasharray="3 3" dot={false} legendType="none"/>
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center
                            text-slate-400">
              <div className="text-center">
                <p className="text-4xl mb-3">🔮</p>
                <p>Selecciona el horizonte y genera el forecast</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}