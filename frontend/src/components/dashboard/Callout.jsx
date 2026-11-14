// One-line explanatory note. Used where a panel needs a caveat but a paragraph
// of disclaimer would bury the numbers.
export default function Callout({ children, tone = 'neutral' }) {
  const toneClass =
    tone === 'warn'
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
      : 'border-white/10 bg-white/[0.03] text-slate-300'
  return <p className={`rounded-xl border p-3 text-xs leading-relaxed ${toneClass}`}>{children}</p>
}
