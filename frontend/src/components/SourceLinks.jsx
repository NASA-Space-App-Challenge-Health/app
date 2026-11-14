// Every claim on the board points at a page the project actually uses. The API
// returns {id, url, title} records; this renders them as small links.
export default function SourceLinks({ sources = [], className = '' }) {
  if (!sources || sources.length === 0) return null
  return (
    <ul className={`flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400 ${className}`}>
      {sources.map((source) => (
        <li key={source.id ?? source.url}>
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-dotted underline-offset-2 transition-colors hover:text-cyan-300"
          >
            {source.title ?? source.id ?? source.url}
          </a>
        </li>
      ))}
    </ul>
  )
}
