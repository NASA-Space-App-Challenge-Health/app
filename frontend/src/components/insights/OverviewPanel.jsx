import Card from '../Card'
import { Empty } from '../StateView'
import { OutOfRangeChart } from './charts'
import {
  EXTREME_SPECS,
  formatCount,
  formatPercent,
  formatSignedPercent,
  isOutOfRange,
  matchesLabTopic,
  pickExtremeRow,
} from './constants'
import { BigStat, ChartCard, Details, FlagChip, Note } from './Ui'

function panelByAnalyteOf(analytes) {
  return Object.fromEntries((analytes ?? []).map((item) => [item.analyte, item.panel]))
}

export default function OverviewPanel({ data, crew, topics, only }) {
  const overview = data?.overview ?? {}
  const analytes = data?.analytes?.analytes ?? []
  const panelByAnalyte = panelByAnalyteOf(analytes)
  const timepoints = overview.timepoint_labels ?? []

  const flagRows = (data?.outOfRange?.analyte ?? []).map((analyte, index) => ({
    analyte,
    low: data.outOfRange.low?.[index] ?? 0,
    high: data.outOfRange.high?.[index] ?? 0,
  }))
  const visibleFlags = flagRows
    .filter((row) => matchesLabTopic(row.analyte, panelByAnalyte, topics))
    .slice(0, 8)

  const shiftRows = (data?.shift?.analyte ?? []).map((analyte, index) => ({
    analyte,
    unit: data.shift.unit?.[index] ?? '',
    mean_percent: data.shift.mean_percent?.[index] ?? null,
  }))
  const visibleShift = shiftRows
    .filter((row) => matchesLabTopic(row.analyte, panelByAnalyte, topics))
    .slice(0, 5)

  const extremeRows = (data?.extremes?.rows ?? []).filter(
    (row) =>
      crew.has(row.crew_id) &&
      matchesLabTopic(row.analyte, panelByAnalyte, topics) &&
      (!only || isOutOfRange(row.flag)),
  )
  const picked = []
  for (const spec of EXTREME_SPECS) {
    const row = pickExtremeRow(
      extremeRows,
      spec.analyte,
      spec.pick,
      crew,
      topics,
      panelByAnalyte,
    )
    if (row) picked.push({ row, label: spec.label })
  }
  for (const row of extremeRows) {
    if (picked.length >= 5) break
    if (picked.some((item) => item.row.analyte === row.analyte)) continue
    picked.push({
      row,
      label: `${row.flag === 'high' ? 'Highest' : 'Lowest'} ${String(row.analyte).toLowerCase()}`,
    })
  }

  const labTopicsOn = topics.has('cbc') || topics.has('cmp')

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <BigStat
          label="Lab rows"
          value={formatCount(overview.lab_rows)}
          hint={`Inspiration4 CBC/CMP results across ${overview.timepoints ?? '—'} timepoints.`}
        />
        <BigStat
          label="Analytes"
          value={formatCount(overview.analytes)}
          hint={`${analytes.length} CBC/CMP tests are listed with a printed range.`}
        />
        <BigStat
          label="Out of range"
          value={formatPercent(overview.pct_out_of_range)}
          hint={`${formatCount(overview.out_of_range_rows)} of ${formatCount(overview.rows_with_reference)} rows with a printed range.`}
        />
        <BigStat
          label="Solar particle events"
          value={formatCount(overview.sep_events)}
          hint="DONKI events logged for calendar 2024."
        />
        <BigStat
          label="Crew"
          value={formatCount(overview.crew_count)}
          hint="Civilians on a 3-day orbital flight; pre- and post-flight draws only."
        />
      </div>

      <Note>
        Totals are whole-cohort. The crew filter applies to per-crew rows below and on the Labs tab.
      </Note>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Most common out-of-range"
          provenance="real"
          summary="Glucose and urea nitrogen (BUN) flag most often, and flags are rare overall."
        >
          {labTopicsOn && visibleFlags.length > 0 ? (
            <OutOfRangeChart
              rows={visibleFlags}
              height={Math.max(280, visibleFlags.length * 34)}
              label="Out-of-range lab flags by test"
            />
          ) : (
            <Empty>Turn on Blood cells or Metabolism to see lab flags for this filter.</Empty>
          )}
          <Details label="What counts as out of range" className="mt-3">
            <p>
              Counts come from the reference range printed on each NASA lab row. A row is low or
              high only when it falls outside its own range.
            </p>
            <p>{data?.outOfRange?.note}</p>
          </Details>
        </ChartCard>

        <ChartCard
          title="Biggest shifts L-3 → R+1"
          provenance="real"
          summary="Eosinophils and absolute lymphocytes moved most between the last pre-flight and first post-flight draw."
        >
          {labTopicsOn && visibleShift.length > 0 ? (
            <ol className="divide-y divide-white/5">
              {visibleShift.map((row) => (
                <li
                  key={row.analyte}
                  className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                >
                  <span className="min-w-0 truncate text-sm text-slate-200">{row.analyte}</span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold text-white">
                      {formatSignedPercent(row.mean_percent)}
                    </span>
                    <span className="block text-[11px] text-slate-500">{row.unit}</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <Empty>Turn on Blood cells or Metabolism to see the shifts.</Empty>
          )}
          <Note>
            Crew-mean change; the crew filter does not apply. There is no in-flight sample in this
            extract.
          </Note>
        </ChartCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Notable extremes"
          provenance="real"
          summary="A few real records far outside their printed range, one per notable test."
        >
          {picked.length === 0 ? (
            <Empty>No extreme rows for this crew and topic filter.</Empty>
          ) : (
            <ul className="divide-y divide-white/5">
              {picked.map(({ row, label }) => (
                <li
                  key={`${row.crew_id}-${row.analyte}-${row.timepoint}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                >
                  <span className="min-w-0">
                    <span className="block text-sm text-slate-200">{label}</span>
                    <span className="block text-[11px] text-slate-500">
                      {row.crew_id} · {row.timepoint}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">
                      {row.value} <span className="text-xs text-slate-400">{row.unit}</span>
                    </span>
                    <FlagChip flag={row.flag} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Details label="How extremes are ranked" className="mt-3">
            <p>{data?.extremes?.note}</p>
          </Details>
        </ChartCard>

        <Card title="Scope of this data">
          <p className="line-clamp-2 text-sm leading-relaxed text-slate-300">
            {overview.scope ?? 'Scope unavailable.'}
          </p>
          <Details label="Full scope and timepoints" className="mt-3">
            <p>{overview.scope}</p>
            <p>Timepoints: {timepoints.join(', ') || '—'}</p>
            <p>
              Radiation covers {overview.radiation_days ?? '—'} days of one ISS DosTel week; solar
              events cover calendar 2024. Not a long-duration crew dataset.
            </p>
          </Details>
        </Card>
      </div>
    </div>
  )
}
