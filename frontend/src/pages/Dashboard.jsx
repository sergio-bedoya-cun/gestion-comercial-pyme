import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid,
         Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import KPICard from '../components/ui/KPICard'
import { getResumenVentas, getVentasPorDia } from '../services/ventas'
import { getAlertasStock } from '../services/productos'

const fmt = n => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(n)

export default function Dashboard() {
  const [resumen,  setResumen]  = useState(null)
  const [porDia,   setPorDia]   = useState([])
  const [alertas,  setAlertas]  = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    Promise.all([
      getResumenVentas(),
      getVentasPorDia(30),
      getAlertasStock()
    ]).then(([r, d, a]) => {
      setResumen(r.data)
      setPorDia(d.data.map(x => ({
        ...x,
        dia: x.dia.slice(5),          // mostrar solo MM-DD
        ingresos: x.ingresos / 1000   // en miles para la gráfica
      })))
      setAlertas(a.data)
    }).finally(() => setLoading(false))
  }, [])

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
        <KPICard
          titulo="Total Ventas"
          valor={resumen?.total_ventas?.toLocaleString('es-CO')}
          subtitulo="Últimos 12 meses"
          color="blue" icono="🧾"
        />
        <KPICard
          titulo="Ingresos Totales"
          valor={fmt(resumen?.ingresos_total)}
          subtitulo="Últimos 12 meses"
          color="green" icono="💰"
        />
        <KPICard
          titulo="Ticket Promedio"
          valor={fmt(resumen?.ticket_promedio)}
          subtitulo="Por transacción"
          color="amber" icono="📈"
        />
        <KPICard
          titulo="Alertas de Stock"
          valor={alertas.length}
          subtitulo="Productos bajo mínimo"
          color={alertas.length > 0 ? 'red' : 'green'} icono="⚠️"
        />
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
                   className="flex justify-between text-sm text-red-600 bg-white
                              rounded-lg px-4 py-2 border border-red-100">
                <span>Producto #{a.producto_id}</span>
                <span>Stock: {a.cantidad} / Mínimo: {a.stock_minimo}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}