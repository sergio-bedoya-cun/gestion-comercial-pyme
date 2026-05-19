import api from './api'

export const getResumenVentas  = (dias = 365) => api.get(`/ventas/resumen?dias=${dias}`)
export const getVentasPorDia   = (dias=30)  => api.get(`/ventas/ventas-por-dia?dias=${dias}`)
export const getVentas         = (skip=0)   => api.get(`/ventas/?skip=${skip}&limit=50`)
export const crearVenta        = (data)     => api.post('/ventas/', data)