import { useId, useRef, useState, type CSSProperties } from 'react'
import type { OvertakeSeasonRow } from '../data/overtakes'

type Props = {
  title: string
  data: OvertakeSeasonRow[]
  loading?: boolean
  error?: string | null
  footnote?: string
}

/** Matplotlib Viridis (low → high) for Overtake-mode lollipop chart only; Speed map uses Plasma in `CircuitMapCard`. */
const VIRIDIS_RGB: Array<[number, number, number]> = [
  [68, 1, 84],
  [72, 40, 120],
  [62, 74, 137],
  [49, 104, 142],
  [38, 130, 142],
  [31, 158, 137],
  [53, 183, 121],
  [110, 206, 88],
  [143, 215, 68],
  [181, 222, 43],
  [221, 227, 24],
  [253, 231, 37],
]

/** Fixed % scale for Viridis (lanes, stems, bubbles, colorbar) — same on every circuit. */
const PCT_FROM_OVERTAKES_COLOR_MIN = 10
const PCT_FROM_OVERTAKES_COLOR_MAX = 80

function viridisColor(t: number): string {
  const stops = VIRIDIS_RGB
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1)
  const i = Math.floor(x)
  const f = x - i
  const a = stops[i] ?? stops[stops.length - 1]
  const b = stops[Math.min(i + 1, stops.length - 1)] ?? a
  const r = Math.round(a[0] + (b[0] - a[0]) * f)
  const g = Math.round(a[1] + (b[1] - a[1]) * f)
  const bl = Math.round(a[2] + (b[2] - a[2]) * f)
  return `rgb(${r} ${g} ${bl})`
}

export function OvertakeDynamicsChart({ title, data, loading, error, footnote }: Props) {
  const hasAny = data.length > 0

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2
        className={`text-base font-semibold leading-snug text-zinc-900 md:text-lg ${footnote ? 'mb-2' : 'mb-4'}`}
      >
        {title}
      </h2>
      {footnote ? (
        <p className="mb-4 text-xs leading-relaxed text-zinc-600">{footnote}</p>
      ) : null}
      {loading ? (
        <p className="text-sm text-zinc-500">Loading overtake data…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !hasAny ? (
        <p className="text-sm text-zinc-500">No overtake rows for this circuit in the CSV.</p>
      ) : (
        <OvertakeDynamicsSvg data={data} />
      )}
    </section>
  )
}

/** Matplotlib `s=positionChanges*6` is area; map to SVG radius ~ sqrt(s). */
function bubbleRadiusPx(positionChanges: number, maxPc: number, rMin: number, rMax: number): number {
  if (maxPc <= 0 || !Number.isFinite(positionChanges)) return (rMin + rMax) / 2
  const areaScale = positionChanges * 6
  const maxArea = maxPc * 6
  const t = Math.sqrt(Math.max(0, areaScale / maxArea))
  /** Slight gamma (>1) so high position-change years read clearly larger than mid values. */
  const tVis = Math.min(1, Math.pow(t, 1.18))
  return rMin + tVis * (rMax - rMin)
}

function OvertakeRowTooltip({
  row,
  style,
}: {
  row: OvertakeSeasonRow
  style: CSSProperties
}) {
  return (
    <div
      className="pointer-events-none absolute z-20 min-w-[200px] max-w-[260px] rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-xs shadow-lg"
      style={style}
      role="tooltip"
    >
      <p className="font-semibold text-zinc-900">{row.year} Season</p>
      <dl className="mt-2 space-y-1.5 text-zinc-600">
        <div className="flex justify-between gap-6 tabular-nums">
          <dt className="text-zinc-500">Overtakes</dt>
          <dd className="font-medium text-zinc-800">{row.overtakes}</dd>
        </div>
        <div className="flex justify-between gap-6 tabular-nums">
          <dt className="text-zinc-500">Position Changes</dt>
          <dd className="font-medium text-zinc-800">{row.positionChanges}</dd>
        </div>
        <div className="flex justify-between gap-6 tabular-nums">
          <dt className="shrink text-left text-zinc-500 leading-snug">% Position Changes from Overtakes</dt>
          <dd className="shrink-0 font-medium text-zinc-800">{row.pctFromOvertakes.toFixed(1)}%</dd>
        </div>
      </dl>
    </div>
  )
}

function BubbleSizeLegendSide({
  refSizes,
  legendScaleMax,
  bubbleRMin,
  bubbleRMax,
}: {
  refSizes: number[]
  legendScaleMax: number
  bubbleRMin: number
  bubbleRMax: number
}) {
  /** Midpoint of fixed % scale (10–80) → center Viridis swatch, same family as chart bubbles. */
  const legendBubbleFill = viridisColor(0.5)

  return (
    <div className="shrink-0 rounded-lg border border-zinc-200 bg-zinc-50/90 px-3 py-2.5 shadow-sm sm:pt-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">Dot size</p>
      <ul className="flex flex-col gap-2.5">
        {refSizes.map((s) => {
          const r = bubbleRadiusPx(s, legendScaleMax, bubbleRMin, bubbleRMax)
          const d = Math.max(2 * r, 6)
          return (
            <li key={s} className="flex items-center gap-2.5">
              <span
                className="inline-block shrink-0 rounded-full border border-white shadow-sm ring-1 ring-black/10"
                style={{ width: d, height: d, backgroundColor: legendBubbleFill }}
                aria-hidden
              />
              <span className="text-[11px] leading-tight text-zinc-600">
                {s} pos. changes
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function OvertakeDynamicsSvg({ data }: { data: OvertakeSeasonRow[] }) {
  const gradientId = useId().replace(/:/g, '')
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [tip, setTip] = useState<null | { row: OvertakeSeasonRow; x: number; y: number }>(null)

  const rows = [...data].sort((a, b) => Number(a.year) - Number(b.year))
  const n = rows.length

  const maxO = Math.max(...rows.map((r) => r.overtakes), 1)
  const pctColorSpan = PCT_FROM_OVERTAKES_COLOR_MAX - PCT_FROM_OVERTAKES_COLOR_MIN
  const normPct = (p: number) =>
    Math.min(1, Math.max(0, (p - PCT_FROM_OVERTAKES_COLOR_MIN) / pctColorSpan))
  const pctColorMid = (PCT_FROM_OVERTAKES_COLOR_MIN + PCT_FROM_OVERTAKES_COLOR_MAX) / 2

  const refXMax = 140
  const xMax = Math.max(refXMax, Math.ceil(maxO * 1.12))

  const W = 760
  const rowH = 48
  const laneH = rowH * 0.9
  /** Scale min/max radius; larger bubbles + gamma in bubbleRadiusPx improve size contrast. */
  const bubbleRadiusScale = 1.55
  const bubbleRMax = laneH * 0.225 * bubbleRadiusScale
  const bubbleRMin = 3.5 * bubbleRadiusScale
  /** Extra left gutter so the rotated y-axis title clears year tick labels. */
  const m = { l: 68, r: 118, t: 24, b: 44 }
  const plotW = W - m.l - m.r
  const plotH = n * rowH
  const H = m.t + plotH + m.b

  const xScale = (v: number) => m.l + (v / xMax) * plotW
  const rowCenterY = (idx: number) => m.t + (n - 1 - idx) * rowH + rowH / 2

  const maxPc = Math.max(...rows.map((r) => r.positionChanges), 1)

  const xTicks = 6
  const tickVals = Array.from({ length: xTicks }, (_, i) => (xMax * i) / (xTicks - 1))

  const legendRefSizes = [100, 150, 220]
  const legendScaleMax = Math.max(maxPc, ...legendRefSizes)
  const cbarW = 12
  const cbarX = W - m.r + 18
  const cbarY = m.t
  const cbarH = plotH

  /** Center the lollipop plot in the horizontal span left of the colorbar; colorbar stays fixed. */
  const chartRegionLeft = cbarX - 20
  const chartRegionCenterX = chartRegionLeft / 2
  const plotCenterX = m.l + plotW / 2
  const plotShiftX = chartRegionCenterX - plotCenterX
  const seasonTitleX = 11
  /** Extra viewBox above y=0 so the rotated “Season” label is not clipped. */
  const viewPadT = 14
  const viewBoxXMin = Math.min(0, Math.floor(seasonTitleX + plotShiftX - 10))
  const viewBoxW = W - viewBoxXMin
  const viewBoxH = H + viewPadT
  const plotLeft = m.l + plotShiftX
  const plotRight = m.l + plotW + plotShiftX

  function svgPointFromClient(svg: SVGSVGElement, clientX: number, clientY: number) {
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    return pt.matrixTransform(ctm.inverse())
  }

  function updateTipFromEvent(clientX: number, clientY: number) {
    const svg = svgRef.current
    const wrap = wrapRef.current
    if (!svg || !wrap) return
    const p = svgPointFromClient(svg, clientX, clientY)
    if (!p) return
    const vx = p.x
    const vy = p.y
    if (vx < plotLeft - 72 || vx > plotRight + 8 || vy < m.t || vy > m.t + plotH) {
      setTip(null)
      return
    }
    const rowFromTop = Math.floor((vy - m.t) / rowH)
    if (rowFromTop < 0 || rowFromTop >= n) {
      setTip(null)
      return
    }
    const idx = n - 1 - rowFromTop
    const row = rows[idx]
    if (!row) {
      setTip(null)
      return
    }
    const wr = wrap.getBoundingClientRect()
    setTip({ row, x: clientX - wr.left, y: clientY - wr.top })
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
      <BubbleSizeLegendSide
        refSizes={legendRefSizes}
        legendScaleMax={legendScaleMax}
        bubbleRMin={bubbleRMin}
        bubbleRMax={bubbleRMax}
      />
      <div className="flex min-w-0 flex-1 justify-center">
        <div
          ref={wrapRef}
          className="relative -ml-12 w-full min-w-0 max-w-[760px] overflow-x-auto sm:-ml-16"
          onMouseLeave={() => setTip(null)}
        >
        {tip ? (
          <OvertakeRowTooltip
            row={tip.row}
            style={{ left: tip.x + 14, top: tip.y + 14 }}
          />
        ) : null}
        <svg
          ref={svgRef}
          viewBox={`${viewBoxXMin} ${-viewPadT} ${viewBoxW} ${viewBoxH}`}
          width="100%"
          height={viewBoxH}
          className="max-w-full overflow-visible"
          role="img"
          aria-label="Overtaking dynamics lollipop chart"
          onMouseMove={(e) => updateTipFromEvent(e.clientX, e.clientY)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="100%" x2="0%" y2="0%">
              {VIRIDIS_RGB.map((c, i) => (
                <stop key={i} offset={`${(i / (VIRIDIS_RGB.length - 1)) * 100}%`} stopColor={`rgb(${c[0]} ${c[1]} ${c[2]})`} />
              ))}
            </linearGradient>
          </defs>

          <g transform={`translate(${plotShiftX} 0)`}>
          {/* Plot background */}
          <rect x={m.l} y={m.t} width={plotW} height={plotH} fill="#fafafa" />

          {/* Vertical grid */}
          {tickVals.slice(1, -1).map((xv, i) => {
            const x = xScale(xv)
            return <line key={i} x1={x} x2={x} y1={m.t} y2={m.t + plotH} stroke="#e4e4e7" strokeWidth={1} opacity={0.45} />
          })}

          {/* Background lanes (Viridis by %); light enough that stems + bubbles stay clear */}
          {rows.map((row, idx) => {
            const yc = rowCenterY(idx)
            const h = laneH
            const y = yc - h / 2
            const c = viridisColor(normPct(row.pctFromOvertakes))
            return <rect key={`lane-${row.year}`} x={m.l} y={y} width={plotW} height={h} fill={c} fillOpacity={0.26} />
          })}

          {/* Stem lines: 0 → overtakes */}
          {rows.map((row, idx) => {
            const y = rowCenterY(idx)
            const c = viridisColor(normPct(row.pctFromOvertakes))
            return (
              <line
                key={`stem-${row.year}`}
                x1={xScale(0)}
                y1={y}
                x2={xScale(row.overtakes)}
                y2={y}
                stroke={c}
                strokeWidth={3}
                strokeLinecap="round"
              />
            )
          })}

          {/* Bubbles (position changes → size, % → face color) */}
          {rows.map((row, idx) => {
            const y = rowCenterY(idx)
            const cx = xScale(row.overtakes)
            const r = bubbleRadiusPx(row.positionChanges, maxPc, bubbleRMin, bubbleRMax)
            const fill = viridisColor(normPct(row.pctFromOvertakes))
            return (
              <circle
                key={`bubble-${row.year}`}
                cx={cx}
                cy={y}
                r={r}
                fill={fill}
                stroke="#fff"
                strokeWidth={1.5}
              />
            )
          })}

          {/* Y: season labels */}
          {rows.map((row, idx) => {
            const y = rowCenterY(idx)
            return (
              <text key={`y-${row.year}`} x={m.l - 8} y={y + 4} fontSize={12} fontWeight={600} fill="#3f3f46" textAnchor="end">
                {row.year}
              </text>
            )
          })}

          {/* X axis */}
          <line x1={m.l} x2={m.l + plotW} y1={m.t + plotH} y2={m.t + plotH} stroke="#d4d4d8" strokeWidth={1} />
          {tickVals.map((xv, i) => {
            const x = xScale(xv)
            return (
              <g key={`xt-${i}`}>
                <line x1={x} x2={x} y1={m.t + plotH} y2={m.t + plotH + 5} stroke="#d4d4d8" />
                <text x={x} y={m.t + plotH + 20} fontSize={10} fill="#71717a" textAnchor="middle">
                  {Math.round(xv)}
                </text>
              </g>
            )
          })}
          <text x={m.l + plotW / 2} y={H - 8} fontSize={12} fill="#52525b" textAnchor="middle">
            Overtakes
          </text>
          <text
            x={seasonTitleX}
            y={m.t + plotH / 2}
            fontSize={12}
            fill="#52525b"
            textAnchor="middle"
            transform={`rotate(-90, ${seasonTitleX}, ${m.t + plotH / 2})`}
          >
            Season
          </text>
          </g>

          {/* Colorbar (fixed on the right; not shifted with plot) */}
          <rect x={cbarX} y={cbarY} width={cbarW} height={cbarH} fill={`url(#${gradientId})`} stroke="#d4d4d8" strokeWidth={0.5} rx={1} />
          <text x={cbarX + cbarW / 2} y={cbarY - 14} fontSize={9} fill="#52525b" textAnchor="middle" fontWeight={600}>
            % from overtakes
          </text>
          <text x={cbarX + cbarW + 6} y={cbarY + cbarH + 3} fontSize={9} fill="#71717a" textAnchor="start">
            {PCT_FROM_OVERTAKES_COLOR_MIN}
          </text>
          <text x={cbarX + cbarW + 6} y={cbarY + cbarH / 2 + 3} fontSize={9} fill="#71717a" textAnchor="start">
            {pctColorMid}
          </text>
          <text x={cbarX + cbarW + 6} y={cbarY + 3} fontSize={9} fill="#71717a" textAnchor="start">
            {PCT_FROM_OVERTAKES_COLOR_MAX}
          </text>
        </svg>
        </div>
      </div>
    </div>
  )
}
