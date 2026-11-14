// Shown wherever the API hides a crew member's numbers from the current role.
// The OCHMO privacy story is the whole point of the demo, so the panel explains
// the state instead of rendering empty numbers.
export default function PrivacyNote({ role, scope = 'numbers' }) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-4">
      <p className="text-sm font-medium text-slate-200">Private in this role</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">
        The {role ?? 'current'} role cannot read this crew member&apos;s {scope}. Switch to Self, CMO, or Flight
        surgeon in the header to reveal them.
      </p>
    </div>
  )
}
