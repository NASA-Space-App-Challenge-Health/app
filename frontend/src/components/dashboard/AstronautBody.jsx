import { Link } from 'react-router-dom'

// Front-facing human silhouette used as the Overview body map. Muted suit-like
// fill with a thin rim, no face and no cartoon detail. Hotspots are real links
// with a 44px target and the status in their accessible name; a tap opens the
// matching system page.

const POSITIONS = {
  head: { top: '6%', left: '50%' },
  eyes: { top: '12%', left: '50%' },
  heart: { top: '31%', left: '50%' },
  blood: { top: '40%', left: '26%' },
  muscles: { top: '62%', left: '41%' },
  bones: { top: '78%', left: '59%' },
  environment: { top: '47%', left: '89%' },
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
      <svg viewBox="0 0 200 320" className="h-full w-full" aria-hidden="true">
        <defs>
          <radialGradient id="human-glow" cx="50%" cy="42%" r="55%">
            <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="100" cy="155" r="145" fill="url(#human-glow)" />
        <ellipse cx="100" cy="305" rx="52" ry="7" fill="#00e5ff" opacity="0.06" />

        {/* head and neck */}
        <ellipse cx="100" cy="33" rx="14.5" ry="17.5" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="2" />
        <path d="M94 48h12v10H94z" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="2" />

        {/* arms: outlined limbs */}
        <path d="M72 66c-9 10-13 24-15 40l-3 40" fill="none" stroke="#94a3b8" strokeWidth="14" strokeLinecap="round" />
        <path d="M72 66c-9 10-13 24-15 40l-3 40" fill="none" stroke="#cbd5e1" strokeWidth="10" strokeLinecap="round" />
        <path d="M128 66c9 10 13 24 15 40l3 40" fill="none" stroke="#94a3b8" strokeWidth="14" strokeLinecap="round" />
        <path d="M128 66c9 10 13 24 15 40l3 40" fill="none" stroke="#cbd5e1" strokeWidth="10" strokeLinecap="round" />
        <ellipse cx="53" cy="152" rx="7" ry="8.5" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1.8" />
        <ellipse cx="147" cy="152" rx="7" ry="8.5" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1.8" />

        {/* legs: outlined limbs */}
        <path d="M89 164l-4 62-2 58" fill="none" stroke="#94a3b8" strokeWidth="20" strokeLinecap="round" />
        <path d="M89 164l-4 62-2 58" fill="none" stroke="#cbd5e1" strokeWidth="16" strokeLinecap="round" />
        <path d="M111 164l4 62 2 58" fill="none" stroke="#94a3b8" strokeWidth="20" strokeLinecap="round" />
        <path d="M111 164l4 62 2 58" fill="none" stroke="#cbd5e1" strokeWidth="16" strokeLinecap="round" />
        <ellipse cx="81" cy="289" rx="11" ry="5.5" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1.8" />
        <ellipse cx="119" cy="289" rx="11" ry="5.5" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1.8" />

        {/* torso */}
        <path
          d="M73 62c7-5 16-8 27-8s20 3 27 8l7 34-3 40-8 28H77l-8-28-3-40z"
          fill="#cbd5e1"
          stroke="#94a3b8"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* anatomical guides only, no decoration */}
        <path d="M100 66v96" stroke="#64748b" strokeWidth="1.2" />
        <path d="M84 86h32" stroke="#64748b" strokeWidth="1" />
        <path d="M80 112h40" stroke="#64748b" strokeWidth="1" opacity="0.8" />
        <path d="M80 126h40" stroke="#64748b" strokeWidth="1" opacity="0.6" />
        <path d="M83 158h34" stroke="#64748b" strokeWidth="1" />
        {/* heart / lung / knee reference points */}
        <path d="M99 98c3-3 8-1 8 3 0 3-4 6-8 9-4-3-8-6-8-9 0-4 5-6 8-3z" fill="#475569" opacity="0.5" />
        <path d="M86 100c-3 3-4 8-3 12" stroke="#475569" strokeWidth="1.2" fill="none" opacity="0.4" />
        <path d="M114 100c3 3 4 8 3 12" stroke="#475569" strokeWidth="1.2" fill="none" opacity="0.4" />
        <circle cx="84" cy="214" r="2.2" fill="#475569" opacity="0.5" />
        <circle cx="116" cy="214" r="2.2" fill="#475569" opacity="0.5" />
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
              className={`h-3.5 w-3.5 rounded-full border-2 border-space shadow-sm transition-transform group-hover:scale-125 ${DOT[state] ?? DOT.private}`}
              aria-hidden="true"
            />
            <span className="sr-only">
              {meta.label} — {state} — open {meta.target}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
