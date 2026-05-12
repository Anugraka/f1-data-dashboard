/**
 * Equal arc-length thirds along a lap polyline from the start/finish anchor (same rules as the map).
 */

export type XY = { x: number; y: number }

/** F1-style sector colors: sector 1 = red, sector 2 = blue, sector 3 = yellow. */
export const F1_SECTOR_COLORS = {
  s1: '#E10600',
  s2: '#00A3E0',
  s3: '#FFD200',
} as const

export function cumulativeDistancesM(points: XY[]): number[] {
  const d: number[] = [0]
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x
    const dy = points[i].y - points[i - 1].y
    d.push(d[i - 1] + Math.hypot(dx, dy))
  }
  return d
}

/** Distance along the open lap polyline from anchor vertex `k` to vertex `i`, wrapping past the end of the array. */
export function distanceFromAnchorVertex(cumM: number[], lapLen: number, k: number, i: number): number {
  if (lapLen <= 0) return 0
  if (i >= k) return cumM[i] - cumM[k]
  return lapLen - cumM[k] + cumM[i]
}

export function sectorFromEqualDistanceThird(distFromSF: number, lapLen: number): 1 | 2 | 3 {
  if (lapLen <= 0) return 1
  const third = lapLen / 3
  if (distFromSF < third) return 1
  if (distFromSF < 2 * third) return 2
  return 3
}

export function closestVertexIndex(points: XY[], x: number, y: number): number {
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < points.length; i++) {
    const dd = Math.hypot(points[i].x - x, points[i].y - y)
    if (dd < bestD) {
      bestD = dd
      best = i
    }
  }
  return best
}

export function lapAnchorVertexIndex(lapXY: XY[], startFinish: XY | null | undefined): number {
  if (!startFinish || lapXY.length < 2) return 0
  return closestVertexIndex(lapXY, startFinish.x, startFinish.y)
}

export type TelemetryLike = { x: number; y: number; speed: number }

export type EqualDistanceSectorScope = 'Full Lap' | 'Sector 1' | 'Sector 2' | 'Sector 3'

/** Max speed in a sector using equal path-length thirds from `anchorK`, matching the circuit map. */
export function maxSpeedForEqualDistanceThirdSector(
  pts: TelemetryLike[],
  anchorK: number,
  sector: EqualDistanceSectorScope,
): number | null {
  if (pts.length === 0) return null
  if (sector === 'Full Lap') {
    return Math.max(...pts.map((p) => p.speed))
  }
  const raw = pts.map((p) => ({ x: p.x, y: p.y }))
  const cumM = cumulativeDistancesM(raw)
  const lapLen = cumM[cumM.length - 1] ?? 0
  if (lapLen <= 0) {
    return maxSpeedSampleThirdsFallback(pts, sector)
  }
  const want: 1 | 2 | 3 = sector === 'Sector 1' ? 1 : sector === 'Sector 2' ? 2 : 3
  let maxS = -Infinity
  for (let i = 0; i < pts.length; i++) {
    const d = distanceFromAnchorVertex(cumM, lapLen, anchorK, i)
    const sn = sectorFromEqualDistanceThird(d, lapLen)
    if (sn === want && Number.isFinite(pts[i].speed) && pts[i].speed > maxS) {
      maxS = pts[i].speed
    }
  }
  return maxS === -Infinity ? null : maxS
}

/** Fallback when lap length is invalid: equal sample-count thirds (legacy). */
function maxSpeedSampleThirdsFallback(pts: TelemetryLike[], sector: EqualDistanceSectorScope): number | null {
  const n = pts.length
  const b1 = Math.floor(n / 3)
  const b2 = Math.floor((2 * n) / 3)
  let slice: TelemetryLike[]
  if (sector === 'Sector 1') slice = pts.slice(0, b1 + 1)
  else if (sector === 'Sector 2') slice = pts.slice(b1, b2 + 1)
  else slice = pts.slice(b2, n)
  if (slice.length === 0) return null
  return Math.max(...slice.map((p) => p.speed))
}
