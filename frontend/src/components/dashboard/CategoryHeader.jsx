import { Link } from 'react-router-dom'

// Page header for the four category pages: title, one-line purpose, and a way
// back to the overview board.
export default function CategoryHeader({ category }) {
  const Icon = category.icon

  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400">
          <Icon size={14} aria-hidden="true" />
          Category
        </p>
        <h1 className="mt-1 text-2xl font-bold text-white">{category.title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">{category.purpose}</p>
      </div>
      <Link
        to="/dashboard"
        className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-white/25 hover:text-white"
      >
        Back to overview
      </Link>
    </header>
  )
}
