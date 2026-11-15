import { useCallback, useEffect, useState } from 'react'
import { HandHeart, Loader2, Send, ShieldCheck, X } from 'lucide-react'
import { api } from '../../api'
import { useViewer } from '../../context/ViewerContext'
import Card from '../Card'
import Chip from '../Chip'

// Crew-to-crew help loop. A request is a persisted row: the requester sees
// "help on the way" as soon as another crew member accepts. Polling keeps the
// two sessions in sync (no websocket yet). The free-text note is private to the
// CMO, the flight surgeon and the requester; the API already redacts it.
const POLL_MS = 3000
const ACTIVE = new Set(['requested', 'accepted', 'escalated'])

const MODULES = ['Node 1', 'Node 2', 'Columbus', 'Cupola', 'US Lab', 'Airlock', 'Service Module']
const REASONS = [
  ['injury', 'Injury or fall'],
  ['chest_discomfort', 'Chest discomfort'],
  ['breathing', 'Breathing trouble'],
  ['dizziness', 'Dizziness'],
  ['illness', 'Feeling unwell'],
  ['radiation', 'Radiation concern'],
  ['other', 'Other'],
]

function StatusChip({ item }) {
  if (item.status === 'accepted') return <Chip kind="nominal">Help on the way</Chip>
  if (item.status === 'escalated') return <Chip kind="concern">Escalated</Chip>
  if (item.status === 'closed') return <Chip kind="neutral">Closed</Chip>
  return <Chip kind="watch">Waiting for a responder</Chip>
}

export default function HelpPanel() {
  const { viewer, role } = useViewer()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ module: 'Node 2', reason_code: 'illness', reason_text: '' })

  const load = useCallback(async () => {
    try {
      const payload = await api.helpRequests({ viewer, role })
      setData(payload)
      setError('')
    } catch (err) {
      setError(err.message || 'The help channel is unavailable.')
    }
  }, [viewer, role])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- first poll intentionally runs on mount
    load()
    const interval = setInterval(load, POLL_MS)
    return () => clearInterval(interval)
  }, [load])

  const mine = data?.mine ?? null
  const mineActive = mine && ACTIVE.has(mine.status)
  const open = Array.isArray(data?.open) ? data.open : []
  const others = open.filter((item) => item.requester !== viewer)

  async function run(action) {
    setBusy(true)
    setActionError('')
    try {
      await action()
      await load()
    } catch (err) {
      setActionError(err.message || 'Action failed.')
    } finally {
      setBusy(false)
    }
  }

  function submitRequest(event) {
    event.preventDefault()
    run(async () => {
      await api.createHelpRequest({
        requester: viewer,
        module: form.module,
        reason_code: form.reason_code,
        reason_text: form.reason_text.trim() ? form.reason_text.trim() : null,
      })
      setFormOpen(false)
      setForm((current) => ({ ...current, reason_text: '' }))
    })
  }

  return (
    <Card
      title="Ask for help"
      subtitle="Crew-to-crew: request, acceptance, and “help on the way”."
      action={
        <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400">
          <HandHeart size={14} aria-hidden="true" />
          {data?.counts?.open ?? 0} open
        </span>
      }
    >
      {error && (
        <p role="alert" className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">
          {error}
        </p>
      )}

      {mine && mineActive && (
        <div
          className={`mb-4 rounded-xl border p-3 ${
            mine.status === 'accepted'
              ? 'border-emerald-500/40 bg-emerald-500/10'
              : mine.status === 'escalated'
                ? 'border-amber-500/40 bg-amber-500/10'
                : 'border-cyan-500/40 bg-cyan-500/10'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip item={mine} />
            <span className="text-sm font-semibold text-white">
              {mine.status === 'accepted'
                ? `Help on the way: ${mine.accepted_by}`
                : mine.status === 'escalated'
                  ? 'No responder yet — the on-call crew was alerted'
                  : 'Help requested — waiting for a responder'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-300">
            {mine.module} · {mine.reason_label} · {mine.age_seconds}s ago
            {mine.time_to_accept_seconds != null && ` · accepted in ${mine.time_to_accept_seconds}s`}
          </p>
          {mine.reason_text && (
            <p className="mt-1 text-[11px] text-slate-400">
              Private note (you, the CMO, and the flight surgeon): {mine.reason_text}
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(() => api.closeHelpRequest(mine.id, { crew: viewer, role }))
              }
              className="rounded-lg border border-white/20 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/5 disabled:opacity-50"
            >
              Close request
            </button>
          </div>
        </div>
      )}

      {!mineActive && !formOpen && (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="mb-4 inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-black hover:bg-cyan-300"
        >
          <HandHeart size={16} aria-hidden="true" />
          Request help
        </button>
      )}

      {formOpen && (
        <form onSubmit={submitRequest} className="mb-4 space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-[11px] uppercase tracking-wide text-slate-400">
              Module
              <select
                value={form.module}
                onChange={(event) => setForm((current) => ({ ...current, module: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-panel px-2 py-1.5 text-sm text-white"
              >
                {MODULES.map((module) => (
                  <option key={module} value={module}>
                    {module}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] uppercase tracking-wide text-slate-400">
              Reason
              <select
                value={form.reason_code}
                onChange={(event) => setForm((current) => ({ ...current, reason_code: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-panel px-2 py-1.5 text-sm text-white"
              >
                {REASONS.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-[11px] uppercase tracking-wide text-slate-400">
            Private note (optional — only you, the CMO, and the flight surgeon see it)
            <input
              value={form.reason_text}
              maxLength={300}
              onChange={(event) => setForm((current) => ({ ...current, reason_text: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-panel px-2 py-1.5 text-sm text-white"
              placeholder="e.g. chest tightness after exercise"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
              Send request
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300"
            >
              <X size={13} aria-hidden="true" />
              Cancel
            </button>
          </div>
        </form>
      )}

      {actionError && (
        <p role="alert" className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-200">
          {actionError}
        </p>
      )}

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-400">
          <ShieldCheck size={13} aria-hidden="true" />
          Open requests from the crew
        </p>
        {others.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 p-3 text-xs text-slate-400">
            No open requests. The crew is quiet.
          </p>
        ) : (
          <ul className="space-y-2">
            {others.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-white">
                    <span className="font-semibold">{item.requester}</span> needs help · {item.module} ·{' '}
                    {item.reason_label}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {item.age_seconds}s ago
                    {item.accepted_by && ` · ${item.accepted_by} is responding`}
                    {item.time_to_accept_seconds != null && ` · accepted in ${item.time_to_accept_seconds}s`}
                  </p>
                  {item.reason_text && (
                    <p className="mt-1 text-[11px] text-slate-400">Private note: {item.reason_text}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusChip item={item} />
                  {item.can_accept && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(() => api.acceptHelpRequest(item.id, { crew: viewer }))}
                      className="rounded-lg bg-accent px-2.5 py-1 text-[11px] font-semibold text-black disabled:opacity-50"
                    >
                      I&apos;m responding
                    </button>
                  )}
                  {item.accepted_by === viewer && item.can_close && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(() => api.closeHelpRequest(item.id, { crew: viewer, role }))}
                      className="rounded-lg border border-white/20 px-2.5 py-1 text-[11px] text-slate-200 disabled:opacity-50"
                    >
                      Close
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
