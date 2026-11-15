// Simple astronaut avatar in the product's dark palette. Used on the crew
// overview hero and in the sidebar header; pure SVG so it stays crisp and does
// not add an image asset or a network request.

export default function AstronautAvatar({ size = 88, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label="Astronaut avatar"
      className={className}
    >
      <defs>
        <linearGradient id="astronaut-visor" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#0ea5e9" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#7851a9" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="astronaut-suit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f1f5f9" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>
        <radialGradient id="astronaut-glow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="60" cy="60" r="58" fill="#101323" stroke="rgba(255,255,255,0.12)" />
      <circle cx="60" cy="58" r="46" fill="url(#astronaut-glow)" />

      {/* shoulders / suit */}
      <path
        d="M22 104c3-16 17-25 38-25s35 9 38 25"
        fill="url(#astronaut-suit)"
        stroke="#94a3b8"
        strokeWidth="2"
      />
      <path d="M60 80v24" stroke="#94a3b8" strokeWidth="2" />
      <circle cx="60" cy="94" r="3.6" fill="#0ea5e9" />
      <circle cx="46" cy="88" r="2.4" fill="#7851a9" />
      <circle cx="74" cy="88" r="2.4" fill="#00e5ff" />

      {/* helmet */}
      <circle cx="60" cy="50" r="31" fill="url(#astronaut-suit)" stroke="#94a3b8" strokeWidth="2.5" />
      <circle cx="60" cy="50" r="24" fill="#0b1020" stroke="#e2e8f0" strokeWidth="2" />
      <circle cx="60" cy="50" r="22" fill="url(#astronaut-visor)" />
      {/* visor reflection */}
      <path d="M46 40c4-7 13-11 21-9" stroke="#ffffff" strokeOpacity="0.65" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M44 56c8 6 20 7 30 2" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* helmet side pods */}
      <circle cx="29" cy="52" r="4.5" fill="#7851a9" stroke="#1e293b" strokeWidth="1.5" />
      <circle cx="91" cy="52" r="4.5" fill="#00e5ff" stroke="#1e293b" strokeWidth="1.5" />
      {/* chest light */}
      <rect x="52" y="78" width="16" height="6" rx="3" fill="#0f172a" stroke="#94a3b8" strokeWidth="1" />
      <circle cx="60" cy="81" r="1.8" fill="#34d399" />
    </svg>
  )
}
