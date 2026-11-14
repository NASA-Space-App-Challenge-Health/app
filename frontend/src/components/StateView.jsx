export function Loading({ label = 'Loading data from the API…' }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-panel/60 p-6 text-sm text-slate-300">
      <span className="h-3 w-3 animate-pulse rounded-full bg-accent" aria-hidden="true" />
      {label}
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  return (
    <div role="alert" className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-200">
      <p className="font-medium">The board could not load.</p>
      <p className="mt-1 text-red-200/80">{error}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg border border-red-400/50 px-3 py-1.5 text-xs font-semibold text-red-100 transition-colors hover:bg-red-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
        >
          Try again
        </button>
      )}
    </div>
  )
}

export function Empty({ children }) {
  return (
    <p className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-slate-400">
      {children}
    </p>
  )
}

export default function StateView({ loading, error, onRetry, label }) {
  if (loading) return <Loading label={label} />
  if (error) return <ErrorState error={error} onRetry={onRetry} />
  return null
}
