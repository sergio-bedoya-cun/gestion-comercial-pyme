import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend, Cell
} from 'recharts'
import {
  getProductosMasVendidos, getVentasPorPeriodo,
  getRotacionInventario,   getResumenEjecutivo
} from '../services/reportes'

const fmt    = n => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(n)
const fmtNum = n => new Intl.NumberFormat('es-CO').format(n)

const COLORES = ['#3b82f6','#8b5cf6','#10b981','#f59e0b',
                 '#ef4444','#06b6d4','#84cc16','#f97316',
                 '#ec4899','#6366f1']

// ── Tarjeta de variación ─────────────────────────────────────────────────────
function VariacionBadge({ valor }) {
  const positivo = valor >= 0
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                      ${positivo
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-600'}`}>
      {positivo ? '▲' : '▼'} {Math.abs(valor)}%
    </span>
  )
}

// ── Exportar CSV ─────────────────────────────────────────────────────────────
function exportarCSV(datos, nombre) {
  if (!datos || datos.length === 0) return

  const escapar = val => {
    const str = String(val ?? '')
    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  // Punto y coma como separador — estándar Excel en español
  const SEP     = ';'
  const headers = Object.keys(datos[0]).map(escapar).join(SEP)
  const filas   = datos.map(r =>
    Object.values(r).map(escapar).join(SEP)
  ).join('\n')

  const BOM  = '\uFEFF'
  const blob = new Blob([BOM + headers + '\n' + filas],
                        { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${nombre}_${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Reportes() {
  const [resumen,    setResumen]    = useState(null)
  const [masVendidos,setMasVendidos]= useState([])
  const [porPeriodo, setPorPeriodo] = useState([])
  const [rotacion,   setRotacion]   = useState([])
  const [periodo,    setPeriodo]    = useState('mensual')
  const [loading,    setLoading]    = useState(true)

  const cargarDatos = async (p = periodo) => {
    setLoading(true)
    try {
      const [res, mv, pp, rot] = await Promise.all([
        getResumenEjecutivo(),
        getProductosMasVendidos(10),
        getVentasPorPeriodo(p),
        getRotacionInventario()
      ])
      setResumen(res.data)
      setMasVendidos(mv.data.map((d, i) => ({ ...d, fill: COLORES[i % COLORES.length] })))
      setPorPeriodo(pp.data.map(d => ({
        ...d,
        ingresos_k: Math.round(d.ingresos / 1000)
      })))
      setRotacion(rot.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargarDatos() }, [])

  const cambiarPeriodo = p => {
    setPeriodo(p)
    cargarDatos(p)
  }

  const rotacionColor = estado =>
    estado === 'alto'   ? 'bg-green-100 text-green-700' :
    estado === 'normal' ? 'bg-blue-100 text-blue-700'   :
                          'bg-amber-100 text-amber-700'

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-slate-400">Cargando reportes...</p>
    </div>
  )

  return (
    <div className="space-y-8">

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Reportes</h2>
          <p className="text-slate-500 mt-1">
            Análisis de rendimiento y exportación de datos
          </p>
        </div>
        <button
          onClick={() => exportarCSV(
            masVendidos.map(({ fill, ...resto }) => resto),
            'productos_mas_vendidos'
          )}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium
                    border border-slate-200 rounded-lg hover:bg-slate-50
                    transition-colors text-slate-600"
        >
          ⬇ Exportar CSV
        </button>
      </div>

      {/* ── Resumen ejecutivo ── */}
      {resumen && (
        <section>
          <h3 className="text-lg font-semibold text-slate-700 mb-4">
            Resumen ejecutivo — últimos 30 días
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {[{
              label:     'Ventas realizadas',
              actual:    fmtNum(resumen.actual.ventas),
              anterior:  fmtNum(resumen.anterior.ventas),
              variacion: resumen.variacion_ventas,
              icono:     '🧾'
            }, {
              label:     'Ingresos totales',
              actual:    fmt(resumen.actual.ingresos),
              anterior:  fmt(resumen.anterior.ingresos),
              variacion: resumen.variacion_ingresos,
              icono:     '💰'
            }, {
              label:     'Ticket promedio',
              actual:    fmt(resumen.actual.ticket_promedio),
              anterior:  fmt(resumen.anterior.ticket_promedio),
              variacion: resumen.variacion_ticket,
              icono:     '📈'
            }].map(k => (
              <div key={k.label}
                   className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{k.icono}</span>
                  <VariacionBadge valor={k.variacion} />
                </div>
                <p className="text-2xl font-bold text-slate-800">{k.actual}</p>
                <p className="text-sm font-medium text-slate-500 mt-1">
                  {k.label}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Mes anterior: {k.anterior}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Productos más vendidos ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-700">
            Productos más vendidos
          </h3>
          <button
            onClick={() => exportarCSV(
              masVendidos.map(({ fill, ...resto }) => resto),
              'productos_mas_vendidos'
            )}
            className="text-xs text-blue-600 hover:underline"
          >
            Exportar CSV
</button>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={masVendidos}
              layout="vertical"
              margin={{ left: 120, right: 80 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"
                            horizontal={false}/>
              <XAxis
                type="number"
                tick={{ fontSize: 11 }}
                tickFormatter={v => `$${(v / 1000000).toFixed(1)}M`}
                domain={[0, 'dataMax']}
              />
              <YAxis
                type="category"
                dataKey="nombre"
                width={115}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(v, n) => [
                  n === 'ingresos_total'
                    ? fmt(v)
                    : fmtNum(v),
                  n === 'ingresos_total' ? 'Ingresos' : 'Unidades'
                ]}
              />
              <Bar dataKey="ingresos_total" radius={[0, 4, 4, 0]}
                  label={{
                    position: 'right',
                    fontSize: 10,
                    formatter: v => `$${(v / 1000000).toFixed(1)}M`
                  }}>
                {masVendidos.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ── Ventas por período ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-700">
            Ventas por período
          </h3>
          <div className="flex gap-2">
            {['diario', 'semanal', 'mensual'].map(p => (
              <button
                key={p}
                onClick={() => cambiarPeriodo(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg
                            capitalize transition-colors border
                            ${periodo === p
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
              >{p}</button>
            ))}
            <button
              onClick={() => exportarCSV(porPeriodo, `ventas_${periodo}`)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border
                         border-slate-200 text-slate-600 hover:bg-slate-50"
            >⬇ CSV</button>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={porPeriodo}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="periodo" tick={{ fontSize: 10 }}
                     interval={periodo === 'diario' ? 6 : 0}
                     angle={-30} textAnchor="end" height={45}/>
              <YAxis tick={{ fontSize: 11 }}
                     tickFormatter={v => `$${v}k`}/>
              <Tooltip
                formatter={(v, n) => [
                  n === 'ingresos_k' ? `$${v}k COP` : fmtNum(v),
                  n === 'ingresos_k' ? 'Ingresos' : 'Ventas'
                ]}
              />
              <Legend />
              <Line type="monotone" dataKey="ingresos_k"
                    stroke="#3b82f6" strokeWidth={2}
                    dot={periodo !== 'diario'}
                    name="Ingresos (miles COP)" />
              <Line type="monotone" dataKey="cantidad_ventas"
                    stroke="#10b981" strokeWidth={2}
                    dot={periodo !== 'diario'}
                    name="Cantidad de ventas" yAxisId="right"  />
              <YAxis yAxisId="right" orientation="right"
                    tick={{ fontSize: 11 }}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ── Rotación de inventario ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-700">
            Rotación de inventario — últimos 30 días
          </h3>
          <button
            onClick={() => exportarCSV(rotacion, 'rotacion_inventario')}
            className="text-xs text-blue-600 hover:underline"
          >
            Exportar CSV
          </button>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Producto</th>
                <th className="px-4 py-3 text-right">Stock actual</th>
                <th className="px-4 py-3 text-right">Vendido 30d</th>
                <th className="px-4 py-3 text-right">Rotación</th>
                <th className="px-4 py-3 text-right">Días p/agotar</th>
                <th className="px-4 py-3 text-center">Nivel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rotacion.map(r => (
                <tr key={r.producto_id}
                    className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{r.nombre}</p>
                    <p className="text-xs text-slate-400 font-mono">{r.codigo}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {fmtNum(r.stock_actual)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {fmtNum(r.vendido_30d)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold
                                 text-slate-800">
                    {r.rotacion_mensual}x
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">
                    {r.dias_agotamiento
                      ? `${fmtNum(r.dias_agotamiento)} días`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs
                                     font-medium capitalize
                                     ${rotacionColor(r.estado)}`}>
                      {r.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  )
}