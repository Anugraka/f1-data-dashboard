import { useCallback, useRef, useState } from 'react'
import type { SpeedBoxPlotYearPoint } from '../data/telemetry'
import { SPEED_BOXPLOT_Y_KMH_MAX, SPEED_BOXPLOT_Y_KMH_MIN } from '../data/telemetry'

export type TopSpeedYearPoint = SpeedBoxPlotYearPoint

type Props = {
  title: string
  data: TopSpeedYearPoint[]
  /** X-axis years (in order), e.g. 2022–2026 or 2024–2026 for Shanghai. */
  years: readonly number[]
  loading?: boolean
  error?: string | null
  footnote?: string
}

export function TopSpeedLineChart({ title, data, years, loading, error, footnote }: Props) {
  const hasAny = data.some((d) => d.medianKmh != null && Number.isFinite(d.medianKmh))

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className={`text-base font-semibold text-zinc-900 ${footnote ? 'mb-2' : 'mb-4'}`}>{title}</h2>
      {footnote ? (
        <p className="mb-4 text-xs leading-relaxed text-zinc-600">{footnote}</p>
      ) : null}
      {loading ? (
        <p className="text-sm text-zinc-500">Loading telemetry…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !hasAny ? (
        <p className="text-sm text-zinc-500">No telemetry for this circuit across the selected years.</p>
      ) : (
        <div className="min-h-[280px] min-w-0">
          <SpeedBoxPlotSvg data={data} years={years} />
        </div>
      )}
    </section>
  )
}

function fmtKmh(v: number | null) {
  return v == null || !Number.isFinite(v) ? '—' : `${v.toFixed(1)} km/h`
}

function SpeedBoxPlotSvg({ data, years }: { data: TopSpeedYearPoint[]; years: readonly number[] }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{
    year: number
    medianKmh: number | null
    maxKmh: number | null
    left: number
    top: number
  } | null>(null)

  const updateTip = useCallback(
    (d: TopSpeedYearPoint, clientX: number, clientY: number) => {
      const el = wrapRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setTip({
        year: d.year,
        medianKmh: d.medianKmh,
        maxKmh: d.maxKmh,
        left: clientX - r.left,
        top: clientY - r.top,
      })
    },
    [],
  )

  const W = 880
  const H = 280
  // Extra bottom margin so x-axis line, year ticks, and x label can be evenly spaced.
  const m = { l: 52, r: 20, t: 12, b: 44 }
  const plotW = W - m.l - m.r
  const plotH = H - m.t - m.b
  const axisY = m.t + plotH
  const xGap = 14

  const yMin = SPEED_BOXPLOT_Y_KMH_MIN
  const yMax = SPEED_BOXPLOT_Y_KMH_MAX

  const boxW = Math.max(10, Math.min(34, plotW / Math.max(1, years.length) - 10))
  const xPadPx = boxW / 2 + 18

  const xForYear = (year: number) => {
    if (years.length <= 1) return m.l + plotW / 2
    const i = years.indexOf(year)
    const t = i <= 0 ? 0 : i >= years.length - 1 ? 1 : i / (years.length - 1)
    return m.l + xPadPx + t * (plotW - 2 * xPadPx)
  }

  const yFor = (v: number | null) => {
    if (v == null) return null
    const t = (v - yMin) / (yMax - yMin)
    const clamped = Math.min(1, Math.max(0, t))
    return m.t + (1 - clamped) * plotH
  }

  const yTicks = [60, 100, 140, 180, 220, 260, 300, 340]
  const stroke = '#6A4C93'
  const fill = 'rgba(106, 76, 147, 0.14)'
  const axis = '#e4e4e7'
  const tick = '#71717a'
  const medianTrend = '#FF6B6B'
  const maxTrend = '#2EC4B6'

  return (
    <div ref={wrapRef} className="relative min-w-0">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Speed boxplots by year">
      {/* grid + y ticks */}
      {yTicks.map((yt) => {
        const y = yFor(yt) ?? 0
        return (
          <g key={yt}>
            <line x1={m.l} x2={m.l + plotW} y1={y} y2={y} stroke={axis} strokeDasharray="3 3" />
            <text x={m.l - 8} y={y + 4} fontSize={11} fill={tick} textAnchor="end">
              {yt}
            </text>
          </g>
        )
      })}

      {/* axes */}
      <line x1={m.l} x2={m.l} y1={m.t} y2={m.t + plotH} stroke={axis} />
      <line x1={m.l} x2={m.l + plotW} y1={axisY} y2={axisY} stroke={axis} />

      {/* y label */}
      <text
        x={14}
        y={m.t + plotH / 2}
        fontSize={12}
        fill="#52525b"
        textAnchor="middle"
        transform={`rotate(-90 14 ${m.t + plotH / 2})`}
      >
        Speed (km/h)
      </text>

      {/* x ticks */}
      {years.map((yr) => {
        const x = xForYear(yr)
        return (
          <g key={yr}>
            <line x1={x} x2={x} y1={axisY} y2={axisY + 6} stroke={axis} />
            <text x={x} y={axisY + xGap} fontSize={11} fill={tick} textAnchor="middle">
              {yr}
            </text>
          </g>
        )
      })}

      {/* x label */}
      <text x={m.l + plotW / 2} y={axisY + 2 * xGap} fontSize={12} fill="#52525b" textAnchor="middle">
        Year
      </text>

      {/* boxplots */}
      {data.map((d) => {
        const cx = xForYear(d.year)
        const yMinV = yFor(d.minKmh)
        const yQ1 = yFor(d.q1Kmh)
        const yMed = yFor(d.medianKmh)
        const yQ3 = yFor(d.q3Kmh)
        const yMaxV = yFor(d.maxKmh)
        if (yQ1 == null || yQ3 == null || yMed == null) return null

        const boxX = cx - boxW / 2
        const boxY = Math.min(yQ1, yQ3)
        const boxH = Math.abs(yQ3 - yQ1)

        const hitPad = 14
        const hitW = boxW + hitPad * 2

        return (
          <g key={d.year}>
            {yMinV != null && yMaxV != null ? (
              <line x1={cx} x2={cx} y1={yMaxV} y2={yMinV} stroke={stroke} strokeWidth={1.25} opacity={0.9} />
            ) : null}
            {yMinV != null ? (
              <line x1={cx - boxW / 3} x2={cx + boxW / 3} y1={yMinV} y2={yMinV} stroke={stroke} strokeWidth={1.25} />
            ) : null}
            {yMaxV != null ? (
              <line x1={cx - boxW / 3} x2={cx + boxW / 3} y1={yMaxV} y2={yMaxV} stroke={stroke} strokeWidth={1.25} />
            ) : null}

            <rect
              x={boxX}
              y={boxY}
              width={boxW}
              height={Math.max(1, boxH)}
              fill={fill}
              stroke={stroke}
              strokeWidth={1.25}
            />
            <line x1={boxX} x2={boxX + boxW} y1={yMed} y2={yMed} stroke={stroke} strokeWidth={2} />
            <rect
              x={cx - hitW / 2}
              y={m.t}
              width={hitW}
              height={plotH}
              fill="transparent"
              className="cursor-crosshair"
              onMouseEnter={(e) => updateTip(d, e.clientX, e.clientY)}
              onMouseMove={(e) => updateTip(d, e.clientX, e.clientY)}
              onMouseLeave={() => setTip(null)}
            />
          </g>
        )
      })}

      {/* median trend line (straight segments); ignore pointer so column hit-areas work */}
      <path
        pointerEvents="none"
        d={data
          .map((d) => {
            const x = xForYear(d.year)
            const y = yFor(d.medianKmh)
            if (y == null) return null
            return `${x},${y}`
          })
          .filter(Boolean)
          .reduce<string>((acc, pt, i) => (i === 0 ? `M ${pt}` : `${acc} L ${pt}`), '')}
        fill="none"
        stroke={medianTrend}
        strokeOpacity={0.9}
        strokeWidth={2}
      />

      {/* max trend line (straight segments) */}
      <path
        pointerEvents="none"
        d={data
          .map((d) => {
            const x = xForYear(d.year)
            const y = yFor(d.maxKmh)
            if (y == null) return null
            return `${x},${y}`
          })
          .filter(Boolean)
          .reduce<string>((acc, pt, i) => (i === 0 ? `M ${pt}` : `${acc} L ${pt}`), '')}
        fill="none"
        stroke={maxTrend}
        strokeOpacity={0.9}
        strokeWidth={2}
        strokeDasharray="6 4"
      />

      </svg>
      {tip ? (
        <div
          className="pointer-events-none absolute z-10 w-max max-w-[220px] rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-md"
          style={{
            left: tip.left,
            top: tip.top,
            transform: 'translate(-50%, calc(-100% - 8px))',
          }}
        >
          <p className="mb-1.5 font-semibold text-zinc-900">{tip.year} Season</p>
          <p className="text-zinc-700">
            <span className="text-zinc-500">Median: </span>
            <span className="font-mono tabular-nums text-zinc-900">{fmtKmh(tip.medianKmh)}</span>
          </p>
          <p className="mt-0.5 text-zinc-700">
            <span className="text-zinc-500">Top speed: </span>
            <span className="font-mono tabular-nums text-zinc-900">{fmtKmh(tip.maxKmh)}</span>
          </p>
        </div>
      ) : null}
    </div>
  )
}
