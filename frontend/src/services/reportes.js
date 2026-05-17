import api from './api'

export const getProductosMasVendidos = (limite = 10, desde = null, hasta = null) => {
  const params = new URLSearchParams({ limite })
  if (desde) params.append('fecha_desde', desde)
  if (hasta) params.append('fecha_hasta', hasta)
  return api.get(`/reportes/productos-mas-vendidos?${params}`)
}

export const getVentasPorPeriodo = (periodo = 'diario', desde = null, hasta = null) => {
  const params = new URLSearchParams({ periodo })
  if (desde) params.append('fecha_desde', desde)
  if (hasta) params.append('fecha_hasta', hasta)
  return api.get(`/reportes/ventas-por-periodo?${params}`)
}

export const getRotacionInventario = () =>
  api.get('/reportes/rotacion-inventario')

export const getResumenEjecutivo = () =>
  api.get('/reportes/resumen-ejecutivo')