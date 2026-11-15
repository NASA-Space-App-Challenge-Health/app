import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Chip, { OriginChip } from '../Chip'
import MetricBar from './MetricBar'
import { bandsForLab, formatNumber } from './format'

// Four body-system summaries for the Overview. Each card answers "is this
// system okay?" with real measurements and clearly-labelled POC estimates, and
// links to the category page for charts, evidence and role detail.

function bandKind(riskBand) {
  if (riskBand === 'watch') return 'watch'
  if (riskBand === 'concern' || riskBand === 'critical') return 'concern'
  return 'nominal'
}

function bandLabel(riskBand) {
  if (riskBand === 'nominal') return 'Nominal'
  if (riskBand === 'watch') return 'Watch'
  if (riskBand === 'concern' || riskBand === 'critical') return 'Concern'
  return 'No band'
}

function readingRow(reading) {
  if (!reading || reading.value == null) return null
  return {
    key: reading.indicator,
    label: reading.label,
    value: reading.value,
    display: formatNumber(reading.value, reading.decimals ?? 1),
    unit: reading.unit,
    bands: reading.bands,
    kind: bandKind(reading.risk_band),
    status: bandLabel(reading.risk_band),
    origin: reading.origin,
  }
}

function labRow(lab) {
  if (!lab || lab.value == null) return null
  return {
    key: `lab-${lab.analyte}`,
    label: lab.analyte,
    value: lab.value,
    display: formatNumber(lab.value, Number.isInteger(Number(lab.value)) ? 0 : 1),
    unit: lab.unit,
    bands: bandsForLab(lab),
    kind: lab.flag === 'normal' ? 'nominal' : 'watch',
    status: lab.flag === 'normal' ? 'In range' : lab.flag === 'high' ? 'High' : 'Low',
    origin: lab.origin,
  }
}

function Row({ row }) {
  return (
    <li className="border-t border-white/5 py-2 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-xs text-slate-300">{row.label}</span>
        <span className="shrink-0 text-sm font-semibold text-white">
          {row.display ?? row.value}
          <span className="ml-1 text-[11px] font-normal text-slate-400">{row.unit}</span>
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <MetricBar value={row.value} unit={row.unit} bands={row.bands} kind={row.kind} compact className="flex-1" />
        <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-500">{row.status}</span>
      </div>
    </li>
  )
}

function SystemCard({ title, href, count, countKind, rows, note, visible, privateNote }) {
  const origins = new Set(rows.map((row) => row.origin).filter(Boolean))
  return (
    <article className="flex h-full min-w-0 flex-col rounded-2xl border border-white/10 bg-panel/80 p-4 shadow-lg shadow-black/20">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {count && <Chip kind={countKind ?? 'neutral'}>{count}</Chip>}
      </div>

      {!visible ? (
        <p className="mt-3 text-xs leading-relaxed text-slate-400">{privateNote ?? 'Private in this role.'}</p>
      ) : rows.length > 0 ? (
        <ul className="mt-3">
          {rows.map((row) => (
            <Row key={row.key} row={row} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs leading-relaxed text-slate-400">{note ?? 'No measured values for this system.'}</p>
      )}

      {visible && note && rows.length > 0 && <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{note}</p>}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {origins.has('real') && <OriginChip origin="real" />}
          {origins.has('simulated') && <OriginChip origin="simulated" />}
          {!visible && <Chip kind="neutral">Private</Chip>}
        </div>
        <Link to={href} className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:text-cyan-200">
          Open details
          <ArrowRight size={12} aria-hidden="true" />
        </Link>
      </div>
    </article>
  )
}

export default function SystemCards({ member, radiation, alerts = [], visible }) {
  const readings = member?.readings ?? []
  const labs = member?.labs ?? []
  const byIndicator = Object.fromEntries(readings.filter(Boolean).map((item) => [item.indicator, item]))
  const byAnalyte = Object.fromEntries(labs.filter(Boolean).map((item) => [item.analyte, item]))

  const emergency = alerts.some((alert) => alert.tier === 'emergency' || alert.severity === 'critical')
  const peak = radiation?.peak
  const peakBand = peak
    ? {
        physical: [0, 700],
        nominal: [0, radiation?.spike_threshold_ugy_h ?? 400],
        watch: [0, (radiation?.spike_threshold_ugy_h ?? 400) * 1.75],
        label: 'The app rule (400 µGy/h) is a setting, not a NASA flight limit.',
      }
    : null

  const brainRows = [readingRow(byIndicator.sleep_hours), readingRow(byIndicator.cortisol_ug_dl)].filter(Boolean)
  const bloodRows = [
    readingRow(byIndicator.heart_rate),
    readingRow(byIndicator.spo2),
    labRow(byAnalyte.POTASSIUM),
    labRow(byAnalyte.GLUCOSE),
  ].filter(Boolean)
  const radiationRows = [
    readingRow(byIndicator.temperature_c),
    peak
      ? {
          key: 'radiation-peak',
          label: 'Radiation peak (raw sample)',
          value: Number(peak.absorbed_dose_rate).toFixed(1),
          display: Number(peak.absorbed_dose_rate).toFixed(1),
          unit: 'µGy/h',
          bands: peakBand,
          kind: peak.absorbed_dose_rate >= (radiation?.spike_threshold_ugy_h ?? 400) ? 'watch' : 'nominal',
          status: peak.absorbed_dose_rate >= (radiation?.spike_threshold_ugy_h ?? 400) ? 'Above rule' : 'Below rule',
          origin: 'real',
        }
      : null,
  ].filter(Boolean)

  const inRangeCount = (rows) => rows.filter((row) => row.status === 'In range' || row.status === 'Nominal').length

  return (
    <section aria-labelledby="systems-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="systems-title" className="text-base font-semibold text-white">
            Systems at a glance
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Real measurements and labelled POC estimates, each with its own band. Open a system for the charts,
            evidence and role detail.
          </p>
        </div>
        <Chip kind="real">Real NASA</Chip>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SystemCard
          title="Brain & balance"
          href="/dashboard/brain"
          visible={visible}
          rows={brainRows}
          count={visible && brainRows.length ? `${brainRows.length} POC` : null}
          countKind="simulated"
          note="Sleep and cortisol are simulated POC estimates. The open data has no EEG, balance test or cognitive score."
        />
        <SystemCard
          title="Blood & heart"
          href="/dashboard/heart"
          visible={visible}
          rows={bloodRows}
          count={visible && bloodRows.length ? `${inRangeCount(bloodRows)} of ${bloodRows.length} in range` : null}
          countKind={visible && inRangeCount(bloodRows) === bloodRows.length ? 'nominal' : 'watch'}
          note="Potassium and glucose are real OSD-575 draws; heart rate and oxygen are simulated POC estimates."
        />
        <SystemCard
          title="Radiation & temperature"
          href="/dashboard/radiation"
          visible
          rows={radiationRows}
          count={emergency ? '1 emergency' : null}
          countKind="emergency"
          note={
            peak
              ? `Real DosTel raw peak ${Number(peak.absorbed_dose_rate).toFixed(1)} µGy/h on ${String(peak.recorded_at).slice(8, 10)}/${String(peak.recorded_at).slice(5, 7)}/${String(peak.recorded_at).slice(0, 4)}. Area dose, not a personal dose.`
              : 'No DosTel peak in the payload.'
          }
        />
        <SystemCard
          title="Muscles & bones"
          href="/dashboard/muscles"
          visible
          rows={[]}
          count="No measured values"
          countKind="neutral"
          note="This open-data package has no DXA, bone-density or muscle-mass record. The category page shows prevention guidance from CSA, HRP and OCHMO."
        />
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
        Green band = nominal range · amber band = watch range · marker = current value. Labs use the range printed on
        the NASA row; simulated vitals use the illustrative POC band.
      </p>
    </section>
  )
}
