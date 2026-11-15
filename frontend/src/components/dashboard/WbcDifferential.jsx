import Card from '../Card'
import Chip from '../Chip'
import PrivacyNote from './PrivacyNote'
import { flagKind, flagLabel, formatMeasurement, formatRange, safeArray } from './format'

// The blood panel shows the total white-cell count. This table names the five
// types behind that total so an eosinophil/neutrophil recommendation has a
// visible home.
const CELL_TYPES = [
  { label: 'Neutrophils', pct: 'NEUTROPHILS', absolute: 'ABSOLUTE NEUTROPHILS' },
  { label: 'Lymphocytes', pct: 'LYMPHOCYTES', absolute: 'ABSOLUTE LYMPHOCYTES' },
  { label: 'Monocytes', pct: 'MONOCYTES', absolute: 'ABSOLUTE MONOCYTES' },
  { label: 'Eosinophils', pct: 'EOSINOPHILS', absolute: 'ABSOLUTE EOSINOPHILS' },
  { label: 'Basophils', pct: 'BASOPHILS', absolute: 'ABSOLUTE BASOPHILS' },
]

function worseFlag(...rows) {
  const flags = rows.map((row) => row?.flag).filter(Boolean)
  if (flags.includes('high')) return 'high'
  if (flags.includes('low')) return 'low'
  return 'normal'
}

export default function WbcDifferential({ rows, role }) {
  if (rows === null || rows === undefined) {
    return (
      <Card title="White blood cell differential" className="min-w-0 overflow-hidden">
        <PrivacyNote role={role} scope="labs" />
      </Card>
    )
  }

  const labs = safeArray(rows)
  if (labs.length === 0) return null

  const byAnalyte = Object.fromEntries(labs.map((row) => [row.analyte, row]))
  const cells = CELL_TYPES.map((type) => ({
    ...type,
    share: byAnalyte[type.pct],
    absolute: byAnalyte[type.absolute],
  })).filter((cell) => cell.share || cell.absolute)

  if (cells.length === 0) return null

  return (
    <Card
      title="White blood cell differential"
      subtitle="The five types behind the total white-cell count."
      action={<Chip kind="real">Real NASA</Chip>}
      className="min-w-0 overflow-hidden"
    >
      <div className="max-w-full overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <caption className="sr-only">White blood cell differential, latest released CBC draw</caption>
          <thead>
            <tr className="border-b border-white/10 text-[11px] uppercase tracking-wide text-slate-400">
              <th scope="col" className="py-2 pr-4 font-medium">
                Cell type
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Share of total WBC
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Absolute count
              </th>
              <th scope="col" className="py-2 font-medium">
                Flag
              </th>
            </tr>
          </thead>
          <tbody>
            {cells.map((cell) => {
              const flag = worseFlag(cell.share, cell.absolute)
              return (
                <tr key={cell.label} className="border-b border-white/5 last:border-0">
                  <th scope="row" className="py-2 pr-4 font-normal text-slate-200">
                    {cell.label}
                  </th>
                  <td className="py-2 pr-4 text-white">
                    {cell.share ? (
                      <>
                        {formatMeasurement(cell.share.value)}
                        <span className="ml-0.5 text-xs text-slate-400">%</span>
                        <span className="mt-0.5 block text-[11px] text-slate-500">
                          {formatRange(cell.share.ref_low, cell.share.ref_high, '%')}
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-white">
                    {cell.absolute ? (
                      <>
                        {formatMeasurement(cell.absolute.value)}
                        <span className="ml-1 text-xs text-slate-400">{cell.absolute.unit}</span>
                        <span className="mt-0.5 block text-[11px] text-slate-500">
                          {formatRange(cell.absolute.ref_low, cell.absolute.ref_high, cell.absolute.unit)}
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="py-2">
                    <Chip kind={flagKind(flag)}>{flagLabel(flag)}</Chip>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-slate-500">
        Latest released CBC draw. Percentages are the share of all white cells; absolute counts are cells per µL.
      </p>
    </Card>
  )
}
