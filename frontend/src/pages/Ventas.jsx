import { useEffect, useState } from 'react'
import { getVentas, getResumenVentas, crearVenta } from '../services/ventas'
import { getProductos } from '../services/productos'
import api from '../services/api'

const fmt = n => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(n)

const fmtFecha = f => new Date(f).toLocaleString('es-CO', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit'
})

// ── Modal detalle de venta ────────────────────────────────────────────────────
function ModalDetalleVenta({ ventaId, onCerrar }) {
  const [detalle, setDetalle] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/ventas/${ventaId}/detalle`)
      .then(r => setDetalle(r.data))
      .finally(() => setLoading(false))
  }, [ventaId])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center
                    justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="p-6 border-b border-slate-100 flex justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800">
              Detalle de venta #{ventaId}
            </h3>
            {detalle && (
              <p className="text-slate-500 text-sm mt-0.5">
                {new Date(detalle.fecha).toLocaleString('es-CO')} ·{' '}
                {detalle.cliente_nombre || 'Cliente anónimo'} ·{' '}
                <span className="capitalize">{detalle.metodo_pago}</span>
              </p>
            )}
          </div>
          <button onClick={onCerrar}
                  className="text-slate-400 hover:text-slate-600 text-xl">
            ✕
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <p className="text-center text-slate-400 py-4">Cargando...</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="text-slate-500 uppercase text-xs border-b
                                  border-slate-100">
                  <tr>
                    <th className="pb-2 text-left">Producto</th>
                    <th className="pb-2 text-right">Cant.</th>
                    <th className="pb-2 text-right">P. Unit.</th>
                    <th className="pb-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {detalle.detalles.map((d, i) => (
                    <tr key={i}>
                      <td className="py-2.5">
                        <p className="font-medium text-slate-800">
                          {d.nombre_producto}
                        </p>
                        <p className="text-xs text-slate-400 font-mono">
                          {d.codigo}
                        </p>
                      </td>
                      <td className="py-2.5 text-right text-slate-600">
                        {d.cantidad}
                      </td>
                      <td className="py-2.5 text-right text-slate-600">
                        {fmt(d.precio_unitario)}
                      </td>
                      <td className="py-2.5 text-right font-semibold
                                     text-slate-800">
                        {fmt(d.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 pt-4 border-t border-slate-100 space-y-1">
                {detalle.descuento > 0 && (
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>Descuento</span>
                    <span>-{fmt(detalle.descuento)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-slate-800">
                  <span>Total</span>
                  <span className="text-lg">{fmt(detalle.total)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Formulario nueva venta ────────────────────────────────────────────────────
function FormNuevaVenta({ productos, onGuardado, onCancelar }) {
  const [items,     setItems]     = useState([{ producto_id: '', cantidad: 1 }])
  const [cliente,   setCliente]   = useState('')
  const [metodo,    setMetodo]    = useState('efectivo')
  const [descuento, setDescuento] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [error,     setError]     = useState('')

  const agregarItem = () =>
    setItems([...items, { producto_id: '', cantidad: 1 }])

  const actualizarItem = (i, campo, valor) => {
    const copia = [...items]
    copia[i][campo] = valor
    setItems(copia)
  }

  const eliminarItem = (i) =>
    setItems(items.filter((_, idx) => idx !== i))

  const calcularTotal = () =>
    items.reduce((acc, item) => {
      const prod = productos.find(p => p.id === parseInt(item.producto_id))
      return acc + (prod ? prod.precio_venta * item.cantidad : 0)
    }, 0) - descuento

  const handleSubmit = async () => {
    const itemsValidos = items.filter(i => i.producto_id && i.cantidad > 0)
    if (itemsValidos.length === 0) {
      setError('Agrega al menos un producto')
      return
    }
    setGuardando(true)
    setError('')
    try {
      const detalles = itemsValidos.map(i => {
        const prod = productos.find(p => p.id === parseInt(i.producto_id))
        return {
          producto_id:     parseInt(i.producto_id),
          cantidad:        parseFloat(i.cantidad),
          precio_unitario: prod.precio_venta
        }
      })
      await crearVenta({
        cliente_nombre: cliente || null,
        metodo_pago:    metodo,
        descuento:      parseFloat(descuento),
        detalles
      })
      onGuardado()
    } catch (e) {
      setError('Error al guardar la venta. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center
                    justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl
                      max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">Nueva Venta</h3>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-600">
                Cliente (opcional)
              </label>
              <input
                className="mt-1 w-full border border-slate-200 rounded-lg px-3
                           py-2 text-sm focus:outline-none focus:ring-2
                           focus:ring-blue-500"
                placeholder="Nombre del cliente"
                value={cliente}
                onChange={e => setCliente(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600">
                Método de pago
              </label>
              <select
                className="mt-1 w-full border border-slate-200 rounded-lg px-3
                           py-2 text-sm focus:outline-none focus:ring-2
                           focus:ring-blue-500"
                value={metodo}
                onChange={e => setMetodo(e.target.value)}
              >
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-600">
              Productos
            </label>
            <div className="mt-2 space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select
                    className="flex-1 border border-slate-200 rounded-lg px-3
                               py-2 text-sm focus:outline-none focus:ring-2
                               focus:ring-blue-500"
                    value={item.producto_id}
                    onChange={e => actualizarItem(i, 'producto_id', e.target.value)}
                  >
                    <option value="">Seleccionar producto...</option>
                    {productos.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} — {fmt(p.precio_venta)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number" min="1"
                    className="w-20 border border-slate-200 rounded-lg px-3
                               py-2 text-sm focus:outline-none focus:ring-2
                               focus:ring-blue-500"
                    value={item.cantidad}
                    onChange={e => actualizarItem(i, 'cantidad', e.target.value)}
                  />
                  <button
                    onClick={() => eliminarItem(i)}
                    className="text-red-400 hover:text-red-600 px-2"
                  >✕</button>
                </div>
              ))}
            </div>
            <button
              onClick={agregarItem}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              + Agregar producto
            </button>
          </div>

          <div className="flex items-center justify-between pt-2
                          border-t border-slate-100">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-600">
                Descuento:
              </label>
              <input
                type="number" min="0"
                className="w-32 border border-slate-200 rounded-lg px-3
                           py-1 text-sm focus:outline-none focus:ring-2
                           focus:ring-blue-500"
                value={descuento}
                onChange={e => setDescuento(e.target.value)}
              />
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">Total</p>
              <p className="text-2xl font-bold text-slate-800">
                {fmt(calcularTotal())}
              </p>
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onCancelar}
            className="px-4 py-2 text-sm font-medium text-slate-600
                       hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={guardando}
            className="px-6 py-2 text-sm font-medium bg-blue-600 text-white
                       rounded-lg hover:bg-blue-700 disabled:opacity-50
                       transition-colors"
          >
            {guardando ? 'Guardando...' : 'Registrar venta'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal Ventas ───────────────────────────────────────────────────
export default function Ventas() {
  const [ventas,       setVentas]       = useState([])
  const [productos,    setProductos]    = useState([])
  const [resumen,      setResumen]      = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [modalAbierto, setModal]        = useState(false)
  const [paginaActual, setPagina]       = useState(0)
  const [ventaDetalle, setVentaDetalle] = useState(null)

  const cargarDatos = async () => {
    setLoading(true)
    try {
      const [v, p, r] = await Promise.all([
        getVentas(paginaActual * 50),
        getProductos(),
        getResumenVentas()
      ])
      setVentas(v.data)
      setProductos(p.data)
      setResumen(r.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargarDatos() }, [paginaActual])

  const metodoColor = {
    efectivo:      'bg-green-100 text-green-700',
    tarjeta:       'bg-blue-100 text-blue-700',
    transferencia: 'bg-purple-100 text-purple-700',
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Ventas</h2>
          <p className="text-slate-500 mt-1">
            Historial y registro de transacciones
          </p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-medium
                     hover:bg-blue-700 transition-colors shadow-sm"
        >
          + Nueva venta
        </button>
      </div>

      {/* KPIs rápidos */}
      {resumen && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-slate-500 text-sm">Total ventas</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">
              {resumen.total_ventas.toLocaleString('es-CO')}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-slate-500 text-sm">Ingresos totales</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {fmt(resumen.ingresos_total)}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-slate-500 text-sm">Ticket promedio</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {fmt(resumen.ticket_promedio)}
            </p>
          </div>
        </div>
      )}

      {/* Tabla de ventas */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center
                        justify-between">
          <h3 className="font-semibold text-slate-700">Últimas ventas</h3>
          <p className="text-xs text-slate-400">
            Haz clic en una fila para ver el detalle
          </p>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400">Cargando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">Método</th>
                  <th className="px-4 py-3 text-left">Items</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ventas.map(v => (
                  <tr
                    key={v.id}
                    onClick={() => setVentaDetalle(v.id)}
                    className="hover:bg-blue-50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-slate-400 font-mono">
                      #{v.id}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {fmtFecha(v.fecha)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {v.cliente_nombre || (
                        <span className="text-slate-400 italic">Anónimo</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs
                                       font-medium ${metodoColor[v.metodo_pago]}`}>
                        {v.metodo_pago}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {v.detalles?.length ?? 0} producto(s)
                    </td>
                    <td className="px-4 py-3 text-right font-semibold
                                   text-slate-800">
                      {fmt(v.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        <div className="p-4 border-t border-slate-100 flex justify-between
                        items-center">
          <p className="text-sm text-slate-500">
            Mostrando {ventas.length} ventas
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPagina(p => Math.max(0, p - 1))}
              disabled={paginaActual === 0}
              className="px-3 py-1 text-sm border border-slate-200 rounded-lg
                         disabled:opacity-40 hover:bg-slate-50"
            >← Anterior</button>
            <span className="px-3 py-1 text-sm text-slate-600">
              Página {paginaActual + 1}
            </span>
            <button
              onClick={() => setPagina(p => p + 1)}
              disabled={ventas.length < 50}
              className="px-3 py-1 text-sm border border-slate-200 rounded-lg
                         disabled:opacity-40 hover:bg-slate-50"
            >Siguiente →</button>
          </div>
        </div>
      </div>

      {/* Modal nueva venta */}
      {modalAbierto && (
        <FormNuevaVenta
          productos={productos}
          onGuardado={() => { setModal(false); cargarDatos() }}
          onCancelar={() => setModal(false)}
        />
      )}

      {/* Modal detalle de venta */}
      {ventaDetalle && (
        <ModalDetalleVenta
          ventaId={ventaDetalle}
          onCerrar={() => setVentaDetalle(null)}
        />
      )}
    </div>
  )
}