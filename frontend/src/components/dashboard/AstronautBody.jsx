import { Link } from 'react-router-dom'

// Full-body astronaut silhouette used as the Overview body map. Each hotspot is
// a real link with a 44px target and an accessible label; colour is paired with
// a text status in the accessible name, and a tap goes straight to the system
// page instead of opening a nested panel.

const POSITIONS = {
  head: { top: '12%', left: '50%' },
  eyes: { top: '22%', left: '50%' },
  heart: { top: '40%', left: '50%' },
  blood: { top: '49%', left: '28%' },
  muscles: { top: '71%', left: '40%' },
  bones: { top: '71%', left: '60%' },
  environment: { top: '58%', left: '88%' },
}

const REGION_META = {
  head: { label: 'Head', to: '/dashboard/brain', target: 'Brain & balance' },
  eyes: { label: 'Eyes', to: '/dashboard/brain', target: 'Brain & balance' },
  heart: { label: 'Heart and vessels', to: '/dashboard/heart', target: 'Blood & heart' },
  blood: { label: 'Blood', to: '/dashboard/heart', target: 'Blood & heart' },
  muscles: { label: 'Muscles', to: '/dashboard/muscles', target: 'Muscles & bones' },
  bones: { label: 'Bones', to: '/dashboard/muscles', target: 'Muscles & bones' },
  environment: { label: 'Environment', to: '/dashboard/radiation', target: 'Radiation & temperature' },
}

const DOT = {
  nominal: 'bg-emerald-400',
  watch: 'bg-amber-400',
  concern: 'bg-red-400',
  private: 'bg-slate-500',
}

export default function AstronautBody({ regions = [] }) {
  const status = Object.fromEntries((regions ?? []).map((region) => [region.id, region.status]))

  return (
    <div className="relative mx-auto h-[300px] w-[210px] shrink-0 select-none">
      <svg viewBox="0 0 200 300" className="h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="body-suit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f1f5f9" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
          <linearGradient id="body-visor" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#0ea5e9" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#7851a9" stopOpacity="0.95" />
          </linearGradient>
          <radialGradient id="body-glow" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse cx="100" cy="288" rx="74" ry="12" fill="#00e5ff" opacity="0.08" />
        <circle cx="100" cy="150" r="120" fill="url(#body-glow)" />

        {/* backpack */}
        <rect x="58" y="98" width="84" height="92" rx="20" fill="#0f172a" stroke="#334155" strokeWidth="2" />
        <rect x="72" y="112" width="56" height="28" rx="8" fill="#111c30" stroke="#334155" strokeWidth="1.5" />
        <circle cx="84" cy="126" r="3" fill="#34d399" />
        <circle cx="100" cy="126" r="3" fill="#00e5ff" />
        <circle cx="116" cy="126" r="3" fill="#7851a9" />

        {/* legs */}
        <path d="M88 190v64" stroke="#cbd5e1" strokeWidth="16" strokeLinecap="round" />
        <path d="M112 190v64" stroke="#cbd5e1" strokeWidth="16" strokeLinecap="round" />
        <path d="M82 252h12" stroke="#64748b" strokeWidth="8" strokeLinecap="round" />
        <path d="M106 252h12" stroke="#64748b" strokeWidth="8" strokeLinecap="round" />

        {/* arms */}
        <path d="M64 112l-16 58" stroke="#cbd5e1" strokeWidth="14" strokeLinecap="round" />
        <path d="M136 112l16 58" stroke="#cbd5e1" strokeWidth="14" strokeLinecap="round" />
        <path d="M45 168l-4 10" stroke="#64748b" strokeWidth="10" strokeLinecap="round" />
        <path d="M155 168l4 10" stroke="#64748b" strokeWidth="10" strokeLinecap="round" />

        {/* torso */}
        <path
          d="M70 108c8-8 52-8 60 0l10 70c-12 12-68 12-82 0z"
          fill="url(#body-suit)"
          stroke="#94a3b8"
          strokeWidth="2"
        />
        <rect x="88" y="150" width="24" height="10" rx="4" fill="#0f172a" stroke="#94a3b8" strokeWidth="1" />
        <circle cx="96" cy="155" r="2" fill="#34d399" />
        <circle cx="104" cy="155" r="2" fill="#00e5ff" />
        <path d="M74 172h52" stroke="#94a3b8" strokeWidth="2" opacity="0.5" />

        {/* helmet */}
        <circle cx="100" cy="52" r="33" fill="url(#body-suit)" stroke="#94a3b8" strokeWidth="2.5" />
        <circle cx="100" cy="52" r="26" fill="#0b1020" stroke="#e2e8f0" strokeWidth="2" />
        <circle cx="100" cy="52" r="24" fill="url(#body-visor)" />
        <path d="M84 40c5-8 15-12 24-10" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="3" strokeLinecap="round" fill="none" />
        <circle cx="69" cy="55" r="5" fill="#7851a9" stroke="#1e293b" strokeWidth="1.5" />
        <circle cx="131" cy="55" r="5" fill="#00e5ff" stroke="#1e293b" strokeWidth="1.5" />
      </svg>

      {Object.entries(REGION_META).map(([id, meta]) => {
        const state = status[id] ?? 'private'
        const position = POSITIONS[id]
        return (
          <Link
            key={id}
            to={meta.to}
            title={`${meta.label} — ${state}. Open ${meta.target}.`}
            aria-label={`${meta.label}: ${state}. Open ${meta.target}.`}
            className="group absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/80"
            style={{ top: position.top, left: position.left }}
          >
            <span
              className={`h-3.5 w-3.5 rounded-full border-2 border-space shadow-sm ${DOT[state] ?? DOT.private}`}
              aria-hidden="true"
            />
            <span className="sr-only">
              {meta.label} — {state} — open {meta.target}
            </span>
          </Link>
        )
      })}

      <p className="relative z-10 mt-1 text-center text-[11px] text-slate-500">Tap a body part to open that system.</p>
    </div>
  )
}
