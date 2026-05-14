import { useEffect, useState } from 'react'
import { getProductos, getAlertasStock } from '../services/productos'
import api from '../services/api'

const fmt = n => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(n)

function ModalAjuste({ item, onGuardado, onCancelar }) {
  const [cantidad,  setCantidad]  = useState('')
  const [tipo,      setTipo]      = useState('entrada')
  const [motivo,    setMotivo]    = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error,     setError]     = useState('')

  const handleSubmit = async () => {
    if (!cantidad || parseFloat(cantidad) <= 0) {
      setError('Ingresa una cantidad válida mayor a 0')
      return
    }
    setGuardando(true)
    setError('')
    try {
      await api.post(`/inventario/${item.producto_id}/movimiento`, {
        tipo,
        cantidad:  parseFloat(cantidad),
        motivo:    motivo || null
      })
      onGuardado()
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al registrar movimiento')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center
                    justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">
            Ajuste de inventario
          </h3>
          <p className="text-slate-500 text-sm mt-1">
            Producto #{item.producto_id} · Stock actual: {item.cantidad} {item.unidad_medida}
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-600">
              Tipo de movimiento
            </label>
            <div className="mt-2 flex gap-3">
              {['entrada', 'salida', 'ajuste'].map(t => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium
                             capitalize transition-colors border
                             ${tipo === t
                               ? t === 'entrada'
                                 ? 'bg-green-600 text-white border-green-600'
                                 : t === 'salida'
                                   ? 'bg-red-500 text-white border-red-500'
                                   : 'bg-blue-600 text-white border-blue-600'
                               : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                             }`}
                >{t}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">
              Cantidad
            </label>
            <input
              type="number" min="0.1" step="0.1"
              value={cantidad}
              onChange={e => setCantidad(e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3
                         py-2 text-sm focus:outline-none focus:ring-2
                         focus:ring-blue-500"
              placeholder="Ej: 10"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">
              Motivo (opcional)
            </label>
            <input
              type="text"
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3
                         py-2 text-sm focus:outline-none focus:ring-2
                         focus:ring-blue-500"
              placeholder="Ej: Compra a proveedor, merma, ajuste..."
            />
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
          >Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={guardando}
            className="px-6 py-2 text-sm font-medium bg-blue-600 text-white
                       rounded-lg hover:bg-blue-700 disabled:opacity-50
                       transition-colors"
          >{guardando ? 'Guardando...' : 'Registrar'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Inventario() {
  const [inventario, setInventario] = useState([])
  const [productos,  setProductos]  = useState([])
  const [alertas,    setAlertas]    = useState([])
  const [busqueda,   setBusqueda]   = useState('')
  const [filtro,     setFiltro]     = useState('todos')
  const [loading,    setLoading]    = useState(true)
  const [itemAjuste, setItemAjuste] = useState(null)

  const cargar = async () => {
    setLoading(true)
    try {
      const [inv, prods, alts] = await Promise.all([
        api.get('/inventario/'),
        getProductos(),
        getAlertasStock()
      ])
      setInventario(inv.data)
      setProductos(prods.data)
      setAlertas(alts.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const nombreProducto = id => {
    const p = productos.find(p => p.id === id)
    return p?.nombre ?? `Producto #${id}`
  }

  const codigoProducto = id => {
    const p = productos.find(p => p.id === id)
    return p?.codigo ?? '—'
  }

  const filtrados = inventario
    .filter(i => {
      const nombre = nombreProducto(i.producto_id).toLowerCase()
      const matchBusqueda = nombre.includes(busqueda.toLowerCase())
      const esAlerta = i.cantidad <= i.stock_minimo
      if (filtro === 'alertas') return matchBusqueda && esAlerta
      if (filtro === 'ok')      return matchBusqueda && !esAlerta
      return matchBusqueda
    })

  const stockPct = i => Math.min(100,
    i.stock_maximo ? (i.cantidad / i.stock_maximo) * 100 : 50
  )

  const stockColor = i => {
    if (i.cantidad <= i.stock_minimo)       return 'bg-red-500'
    if (i.cantidad <= i.stock_minimo * 1.5) return 'bg-amber-400'
    return 'bg-green-500'
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Inventario</h2>
          <p className="text-slate-500 mt-1">
            Control de stock y movimientos
          </p>
        </div>
      </div>

      {/* Alertas banner */}
      {alertas.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4
                        flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-semibold text-red-700">
              {alertas.length} producto(s) con stock bajo el mínimo
            </p>
            <p className="text-sm text-red-500 mt-0.5">
              Revisa y repone el inventario para evitar quiebres de stock
            </p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-slate-500 text-sm">Total productos</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">
            {inventario.length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-slate-500 text-sm">Stock OK</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {inventario.filter(i => i.cantidad > i.stock_minimo).length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-slate-500 text-sm">Bajo mínimo</p>
          <p className="text-2xl font-bold text-red-500 mt-1">
            {alertas.length}
          </p>
        </div>
      </div>

      {/* Filtros y búsqueda */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
          <input
            type="text"
            placeholder="Buscar producto..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200
                       rounded-xl text-sm focus:outline-none focus:ring-2
                       focus:ring-blue-500 bg-white"
          />
        </div>
        <div className="flex gap-2">
          {[
            { key: 'todos',   label: 'Todos'   },
            { key: 'alertas', label: '⚠️ Alertas' },
            { key: 'ok',      label: '✅ OK'    },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium
                         transition-colors border
                         ${filtro === f.key
                           ? 'bg-blue-600 text-white border-blue-600'
                           : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                         }`}
            >{f.label}</button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Cargando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Código</th>
                  <th className="px-4 py-3 text-left">Producto</th>
                  <th className="px-4 py-3 text-center">Stock actual</th>
                  <th className="px-4 py-3 text-center">Mínimo</th>
                  <th className="px-4 py-3 text-left">Nivel</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.map(i => (
                  <tr key={i.producto_id}
                      className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-500 text-xs">
                      {codigoProducto(i.producto_id)}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {nombreProducto(i.producto_id)}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold
                                   text-slate-800">
                      {i.cantidad} {i.unidad_medida}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500">
                      {i.stock_minimo}
                    </td>
                    <td className="px-4 py-3 w-32">
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all
                                     ${stockColor(i)}`}
                          style={{ width: `${stockPct(i)}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {i.cantidad <= i.stock_minimo ? (
                        <span className="px-2 py-1 rounded-full text-xs
                                         font-medium bg-red-100 text-red-700">
                          Stock bajo
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs
                                         font-medium bg-green-100 text-green-700">
                          Normal
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setItemAjuste(i)}
                        className="px-3 py-1 text-xs font-medium text-blue-600
                                   hover:bg-blue-50 rounded-lg border
                                   border-blue-200 transition-colors"
                      >Ajustar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtrados.length === 0 && (
              <div className="p-8 text-center text-slate-400">
                No hay productos que coincidan con los filtros
              </div>
            )}
          </div>
        )}
      </div>

      {itemAjuste && (
        <ModalAjuste
          item={itemAjuste}
          onGuardado={() => { setItemAjuste(null); cargar() }}
          onCancelar={() => setItemAjuste(null)}
        />
      )}
    </div>
  )
}