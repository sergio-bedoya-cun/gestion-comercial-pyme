import { NavLink } from 'react-router-dom'

const links = [
  { to: '/',          icon: '📊', label: 'Dashboard'  },
  { to: '/ventas',    icon: '💰', label: 'Ventas'     },
  { to: '/productos', icon: '📦', label: 'Productos'  },
  { to: '/inventario',icon: '🏪', label: 'Inventario' },
  { to: '/predicciones', icon: '🔮', label: 'Predicciones' },
]

export default function Sidebar() {
  return (
    <aside className="w-64 min-h-screen bg-slate-900 text-white flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-xl font-bold text-white">GestiónPyme</h1>
        <p className="text-slate-400 text-sm mt-1">Panel de control</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {links.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm font-medium
               ${isActive
                 ? 'bg-blue-600 text-white'
                 : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`
            }
          >
            <span className="text-lg">{link.icon}</span>
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-700">
        <p className="text-slate-500 text-xs">Trabajo de grado v1.0</p>
      </div>
    </aside>
  )
}