import Card from '../Card'
import Chip from '../Chip'
import { Empty } from '../StateView'
import PrivacyNote from './PrivacyNote'
import MetricBar from './MetricBar'
import { flagKind, flagLabel, formatMeasurement, formatRange, safeArray, bandsForLab } from './format'

const DEFAULT_ORDER = ['GLUCOSE', 'HEMOGLOBIN', 'WHITE BLOOD CELL COUNT', 'PLATELET COUNT', 'POTASSIUM', 'SODIUM', 'CREATININE']

// Inspiration4 CBC/CMP rows. The API returns `labs: null` for a crew member the
// current role may not read, so the table swaps to the privacy note.
export default function LabsTable({
  labs,
  role,
  title = 'Released research labs',
  subtitle = 'Released CBC/CMP lab rows, de-identified by NASA. Not a diagnosis.',
  analytes,
  emptyMessage = 'No lab rows for this crew member in the API response.',
}) {
  const rows = safeArray(labs)
  const order = analytes ?? DEFAULT_ORDER
  const filtered = rows
    .filter((lab) => order.includes(lab.analyte))
    .sort((left, right) => order.indexOf(left.analyte) - order.indexOf(right.analyte))

  return (
    <Card
      title={title}
      subtitle={subtitle}
      className="min-w-0 overflow-hidden"
      action={<Chip kind="real">Real NASA</Chip>}
    >
      {labs === null || labs === undefined ? (
        <PrivacyNote role={role} scope="labs" />
      ) : filtered.length === 0 ? (
        <Empty>{emptyMessage}</Empty>
      ) : (
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-wide text-slate-400">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Test
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Value
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Reference range
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Flag
                </th>
                <th scope="col" className="py-2 font-medium">
                  Source study
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lab) => (
                <tr key={`${lab.analyte}-${lab.timepoint}`} className="border-b border-white/5 last:border-0">
                  <th scope="row" className="py-2 pr-4 font-normal">
                    <span className="block text-slate-200">{lab.analyte}</span>
                    {lab.timepoint && <span className="block text-[11px] text-slate-500">Draw {lab.timepoint}</span>}
                  </th>
                  <td className="py-2 pr-4 text-white">
                    {formatMeasurement(lab.value)}
                    {lab.unit && <span className="ml-1 text-xs text-slate-400">{lab.unit}</span>}
                  </td>
                  <td className="py-2 pr-4 text-slate-400">
                    <span className="block">{formatRange(lab.ref_low, lab.ref_high)}</span>
                    {lab.value != null && (
                      <MetricBar
                        value={lab.value}
                        unit={lab.unit}
                        bands={bandsForLab(lab)}
                        kind={lab.flag === 'normal' ? 'nominal' : 'watch'}
                        compact
                        label={lab.analyte}
                        className="mt-1 max-w-[150px]"
                      />
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <Chip kind={flagKind(lab.flag)}>{flagLabel(lab.flag)}</Chip>
                  </td>
                  <td className="py-2 text-xs text-slate-400">{lab.source_study ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
