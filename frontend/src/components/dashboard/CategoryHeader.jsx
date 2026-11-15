import { Link } from 'react-router-dom'

// Page header for the four category pages: the system name and a way back.
export default function CategoryHeader({ category }) {
  const Icon = category.icon

  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
        <Icon size={20} className="text-cyan-300" aria-hidden="true" />
        {category.title}
      </h1>
      <Link
        to="/dashboard"
        className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-white/25 hover:text-white"
      >
        Back to overview
      </Link>
    </header>
  )
}
