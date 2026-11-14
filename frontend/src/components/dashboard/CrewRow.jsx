import Chip, { bandChip } from '../Chip'
import { safeArray } from './format'

// Four clickable crew cards. Clicking a card changes the shared viewer in the
// URL, so the whole board re-fetches for that crew member. A hidden crew member
// never shows numbers: the demo makes the OCHMO privacy rule visible.
export default function CrewRow({ crew, selected, onSelect }) {
  const members = safeArray(crew)

  return (
    <section aria-labelledby="crew-row-title">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="crew-row-title" className="text-sm font-semibold text-white">
          Crew
        </h2>
        <p className="text-[11px] text-slate-500">Select a crew member to change the viewer.</p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {members.map((member) => {
          const active = member.call_sign === selected
          const hidden = member.visible !== 'full'
          return (
            <li key={member.call_sign}>
              <button
                type="button"
                onClick={() => onSelect(member.call_sign)}
                aria-pressed={active}
                aria-label={`View ${member.call_sign}${hidden ? ', private in this role' : ''}`}
                className={`h-full w-full rounded-xl border p-4 text-left transition-colors ${
                  active
                    ? 'border-accent/60 bg-accent/10'
                    : 'border-white/10 bg-panel/80 hover:border-white/25'
                }`}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block text-base font-semibold text-white">{member.call_sign}</span>
                    <span className="block truncate text-xs text-slate-400">{member.full_name}</span>
                  </span>
                  {member.is_cmo && <Chip kind="real">CMO</Chip>}
                </span>

                <span className="mt-3 flex flex-wrap items-center gap-2">
                  {hidden ? <Chip kind="neutral">Private in this role</Chip> : bandChip(member.overall_band)}
                  {active && <span className="text-[11px] font-semibold text-accent">Selected</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
