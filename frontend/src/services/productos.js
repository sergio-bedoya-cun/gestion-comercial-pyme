import api from './api'

export const getProductos      = ()     => api.get('/productos/')
export const getProducto       = (id)   => api.get(`/productos/${id}`)
export const crearProducto     = (data) => api.post('/productos/', data)
export const getAlertasStock   = ()     => api.get('/productos/inventario/alertas')