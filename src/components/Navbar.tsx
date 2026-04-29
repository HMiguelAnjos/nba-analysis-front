import { NavLink } from 'react-router-dom'

export default function Navbar() {
  return (
    <nav className="bg-slate-900 border-b border-slate-700 sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-7xl flex items-center h-14 gap-8">
        <span className="text-orange-400 font-bold text-lg tracking-tight">
          🏀 NBA Analysis
        </span>
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `text-sm font-medium transition-colors ${
              isActive ? 'text-orange-400' : 'text-slate-400 hover:text-slate-200'
            }`
          }
        >
          Jogadores
        </NavLink>
        <NavLink
          to="/live"
          className={({ isActive }) =>
            `text-sm font-medium transition-colors ${
              isActive ? 'text-orange-400' : 'text-slate-400 hover:text-slate-200'
            }`
          }
        >
          Ao Vivo
        </NavLink>
      </div>
    </nav>
  )
}
