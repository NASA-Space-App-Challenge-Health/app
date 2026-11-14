// Small definition grid for the few numbers that carry a whole panel (peak dose
// rate, next SEP, forecast step). Keeps labels above values for screen readers.
export default function StatGrid({ items, className = '' }) {
  const list = Array.isArray(items) ? items : []
  if (list.length === 0) return null

  return (
    <dl className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-4 ${className}`}>
      {list.map((item) => (
        <div key={item.label} className="min-w-0 rounded-xl border border-white/10 bg-panel2/60 p-4">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{item.label}</dt>
          <dd className="mt-1 break-words text-lg font-semibold leading-snug text-white">
            {item.value}
            {item.unit && <span className="ml-1 text-xs font-normal text-slate-400">{item.unit}</span>}
          </dd>
          {item.hint && <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{item.hint}</p>}
        </div>
      ))}
    </dl>
  )
}
