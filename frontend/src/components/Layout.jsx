import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Brain,
  Bone,
  Gauge,
  HeartPulse,
  Home,
  LineChart,
  Menu,
  PlayCircle,
  Radiation,
  User,
  X,
} from 'lucide-react'
import { CREW, ROLES } from '../api'
import { useViewer } from '../context/ViewerContext'
import AstronautAvatar from './AstronautAvatar'

const NAV = [
  { to: '/dashboard', label: 'Overview', icon: Home, end: true },
  { to: '/status', label: 'Health status', icon: Gauge },
  { to: '/dashboard/brain', label: 'Brain & balance', icon: Brain },
  { to: '/dashboard/heart', label: 'Blood & heart', icon: HeartPulse },
  { to: '/dashboard/radiation', label: 'Radiation & temp', icon: Radiation },
  { to: '/dashboard/muscles', label: 'Muscles & bones', icon: Bone },
  { to: '/insights', label: 'Data insights', icon: LineChart },
  { to: '/demo', label: 'Guided demo', icon: PlayCircle },
  { to: '/profile', label: 'Crew profile', icon: User },
]

function NavItems({ onNavigate }) {
  return (
    <nav className="space-y-1" aria-label="Main">
      {NAV.map(({ to, label, icon: Icon, end }) => (
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
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

export default function Layout() {
  const { viewer, role, setViewer, setRole } = useViewer()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

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
        <div className="border-b border-white/10 p-5">
          <div className="flex items-center gap-3">
            <AstronautAvatar size={46} className="shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400">Space Apps 2026</p>
              <h1 className="text-lg font-bold leading-tight text-white">T.H.A.I.S.</h1>
              <p className="text-xs font-medium text-slate-300">Astronaut Health Monitor</p>
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-slate-500">
            Tech &amp; Health Astronaut Intelligent System
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <NavItems />
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
              <div className="flex items-center gap-2.5">
                <AstronautAvatar size={38} className="shrink-0" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400">Space Apps 2026</p>
                  <p className="text-base font-bold text-white">T.H.A.I.S.</p>
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
              <NavItems onNavigate={() => setMenuOpen(false)} />
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
              <AstronautAvatar size={26} className="shrink-0" />
              <span className="truncate">T.H.A.I.S.</span>
            </button>

            <div className="ml-auto flex items-center gap-2">
              <label className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-slate-400">
                <span className="hidden sm:inline">Crew</span>
                <select
                  value={viewer}
                  onChange={(event) => setViewer(event.target.value)}
                  aria-label="Viewing crew member"
                  className="rounded-lg border border-white/10 bg-panel px-2 py-1 text-xs text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
                  aria-label="Acting role"
                  className="max-w-[7.5rem] rounded-lg border border-white/10 bg-panel px-2 py-1 text-xs text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {ROLES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
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

        <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-6 lg:px-8">
          <Outlet />
        </main>

        <footer className="border-t border-white/10 px-4 py-4 text-[11px] text-slate-500 lg:px-8">
          T.H.A.I.S. — Tech &amp; Health Astronaut Intelligent System · educational demonstration for the NASA Space
          Apps Challenge 2026. NASA open data is labelled Real NASA; simulated POC values are labelled Simulated.
          Not a medical device and not a diagnosis.{' '}
          <a className="underline decoration-dotted hover:text-slate-300" href="/docs" target="_blank" rel="noreferrer">
            API docs
          </a>
        </footer>
      </div>
    </div>
  )
}
