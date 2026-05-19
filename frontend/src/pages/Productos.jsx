import { useEffect, useState } from 'react'
import { getProductos, crearProducto } from '../services/productos'
import api from '../services/api'

const fmt = n => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(n)

// ── Modal editar producto ─────────────────────────────────────────────────────
function ModalEditarProducto({ producto, onGuardado, onCancelar }) {
  const [form, setForm] = useState({
    nombre:        producto.nombre,
    precio_compra: producto.precio_compra,
    precio_venta:  producto.precio_venta,
    descripcion:   producto.descripcion || ''
  })
  const [guardando, setGuardando] = useState(false)
  const [error,     setError]     = useState('')
  const [confirmar, setConfirmar] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleGuardar = async () => {
    setGuardando(true)
    setError('')
    try {
      await api.put(`/productos/${producto.id}`, {
        nombre:        form.nombre,
        precio_compra: parseFloat(form.precio_compra),
        precio_venta:  parseFloat(form.precio_venta),
        descripcion:   form.descripcion
      })
      onGuardado()
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al actualizar')
    } finally {
      setGuardando(false)
    }
  }

  const handleDesactivar = async () => {
    setGuardando(true)
    try {
      await api.delete(`/productos/${producto.id}`)
      onGuardado()
    } catch (e) {
      setError('Error al desactivar el producto')
    } finally {
      setGuardando(false)
    }
  }

  const handleReactivar = async () => {
    setGuardando(true)
    try {
      await api.put(`/productos/${producto.id}`, { activo: true })
      onGuardado()
    } catch (e) {
      setError('Error al reactivar el producto')
    } finally {
      setGuardando(false)
    }
  }

  const campo = (label, key, type = 'text') => (
    <div>
      <label className="text-sm font-medium text-slate-600">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => set(key, e.target.value)}
        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2
                   text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center
                    justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">Editar producto</h3>
          <p className="text-slate-500 text-sm mt-0.5">
            {producto.codigo} — {producto.nombre}
          </p>
          {!producto.activo && (
            <span className="inline-block mt-2 px-2 py-0.5 bg-slate-100
                             text-slate-500 text-xs rounded-full font-medium">
              Producto inactivo
            </span>
          )}
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {campo('Nombre',        'nombre')}
            {campo('Precio compra', 'precio_compra', 'number')}
            {campo('Precio venta',  'precio_venta',  'number')}
          </div>
          {campo('Descripción', 'descripcion')}

          {error && (
            <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {confirmar && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700 font-medium">
                ¿Confirmas desactivar este producto?
              </p>
              <p className="text-xs text-red-500 mt-1">
                El historial de ventas se conserva. Puedes reactivarlo después.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleDesactivar}
                  className="px-3 py-1.5 text-xs font-medium bg-red-600
                             text-white rounded-lg hover:bg-red-700"
                >Confirmar desactivación</button>
                <button
                  onClick={() => setConfirmar(false)}
                  className="px-3 py-1.5 text-xs font-medium border
                             border-slate-200 rounded-lg hover:bg-slate-50"
                >Cancelar</button>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-between">
          {producto.activo ? (
            <button
              onClick={() => setConfirmar(true)}
              className="px-4 py-2 text-sm font-medium text-red-600
                         hover:bg-red-50 rounded-lg transition-colors
                         border border-red-200"
            >Desactivar</button>
          ) : (
            <button
              onClick={handleReactivar}
              disabled={guardando}
              className="px-4 py-2 text-sm font-medium text-green-600
                         hover:bg-green-50 rounded-lg transition-colors
                         border border-green-300 disabled:opacity-50"
            >✓ Reactivar</button>
          )}
          <div className="flex gap-2">
            <button
              onClick={onCancelar}
              className="px-4 py-2 text-sm font-medium text-slate-600
                         hover:bg-slate-100 rounded-lg"
            >Cancelar</button>
            <button
              onClick={handleGuardar}
              disabled={guardando}
              className="px-6 py-2 text-sm font-medium bg-blue-600 text-white
                         rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >{guardando ? 'Guardando...' : 'Guardar cambios'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal crear producto ──────────────────────────────────────────────────────
function FormProducto({ onGuardado, onCancelar }) {
  const [form, setForm] = useState({
    nombre: '', codigo: '', precio_compra: '',
    precio_venta: '', categoria_id: '', descripcion: ''
  })
  const [guardando, setGuardando] = useState(false)
  const [error,     setError]     = useState('')

  const set = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }))

  const handleSubmit = async () => {
    if (!form.nombre || !form.codigo || !form.precio_venta) {
      setError('Nombre, código y precio de venta son obligatorios')
      return
    }
    setGuardando(true)
    setError('')
    try {
      await crearProducto({
        ...form,
        precio_compra: parseFloat(form.precio_compra) || 0,
        precio_venta:  parseFloat(form.precio_venta),
        categoria_id:  form.categoria_id ? parseInt(form.categoria_id) : null
      })
      onGuardado()
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al guardar el producto')
    } finally {
      setGuardando(false)
    }
  }

  const campo = (label, key, type = 'text', placeholder = '') => (
    <div>
      <label className="text-sm font-medium text-slate-600">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={form[key]}
        onChange={e => set(key, e.target.value)}
        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2
                   text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center
                    justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">Nuevo Producto</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {campo('Nombre *',          'nombre',        'text',   'Ej: Agua 500ml')}
            {campo('Código *',          'codigo',        'text',   'Ej: AG500')}
            {campo('Precio de compra',  'precio_compra', 'number', '0')}
            {campo('Precio de venta *', 'precio_venta',  'number', '0')}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">
              Descripción
            </label>
            <textarea
              rows={2}
              value={form.descripcion}
              onChange={e => set('descripcion', e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2
                         text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Descripción opcional..."
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
          >{guardando ? 'Guardando...' : 'Crear producto'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal Productos ────────────────────────────────────────────────
export default function Productos() {
  const [productos,        setProductos]        = useState([])
  const [busqueda,         setBusqueda]         = useState('')
  const [loading,          setLoading]          = useState(true)
  const [modal,            setModal]            = useState(false)
  const [productoEditar,   setProductoEditar]   = useState(null)
  const [mostrarInactivos, setMostrarInactivos] = useState(false)

  const cargar = async () => {
    setLoading(true)
    try {
      const r = await getProductos(false) // trae todos, filtramos en cliente
      setProductos(r.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const filtrados = productos.filter(p => {
    if (!mostrarInactivos && !p.activo) return false
    return (
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.codigo.toLowerCase().includes(busqueda.toLowerCase())
    )
  })

  const activos   = productos.filter(p => p.activo).length
  const inactivos = productos.filter(p => !p.activo).length

  const margen = p => p.precio_compra > 0
    ? (((p.precio_venta - p.precio_compra) / p.precio_compra) * 100).toFixed(0)
    : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Productos</h2>
          <p className="text-slate-500 mt-1">
            {activos} activos
            {inactivos > 0 && (
              <span className="text-slate-400"> · {inactivos} inactivos</span>
            )}
          </p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-medium
                     hover:bg-blue-700 transition-colors shadow-sm"
        >+ Nuevo producto</button>
      </div>

      {/* Buscador y toggle inactivos */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
          <input
            type="text"
            placeholder="Buscar por nombre o código..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl
                       text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                       bg-white"
          />
        </div>
        {inactivos > 0 && (
          <button
            onClick={() => setMostrarInactivos(v => !v)}
            className={`px-4 py-2 text-sm font-medium rounded-xl border
                        transition-colors whitespace-nowrap
                        ${mostrarInactivos
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {mostrarInactivos
              ? 'Ocultar inactivos'
              : `Mostrar inactivos (${inactivos})`}
          </button>
        )}
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
                  <th className="px-4 py-3 text-left">Nombre</th>
                  <th className="px-4 py-3 text-right">P. Compra</th>
                  <th className="px-4 py-3 text-right">P. Venta</th>
                  <th className="px-4 py-3 text-right">Margen</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.map(p => (
                  <tr key={p.id}
                      className={`transition-colors
                        ${p.activo
                          ? 'hover:bg-slate-50'
                          : 'bg-slate-50 opacity-60 hover:opacity-80'}`}>
                    <td className="px-4 py-3 font-mono text-slate-500 text-xs">
                      {p.codigo}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {p.nombre}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {fmt(p.precio_compra)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold
                                   text-slate-800">
                      {fmt(p.precio_venta)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {margen(p) !== null ? (
                        <span className={`font-medium ${
                          parseInt(margen(p)) >= 30
                            ? 'text-green-600'
                            : 'text-amber-500'
                        }`}>
                          {margen(p)}%
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium
                        ${p.activo
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-500'}`}>
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setProductoEditar(p)}
                        className="px-3 py-1 text-xs font-medium text-blue-600
                                   hover:bg-blue-50 rounded-lg border
                                   border-blue-200 transition-colors"
                      >Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtrados.length === 0 && (
              <div className="p-8 text-center text-slate-400">
                {busqueda
                  ? `No se encontraron productos con "${busqueda}"`
                  : 'No hay productos que mostrar'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal crear */}
      {modal && (
        <FormProducto
          onGuardado={() => { setModal(false); cargar() }}
          onCancelar={() => setModal(false)}
        />
      )}

      {/* Modal editar / reactivar */}
      {productoEditar && (
        <ModalEditarProducto
          producto={productoEditar}
          onGuardado={() => { setProductoEditar(null); cargar() }}
          onCancelar={() => setProductoEditar(null)}
        />
      )}
    </div>
  )
}