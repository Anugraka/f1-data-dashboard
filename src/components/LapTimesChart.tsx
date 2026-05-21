import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ENGINE_COLORS } from '../data/engineColors'
import type { EngineManufacturer, TeamLap, YearBestTeamLap } from '../types'

function enginesForLegend(engines: EngineManufacturer[]): EngineManufacturer[] {
  return [...new Set(engines)].sort((a, b) => a.localeCompare(b))
}

type ChartRowTeam = {
  team: string
  engine: EngineManufacturer
  lapTime: number
  fill: string
}

type ChartRowYear = {
  year: string
  team: string
  engine: EngineManufacturer
  lapTime: number
  fill: string
}

export type LapTimesChartProps =
  | { variant: 'singleYear'; title: string; data: TeamLap[]; yDomain: [number, number]; footnote?: string }
  | { variant: 'allYears'; title: string; data: YearBestTeamLap[]; yDomain: [number, number]; footnote?: string }

export function LapTimesChart(props: LapTimesChartProps) {
  if (props.variant === 'singleYear') {
    return (
      <LapTimesSingleYear
        title={props.title}
        data={props.data}
        yDomain={props.yDomain}
        footnote={props.footnote}
      />
    )
  }
  return (
    <LapTimesAllYears
      title={props.title}
      data={props.data}
      yDomain={props.yDomain}
      footnote={props.footnote}
    />
  )
}

function LapTimesSingleYear({
  title,
  data,
  yDomain,
  footnote,
}: {
  title: string
  data: TeamLap[]
  yDomain: [number, number]
  footnote?: string
}) {
  const chartData: ChartRowTeam[] = data.map((row) => ({
    team: row.team,
    engine: row.engine,
    lapTime: row.lapTime,
    fill: ENGINE_COLORS[row.engine],
  }))

  const legendEngines = enginesForLegend(chartData.map((d) => d.engine))

  const hasFinite = chartData.some((d) => Number.isFinite(d.lapTime))

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className={`text-base font-semibold text-zinc-900 ${footnote ? 'mb-2' : 'mb-4'}`}>{title}</h2>
      {footnote ? (
        <p className="mb-4 text-xs leading-relaxed text-zinc-600">{footnote}</p>
      ) : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <div className="min-h-[320px] min-w-0 flex-1">
          {!hasFinite ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              No numeric values to plot for the current filter.
            </div>
          ) : null}
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 48, bottom: 64 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
              <XAxis
                dataKey="team"
                tick={{ fill: '#71717a', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#e4e4e7' }}
                label={{
                  value: 'Team',
                  position: 'insideBottom',
                  offset: -36,
                  fill: '#52525b',
                  fontSize: 12,
                }}
                interval={0}
                angle={-40}
                textAnchor="end"
                height={72}
              />
              <YAxis
                domain={yDomain}
                tick={{ fill: '#71717a', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#e4e4e7' }}
                tickFormatter={(v) => (typeof v === 'number' ? v.toFixed(1) : String(v))}
                label={{
                  value: 'Average time (s)',
                  angle: -90,
                  position: 'left',
                  offset: 26,
                  fill: '#52525b',
                  fontSize: 12,
                  style: { textAnchor: 'middle' },
                }}
              />
              <Tooltip cursor={{ fill: 'rgba(24, 24, 27, 0.04)' }} content={SingleYearTooltip} />
              <Bar dataKey="lapTime" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
                {chartData.map((entry) => (
                  <Cell key={entry.team} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="shrink-0 border-t border-zinc-100 pt-4 lg:w-36 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Engine</p>
          <ul className="mt-3 space-y-2">
            {legendEngines.map((engine) => (
              <li key={engine} className="flex items-center gap-2 text-sm text-zinc-700">
                <span
                  className="size-3.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: ENGINE_COLORS[engine] }}
                  aria-hidden
                />
                {engine}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function truncateTeam(name: string, max = 20) {
  const t = name.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function formatLapTooltipTime(value: unknown): string {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? `${num}s` : String(value ?? '—')
}

const lapTooltipBoxClass =
  'rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 shadow-sm'

/** `Team · Engine : Laptime` (laptime includes `s` suffix when numeric). */
function lapTooltipMainLine(team: string, engine: string, value: unknown): string {
  return `${team} · ${engine} : ${formatLapTooltipTime(value)}`
}

function SingleYearTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: ReadonlyArray<{
    value?: unknown
    payload?: ChartRowTeam
  }>
}) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const row = item?.payload
  if (!row) return null
  const line = lapTooltipMainLine(row.team, row.engine, item.value)
  return (
    <div className={lapTooltipBoxClass} style={{ fontSize: 12 }}>
      <p className="tabular-nums">{line}</p>
    </div>
  )
}

function AllYearsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: ReadonlyArray<{
    value?: unknown
    dataKey?: unknown
    color?: string
    payload?: ChartRowYear
  }>
  label?: unknown
}) {
  if (!active || !payload?.length) return null
  // Bar + Line share `lapTime`; Recharts emits two tooltip rows — show one.
  const item =
    payload.find((p) => p.dataKey === 'lapTime') ??
    payload.find((p) => String(p.dataKey) === 'lapTime') ??
    payload[0]
  const row = item?.payload
  const team = row?.team ?? '—'
  const engine = row?.engine != null ? String(row.engine) : '—'
  const line = lapTooltipMainLine(team, engine, item?.value)
  return (
    <div className={lapTooltipBoxClass} style={{ fontSize: 12 }}>
      <p className="mb-1 text-[11px] font-semibold text-zinc-500">
        {label != null ? String(label) : '—'} Season
      </p>
      <p className="tabular-nums text-zinc-900">{line}</p>
    </div>
  )
}

function YearAxisTick({
  x,
  y,
  index,
  rows,
}: {
  x: number
  y: number
  index: number
  rows: ChartRowYear[]
}) {
  const row = rows[index]
  if (!row) return null
  return (
    <g transform={`translate(${x},${y})`} className="recharts-cartesian-axis-tick">
      <text textAnchor="middle" fill="#3f3f46" fontSize={12} fontWeight={600} dy={14}>
        {row.year}
      </text>
      <text textAnchor="middle" fill="#71717a" fontSize={10} dy={28}>
        {truncateTeam(row.team)}
      </text>
    </g>
  )
}

function LapTimesAllYears({
  title,
  data,
  yDomain,
  footnote,
}: {
  title: string
  data: YearBestTeamLap[]
  yDomain: [number, number]
  footnote?: string
}) {
  const chartData: ChartRowYear[] = data.map((row) => ({
    year: row.year,
    team: row.team,
    engine: row.engine,
    lapTime: row.lapTime,
    fill: ENGINE_COLORS[row.engine],
  }))

  const legendEngines = enginesForLegend(chartData.map((d) => d.engine))

  const hasFinite = chartData.some((d) => Number.isFinite(d.lapTime))

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className={`text-base font-semibold text-zinc-900 ${footnote ? 'mb-2' : 'mb-4'}`}>{title}</h2>
      {footnote ? (
        <p className="mb-4 text-xs leading-relaxed text-zinc-600">{footnote}</p>
      ) : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <div className="min-h-[320px] min-w-0 flex-1">
          {!hasFinite ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              No numeric values to plot for the current filter.
            </div>
          ) : null}
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 48, bottom: 72 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
              <XAxis
                dataKey="year"
                tickLine={false}
                axisLine={{ stroke: '#e4e4e7' }}
                tick={(tickProps) => (
                  <YearAxisTick
                    x={Number(tickProps.x)}
                    y={Number(tickProps.y)}
                    index={tickProps.index}
                    rows={chartData}
                  />
                )}
                label={{
                  value: 'Season / Fastest Team on Average',
                  position: 'insideBottom',
                  offset: -44,
                  fill: '#52525b',
                  fontSize: 12,
                }}
                interval={0}
                height={64}
              />
              <YAxis
                domain={yDomain}
                tick={{ fill: '#71717a', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#e4e4e7' }}
                tickFormatter={(v) => (typeof v === 'number' ? v.toFixed(1) : String(v))}
                label={{
                  value: 'Average time (s)',
                  angle: -90,
                  position: 'left',
                  offset: 26,
                  fill: '#52525b',
                  fontSize: 12,
                  style: { textAnchor: 'middle' },
                }}
              />
              <Tooltip cursor={{ fill: 'rgba(24, 24, 27, 0.04)' }} content={AllYearsTooltip} />
              <Bar dataKey="lapTime" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}>
                {chartData.map((entry) => (
                  <Cell key={entry.year} fill={entry.fill} />
                ))}
              </Bar>
              <Line
                type="linear"
                dataKey="lapTime"
                stroke="#18181b"
                strokeWidth={2}
                dot={{ r: 3.5, fill: '#18181b', stroke: '#fff', strokeWidth: 1 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="shrink-0 border-t border-zinc-100 pt-4 lg:w-36 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Engine</p>
          <ul className="mt-3 space-y-2">
            {legendEngines.map((engine) => (
              <li key={engine} className="flex items-center gap-2 text-sm text-zinc-700">
                <span
                  className="size-3.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: ENGINE_COLORS[engine] }}
                  aria-hidden
                />
                {engine}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
