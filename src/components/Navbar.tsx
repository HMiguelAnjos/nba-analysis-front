import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

// ─── GreenLab Navbar ─────────────────────────────────────────────────────────
// Layout:
//   Desktop ≥ md  →  logo + links inline + ações à direita
//   Mobile  < md  →  logo + hamburguer; drawer aparece embaixo ao abrir
//
// Active state: indicador animado com underline brand (em vez de só mudar a cor).
// Hover: fundo sutil + transição 150ms.

interface NavItem {
  to: string
  label: string
  end?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/',          label: 'Ao Vivo',   end: true },
  { to: '/elencos',   label: 'Elencos' },
  { to: '/jogadores', label: 'Jogadores' },
]

function NavItemLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          'relative px-3 py-2 rounded-lg text-sm font-medium',
          'transition-colors duration-150',
          isActive
            ? 'text-white bg-slate-800/80'
            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <span>{item.label}</span>
          {/* Indicador inferior animado pra link ativo */}
          {isActive && (
            <span
              aria-hidden
              className="absolute -bottom-px left-3 right-3 h-0.5 rounded-full bg-brand-500"
            />
          )}
        </>
      )}
    </NavLink>
  )
}

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  // Fecha o drawer ao trocar de rota (UX padrão).
  useEffect(() => { setOpen(false) }, [location.pathname])

  return (
    <nav className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
        <div className="flex items-center justify-between h-14">
          {/* ─── Brand ───────────────────────────────────────────── */}
          <NavLink
            to="/"
            className="flex items-center gap-2.5 group"
          >
            <img
              src="/greenlab-logo.png"
              alt="GreenLab"
              className="h-9 w-9 object-contain transition-transform duration-200 group-hover:scale-105"
            />
            <div className="hidden sm:flex flex-col leading-none">
              <span className="text-base font-bold tracking-tight">
                <span className="text-slate-100">GREEN</span>
                <span className="text-brand-500">LAB</span>
              </span>
              <span className="text-[9px] text-slate-500 tracking-[0.18em] uppercase mt-0.5">
                Análise · Dados · Vantagem
              </span>
            </div>
          </NavLink>

          {/* ─── Links desktop ───────────────────────────────────── */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(item => <NavItemLink key={item.to} item={item} />)}
          </div>

          {/* ─── Hamburguer mobile ───────────────────────────────── */}
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={open}
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg
                       text-slate-300 hover:text-white hover:bg-slate-800
                       transition-colors duration-150
                       focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          >
            {open ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ─── Drawer mobile ─────────────────────────────────────── */}
      {open && (
        <div className="md:hidden border-t border-slate-800 bg-slate-900/95 backdrop-blur-md animate-fade-in">
          <div className="container mx-auto px-4 py-3 max-w-7xl flex flex-col gap-1">
            {NAV_ITEMS.map(item => (
              <NavItemLink key={item.to} item={item} onNavigate={() => setOpen(false)} />
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
