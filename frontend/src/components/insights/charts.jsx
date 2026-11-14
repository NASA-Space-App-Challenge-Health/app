import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  CHART_AXIS,
  CHART_COLORS,
  CHART_GRID,
  CHART_LEGEND,
  CHART_TOOLTIP,
  formatDay,
  formatMonth,
  formatSignedPercent,
} from './constants'

// Recharts wrappers for the Insights page. Each chart gets a role="img" label
// and the panel renders a plain-language summary sentence above it.

function Figure({ label, children }) {
  return (
    <div role="img" aria-label={label} className="w-full">
      {children}
    </div>
  )
}

// Single-line category tick: truncates long analyte names and keeps the full
// name in a native SVG <title>. Keeps rows from overlapping on the bar charts.
function AnalyteTick({ x, y, payload }) {
  const full = String(payload?.value ?? '')
  const short = full.length > 22 ? `${full.slice(0, 21)}…` : full
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={4} textAnchor="end" fill="#94a3b8" fontSize={11}>
        {short}
        <title>{full}</title>
      </text>
    </g>
  )
}

export function OutOfRangeChart({ rows, height = 240, label = 'Out-of-range flags by test' }) {
  return (
    <Figure label={label}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 4 }}>
          <CartesianGrid stroke={CHART_GRID} horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={CHART_AXIS} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="analyte"
            width={190}
            interval={0}
            tickMargin={8}
            tick={<AnalyteTick />}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            {...CHART_TOOLTIP}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            formatter={(value, name) => [value, name === 'Low' ? 'Low flags' : 'High flags']}
          />
          <Legend wrapperStyle={CHART_LEGEND} iconSize={9} />
          <Bar isAnimationActive={false} dataKey="low" name="Low" stackId="flags" fill={CHART_COLORS[3]} barSize={12} />
          <Bar isAnimationActive={false} dataKey="high" name="High" stackId="flags" fill={CHART_COLORS[4]} barSize={12} />
        </BarChart>
      </ResponsiveContainer>
    </Figure>
  )
}

export function ShiftChart({ rows, height = 300, label = 'Mean percent change from L-3 to R+1' }) {
  return (
    <Figure label={label}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 52, bottom: 0, left: 4 }}
        >
          <CartesianGrid stroke={CHART_GRID} horizontal={false} />
          <XAxis type="number" tick={CHART_AXIS} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="analyte"
            width={190}
            interval={0}
            tickMargin={8}
            tick={<AnalyteTick />}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            {...CHART_TOOLTIP}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            formatter={(value, name, entry) => [
              `${formatSignedPercent(value)} ${entry?.payload?.unit ?? ''}`.trim(),
              'Mean change L-3 to R+1',
            ]}
          />
          <Bar isAnimationActive={false} dataKey="mean_percent" name="Mean change" barSize={12}>
            <LabelList
              dataKey="mean_percent"
              position="right"
              fill="#cbd5e1"
              fontSize={10}
              formatter={(value) => formatSignedPercent(value)}
            />
            {rows.map((row) => (
              <Cell
                key={row.analyte}
                fill={row.mean_percent > 0 ? CHART_COLORS[3] : CHART_COLORS[0]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Figure>
  )
}

export function TrendLineChart({
  timepoints = [],
  traces = [],
  refLow,
  refHigh,
  unit,
  height = 300,
  label = 'Lab value per crew across timepoints with the printed reference range',
}) {
  const rows = timepoints.map((timepoint) => {
    const row = { timepoint }
    for (const trace of traces) {
      const index = Array.isArray(trace.x) ? trace.x.indexOf(timepoint) : -1
      row[trace.name] = index >= 0 && trace.y?.[index] != null ? trace.y[index] : null
    }
    return row
  })
  const hasBand = typeof refLow === 'number' && typeof refHigh === 'number'
  const values = []
  for (const trace of traces) {
    for (const value of trace.y ?? []) if (typeof value === 'number') values.push(value)
  }
  if (typeof refLow === 'number') values.push(refLow)
  if (typeof refHigh === 'number') values.push(refHigh)
  let domain = ['auto', 'auto']
  if (values.length > 0) {
    const min = Math.min(...values)
    const max = Math.max(...values)
    const pad = (max - min) * 0.08 || 1
    domain = [
      min >= 0 ? Math.max(0, Math.floor(min - pad)) : Math.floor(min - pad),
      Math.ceil(max + pad),
    ]
  }
  return (
    <Figure label={label}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={CHART_GRID} />
          <XAxis dataKey="timepoint" tick={CHART_AXIS} axisLine={false} tickLine={false} />
          <YAxis
            tick={CHART_AXIS}
            axisLine={false}
            tickLine={false}
            domain={domain}
            width={44}
            tickMargin={4}
          />
          {hasBand && (
            <>
              <ReferenceArea
                isAnimationActive={false}
                y1={refLow}
                y2={refHigh}
                fill={CHART_COLORS[1]}
                fillOpacity={0.18}
                stroke="none"
              />
              <ReferenceLine y={refLow} stroke={CHART_COLORS[1]} strokeDasharray="4 4" />
              <ReferenceLine y={refHigh} stroke={CHART_COLORS[1]} strokeDasharray="4 4" />
            </>
          )}
          <Tooltip
            {...CHART_TOOLTIP}
            formatter={(value, name) => [`${value}${unit ? ` ${unit}` : ''}`, name]}
            labelFormatter={(timepointValue) => `Draw ${timepointValue}`}
          />
          <Legend wrapperStyle={CHART_LEGEND} iconSize={9} />
          {traces.map((trace, index) => (
            <Line
              isAnimationActive={false}
              key={trace.name}
              type="monotone"
              dataKey={trace.name}
              stroke={CHART_COLORS[index % CHART_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 2.5, strokeWidth: 0 }}
              activeDot={{ r: 4 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Figure>
  )
}

export function RadiationDailyChart({
  daily,
  threshold,
  unit = 'µGy/h',
  height = 260,
  label = 'Daily mean and maximum area dose rate, not a personal dose',
}) {
  const rows = (daily?.x ?? []).map((day, index) => ({
    day: formatDay(day),
    mean: daily.mean_ugy_h?.[index] ?? null,
    max: daily.max_ugy_h?.[index] ?? null,
  }))
  return (
    <Figure label={label}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={rows} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART_GRID} />
          <XAxis dataKey="day" tick={CHART_AXIS} axisLine={false} tickLine={false} />
          <YAxis
            tick={CHART_AXIS}
            axisLine={false}
            tickLine={false}
            domain={[0, 'auto']}
            width={44}
          />
          <Tooltip
            {...CHART_TOOLTIP}
            formatter={(value, name) => [`${value} ${unit}`, name]}
            labelFormatter={(dayLabel) => `Day ${dayLabel}`}
          />
          <Legend wrapperStyle={CHART_LEGEND} iconSize={9} />
          {typeof threshold === 'number' && (
            <ReferenceLine
              y={threshold}
              stroke={CHART_COLORS[4]}
              strokeDasharray="6 4"
              label={{
                value: `App rule ${threshold} ${unit}`,
                fill: '#fca5a5',
                fontSize: 10,
                position: 'insideTopRight',
              }}
            />
          )}
          <Line
            isAnimationActive={false}
            type="monotone"
            dataKey="mean"
            name="Daily mean"
            stroke={CHART_COLORS[0]}
            strokeWidth={2}
            dot={false}
          />
          <Line
            isAnimationActive={false}
            type="monotone"
            dataKey="max"
            name="Daily max"
            stroke={CHART_COLORS[3]}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Figure>
  )
}

export function SepMonthChart({ x = [], y = [], height = 220, label = 'Solar particle events per month in 2024' }) {
  const rows = x.map((month, index) => ({ month: formatMonth(month), events: y[index] ?? 0 }))
  return (
    <Figure label={label}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART_GRID} vertical={false} />
          <XAxis dataKey="month" tick={CHART_AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={CHART_AXIS} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
          <Tooltip
            {...CHART_TOOLTIP}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            formatter={(value) => [value, 'SEP events']}
            labelFormatter={(month) => `Month ${month} 2024`}
          />
          <Bar isAnimationActive={false} dataKey="events" name="SEP events" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Figure>
  )
}
