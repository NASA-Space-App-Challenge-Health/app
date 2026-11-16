import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Brain,
  Bone,
  HandHeart,
  HeartPulse,
  Home,
  LineChart,
  Menu,
  Radiation,
  Users,
  X,
} from 'lucide-react'
import { CREW, ROLES } from '../api'
import { useViewer } from '../context/ViewerContext'
import useHelpTickets from '../hooks/useHelpTickets'

const NAV = [
  { to: '/dashboard', label: 'Overview', icon: Home, end: true },
  { to: '/dashboard/brain', label: 'Brain & balance', icon: Brain },
  { to: '/dashboard/heart', label: 'Blood & heart', icon: HeartPulse },
  { to: '/dashboard/radiation', label: 'Radiation & temp', icon: Radiation },
  { to: '/dashboard/muscles', label: 'Muscles & bones', icon: Bone },
  { to: '/insights', label: 'Data insights', icon: LineChart },
  { to: '/about', label: 'About us', icon: Users },
]


function NavItems({ onNavigate, helpCount = 0, showHelp = false }) {
  const items = showHelp
    ? [...NAV, { to: '/help', label: 'Help requests', icon: HandHeart }]
    : NAV
  return (
    <nav className="space-y-1" aria-label="Main">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
              isActive ? 'bg-accent/15 font-semibold text-accent' : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`
          }
        >
          <Icon size={18} aria-hidden="true" />
          <span className="flex-1">{label}</span>
          {to === '/help' && helpCount > 0 && (
            <span className="rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-black">{helpCount}</span>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export default function Layout() {
  const { viewer, role, setViewer, setRole, busy } = useViewer()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const clinical = role === 'cmo' || role === 'flight_surgeon'
  const helpCount = useHelpTickets({ viewer, role, enabled: clinical })

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex min-h-screen bg-space text-slate-100">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/10 bg-panel/60 lg:flex">
        <div className="border-b border-white/10 p-5 text-center">
          <img
            src="/thais-logo.png"
            alt="T.H.A.I.S. logo"
            className="mx-auto h-[84px] w-[84px] rounded-full object-cover"
            width="84"
            height="84"
          />
          <h1 className="mt-3 text-2xl font-bold leading-tight text-white">T.H.A.I.S.</h1>
          <p className="text-xs font-medium text-slate-300">Astronaut Health Monitor</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <NavItems helpCount={helpCount} showHelp={clinical} />
        </div>
        <div className="border-t border-white/10 p-4 text-[11px] leading-relaxed text-slate-500">
          Demo only, no login. Real NASA data is labelled; simulated vitals are labelled too.
        </div>
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 h-full w-full bg-black/70"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col border-r border-white/10 bg-panel p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src="/thais-logo.png" alt="T.H.A.I.S. logo" className="h-[52px] w-[52px] shrink-0 rounded-full object-cover" width="52" height="52" />
                <div>
                  <p className="text-lg font-bold text-white">T.H.A.I.S.</p>
                  <p className="text-[11px] text-slate-400">Astronaut Health Monitor</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg border border-white/10 p-2 text-slate-300"
                aria-label="Close menu"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavItems helpCount={helpCount} showHelp={clinical} onNavigate={() => setMenuOpen(false)} />
            </div>
            <p className="mt-4 border-t border-white/10 pt-3 text-[11px] text-slate-500">
              Demo only. Real NASA data is labelled; simulated vitals are labelled too.
            </p>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-space/90 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-2.5 lg:px-8">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="rounded-lg border border-white/10 p-2 text-slate-200 lg:hidden"
              aria-label="Open menu"
              aria-expanded={menuOpen}
            >
              <Menu size={18} aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white"
            >
              <img src="/thais-logo.png" alt="T.H.A.I.S. logo" className="h-8 w-8 shrink-0 rounded-full object-cover" width="32" height="32" />
              <span className="truncate">T.H.A.I.S.</span>
            </button>

            <div className="ml-auto flex items-center gap-2">
              <label className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-slate-400">
                <span className="hidden sm:inline">Crew</span>
                <select
                  value={viewer}
                  onChange={(event) => setViewer(event.target.value)}
                  disabled={busy}
                  aria-busy={busy}
                  aria-label="Viewing crew member"
                  className="rounded-lg border border-white/10 bg-panel px-2 py-1 text-xs text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
                >
                  {CREW.map((member) => (
                    <option key={member} value={member}>
                      {member}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-slate-400">
                <span className="hidden sm:inline">Role</span>
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  disabled={busy}
                  aria-busy={busy}
                  aria-label="Acting role"
                  className="max-w-[7.5rem] rounded-lg border border-white/10 bg-panel px-2 py-1 text-xs text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
                >
                  {ROLES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              {busy && <span className="text-[10px] uppercase tracking-wide text-slate-500">Syncing</span>}
            </div>
          </div>

          <nav className="-mt-1 flex gap-1 overflow-x-auto px-4 pb-2 lg:hidden" aria-label="Sections">
            {NAV.slice(0, 5).map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-2 py-1 text-xs ${
                    isActive ? 'bg-accent/15 text-accent' : 'text-slate-400'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </header>

        {clinical && helpCount > 0 && (
          <Link
            to="/help"
            className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs text-amber-100 hover:bg-amber-400/15 lg:px-8"
          >
            <HandHeart size={15} aria-hidden="true" />
            <span className="font-semibold">
              {helpCount} open help request{helpCount === 1 ? '' : 's'} waiting for a responder
            </span>
            <span className="ml-auto font-semibold text-accent">Open help inbox →</span>
          </Link>
        )}

        <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-6 lg:px-8">
          <Outlet />
        </main>

        <footer className="border-t border-white/10 px-4 py-4 text-[11px] text-slate-500 lg:px-8">
          T.H.A.I.S. — Tech &amp; Health Astronaut Intelligent System · educational demonstration for the NASA Space
          Apps Challenge 2026. Real NASA open data is labelled Real NASA; simulated POC values are labelled Simulated.
          Not a medical device and not a diagnosis.{' '}
          <a className="underline decoration-dotted hover:text-slate-300" href="/docs" target="_blank" rel="noreferrer">
            API docs
          </a>
        </footer>
      </div>
    </div>
  )
}
