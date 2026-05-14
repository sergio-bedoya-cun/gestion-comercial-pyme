import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import Dashboard  from './pages/Dashboard'
import Ventas     from './pages/Ventas'
import Productos  from './pages/Productos'
import Inventario from './pages/Inventario'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 p-8 overflow-auto">
          <Routes>
            <Route path="/"           element={<Dashboard />}  />
            <Route path="/ventas"     element={<Ventas />}     />
            <Route path="/productos"  element={<Productos />}  />
            <Route path="/inventario" element={<Inventario />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}