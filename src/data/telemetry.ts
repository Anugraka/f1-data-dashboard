import {
  cumulativeDistancesM,
  distanceFromAnchorVertex,
  lapAnchorVertexIndex,
  maxSpeedForEqualDistanceThirdSector,
  sectorFromEqualDistanceThird,
} from './sectorGeometry'

export type TelemetryPoint = {
  track: string
  year: string
  driver: string
  x: number
  y: number
  speed: number
  /** DRS zone telemetry from CSV (`On`, `Off`, `Detected, Eligible`, etc.). */
  drs: string
}

function splitCsvLine(line: string) {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cur += ch
      }
    } else {
      if (ch === ',') {
        out.push(cur)
        cur = ''
      } else if (ch === '"') {
        inQuotes = true
      } else {
        cur += ch
      }
    }
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

/** Parse `Track,Year,Driver,X,Y,Speed,DRS` telemetry CSV text (shared by fastest-lap and Miami DRS exports). */
export function parseTelemetryCsvText(text: string): TelemetryPoint[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean)
  if (lines.length < 2) return []
  const headers = splitCsvLine(lines[0])

  const idx = {
    track: headers.indexOf('Track'),
    year: headers.indexOf('Year'),
    driver: headers.indexOf('Driver'),
    x: headers.indexOf('X'),
    y: headers.indexOf('Y'),
    speed: headers.indexOf('Speed'),
    drs: headers.indexOf('DRS'),
  }

  if (Object.values(idx).some((i) => i < 0)) {
    throw new Error(`Telemetry CSV is missing required headers. Found: ${headers.join(', ')}`)
  }

  const points: TelemetryPoint[] = []
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line)
    const x = Number(cols[idx.x])
    const y = Number(cols[idx.y])
    const speed = Number(cols[idx.speed])
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(speed)) continue
    const drsRaw = idx.drs >= 0 ? (cols[idx.drs] ?? '') : ''
    points.push({
      track: cols[idx.track] ?? '',
      year: cols[idx.year] ?? '',
      driver: cols[idx.driver] ?? '',
      x,
      y,
      speed,
      drs: drsRaw.trim(),
    })
  }
  return points
}

export async function loadFastestLapsTelemetryCsv(path = '/data/fastest_laps_telemetry.csv') {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`Failed to load ${path} (HTTP ${res.status})`)
  return parseTelemetryCsvText(await res.text())
}

/** Miami GP only: DRS-rich telemetry for the Overtake map (`fastest_laps_telemetry.csv` is all `Off` for this track). */
export async function loadDrsTelemetryMiamiCsv(path = '/data/drs_telemetry_data_miami.csv') {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`Failed to load ${path} (HTTP ${res.status})`)
  return parseTelemetryCsvText(await res.text())
}

export type DrsCategory = 'on' | 'off' | 'eligible' | 'unknown'

/** Normalize DRS CSV strings (`On`, `Off`, `Detected, Eligible`, …). */
export function drsCategory(drs: string): DrsCategory {
  const t = (drs ?? '').trim().toLowerCase()
  if (t === 'on') return 'on'
  if (t === 'off') return 'off'
  if (t.includes('detect') || t.includes('eligible')) return 'eligible'
  return 'unknown'
}

export const DRS_STATUS_COLORS: Record<DrsCategory, string> = {
  on: '#1F7A4D',
  off: '#9A9A9A',
  eligible: '#7BCB8E',
  /** Fallback for unparseable CSV values; not shown in the map legend. */
  unknown: '#9A9A9A',
}

export function latestYearForTrack(points: TelemetryPoint[], track: string) {
  const t = track.trim()
  let best: number | null = null
  for (const p of points) {
    if ((p.track ?? '').trim() !== t) continue
    const y = Number((p.year ?? '').trim())
    if (!Number.isFinite(y)) continue
    if (best == null || y > best) best = y
  }
  return best?.toString()
}

/**
 * For DRS map coloring: prefer the **newest** season whose representative lap (busiest driver)
 * actually shows DRS activation or multiple zone states. Some recent seasons in the CSV are
 * `Off` for every sample; using only {@link latestYearForTrack} would paint the whole lap one color.
 */
export function pickYearForDrsVisualization(points: TelemetryPoint[], trackName: string): string | null {
  const t = trackName.trim()
  const years = new Set<number>()
  for (const p of points) {
    if ((p.track ?? '').trim() !== t) continue
    const y = Number((p.year ?? '').trim())
    if (Number.isFinite(y)) years.add(y)
  }
  const sortedDesc = [...years].sort((a, b) => b - a)
  for (const yNum of sortedDesc) {
    const yearStr = String(yNum)
    const yearPoints = points.filter((p) => (p.track ?? '').trim() === t && p.year === yearStr)
    if (yearPoints.length === 0) continue
    const driver = pickDriverWithMostPoints(yearPoints)
    const lap = driver ? yearPoints.filter((p) => p.driver === driver) : yearPoints
    const cats = new Set(lap.map((p) => drsCategory(p.drs)))
    const hasOnOrEligible = lap.some((p) => {
      const c = drsCategory(p.drs)
      return c === 'on' || c === 'eligible'
    })
    if (cats.size > 1 || hasOnOrEligible) return yearStr
  }
  return sortedDesc.length > 0 ? String(sortedDesc[0]) : null
}

export function pickDriverWithMostPoints(points: TelemetryPoint[]) {
  const counts = new Map<string, number>()
  for (const p of points) counts.set(p.driver, (counts.get(p.driver) ?? 0) + 1)
  let best: { driver: string; n: number } | null = null
  for (const [driver, n] of counts.entries()) {
    if (!best || n > best.n) best = { driver, n }
  }
  return best?.driver
}

/** Years shown on the speed trend chart (x-axis), default tracks. */
export const TELEMETRY_SPEED_CHART_YEARS = [2022, 2023, 2024, 2025, 2026] as const

/** Chinese GP returned in 2024; chart x-axis omits 2022–2023. */
export const TELEMETRY_SPEED_CHART_YEARS_SHANGHAI = [2024, 2025, 2026] as const

/** Fixed Y-axis (km/h) for the top-speed-by-year line chart. */
export const SPEED_CHART_Y_KMH_MIN = 295
export const SPEED_CHART_Y_KMH_MAX = 335

/** Y-axis (km/h) for speed distribution boxplots (includes slow corners/pit-lane speeds). */
export const SPEED_BOXPLOT_Y_KMH_MIN = 60
export const SPEED_BOXPLOT_Y_KMH_MAX = 340

export function speedChartYearsForCircuit(circuitId: string): readonly number[] {
  return circuitId === 'shanghai' ? TELEMETRY_SPEED_CHART_YEARS_SHANGHAI : TELEMETRY_SPEED_CHART_YEARS
}

export type SpeedSectorScope = 'Full Lap' | 'Sector 1' | 'Sector 2' | 'Sector 3'

function speedsForEqualDistanceThirdSector(
  pts: Array<{ x: number; y: number; speed: number }>,
  anchorK: number,
  sector: SpeedSectorScope,
): number[] {
  if (pts.length === 0) return []
  if (sector === 'Full Lap') return pts.map((p) => p.speed)

  const raw = pts.map((p) => ({ x: p.x, y: p.y }))
  const cumM = cumulativeDistancesM(raw)
  const lapLen = cumM[cumM.length - 1] ?? 0

  // Fallback when geometry is invalid: equal sample-count thirds (legacy).
  if (lapLen <= 0) {
    const n = pts.length
    const b1 = Math.floor(n / 3)
    const b2 = Math.floor((2 * n) / 3)
    const slice =
      sector === 'Sector 1' ? pts.slice(0, b1 + 1) : sector === 'Sector 2' ? pts.slice(b1, b2 + 1) : pts.slice(b2, n)
    return slice.map((p) => p.speed)
  }

  const want: 1 | 2 | 3 = sector === 'Sector 1' ? 1 : sector === 'Sector 2' ? 2 : 3
  const out: number[] = []
  for (let i = 0; i < pts.length; i++) {
    const d = distanceFromAnchorVertex(cumM, lapLen, anchorK, i)
    const sn = sectorFromEqualDistanceThird(d, lapLen)
    if (sn === want) out.push(pts[i].speed)
  }
  return out
}

function quantile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  const pp = Math.min(1, Math.max(0, p))
  const i = (sorted.length - 1) * pp
  const i0 = Math.floor(i)
  const i1 = Math.ceil(i)
  const v0 = sorted[i0]
  const v1 = sorted[i1]
  if (!Number.isFinite(v0) || !Number.isFinite(v1)) return null
  if (i0 === i1) return v0
  const t = i - i0
  return v0 + (v1 - v0) * t
}

/**
 * For each calendar year, max speed on the representative lap for that track/year from
 * `fastest_laps_telemetry.csv` only (no synthetic values).
 * Uses the driver with the most samples for that track/year (same heuristic as the map).
 * Sectors use equal path-length thirds from `startFinish` when provided (same as the map); otherwise sample-thirds fallback.
 */
export function topSpeedSeriesForTrack(
  allPoints: TelemetryPoint[],
  trackName: string,
  sector: SpeedSectorScope,
  years: readonly number[] = TELEMETRY_SPEED_CHART_YEARS,
  startFinish: { x: number; y: number } | null = null,
): { year: number; speedKmh: number | null }[] {
  return years.map((year) => {
    const yearPoints = allPoints.filter(
      (p) => (p.track ?? '').trim() === trackName && Number((p.year ?? '').trim()) === year,
    )
    if (yearPoints.length === 0) {
      return { year, speedKmh: null }
    }

    const driver = pickDriverWithMostPoints(yearPoints)
    const lapPoints = driver ? yearPoints.filter((p) => p.driver === driver) : yearPoints
    if (lapPoints.length === 0) {
      return { year, speedKmh: null }
    }

    const anchorK = lapAnchorVertexIndex(
      lapPoints.map((p) => ({ x: p.x, y: p.y })),
      startFinish,
    )
    const maxSpeed = maxSpeedForEqualDistanceThirdSector(lapPoints, anchorK, sector)
    return { year, speedKmh: maxSpeed }
  })
}

export type SpeedBoxPlotYearPoint = {
  year: number
  minKmh: number | null
  q1Kmh: number | null
  medianKmh: number | null
  q3Kmh: number | null
  maxKmh: number | null
  n: number
}

/**
 * For each calendar year, compute the speed distribution on the representative fastest lap.
 * Uses the driver with the most samples for that track/year (same heuristic as the map).
 * When `sector` is not Full Lap, uses equal path-length thirds anchored at `startFinish` (same as the map).
 */
export function speedBoxPlotSeriesForTrack(
  allPoints: TelemetryPoint[],
  trackName: string,
  sector: SpeedSectorScope,
  years: readonly number[] = TELEMETRY_SPEED_CHART_YEARS,
  startFinish: { x: number; y: number } | null = null,
): SpeedBoxPlotYearPoint[] {
  return years.map((year) => {
    const yearPoints = allPoints.filter(
      (p) => (p.track ?? '').trim() === trackName && Number((p.year ?? '').trim()) === year,
    )
    if (yearPoints.length === 0) {
      return { year, minKmh: null, q1Kmh: null, medianKmh: null, q3Kmh: null, maxKmh: null, n: 0 }
    }

    const driver = pickDriverWithMostPoints(yearPoints)
    const lapPoints = driver ? yearPoints.filter((p) => p.driver === driver) : yearPoints
    if (lapPoints.length === 0) {
      return { year, minKmh: null, q1Kmh: null, medianKmh: null, q3Kmh: null, maxKmh: null, n: 0 }
    }

    const anchorK = lapAnchorVertexIndex(
      lapPoints.map((p) => ({ x: p.x, y: p.y })),
      startFinish,
    )

    const speeds = speedsForEqualDistanceThirdSector(lapPoints, anchorK, sector).filter((s) => Number.isFinite(s))
    if (speeds.length === 0) {
      return { year, minKmh: null, q1Kmh: null, medianKmh: null, q3Kmh: null, maxKmh: null, n: 0 }
    }
    speeds.sort((a, b) => a - b)

    const minKmh = speeds[0] ?? null
    const maxKmh = speeds[speeds.length - 1] ?? null
    const q1Kmh = quantile(speeds, 0.25)
    const medianKmh = quantile(speeds, 0.5)
    const q3Kmh = quantile(speeds, 0.75)

    return { year, minKmh, q1Kmh, medianKmh, q3Kmh, maxKmh, n: speeds.length }
  })
}

