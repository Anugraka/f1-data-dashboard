/**
 * Sidebar thumbs with lap-time sector colors (equal path-length thirds from start/finish).
 * Same rules as CircuitMapCard + sectorGeometry. Run: node scripts/generate-thumb-sector-paths.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const F1_SECTOR_COLORS = { s1: '#E10600', s2: '#00A3E0', s3: '#FFD200' }

const MAP_W = 400
const MAP_H = 260
const MAP_PAD = 18
const THUMB_W = 80
const THUMB_H = 60

const CIRCUITS = [
  { id: 'australia', gp: 'Australian Grand Prix', sectorCsv: 'Australia' },
  { id: 'shanghai', gp: 'Chinese Grand Prix', sectorCsv: 'China' },
  { id: 'japan', gp: 'Japanese Grand Prix', sectorCsv: 'Japan' },
  { id: 'miami', gp: 'Miami Grand Prix', sectorCsv: 'Miami' },
]

function splitCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') inQuotes = false
      else cur += ch
    } else {
      if (ch === ',') {
        out.push(cur)
        cur = ''
      } else if (ch === '"') inQuotes = true
      else cur += ch
    }
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

function loadStartFinishes() {
  const p = path.join(__dirname, '../public/data/sector_positions.csv')
  const text = fs.readFileSync(p, 'utf8')
  const lines = text.trim().split(/\r?\n/)
  const h = splitCsvLine(lines[0])
  const iTrack = h.indexOf('track')
  const iPoint = h.indexOf('point')
  const iX = h.indexOf('x')
  const iY = h.indexOf('y')
  const map = new Map()
  for (let li = 1; li < lines.length; li++) {
    const cols = splitCsvLine(lines[li])
    const track = cols[iTrack]
    const point = cols[iPoint]
    const x = Number(cols[iX])
    const y = Number(cols[iY])
    if (point === 'start_finish' && track && Number.isFinite(x) && Number.isFinite(y)) {
      map.set(track, { x, y })
    }
  }
  return map
}

function cumulativeDistancesM(points) {
  const d = [0]
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x
    const dy = points[i].y - points[i - 1].y
    d.push(d[i - 1] + Math.hypot(dx, dy))
  }
  return d
}

function distanceFromAnchorVertex(cumM, lapLen, k, i) {
  if (lapLen <= 0) return 0
  if (i >= k) return cumM[i] - cumM[k]
  return lapLen - cumM[k] + cumM[i]
}

function sectorFromEqualDistanceThird(distFromSF, lapLen) {
  if (lapLen <= 0) return 1
  const third = lapLen / 3
  if (distFromSF < third) return 1
  if (distFromSF < 2 * third) return 2
  return 3
}

function closestVertexIndex(points, x, y) {
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

function getViewBoxTransform(points, width, height, padding) {
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

function projectToThumb(x, y, t) {
  const xm = t.offsetX + (x - t.minX) * t.scale
  const ym = t.offsetY + (y - t.minY) * t.scale
  return {
    x: xm * (THUMB_W / MAP_W),
    y: ym * (THUMB_H / MAP_H),
  }
}

function buildEqualDistanceThirds(ptsNorm, cumM, lapLen, anchorK) {
  const n = ptsNorm.length
  if (n < 2 || cumM.length !== n || lapLen <= 0) return []

  const midDistAlongLap = (a, b) => {
    const da = distanceFromAnchorVertex(cumM, lapLen, anchorK, a)
    const db = distanceFromAnchorVertex(cumM, lapLen, anchorK, b)
    return (da + db) / 2
  }

  const out = []
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

function pathPointCount(d) {
  return (d.match(/[ML]/g) ?? []).length
}

/** Append `b`'s polyline to `a` (both "M…L…" paths). */
function mergePathD(a, b) {
  const ptsA = []
  const ra = /[ML]\s*([\d.-]+)\s*([\d.-]+)/g
  let m
  while ((m = ra.exec(a)) !== null) ptsA.push({ x: Number(m[1]), y: Number(m[2]) })
  const ptsB = []
  const rb = /[ML]\s*([\d.-]+)\s*([\d.-]+)/g
  while ((m = rb.exec(b)) !== null) ptsB.push({ x: Number(m[1]), y: Number(m[2]) })
  if (ptsA.length === 0) return b
  if (ptsB.length === 0) return a
  const last = ptsA[ptsA.length - 1]
  const first = ptsB[0]
  const same = Math.hypot(last.x - first.x, last.y - first.y) < 1e-3
  const rest = same ? ptsB.slice(1) : ptsB
  const all = ptsA.concat(rest)
  let d = `M ${all[0].x.toFixed(2)} ${all[0].y.toFixed(2)}`
  for (let i = 1; i < all.length; i++) d += ` L ${all[i].x.toFixed(2)} ${all[i].y.toFixed(2)}`
  return d
}

function mergeAdjacentByColor(segments) {
  const out = []
  for (const s of segments) {
    const last = out[out.length - 1]
    if (last && last.color === s.color) last.d = mergePathD(last.d, s.d)
    else out.push({ d: s.d, color: s.color })
  }
  return out
}

/** Merge very short trailing sector slivers (boundary noise) into the previous segment. */
function absorbTinyTailSegments(segments, maxVertices) {
  if (segments.length < 2) return segments
  const out = [...segments]
  while (out.length >= 2 && pathPointCount(out[out.length - 1].d) <= maxVertices) {
    const tail = out.pop()
    out[out.length - 1].d = mergePathD(out[out.length - 1].d, tail.d)
  }
  return out
}

function fallbackThirds(pts) {
  if (pts.length < 2) return []
  const n = pts.length
  const b1 = Math.floor(n / 3)
  const b2 = Math.floor((2 * n) / 3)
  const mk = (start, end) => {
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

function loadTelemetryRows() {
  const csvPath = path.join(__dirname, '../public/data/fastest_laps_telemetry.csv')
  const text = fs.readFileSync(csvPath, 'utf8')
  const lines = text.trim().split(/\r?\n/)
  const header = splitCsvLine(lines[0])
  const iTrack = header.indexOf('Track')
  const iYear = header.indexOf('Year')
  const iDriver = header.indexOf('Driver')
  const iX = header.indexOf('X')
  const iY = header.indexOf('Y')
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const parts = splitCsvLine(lines[i])
    if (parts.length < 7) continue
    const track = parts[iTrack]?.trim()
    const year = Number(parts[iYear])
    const driver = parts[iDriver]?.trim()
    const x = Number(parts[iX])
    const y = Number(parts[iY])
    if (!track || !Number.isFinite(year) || !driver || !Number.isFinite(x) || !Number.isFinite(y)) continue
    rows.push({ track, year, driver, x, y })
  }
  return rows
}

const sfMap = loadStartFinishes()
const rows = loadTelemetryRows()

for (const c of CIRCUITS) {
  const subset = rows.filter((r) => r.track === c.gp)
  if (subset.length === 0) {
    console.error('No telemetry for', c.gp)
    continue
  }
  const maxYear = Math.max(...subset.map((r) => r.year))
  const byYear = subset.filter((r) => r.year === maxYear)
  const drivers = [...new Set(byYear.map((r) => r.driver))]
  let bestDriver = drivers[0]
  let bestN = 0
  for (const d of drivers) {
    const n = byYear.filter((r) => r.driver === d).length
    if (n > bestN) {
      bestN = n
      bestDriver = d
    }
  }
  let raw = byYear.filter((r) => r.driver === bestDriver).map((r) => ({ x: r.x, y: r.y }))

  const MAX_PTS = 80
  const step0 = Math.max(1, Math.floor(raw.length / MAX_PTS))
  const sampledRaw = []
  for (let i = 0; i < raw.length; i += step0) sampledRaw.push(raw[i])
  const lastR = raw[raw.length - 1]
  const prevR = sampledRaw[sampledRaw.length - 1]
  if (!prevR || prevR.x !== lastR.x || prevR.y !== lastR.y) sampledRaw.push(lastR)
  raw = sampledRaw

  const t = getViewBoxTransform(raw, MAP_W, MAP_H, MAP_PAD)
  const ptsThumb = raw.map((p) => projectToThumb(p.x, p.y, t))
  const cumM = cumulativeDistancesM(raw)
  const lapLen = cumM[cumM.length - 1] ?? 0
  const sf = sfMap.get(c.sectorCsv)
  const anchorK = sf ? closestVertexIndex(raw, sf.x, sf.y) : 0

  let segments = buildEqualDistanceThirds(ptsThumb, cumM, lapLen, anchorK)
  if (segments.length === 0) segments = fallbackThirds(ptsThumb)

  segments = mergeAdjacentByColor(segments)
  segments = absorbTinyTailSegments(segments, 3)

  console.log(`// ${c.id} (${c.gp}, ${maxYear}, ${bestDriver})`)
  console.log(JSON.stringify(segments, null, 2))
  console.log('')
}
