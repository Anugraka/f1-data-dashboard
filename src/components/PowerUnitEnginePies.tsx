import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { ENGINE_COLORS } from '../data/circuits'
import type { EngineManufacturer } from '../types'

/** 2022 grid: engine supplier → teams (from user spec). */
const ENGINES_22: Record<string, string[]> = {
  Mercedes: ['Mercedes', 'McLaren', 'Aston Martin', 'Williams'],
  Ferrari: ['Ferrari', 'Alfa Romeo', 'Haas F1 Team'],
  Honda: ['Red Bull Racing', 'AlphaTauri'],
  Renault: ['Alpine'],
}

/** 2026 grid: engine supplier → teams (from user spec). */
const ENGINES_26: Record<string, string[]> = {
  Mercedes: ['Mercedes', 'McLaren', 'Alpine', 'Williams'],
  Ferrari: ['Ferrari', 'Cadillac', 'Haas F1 Team'],
  Ford: ['Red Bull Racing', 'Racing Bulls'],
  Honda: ['Aston Martin'],
  Audi: ['Audi'],
}

type PieSlice = { name: string; value: number; fill: string; teams: string }

function toPieData(d: Record<string, string[]>): PieSlice[] {
  return Object.entries(d).map(([engine, teams]) => ({
    name: engine,
    value: teams.length,
    fill: ENGINE_COLORS[engine as EngineManufacturer],
    teams: teams.join(', '),
  }))
}

const DATA_22 = toPieData(ENGINES_22)
const DATA_26 = toPieData(ENGINES_26)

function PieTooltipContent({
  active,
  payload,
  total,
}: {
  active?: boolean
  payload?: readonly { payload?: PieSlice }[]
  total: number
}) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null
  const pct = total > 0 ? ((row.value / total) * 100).toFixed(0) : '0'
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-zinc-900">{row.name}</p>
      <p className="mt-0.5 text-zinc-600">
        {row.value} team{row.value === 1 ? '' : 's'} ({pct}%)
      </p>
      <p className="mt-1 max-w-[220px] text-[11px] leading-snug text-zinc-500">{row.teams}</p>
    </div>
  )
}

function SingleEnginePie({ title, data }: { title: string; data: PieSlice[] }) {
  const total = data.reduce((s, x) => s + x.value, 0)
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-2 text-center text-sm font-semibold text-zinc-800">{title}</p>
      <div className="h-[260px] w-full md:h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius="72%"
              paddingAngle={1}
              label={({ name, percent }) =>
                `${name ?? ''} ${((Number(percent) || 0) * 100).toFixed(0)}%`
              }
              labelLine={{ stroke: '#a1a1aa', strokeWidth: 1 }}
            >
              {data.map((entry, i) => (
                <Cell key={`${title}-${entry.name}-${i}`} fill={entry.fill} stroke="#fff" strokeWidth={1} />
              ))}
            </Pie>
            <Tooltip
              content={(props) => (
                <PieTooltipContent active={props.active} payload={props.payload} total={total} />
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function PowerUnitEnginePies() {
  return (
    <div className="mt-8 grid w-full grid-cols-1 gap-10 md:grid-cols-2 md:gap-8">
      <SingleEnginePie title="2022" data={DATA_22} />
      <SingleEnginePie title="2026" data={DATA_26} />
    </div>
  )
}
