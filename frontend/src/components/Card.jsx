export default function Card({ title, subtitle, action, children, className = '', as: Tag = 'section' }) {
  return (
    <Tag className={`rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-lg shadow-black/20 ${className}`}>
      {(title || action) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-semibold text-white">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </Tag>
  )
}
