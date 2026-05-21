import type { TrackSegment } from '../types'
import {
  cumulativeDistancesM,
  distanceFromAnchorVertex,
  F1_SECTOR_COLORS,
  lapAnchorVertexIndex,
  sectorFromEqualDistanceThird,
  type XY,
} from './sectorGeometry'

const THUMB_W = 80
const THUMB_H = 60
const MAP_W = 400
const MAP_H = 260
const MAP_PAD = 18

function getViewBoxTransform(points: XY[], width: number, height: number, padding: number) {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  const spanX = Math.max(1e-9, maxX - minX)
  const spanY = Math.max(1e-9, maxY - minY)
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY)
  const offsetX = (width - spanX * scale) / 2
  const offsetY = (height - spanY * scale) / 2
  return { minX, maxX, minY, maxY, scale, offsetX, offsetY }
}

function projectToThumb(x: number, y: number, t: ReturnType<typeof getViewBoxTransform>) {
  const xm = t.offsetX + (x - t.minX) * t.scale
  const ym = t.offsetY + (y - t.minY) * t.scale
  return { x: (xm * THUMB_W) / MAP_W, y: (ym * THUMB_H) / MAP_H }
}

function buildEqualDistanceThirds(ptsNorm: XY[], cumM: number[], lapLen: number, anchorK: number): TrackSegment[] {
  const n = ptsNorm.length
  if (n < 2 || cumM.length !== n || lapLen <= 0) return []

  const midDistAlongLap = (a: number, b: number) => {
    const da = distanceFromAnchorVertex(cumM, lapLen, anchorK, a)
    const db = distanceFromAnchorVertex(cumM, lapLen, anchorK, b)
    return (da + db) / 2
  }

  const out: TrackSegment[] = []
  let i = 1
  while (i < n) {
    const sn = sectorFromEqualDistanceThird(midDistAlongLap(i - 1, i), lapLen)
    const color = sn === 1 ? F1_SECTOR_COLORS.s1 : sn === 2 ? F1_SECTOR_COLORS.s2 : F1_SECTOR_COLORS.s3
    let d = `M ${ptsNorm[i - 1].x.toFixed(2)} ${ptsNorm[i - 1].y.toFixed(2)}`
    let j = i
    while (j < n) {
      const sj = sectorFromEqualDistanceThird(midDistAlongLap(j - 1, j), lapLen)
      if (sj !== sn) break
      d += ` L ${ptsNorm[j].x.toFixed(2)} ${ptsNorm[j].y.toFixed(2)}`
      j++
    }
    out.push({ d, color })
    i = j
  }
  return out
}

function fallbackThirds(pts: XY[]): TrackSegment[] {
  if (pts.length < 2) return []
  const n = pts.length
  const b1 = Math.floor(n / 3)
  const b2 = Math.floor((2 * n) / 3)
  const mk = (start: number, end: number) => {
    const slice = pts.slice(start, end)
    if (slice.length === 0) return ''
    let d = `M ${slice[0].x.toFixed(2)} ${slice[0].y.toFixed(2)}`
    for (let k = 1; k < slice.length; k++) d += ` L ${slice[k].x.toFixed(2)} ${slice[k].y.toFixed(2)}`
    return d
  }
  return [
    { d: mk(0, b1 + 1), color: F1_SECTOR_COLORS.s1 },
    { d: mk(b1, b2 + 1), color: F1_SECTOR_COLORS.s2 },
    { d: mk(b2, n), color: F1_SECTOR_COLORS.s3 },
  ].filter((s) => s.d)
}

/** Build colored sector strokes for the sidebar from a representative lap (X/Y). */
export function buildThumbSectorsFromTelemetry(
  lapXY: XY[],
  startFinish: XY | null | undefined,
): TrackSegment[] {
  if (lapXY.length < 2) return []

  const t = getViewBoxTransform(lapXY, MAP_W, MAP_H, MAP_PAD)
  const ptsNorm = lapXY.map((p) => projectToThumb(p.x, p.y, t))
  const cumM = cumulativeDistancesM(lapXY)
  const lapLen = cumM[cumM.length - 1] ?? 0
  const anchorK = lapAnchorVertexIndex(lapXY, startFinish ?? null)

  let segments =
    lapLen > 0 && startFinish
      ? buildEqualDistanceThirds(ptsNorm, cumM, lapLen, anchorK)
      : fallbackThirds(ptsNorm)

  if (segments.length === 0) segments = fallbackThirds(ptsNorm)
  return segments
}
