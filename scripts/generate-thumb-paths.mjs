/**
 * Sidebar thumbs: same uniform scale + centering as CircuitMapCard telemetry paths
 * (getViewBoxTransform @ 400×260, padding 18), then scaled into viewBox 0 0 80 60.
 *
 * Run: node scripts/generate-thumb-paths.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const csvPath = path.join(__dirname, '../public/data/fastest_laps_telemetry.csv')

const text = fs.readFileSync(csvPath, 'utf8')
const lines = text.trim().split(/\r?\n/)
const header = lines[0].split(',').map((s) => s.trim())
const iTrack = header.indexOf('Track')
const iYear = header.indexOf('Year')
const iDriver = header.indexOf('Driver')
const iX = header.indexOf('X')
const iY = header.indexOf('Y')

const rows = []
for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split(',')
  if (parts.length < 7) continue
  const track = parts[iTrack]?.trim()
  const year = Number(parts[iYear])
  const driver = parts[iDriver]?.trim()
  const x = Number(parts[iX])
  const y = Number(parts[iY])
  if (!track || !Number.isFinite(year) || !driver || !Number.isFinite(x) || !Number.isFinite(y)) continue
  rows.push({ track, year, driver, x, y })
}

const TRACKS = [
  'Australian Grand Prix',
  'Chinese Grand Prix',
  'Japanese Grand Prix',
  'Miami Grand Prix',
]

/** Must match CircuitMapCard / getViewBoxTransform for telemetry map. */
const MAP_W = 400
const MAP_H = 260
const MAP_PAD = 18

const THUMB_W = 80
const THUMB_H = 60
const MAX_PTS = 56

function getViewBoxTransform(points, width, height, padding) {
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

function projectToThumb(x, y, t) {
  const xm = t.offsetX + (x - t.minX) * t.scale
  const ym = t.offsetY + (y - t.minY) * t.scale
  return {
    x: xm * (THUMB_W / MAP_W),
    y: ym * (THUMB_H / MAP_H),
  }
}

for (const trackName of TRACKS) {
  const subset = rows.filter((r) => r.track === trackName)
  if (subset.length === 0) {
    console.error('No rows for', trackName)
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
  const pts = byYear.filter((r) => r.driver === bestDriver).map((r) => ({ x: r.x, y: r.y }))

  const t = getViewBoxTransform(pts, MAP_W, MAP_H, MAP_PAD)
  const svgPts = pts.map((p) => projectToThumb(p.x, p.y, t))
  const step = Math.max(1, Math.floor(svgPts.length / MAX_PTS))
  const sampled = []
  for (let i = 0; i < svgPts.length; i += step) sampled.push(svgPts[i])
  const last = svgPts[svgPts.length - 1]
  const prev = sampled[sampled.length - 1]
  if (!prev || prev.x !== last.x || prev.y !== last.y) sampled.push(last)

  let d = `M ${sampled[0].x.toFixed(2)} ${sampled[0].y.toFixed(2)}`
  for (let i = 1; i < sampled.length; i++) {
    d += ` L ${sampled[i].x.toFixed(2)} ${sampled[i].y.toFixed(2)}`
  }
  d += ' Z'

  console.log(`// ${trackName} (${maxYear}, ${bestDriver}, ${pts.length} pts -> ${sampled.length} path pts)`)
  console.log(JSON.stringify(d))
  console.log('')
}
