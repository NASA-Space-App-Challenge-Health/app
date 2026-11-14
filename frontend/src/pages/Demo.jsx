import { useCallback, useState } from 'react'
import { api } from '../api'
import Card from '../components/Card'
import Chip from '../components/Chip'
import SourceLinks from '../components/SourceLinks'
import { ErrorState, Loading } from '../components/StateView'
import { useViewer } from '../context/ViewerContext'
import useFetch from '../hooks/useFetch'

// Guided demo: walks the OCHMO privacy story, the radiation emergency, the
// potassium preventive rule, and what is still simulated. The copy and the
// numbers come from /api/demo, built from rules/rules.yaml.
const TIER_TONE = {
  emergency: 'emergency',
  cmo: 'watch',
  flight_surgeon: 'watch',
  self: 'neutral',
}

export default function Demo() {
  const { viewer, role } = useViewer()
  const load = useCallback(() => api.demo({ viewer, role: role === 'self' ? 'flight_surgeon' : role }), [viewer, role])
  const { data, loading, error, reload } = useFetch(load, [viewer, role])
  const [step, setStep] = useState(0)

  if (loading) return <Loading label="Loading the guided demo…" />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const steps = data?.steps ?? []
  if (steps.length === 0) return <Card title="Guided demo">The API returned no demo steps.</Card>

  const current = steps[Math.min(step, steps.length - 1)]
  const alert = current.alert
  const recommendation = current.recommendation

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400">Guided demo</p>
        <h1 className="mt-1 text-2xl font-bold text-white">Four steps, two real NASA records</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Each step is generated from the rules the API ships. Emergency notices reach the whole crew; preventive
          cards stay with the CMO and the flight surgeon.
        </p>
      </header>

      <ol className="flex flex-wrap gap-2" aria-label="Demo steps">
        {steps.map((item, index) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setStep(index)}
              aria-current={index === step ? 'step' : undefined}
              className={`rounded-xl border px-3 py-2 text-xs transition-colors ${
                index === step
                  ? 'border-accent/60 bg-accent/10 text-accent'
                  : 'border-white/10 bg-panel/60 text-slate-300 hover:border-white/20 hover:text-white'
              }`}
            >
              <span className="block text-[10px] uppercase tracking-wide text-slate-500">{item.kicker}</span>
              {item.title}
            </button>
          </li>
        ))}
      </ol>

      <Card title={current.title} subtitle={current.kicker} action={<Chip kind={TIER_TONE[current.tier] ?? 'neutral'}>{current.tier}</Chip>}>
        <p className="text-sm leading-relaxed text-slate-200">{current.body}</p>

        {alert && (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Chip kind="emergency">Emergency · crew broadcast</Chip>
              <span className="text-sm font-semibold text-white">{alert.public_title ?? alert.title}</span>
            </div>
            <p className="mt-2 text-sm text-red-100">{alert.public_detail ?? alert.detail}</p>
            {alert.suggested_action && <p className="mt-2 text-xs text-red-200/80">{alert.suggested_action}</p>}
            <SourceLinks sources={alert.sources} className="mt-3" />
          </div>
        )}

        {recommendation && (
          <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Chip kind="watch">Preventive · {recommendation.tier}</Chip>
              <span className="text-sm font-semibold text-white">{recommendation.title}</span>
            </div>
            <p className="mt-2 text-sm text-amber-50">{recommendation.detail}</p>
            {recommendation.what_to_do && <p className="mt-2 text-xs text-amber-100/80">{recommendation.what_to_do}</p>}
            {recommendation.technical && (
              <p className="mt-2 text-[11px] text-amber-200/70">
                Reference range {recommendation.technical.earlier_value} → {recommendation.technical.later_value}{' '}
                {recommendation.technical.unit} ({recommendation.technical.earlier_timepoint} →{' '}
                {recommendation.technical.later_timepoint})
              </p>
            )}
            <SourceLinks sources={recommendation.sources} className="mt-3" />
          </div>
        )}

        {current.hygiene && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
            <p className="font-medium text-white">{current.hygiene.suggestion}</p>
            <p className="mt-1 text-xs text-slate-400">{current.hygiene.label}</p>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep((value) => Math.max(0, value - 1))}
            disabled={step === 0}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-[11px] text-slate-500">
            Step {Math.min(step, steps.length - 1) + 1} of {steps.length}
          </span>
          <button
            type="button"
            onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}
            disabled={step >= steps.length - 1}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-40"
          >
            Next step
          </button>
        </div>
      </Card>
    </div>
  )
}
