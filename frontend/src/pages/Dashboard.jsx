import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid,
         Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import KPICard from '../components/ui/KPICard'
import { getResumenVentas, getVentasPorDia } from '../services/ventas'
import { getAlertasStock } from '../services/productos'
import api from '../services/api'

const fmt = n => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(n)

export default function Dashboard() {
  // ── TODOS los hooks al inicio, sin excepción ──────────────────────────────
  const [resumen,     setResumen]     = useState(null)
  const [porDia,      setPorDia]      = useState([])
  const [alertas,     setAlertas]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [prediccion,  setPrediccion]  = useState([])
  const [loadingPred, setLoadingPred] = useState(false)

  useEffect(() => {
    Promise.all([
      getResumenVentas(),
      getVentasPorDia(30),
      getAlertasStock()
    ]).then(([r, d, a]) => {
      setResumen(r.data)
      setPorDia(d.data.map(x => ({
        ...x,
        dia:      x.dia.slice(5),
        ingresos: x.ingresos / 1000
      })))
      setAlertas(a.data)
    }).finally(() => setLoading(false))
  }, [])

  // ── Funciones después de los hooks ───────────────────────────────────────
  const cargarPrediccion = async () => {
    setLoadingPred(true)
    try {
      const r = await api.get('/predicciones/prophet?horizonte=30')
      setPrediccion(r.data.prediccion.map(p => ({
        dia:   p.ds.slice(0, 10),
        pred:  Math.round(p.yhat / 1000),
        lower: Math.round(p.yhat_lower / 1000),
        upper: Math.round(p.yhat_upper / 1000),
      })))
    } catch (e) {
      console.error('Error cargando predicción:', e)
    } finally {
      setLoadingPred(false)
    }
  }

  // ── El return condicional SIEMPRE al final ────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-slate-500 text-lg">Cargando dashboard...</div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
        <p className="text-slate-500 mt-1">Resumen general del negocio</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard titulo="Total Ventas"
          valor={resumen?.total_ventas?.toLocaleString('es-CO')}
          subtitulo="Últimos 12 meses" color="blue" icono="🧾" />
        <KPICard titulo="Ingresos Totales"
          valor={fmt(resumen?.ingresos_total)}
          subtitulo="Últimos 12 meses" color="green" icono="💰" />
        <KPICard titulo="Ticket Promedio"
          valor={fmt(resumen?.ticket_promedio)}
          subtitulo="Por transacción" color="amber" icono="📈" />
        <KPICard titulo="Alertas de Stock"
          valor={alertas.length}
          subtitulo="Productos bajo mínimo"
          color={alertas.length > 0 ? 'red' : 'green'} icono="⚠️" />
      </div>

      {/* Gráfica de ingresos */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-700 mb-4">
          Ingresos últimos 30 días (miles COP)
        </h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={porDia}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="dia" tick={{ fontSize: 11 }} interval={4} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(v) => [`$${v.toFixed(0)}k`, 'Ingresos']}
              labelStyle={{ color: '#334155' }}
            />
            <Bar dataKey="ingresos" fill="#3b82f6" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Alertas de stock */}
      {alertas.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <h3 className="font-semibold text-red-700 mb-3">
            ⚠️ Productos con stock bajo ({alertas.length})
          </h3>
          <div className="space-y-2">
            {alertas.map(a => (
              <div key={a.producto_id}
                   className="flex justify-between text-sm text-red-600
                              bg-white rounded-lg px-4 py-2 border border-red-100">
                <span>Producto #{a.producto_id}</span>
                <span>Stock: {a.cantidad} / Mínimo: {a.stock_minimo}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Módulo de predicción */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-700">
              Predicción de demanda — Prophet
            </h3>
            <p className="text-slate-400 text-sm mt-0.5">
              Próximos 30 días (miles COP)
            </p>
          </div>
          <button
            onClick={cargarPrediccion}
            disabled={loadingPred}
            className="px-4 py-2 text-sm font-medium bg-purple-600 text-white
                       rounded-lg hover:bg-purple-700 disabled:opacity-50
                       transition-colors"
          >
            {loadingPred ? 'Calculando...' : '🔮 Generar predicción'}
          </button>
        </div>

        {prediccion.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={prediccion}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="dia" tick={{ fontSize: 10 }}
                     interval={4} angle={-30} textAnchor="end" height={40} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`$${v}k`, '']} />
              <Line type="monotone" dataKey="pred"
                    stroke="#8b5cf6" strokeWidth={2}
                    dot={false} name="Predicción" />
              <Line type="monotone" dataKey="upper"
                    stroke="#c4b5fd" strokeWidth={1}
                    strokeDasharray="4 4" dot={false} name="Límite superior" />
              <Line type="monotone" dataKey="lower"
                    stroke="#c4b5fd" strokeWidth={1}
                    strokeDasharray="4 4" dot={false} name="Límite inferior" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <p className="text-4xl mb-3">🔮</p>
              <p>Haz clic en "Generar predicción" para ver el forecast</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}