import { useEffect, useId, useMemo, useState } from 'react'
import type { Circuit, TrackPoint } from '../types'
import { racesMatch } from '../data/raceNameCanonical'
import type { SectorBoundaries } from '../data/sectorPositions'
import {
  closestVertexIndex,
  cumulativeDistancesM,
  distanceFromAnchorVertex,
  F1_SECTOR_COLORS,
  sectorFromEqualDistanceThird,
} from '../data/sectorGeometry'
import {
  DRS_STATUS_COLORS,
  drsCategory,
  latestYearForTrack,
  pickDriverWithMostPoints,
  pickYearForDrsVisualization,
  type TelemetryPoint,
} from '../data/telemetry'

export const MODE_OPTIONS = ['Lap Time', 'Speed', 'Overtake'] as const
const SECTOR_OPTIONS = ['Full Lap', 'Sector 1', 'Sector 2', 'Sector 3'] as const

/** Matplotlib-style Plasma RGB stops (low → high) for Speed-mode heatmap. */
const PLASMA_RGB: Array<[number, number, number]> = [
  [13, 8, 135],
  [83, 2, 163],
  [126, 3, 168],
  [156, 23, 158],
  [189, 55, 134],
  [216, 87, 107],
  [237, 121, 83],
  [251, 159, 58],
  [253, 202, 38],
  [240, 249, 33],
]

function plasmaColor(t: number): string {
  const stops = PLASMA_RGB
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

/** Legend bar matching Plasma (same ordering as the track segments). */
const PLASMA_LEGEND_GRADIENT =
  'linear-gradient(90deg, rgb(13 8 135) 0%, rgb(126 3 168) 28%, rgb(216 87 107) 56%, rgb(253 202 38) 82%, rgb(240 249 33) 100%)'

function formatSpeedKmh(v: number): string {
  const rounded = Math.round(v * 10) / 10
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1)
}

type Props = {
  circuit: Circuit
  mode: (typeof MODE_OPTIONS)[number]
  sector: (typeof SECTOR_OPTIONS)[number]
  onModeChange: (mode: (typeof MODE_OPTIONS)[number]) => void
  onSectorChange: (sector: (typeof SECTOR_OPTIONS)[number]) => void
  /** Loaded once in App; null = still loading */
  telemetry: TelemetryPoint[] | null
  telemetryError: string | null
  /** From `sector_positions.csv`; null while loading */
  sectorPositionsMap: Map<string, SectorBoundaries> | null
}

type TrackApiShape =
  | TrackPoint[]
  | { points: TrackPoint[] }
  | { positions: TrackPoint[] }
  | { data: TrackPoint[] }
  | { data: { points: TrackPoint[] } }

function isPoint(v: unknown): v is TrackPoint {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { x?: unknown }).x === 'number' &&
    typeof (v as { y?: unknown }).y === 'number'
  )
}

function extractPoints(payload: TrackApiShape): TrackPoint[] {
  if (Array.isArray(payload)) return payload.filter(isPoint)
  if ('points' in payload && Array.isArray(payload.points)) return payload.points.filter(isPoint)
  if ('positions' in payload && Array.isArray(payload.positions)) return payload.positions.filter(isPoint)
  if ('data' in payload) {
    const d = payload.data as unknown
    if (Array.isArray(d)) return d.filter(isPoint)
    if (typeof d === 'object' && d !== null && 'points' in (d as any) && Array.isArray((d as any).points)) {
      return (d as any).points.filter(isPoint)
    }
  }
  return []
}

type ViewBoxTransform = {
  minX: number
  maxX: number
  minY: number
  maxY: number
  scale: number
  offsetX: number
  offsetY: number
}

function getViewBoxTransform(points: TrackPoint[], width: number, height: number, padding: number): ViewBoxTransform {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const spanX = Math.max(1e-9, maxX - minX)
  const spanY = Math.max(1e-9, maxY - minY)
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY)
  const offsetX = (width - spanX * scale) / 2
  const offsetY = (height - spanY * scale) / 2
  return { minX, maxX, minY, maxY, scale, offsetX, offsetY }
}

function projectXYToViewBox(x: number, y: number, t: ViewBoxTransform) {
  return {
    x: t.offsetX + (x - t.minX) * t.scale,
    y: t.offsetY + (y - t.minY) * t.scale,
  }
}

function normalizePointsToViewBox(points: TrackPoint[], width: number, height: number, padding: number) {
  const tr = getViewBoxTransform(points, width, height, padding)
  return points.map((p) => ({
    x: tr.offsetX + (p.x - tr.minX) * tr.scale,
    y: tr.offsetY + (p.y - tr.minY) * tr.scale,
  }))
}

/**
 * Three sectors of equal **path length** (lap length / 3), measured along the telemetry polyline.
 * Distance is counted from the vertex closest to `start_finish` (lap “zero”), wrapping through the end of the sample order.
 */
function buildEqualDistanceThirdsAnchoredAtSF(
  ptsNorm: TrackPoint[],
  cumM: number[],
  lapLen: number,
  anchorK: number,
): Array<{ sector: 'Sector 1' | 'Sector 2' | 'Sector 3'; d: string; color: string }> {
  const n = ptsNorm.length
  if (n < 2 || cumM.length !== n || lapLen <= 0) return []

  const midDistAlongLap = (a: number, b: number) => {
    const da = distanceFromAnchorVertex(cumM, lapLen, anchorK, a)
    const db = distanceFromAnchorVertex(cumM, lapLen, anchorK, b)
    return (da + db) / 2
  }

  const out: Array<{ sector: 'Sector 1' | 'Sector 2' | 'Sector 3'; d: string; color: string }> = []
  let i = 1
  while (i < n) {
    const sn = sectorFromEqualDistanceThird(midDistAlongLap(i - 1, i), lapLen)
    const sector: 'Sector 1' | 'Sector 2' | 'Sector 3' =
      sn === 1 ? 'Sector 1' : sn === 2 ? 'Sector 2' : 'Sector 3'
    const color = sn === 1 ? F1_SECTOR_COLORS.s1 : sn === 2 ? F1_SECTOR_COLORS.s2 : F1_SECTOR_COLORS.s3
    let d = `M ${ptsNorm[i - 1].x.toFixed(2)} ${ptsNorm[i - 1].y.toFixed(2)}`
    let j = i
    while (j < n) {
      const sj = sectorFromEqualDistanceThird(midDistAlongLap(j - 1, j), lapLen)
      if (sj !== sn) break
      d += ` L ${ptsNorm[j].x.toFixed(2)} ${ptsNorm[j].y.toFixed(2)}`
      j++
    }
    out.push({ sector, d, color })
    i = j
  }
  return out
}

function fallbackThirdSectorPaths(pts: TrackPoint[]) {
  if (pts.length < 2) return []
  const n = pts.length
  const b1 = Math.floor(n / 3)
  const b2 = Math.floor((2 * n) / 3)
  const mk = (start: number, end: number) => pointsToPath(pts.slice(start, end))
  return [
    { sector: 'Sector 1' as const, d: mk(0, b1 + 1), color: F1_SECTOR_COLORS.s1 },
    { sector: 'Sector 2' as const, d: mk(b1, b2 + 1), color: F1_SECTOR_COLORS.s2 },
    { sector: 'Sector 3' as const, d: mk(b2, n), color: F1_SECTOR_COLORS.s3 },
  ]
}

function pointsToPath(points: TrackPoint[]) {
  if (points.length === 0) return ''
  const [first, ...rest] = points
  return [`M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`, ...rest.map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)].join(' ')
}

/** Half the checker height along the lap (`<rect … height={5} />`, viewBox px). Forward edge = center + this along +tangent. */
const SF_GRID_HALF_ALONG = 2.5
/** Map path `strokeWidth` is 10 — distance from centerline to outer paint edge. */
const SF_TRACK_STROKE_HALF = 5
/** Extra along-lap past the checker’s forward edge (still clearly ahead of the SF line). */
const SF_ARROW_AHEAD = 6.5
/** Small standoff beyond the track stroke on the outer side of the circuit. */
const SF_ARROW_OUT_PAD = 4.5

/**
 * Arrow sits **ahead** of the start/finish line (+tangent past the checker) and **just outside** the
 * track stroke on the outer side (+normal). `sideSign` picks which side is “outer” (+1 default; Miami −1).
 */
function directionArrowViewPosition(p: { x: number; y: number }, angRad: number, sideSign: 1 | -1 = 1) {
  const tx = Math.cos(angRad)
  const ty = Math.sin(angRad)
  const nx = -ty * sideSign
  const ny = tx * sideSign
  const along = SF_GRID_HALF_ALONG + SF_ARROW_AHEAD
  const out = SF_TRACK_STROKE_HALF + SF_ARROW_OUT_PAD
  return {
    arrowCx: p.x + tx * along + nx * out,
    arrowCy: p.y + ty * along + ny * out,
  }
}

/** Small arrow in local +x; parent uses `rotate(directionDeg)` so +x matches travel direction. */
function TrackDirectionArrow({ cx, cy, directionDeg }: { cx: number; cy: number; directionDeg: number }) {
  return (
    <g transform={`translate(${cx},${cy}) rotate(${directionDeg})`} pointerEvents="none">
      <polygon
        points="-3.4,-2.35 5.2,0 -3.4,2.35"
        fill="#b8b5b2"
        fillOpacity={0.88}
        stroke="#ececec"
        strokeOpacity={0.95}
        strokeWidth={0.28}
        strokeLinejoin="round"
      />
    </g>
  )
}

export function CircuitMapCard({
  circuit,
  mode,
  sector,
  onModeChange,
  onSectorChange,
  telemetry,
  telemetryError,
  sectorPositionsMap,
}: Props) {
  const viewId = useId()
  const sectorId = useId()
  const sfCheckerPatternId = useId().replace(/:/g, '')
  const [apiPoints, setApiPoints] = useState<TrackPoint[] | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    async function load() {
      setApiError(null)
      setApiPoints(null)
      if (!circuit.positionsUrl) return
      try {
        const res = await fetch(circuit.positionsUrl, { headers: { accept: 'application/json' } })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as TrackApiShape
        const pts = extractPoints(json)
        if (!cancelled) {
          if (pts.length < 2) {
            setApiError('Track API returned no usable points.')
            setApiPoints([])
          } else {
            setApiPoints(pts)
          }
        }
      } catch (e) {
        if (!cancelled) {
          setApiError(e instanceof Error ? e.message : 'Failed to load track layout.')
          setApiPoints([])
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [circuit.id, circuit.positionsUrl])

  const telemetryForCircuit = useMemo(() => {
    if (!telemetry) return null
    const track = (circuit.fastF1RaceName ?? circuit.name).trim()
    const latest = latestYearForTrack(telemetry, track)
    const year =
      mode === 'Overtake'
        ? pickYearForDrsVisualization(telemetry, track) ?? latest
        : latest
    const filtered = telemetry.filter(
      (p) => racesMatch(p.track ?? '', track) && (!year || p.year === year),
    )
    if (filtered.length === 0) return []
    const driver = pickDriverWithMostPoints(filtered)
    return driver ? filtered.filter((p) => p.driver === driver) : filtered
  }, [circuit.fastF1RaceName, circuit.name, mode, telemetry])

  /** Fastest-lap telemetry used for Overtake-mode DRS segment coloring (`fastest_laps_telemetry.csv`). */
  const drsLapPoints = useMemo(() => {
    if (mode !== 'Overtake') return null
    return telemetryForCircuit ?? null
  }, [mode, telemetryForCircuit])

  const telemetryPath = useMemo(() => {
    if (!telemetryForCircuit || telemetryForCircuit.length < 2) {
      return { points: [] as TrackPoint[], min: 0, max: 0, transform: null as ViewBoxTransform | null }
    }
    const raw = telemetryForCircuit.map((p) => ({ x: p.x, y: p.y }))
    const tr = getViewBoxTransform(raw, 400, 260, 18)
    const normalized = raw.map((p) => projectXYToViewBox(p.x, p.y, tr))
    let min = Infinity
    let max = -Infinity
    for (const p of telemetryForCircuit) {
      if (p.speed < min) min = p.speed
      if (p.speed > max) max = p.speed
    }
    return {
      points: normalized,
      min: Number.isFinite(min) ? min : 0,
      max: Number.isFinite(max) ? max : 0,
      transform: tr,
    }
  }, [telemetryForCircuit])

  const apiPath = useMemo(() => {
    if (!apiPoints || apiPoints.length < 2) return ''
    const normalized = normalizePointsToViewBox(apiPoints, 400, 260, 18)
    return pointsToPath(normalized)
  }, [apiPoints])

  const speedSegments = useMemo(() => {
    if (!telemetryForCircuit || telemetryForCircuit.length < 2) return []
    const { points, min, max } = telemetryPath
    if (points.length < 2 || max <= min) return []
    const span = max - min
    const segs: Array<{ d: string; color: string }> = []
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]
      const b = points[i]
      const s = telemetryForCircuit[i]?.speed ?? telemetryForCircuit[i - 1]?.speed ?? min
      const t = Math.min(1, Math.max(0, (s - min) / span))
      const color = plasmaColor(t)
      segs.push({ d: `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`, color })
    }
    return segs
  }, [telemetryForCircuit, telemetryPath])

  const drsSegments = useMemo(() => {
    if (mode !== 'Overtake') return []
    if (!drsLapPoints || drsLapPoints.length < 2) return []
    const { points } = telemetryPath
    if (points.length < 2) return []
    const segs: Array<{ d: string; color: string }> = []
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]
      const b = points[i]
      const drsRaw = drsLapPoints[i]?.drs ?? drsLapPoints[i - 1]?.drs ?? ''
      const cat = drsCategory(drsRaw)
      const color = DRS_STATUS_COLORS[cat]
      segs.push({ d: `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`, color })
    }
    return segs
  }, [drsLapPoints, mode, telemetryPath])

  const sectorPositionsForCircuit = useMemo(() => {
    if (!sectorPositionsMap) return null
    const csvTrack = circuit.sectorCsvTrack
    if (!csvTrack) return null
    return sectorPositionsMap.get(csvTrack) ?? null
  }, [sectorPositionsMap, circuit.sectorCsvTrack])

  /** Vertex on the lap polyline closest to CSV start/finish (distance 0). Falls back to first sample if unknown. */
  const lapSectorAnchorK = useMemo(() => {
    if (!telemetryForCircuit || telemetryForCircuit.length < 2) return 0
    const raw = telemetryForCircuit.map((p) => ({ x: p.x, y: p.y }))
    const sf = sectorPositionsForCircuit?.startFinish
    if (sf) return closestVertexIndex(raw, sf.x, sf.y)
    return 0
  }, [telemetryForCircuit, sectorPositionsForCircuit])

  const lapSectorPaths = useMemo(() => {
    const pts = telemetryPath.points
    if (pts.length < 2 || !telemetryForCircuit) return []
    const raw = telemetryForCircuit.map((p) => ({ x: p.x, y: p.y }))
    const cumM = cumulativeDistancesM(raw)
    const lapLen = cumM[cumM.length - 1] ?? 0
    if (lapLen <= 0) return fallbackThirdSectorPaths(pts)
    return buildEqualDistanceThirdsAnchoredAtSF(pts, cumM, lapLen, lapSectorAnchorK)
  }, [telemetryPath.points, telemetryForCircuit, lapSectorAnchorK])

  const startFinishMark = useMemo(() => {
    const path = telemetryPath
    if (!path.transform || !sectorPositionsForCircuit?.startFinish || path.points.length < 2) {
      return null
    }
    const pts = path.points
    const { x, y } = sectorPositionsForCircuit.startFinish
    const p = projectXYToViewBox(x, y, path.transform)
    const k = lapSectorAnchorK
    const n = pts.length
    let tdx: number
    let tdy: number
    if (k < n - 1) {
      tdx = pts[k + 1].x - pts[k].x
      tdy = pts[k + 1].y - pts[k].y
    } else {
      tdx = pts[k].x - pts[k - 1].x
      tdy = pts[k].y - pts[k - 1].y
    }
    const ang = Math.atan2(tdy, tdx)
    const perp = ang + Math.PI / 2
    /** Rotate so rect +x aligns with track perpendicular (flag spans across the road). */
    const rotationDeg = (perp * 180) / Math.PI
    const directionDeg = (ang * 180) / Math.PI
    const arrowSideSign = circuit.id === 'miami' ? (-1 as const) : (1 as const)
    const { arrowCx, arrowCy } = directionArrowViewPosition(p, ang, arrowSideSign)
    return {
      cx: p.x,
      cy: p.y,
      rotationDeg,
      directionDeg,
      arrowCx,
      arrowCy,
    }
  }, [
    circuit.id,
    lapSectorAnchorK,
    sectorPositionsForCircuit,
    telemetryPath.points,
    telemetryPath.transform,
  ])

  /** API layout only (no telemetry polyline): direction from centerline samples + sector CSV start/finish. */
  const apiTrackDirectionMark = useMemo(() => {
    if (startFinishMark) return null
    if (!apiPoints || apiPoints.length < 2 || !sectorPositionsForCircuit?.startFinish) return null
    const sf = sectorPositionsForCircuit.startFinish
    const tr = getViewBoxTransform(apiPoints, 400, 260, 18)
    const raw = apiPoints.map((p) => ({ x: p.x, y: p.y }))
    const k = closestVertexIndex(raw, sf.x, sf.y)
    const norm = apiPoints.map((p) => projectXYToViewBox(p.x, p.y, tr))
    const n = norm.length
    let tdx: number
    let tdy: number
    if (k < n - 1) {
      tdx = norm[k + 1].x - norm[k].x
      tdy = norm[k + 1].y - norm[k].y
    } else {
      tdx = norm[k].x - norm[k - 1].x
      tdy = norm[k].y - norm[k - 1].y
    }
    if (tdx * tdx + tdy * tdy < 1e-12) return null
    const ang = Math.atan2(tdy, tdx)
    const p = projectXYToViewBox(sf.x, sf.y, tr)
    const arrowSideSign = circuit.id === 'miami' ? (-1 as const) : (1 as const)
    const { arrowCx, arrowCy } = directionArrowViewPosition(p, ang, arrowSideSign)
    return {
      directionDeg: (ang * 180) / Math.PI,
      arrowCx,
      arrowCy,
    }
  }, [apiPoints, circuit.id, sectorPositionsForCircuit, startFinishMark])

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-zinc-900">Circuit Map</h2>
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400" htmlFor={viewId}>
              Mode
            </label>
            <select
              id={viewId}
              value={mode}
              onChange={(e) => onModeChange(e.target.value as (typeof MODE_OPTIONS)[number])}
              className="h-9 min-w-[140px] rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-800 outline-none ring-indigo-500/20 focus:ring-2"
            >
              {MODE_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          {mode === 'Lap Time' ? (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400" htmlFor={sectorId}>
                Sector
              </label>
              <select
                id={sectorId}
                value={sector}
                onChange={(e) => onSectorChange(e.target.value as (typeof SECTOR_OPTIONS)[number])}
                className="h-9 min-w-[140px] rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-800 outline-none ring-indigo-500/20 focus:ring-2"
              >
                {SECTOR_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      </div>

      <div
        className={`mt-4 rounded-lg border border-zinc-100 bg-zinc-50/80 px-4 pt-4 ${
          mode === 'Speed' || mode === 'Overtake' ? 'pb-10' : 'pb-4'
        }${mode === 'Lap Time' ? ' cursor-pointer' : ''}`}
        onClick={mode === 'Lap Time' ? () => onSectorChange('Full Lap') : undefined}
      >
        <svg
          viewBox="0 0 400 260"
          className="mx-auto h-auto w-full max-w-xl"
          role="img"
          aria-label={`${circuit.fullName} map, ${mode}, ${sector}`}
        >
          <defs>
            <pattern
              id={sfCheckerPatternId}
              width={2}
              height={2}
              patternUnits="userSpaceOnUse"
              patternContentUnits="userSpaceOnUse"
            >
              <rect width={2} height={2} fill="#fafafa" />
              <rect width={1} height={1} fill="#171717" />
              <rect x={1} y={1} width={1} height={1} fill="#171717" />
            </pattern>
          </defs>
          {mode === 'Overtake' && drsSegments.length ? (
            drsSegments.map((seg, i) => (
              <path
                key={`${circuit.id}-drs-${i}`}
                d={seg.d}
                fill="none"
                stroke={seg.color}
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={1}
              />
            ))
          ) : mode === 'Speed' && speedSegments.length ? (
            speedSegments.map((seg, i) => (
              <path
                key={`${circuit.id}-speed-${i}`}
                d={seg.d}
                fill="none"
                stroke={seg.color}
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={1}
              />
            ))
          ) : mode === 'Lap Time' && lapSectorPaths.length ? (
            lapSectorPaths.map((seg, idx) => (
              <path
                key={`${circuit.id}-lap-${idx}`}
                d={seg.d}
                fill="none"
                stroke={seg.color}
                strokeWidth="10"
                strokeLinecap="butt"
                strokeLinejoin="round"
                opacity={sector === seg.sector || sector === 'Full Lap' ? 1 : 0.35}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation()
                  onSectorChange(seg.sector)
                }}
              />
            ))
          ) : mode !== 'Overtake' && apiPath ? (
            <path
              d={apiPath}
              fill="none"
              stroke="#0ea5e9"
              strokeWidth="10"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.9}
            />
          ) : (
            (circuit.trackSegments ?? []).map((seg, i) => (
              <path
                key={`${circuit.id}-seg-${i}`}
                d={seg.d}
                fill="none"
                stroke={seg.color}
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.85}
              />
            ))
          )}
          {startFinishMark ? (
            <g pointerEvents="none">
              <g aria-label="Start/finish line">
                <g transform={`translate(${startFinishMark.cx},${startFinishMark.cy}) rotate(${startFinishMark.rotationDeg})`}>
                  {/*
                    Spans past the ~10px stroke “track width”: wider across the road (local +x),
                    thin along the lap (local +y).
                  */}
                  <rect
                    x={-12}
                    y={-2.5}
                    width={24}
                    height={5}
                    fill={`url(#${sfCheckerPatternId})`}
                    stroke="#171717"
                    strokeWidth={0.4}
                  />
                </g>
              </g>
              <g aria-label="Track direction">
                <TrackDirectionArrow
                  cx={startFinishMark.arrowCx}
                  cy={startFinishMark.arrowCy}
                  directionDeg={startFinishMark.directionDeg}
                />
              </g>
            </g>
          ) : apiTrackDirectionMark ? (
            <g pointerEvents="none" aria-label="Track direction">
              <TrackDirectionArrow
                cx={apiTrackDirectionMark.arrowCx}
                cy={apiTrackDirectionMark.arrowCy}
                directionDeg={apiTrackDirectionMark.directionDeg}
              />
            </g>
          ) : null}
        </svg>
        {(mode === 'Speed' || mode === 'Overtake') && telemetry === null && !telemetryError ? (
          <div className="mx-auto mt-3 max-w-xl rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600">
            Loading telemetry…
          </div>
        ) : null}
        {(mode === 'Speed' || mode === 'Overtake') && telemetryError ? (
          <div className="mx-auto mt-3 max-w-xl rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600">
            Couldn’t load telemetry CSV (<code className="font-mono">/data/fastest_laps_telemetry.csv</code>):{' '}
            {telemetryError}
          </div>
        ) : null}
        {(mode === 'Speed' || mode === 'Overtake') && telemetry !== null && telemetry.length === 0 && !telemetryError ? (
          <div className="mx-auto mt-3 max-w-xl rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600">
            Telemetry file loaded but contains no valid rows.
          </div>
        ) : null}
        {(mode === 'Speed' || mode === 'Overtake') &&
        telemetry !== null &&
        telemetry.length > 0 &&
        telemetryForCircuit &&
        telemetryForCircuit.length === 0 ? (
          <div className="mx-auto mt-3 max-w-xl rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600">
            No telemetry found for <span className="font-semibold">{circuit.fastF1RaceName ?? circuit.name}</span>.
          </div>
        ) : null}
        {!apiPath && !circuit.trackSegments?.length && mode !== 'Speed' && mode !== 'Overtake' && !lapSectorPaths.length ? (
          <div className="mx-auto mt-3 max-w-xl rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600">
            {circuit.positionsUrl ? (
              apiError ? (
                <span>
                  Couldn’t load track layout from API ({apiError}). Check the response shape (needs points with x/y).
                </span>
              ) : (
                <span>Loading track layout from API…</span>
              )
            ) : (
              <span>
                No track layout configured yet. Set <code className="font-mono">VITE_TRACK_POSITIONS_BASE_URL</code> or
                provide <code className="font-mono">positionsUrl</code> for this circuit.
              </span>
            )}
          </div>
        ) : null}
        {mode === 'Speed' && speedSegments.length > 0 ? (
          <div className="mx-auto mt-4 max-w-xl">
            <div className="mb-1 flex justify-between text-xs tabular-nums text-zinc-600">
              <span>{formatSpeedKmh(telemetryPath.min)} km/h</span>
              <span>{formatSpeedKmh(telemetryPath.max)} km/h</span>
            </div>
            <div className="h-2 w-full rounded-full" style={{ background: PLASMA_LEGEND_GRADIENT }} />
          </div>
        ) : null}
        {mode === 'Overtake' && drsSegments.length > 0 ? (
          <div className="mx-auto mt-4 max-w-xl">
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-zinc-700">
              {(
                [
                  ['on', 'Drag Reduction System / Overtake Mode On'],
                  ['eligible', 'Drag Reduction System / Overtake Mode Eligible'],
                  ['off', 'Drag Reduction System / Overtake Mode Off'],
                ] as const
              ).map(([key, label]) => (
                <span key={key} className="flex items-center gap-2">
                  <span className="h-2.5 w-8 shrink-0 rounded-sm" style={{ backgroundColor: DRS_STATUS_COLORS[key] }} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
