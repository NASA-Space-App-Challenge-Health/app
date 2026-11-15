export default function Card({ title, subtitle, action, children, className = '', as: Tag = 'section' }) {
  return (
    <Tag className={`rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-lg shadow-black/20 ${className}`}>
      {(title || action) && (
        <header className="mb-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="min-w-0 flex-1">
            {title && <h2 className="text-base font-semibold leading-snug text-white">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {children}
    </Tag>
  )
}
