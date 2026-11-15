import { CREW_IDS, TOPICS, VIEWS } from './constants'

const TOGGLE_ACTIVE =
  'border-accent/60 bg-accent/15 text-accent'
const TOGGLE_IDLE =
  'border-white/10 bg-white/5 text-slate-300 hover:border-white/25 hover:text-white'

function ToggleButton({ pressed, onClick, children, title }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      title={title}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${pressed ? TOGGLE_ACTIVE : TOGGLE_IDLE}`}
    >
      {children}
    </button>
  )
}

// Compact filter bar: crew and topic are multi-select toggles, the view is a
// single-select segmented control, and "Only out-of-range" is a real checkbox.
export default function FilterBar({
  crew,
  topics,
  view,
  only,
  topicCounts,
  onToggleCrew,
  onToggleTopic,
  onView,
  onOnly,
  onReset,
}) {
  return (
    <section
      aria-label="Insights filters"
      className="rounded-2xl border border-white/10 bg-panel/80 p-3 shadow-lg shadow-black/20"
    >
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <fieldset className="min-w-0">
          <legend className="mb-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
            Crew
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {CREW_IDS.map((id) => (
              <ToggleButton key={id} pressed={crew.includes(id)} onClick={() => onToggleCrew(id)}>
                {id}
              </ToggleButton>
            ))}
          </div>
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="mb-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
            Topic
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {TOPICS.map((topic) => {
              const count = topicCounts?.[topic.id]
              let title = topic.hint ?? topic.label
              if (count > 0 && topic.id === 'rad') title = `${count} daily dose-rate readings`
              else if (count > 0) title = `${count} analytes with a ${topic.hint} panel`
              return (
                <ToggleButton
                  key={topic.id}
                  pressed={topics.includes(topic.id)}
                  onClick={() => onToggleTopic(topic.id)}
                  title={title}
                >
                  {topic.label}
                  {count > 0 ? <span className="ml-1 text-slate-500">{count}</span> : null}
                </ToggleButton>
              )
            })}
          </div>
        </fieldset>

        <div className="min-w-0">
          <p
            id="insights-view-label"
            className="mb-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400"
          >
            View
          </p>
          <div
            role="group"
            aria-labelledby="insights-view-label"
            className="inline-flex flex-wrap gap-1 rounded-xl border border-white/10 bg-panel2/70 p-1"
          >
            {VIEWS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={view === item.id}
                onClick={() => onView(item.id)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  view === item.id
                    ? 'bg-accent/15 text-accent'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pb-0.5">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={only}
              onChange={(event) => onOnly(event.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-panel2 accent-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            Only out-of-range
          </label>
          <button
            type="button"
            onClick={onReset}
            className="text-xs font-medium text-cyan-300 underline decoration-dotted underline-offset-2 hover:text-accent"
          >
            Reset filters
          </button>
        </div>
      </div>

      <p className="mt-2 text-[11px] leading-snug text-slate-500">
        Filters update the shared link. Totals follow the active crew profile; Crew also filters
        per-crew rows. Out-of-range filters lab flags.
      </p>
    </section>
  )
}
