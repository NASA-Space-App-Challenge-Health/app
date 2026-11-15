import { useNavigate } from 'react-router-dom'
import { Fingerprint } from 'lucide-react'

// Access screen from the design screens. The demo has no login: the button
// models the biometric hand-off and drops the visitor on the crew board.
export default function Login() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen items-center justify-center bg-space px-4 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-panel/80 p-10 text-center shadow-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-400">T.H.A.I.S.</p>
        <span className="mx-auto mb-6 mt-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
          <Fingerprint size={36} className="text-accent" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-bold text-white">Crew access</h1>
        <p className="mt-1 text-xs text-slate-400">Tech &amp; Health Astronaut Intelligent System</p>
        <p className="mt-2 text-sm text-slate-400">
          Biometric identification is simulated in this prototype. The board opens with the C001 view.
        </p>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="mt-8 w-full rounded-xl bg-accent py-3 text-sm font-bold text-black transition-colors hover:bg-cyan-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Simulate authorised access
        </button>
        <p className="mt-6 text-[11px] text-slate-500">
          NASA Space Apps Challenge 2026 · demo only, no real crew data.
        </p>
      </div>
    </div>
  )
}
