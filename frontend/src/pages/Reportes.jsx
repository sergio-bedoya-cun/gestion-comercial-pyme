import { useEffect, useRef, useState } from 'react'
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

function exportarCSV(datos, nombre) {
  if (!datos || datos.length === 0) return
  const escapar = val => {
    const str = String(val ?? '')
    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }
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

// Capturar un div como imagen PNG usando html2canvas
async function capturarGrafico(el) {
  if (!el) return null
  try {
    const { default: html2canvas } = await import('html2canvas')
    const canvas = await html2canvas(el, {
      backgroundColor: '#ffffff',
      scale: 1.5,
      useCORS: true,
      logging: false,
    })
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

export default function Reportes() {
  const [resumen,    setResumen]    = useState(null)
  const [masVendidos,setMasVendidos]= useState([])
  const [porPeriodo, setPorPeriodo] = useState([])
  const [rotacion,   setRotacion]   = useState([])
  const [periodo,    setPeriodo]    = useState('mensual')
  const [loading,    setLoading]    = useState(true)
  const [exportando, setExportando] = useState(false)
  const [loadingVentas, setLoadingVentas] = useState(false)
  const [vistaProductos, setVistaProductos] = useState('ingresos')

  // Filtro de fechas personalizado
  const hoy      = new Date().toISOString().slice(0, 10)
  const hace30d  = (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10) })()
  const hace90d  = (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().slice(0, 10) })()
  const [filtroDesde, setFiltroDesde] = useState(hace90d)
  const [filtroHasta, setFiltroHasta] = useState(hoy)

  // Refs para capturar los gráficos como imagen en el PDF
  // Refs para capturar los gráficos como imagen en el PDF
  const refGraficoProductos = useRef(null)
  const refGraficoPeriodo   = useRef(null)

  // Datos de 12 meses exclusivos para la gráfica del PDF
  const [porPeriodoPDF, setPorPeriodoPDF] = useState([])

  // Calcular fechas de los últimos 30 días
  const getFechas30d = () => {
    const hasta = new Date()
    const desde = new Date()
    desde.setDate(desde.getDate() - 30)
    const toISO = d => d.toISOString().slice(0, 10)
    return { desde: toISO(desde), hasta: toISO(hasta) }
  }

  const exportarPDF = async () => {
    setExportando(true)
    try {
      const { jsPDF }   = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF()
      const hoy = new Date().toLocaleDateString('es-CO', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      })
      const { desde, hasta } = getFechas30d()
      const periodoTexto = `${new Date(desde + 'T00:00:00').toLocaleDateString('es-CO')} – ${new Date(hasta + 'T00:00:00').toLocaleDateString('es-CO')}`

      // ── Portada ──────────────────────────────────────────────────────────
      doc.setFillColor(30, 41, 59)
      doc.rect(0, 0, 220, 38, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('GestionPyme', 14, 14)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text('Reporte Ejecutivo de Rendimiento', 14, 22)
      doc.setFontSize(8)
      doc.setTextColor(148, 163, 184)
      doc.text(`Generado el ${hoy}`, 14, 30)
      doc.text(`Periodo analizado: ${periodoTexto}`, 14, 35)
      doc.setTextColor(30, 41, 59)

      let y = 48

      // ── 1. Resumen ejecutivo ──────────────────────────────────────────────
      if (resumen) {
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text('1. Resumen ejecutivo — ultimos 30 dias', 14, y)
        y += 7
        autoTable(doc, {
          startY: y,
          head: [['Metrica', 'Periodo actual', 'Mes anterior', 'Variacion']],
          body: [
            ['Ventas realizadas',
             resumen.actual.ventas.toLocaleString('es-CO'),
             resumen.anterior.ventas.toLocaleString('es-CO'),
             `${resumen.variacion_ventas > 0 ? '+' : ''}${resumen.variacion_ventas}%`],
            ['Ingresos totales',
             `$${resumen.actual.ingresos.toLocaleString('es-CO')}`,
             `$${resumen.anterior.ingresos.toLocaleString('es-CO')}`,
             `${resumen.variacion_ingresos > 0 ? '+' : ''}${resumen.variacion_ingresos}%`],
            ['Ticket promedio',
             `$${resumen.actual.ticket_promedio.toLocaleString('es-CO')}`,
             `$${resumen.anterior.ticket_promedio.toLocaleString('es-CO')}`,
             `${resumen.variacion_ticket > 0 ? '+' : ''}${resumen.variacion_ticket}%`],
          ],
          styles:       { fontSize: 9, cellPadding: 3 },
          headStyles:   { fillColor: [59, 130, 246], textColor: 255 },
          columnStyles: { 3: { halign: 'center' } },
        })
        y = (doc.lastAutoTable?.finalY ?? y) + 14
      }

      // ── 2. Productos más vendidos: gráfica + tabla ────────────────────────
      if (masVendidos.length > 0) {
        if (y + 20 > doc.internal.pageSize.height - 20) { doc.addPage(); y = 20 }
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text('2. Productos mas vendidos — ultimos 30 dias', 14, y)
        y += 6

        const imgProductos = await capturarGrafico(refGraficoProductos.current)
        if (imgProductos) {
          if (y + 78 > doc.internal.pageSize.height - 20) { doc.addPage(); y = 20 }
          doc.addImage(imgProductos, 'PNG', 14, y, 182, 74)
          y += 79
        }

        if (y + 40 > doc.internal.pageSize.height - 20) { doc.addPage(); y = 20 }
        autoTable(doc, {
          startY: y,
          head: [['#', 'Producto', 'Codigo', 'Unidades (30d)', 'Ingresos (30d)']],
          body: masVendidos.slice(0, 10).map((p, i) => [
            i + 1, p.nombre, p.codigo,
            p.unidades_vendidas.toLocaleString('es-CO'),
            `$${p.ingresos_total.toLocaleString('es-CO')}`
          ]),
          styles:     { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [139, 92, 246], textColor: 255 },
        })
        y = (doc.lastAutoTable?.finalY ?? y) + 14
      }

      // ── 3. Ventas por período: gráfica 12 meses + tabla ──────────────────
      const datosPDF = porPeriodoPDF.length > 0 ? porPeriodoPDF : porPeriodo
      if (datosPDF.length > 0) {
        if (y + 20 > doc.internal.pageSize.height - 20) { doc.addPage(); y = 20 }
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        const labelPer = periodo === 'diario' ? 'diaria'
                       : periodo === 'semanal' ? 'semanal' : 'mensual'
        doc.text('3. Evolucion de ventas — ultimos 12 meses (mensual)', 14, y)
        y += 6

        const imgPeriodo = await capturarGrafico(refGraficoPeriodo.current)
        if (imgPeriodo) {
          if (y + 70 > doc.internal.pageSize.height - 20) { doc.addPage(); y = 20 }
          doc.addImage(imgPeriodo, 'PNG', 14, y, 182, 66)
          y += 71
        }

        if (y + 20 > doc.internal.pageSize.height - 20) { doc.addPage(); y = 20 }
        autoTable(doc, {
          startY: y,
          head: [['Periodo', 'Cantidad ventas', 'Ingresos (COP)', 'Ticket promedio']],
          body: datosPDF.map(r => [
            r.periodo,
            r.cantidad_ventas.toLocaleString('es-CO'),
            `$${r.ingresos.toLocaleString('es-CO')}`,
            `$${r.ticket_promedio.toLocaleString('es-CO')}`
          ]),
          styles:     { fontSize: 8, cellPadding: 2.5 },
          headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        })
        y = (doc.lastAutoTable?.finalY ?? y) + 14
      }

      // ── 4. Rotación de inventario (incluye días p/agotar) ─────────────────
      if (rotacion.length > 0) {
        if (y + 20 > doc.internal.pageSize.height - 20) { doc.addPage(); y = 20 }
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text('4. Rotacion de inventario — top 10', 14, y)
        y += 6
        autoTable(doc, {
          startY: y,
          head: [['Producto', 'Stock', 'Vendido 30d', 'Rotacion', 'Dias p/agotar', 'Nivel']],
          body: rotacion.slice(0, 10).map(r => [
            r.nombre, r.stock_actual, r.vendido_30d,
            `${r.rotacion_mensual}x`,
            r.dias_agotamiento ? `${r.dias_agotamiento.toLocaleString('es-CO')} dias` : '—',
            r.estado
          ]),
          styles:       { fontSize: 9, cellPadding: 3 },
          headStyles:   { fillColor: [16, 185, 129], textColor: 255 },
          columnStyles: { 3: { halign: 'center' }, 4: { halign: 'right' }, 5: { halign: 'center' } },
          didParseCell: data => {
            if (data.column.index === 5 && data.section === 'body') {
              const v = data.cell.raw
              data.cell.styles.textColor =
                v === 'alto'   ? [22, 163, 74]  :
                v === 'normal' ? [37, 99, 235]  : [217, 119, 6]
              data.cell.styles.fontStyle = 'bold'
            }
          }
        })
      }

      // ── Pie de página ─────────────────────────────────────────────────────
      const pageCount = doc.internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(148, 163, 184)
        doc.text(
          `Sistema de Gestion Comercial — Trabajo de Grado | Pagina ${i} de ${pageCount}`,
          14, doc.internal.pageSize.height - 8
        )
      }

      doc.save(`reporte_ejecutivo_${new Date().toISOString().slice(0,10)}.pdf`)
    } finally {
      setExportando(false)
    }
  }

  // Carga los datos principales: resumen, productos y rotación
  // No incluye ventas por período para que cambiar el período no recargue todo
  const cargarDatosPrincipales = async (desde = filtroDesde, hasta = filtroHasta) => {
    setLoading(true)
    try {
      const [res, mv, rot] = await Promise.all([
        getResumenEjecutivo(),
        getProductosMasVendidos(10, desde, hasta),
        getRotacionInventario()
      ])
      setResumen(res.data)
      setMasVendidos(mv.data.map((d, i) => ({ ...d, fill: COLORES[i % COLORES.length] })))
      setRotacion(rot.data)
    } finally {
      setLoading(false)
    }
  }

  // Carga solo la gráfica de ventas por período
  // En mensual fuerza 12 meses; en diario/semanal respeta el filtro activo
  const cargarVentas = async (p = periodo, desde = filtroDesde, hasta = filtroHasta) => {
    setLoadingVentas(true)
    try {
      let desdeEfectivo = desde
      if (p === 'mensual') {
        const hace12m = new Date()
        hace12m.setFullYear(hace12m.getFullYear() - 1)
        desdeEfectivo = hace12m.toISOString().slice(0, 10)
      }
      const pp = await getVentasPorPeriodo(p, desdeEfectivo, hasta)
      const mapped = pp.data.map(d => ({
        ...d,
        ingresos_k: Math.round(d.ingresos / 1000)
      }))
      setPorPeriodo(mapped)
      setPorPeriodoPDF(p === 'mensual' ? mapped : [])
    } finally {
      setLoadingVentas(false)
    }
  }

  useEffect(() => {
    cargarDatosPrincipales()
    cargarVentas()
  }, [])

  const cambiarPeriodo = p => { setPeriodo(p); cargarVentas(p) }
  const aplicarFiltro  = () => { cargarDatosPrincipales(filtroDesde, filtroHasta); cargarVentas(periodo, filtroDesde, filtroHasta) }

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
        <div className="flex gap-2">
          <button
            onClick={() => {
              const fechaHoy = new Date().toISOString().slice(0, 10)
              exportarCSV(masVendidos.map(({ fill, ...r }) => r), 'consolidado_productos_' + fechaHoy)
              if (porPeriodo.length > 0)
                exportarCSV(porPeriodo, 'consolidado_ventas_' + fechaHoy)
              if (rotacion.length > 0)
                exportarCSV(rotacion, 'consolidado_rotacion_' + fechaHoy)
            }}
            title="Exporta tres archivos CSV: productos, ventas por período y rotación"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium
                      border border-slate-200 rounded-lg hover:bg-slate-50
                      transition-colors text-slate-600"
          >
            ⬇ CSV completo
          </button>
          <button
            onClick={exportarPDF}
            disabled={exportando}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium
                      bg-slate-800 text-white rounded-lg hover:bg-slate-900
                      transition-colors disabled:opacity-60 disabled:cursor-wait"
          >
            {exportando ? '⏳ Generando...' : '📄 PDF'}
          </button>
        </div>
      </div>

      {/* ── Filtro de fechas ── */}
      <section className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Desde</label>
            <input
              type="date"
              value={filtroDesde}
              max={filtroHasta}
              onChange={e => setFiltroDesde(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Hasta</label>
            <input
              type="date"
              value={filtroHasta}
              min={filtroDesde}
              max={hoy}
              onChange={e => setFiltroHasta(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={aplicarFiltro}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white
                       rounded-lg hover:bg-blue-700 transition-colors"
          >
            Aplicar filtro
          </button>
          <button
          onClick={() => {
            setFiltroDesde(hace30d)
            setFiltroHasta(hoy)
            cargarDatosPrincipales(hace30d, hoy)
            cargarVentas(periodo, hace30d, hoy)
          }}
            className="px-4 py-2 text-sm font-medium border border-slate-200
                       text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Últimos 30 días
          </button>
          <p className="text-xs text-slate-400 ml-auto">
            Afecta: productos más vendidos y ventas por período
          </p>
        </div>
      </section>

      {/* ── Resumen ejecutivo ── */}
      {resumen && (
        <section>
          <h3 className="text-lg font-semibold text-slate-700 mb-4">
            Resumen ejecutivo — últimos 30 días
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {[{
              label: 'Ventas realizadas', actual: fmtNum(resumen.actual.ventas),
              anterior: fmtNum(resumen.anterior.ventas), variacion: resumen.variacion_ventas, icono: '🧾'
            }, {
              label: 'Ingresos totales', actual: fmt(resumen.actual.ingresos),
              anterior: fmt(resumen.anterior.ingresos), variacion: resumen.variacion_ingresos, icono: '💰'
            }, {
              label: 'Ticket promedio', actual: fmt(resumen.actual.ticket_promedio),
              anterior: fmt(resumen.anterior.ticket_promedio), variacion: resumen.variacion_ticket, icono: '📈'
            }].map(k => (
              <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{k.icono}</span>
                  <VariacionBadge valor={k.variacion} />
                </div>
                <p className="text-2xl font-bold text-slate-800">{k.actual}</p>
                <p className="text-sm font-medium text-slate-500 mt-1">{k.label}</p>
                <p className="text-xs text-slate-400 mt-1">Mes anterior: {k.anterior}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Productos más vendidos ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-700">
              Productos más vendidos
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Filtrado según el rango de fechas seleccionado</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Toggle ingresos / unidades */}
            <div className="flex border border-slate-200 rounded-lg overflow-hidden text-xs font-medium">
              <button
                onClick={() => setVistaProductos('ingresos')}
                className={`px-3 py-1.5 transition-colors
                  ${vistaProductos === 'ingresos'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-50'}`}
              >💰 Ingresos</button>
              <button
                onClick={() => setVistaProductos('unidades')}
                className={`px-3 py-1.5 transition-colors border-l border-slate-200
                  ${vistaProductos === 'unidades'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-50'}`}
              >📦 Unidades</button>
            </div>
            <button
              onClick={() => exportarCSV(masVendidos.map(({ fill, ...r }) => r), 'productos_mas_vendidos')}
              className="text-xs text-blue-600 hover:underline"
            >Exportar CSV</button>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6"
             ref={refGraficoProductos}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={masVendidos} layout="vertical" margin={{ left: 120, right: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false}/>
              <XAxis
                type="number"
                tick={{ fontSize: 11 }}
                tickFormatter={vistaProductos === 'ingresos'
                  ? v => v >= 1000000
                      ? `$${(v / 1000000).toFixed(1)}M`
                      : `$${(v / 1000).toFixed(0)}k`
                  : v => fmtNum(v)}
                domain={[0, 'dataMax']}
              />
              <YAxis type="category" dataKey="nombre" width={115} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => [
                vistaProductos === 'ingresos' ? fmt(v) : `${fmtNum(v)} uds`,
                vistaProductos === 'ingresos' ? 'Ingresos' : 'Unidades vendidas'
              ]} />
              <Bar
                dataKey={vistaProductos === 'ingresos' ? 'ingresos_total' : 'unidades_vendidas'}
                radius={[0, 4, 4, 0]}
                label={{
                  position: 'right',
                  fontSize: 10,
                  formatter: v => vistaProductos === 'ingresos'
                    ? v >= 1000000
                        ? `$${(v / 1000000).toFixed(1)}M`
                        : `$${(v / 1000).toFixed(0)}k`
                    : fmtNum(v)
                }}
              >
                {masVendidos.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ── Ventas por período ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-700">Ventas por período</h3>
          <div className="flex gap-2">
            {['diario', 'semanal', 'mensual'].map(p => (
              <button key={p} onClick={() => cambiarPeriodo(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors border
                            ${periodo === p
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >{p}</button>
            ))}
            <button onClick={() => exportarCSV(porPeriodo, `ventas_${periodo}`)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >⬇ CSV</button>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6"
             ref={refGraficoPeriodo}>
          {loadingVentas ? (
            <div className="flex items-center justify-center h-64 text-slate-400">
              <p className="text-sm">Cargando gráfica...</p>
            </div>
          ) : porPeriodo.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-sm font-medium">Sin ventas en este período</p>
              <p className="text-xs mt-1">Ajusta el rango de fechas o el tipo de agrupación</p>
            </div>
          ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={porPeriodo}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="periodo" tick={{ fontSize: 10 }}
                     interval={periodo === 'diario' ? 6 : 0} angle={-30} textAnchor="end" height={45}/>
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}k`}/>
              <Tooltip formatter={(v, n) => [
                n === 'ingresos_k' ? `$${v}k COP` : fmtNum(v),
                n === 'ingresos_k' ? 'Ingresos' : 'Ventas'
              ]} />
              <Legend />
              <Line type="monotone" dataKey="ingresos_k" stroke="#3b82f6" strokeWidth={2}
                    dot={periodo !== 'diario'} name="Ingresos (miles COP)" />
              <Line type="monotone" dataKey="cantidad_ventas" stroke="#10b981" strokeWidth={2}
                    dot={periodo !== 'diario'} name="Cantidad de ventas" yAxisId="right" />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }}/>
            </LineChart>
          </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* ── Rotación de inventario ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-700">
            Rotación de inventario — últimos 30 días
          </h3>
          <button onClick={() => exportarCSV(rotacion, 'rotacion_inventario')}
            className="text-xs text-blue-600 hover:underline"
          >Exportar CSV</button>
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
                <tr key={r.producto_id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{r.nombre}</p>
                    <p className="text-xs text-slate-400 font-mono">{r.codigo}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">{fmtNum(r.stock_actual)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{fmtNum(r.vendido_30d)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">{r.rotacion_mensual}x</td>
                  <td className="px-4 py-3 text-right text-slate-500">
                    {r.dias_agotamiento ? `${fmtNum(r.dias_agotamiento)} días` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${rotacionColor(r.estado)}`}>
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