export type SectorBoundaries = {
  startFinish: { x: number; y: number }
  /** Cumulative distance (m) at sector 1 → 2 boundary */
  s1S2M: number
  /** Cumulative distance (m) at sector 2 → 3 boundary */
  s2S3M: number
}

/** `sector_positions.csv` uses short track labels; map app circuit ids to those names. */
export const CIRCUIT_ID_TO_SECTOR_CSV_TRACK: Record<string, string> = {
  australia: 'Australia',
  shanghai: 'China',
  japan: 'Japan',
  miami: 'Miami',
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

/**
 * Load `/data/sector_positions.csv` → boundaries per CSV track name (e.g. Australia, Japan).
 */
export async function loadSectorPositionsCsv(path = '/data/sector_positions.csv') {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`Failed to load ${path} (HTTP ${res.status})`)
  const text = await res.text()
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean)
  if (lines.length < 2) return new Map<string, SectorBoundaries>()

  const headers = splitCsvLine(lines[0])
  const iTrack = headers.indexOf('track')
  const iPoint = headers.indexOf('point')
  const iX = headers.indexOf('x')
  const iY = headers.indexOf('y')
  const iDist = headers.indexOf('distance_m')
  if ([iTrack, iPoint, iX, iY, iDist].some((i) => i < 0)) {
    throw new Error(`sector_positions.csv missing columns. Found: ${headers.join(', ')}`)
  }

  const byTrack = new Map<
    string,
    Partial<{ startFinish: { x: number; y: number }; s1S2M: number; s2S3M: number }>
  >()

  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line)
    const track = (cols[iTrack] ?? '').trim()
    const point = (cols[iPoint] ?? '').trim()
    const x = Number(cols[iX])
    const y = Number(cols[iY])
    const dist = Number(cols[iDist])
    if (!track || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(dist)) continue

    let rec = byTrack.get(track)
    if (!rec) {
      rec = {}
      byTrack.set(track, rec)
    }
    if (point === 'start_finish') {
      rec.startFinish = { x, y }
    } else if (point === 's1_s2_boundary') {
      rec.s1S2M = dist
    } else if (point === 's2_s3_boundary') {
      rec.s2S3M = dist
    }
  }

  const out = new Map<string, SectorBoundaries>()
  for (const [track, rec] of byTrack.entries()) {
    if (rec.startFinish && rec.s1S2M != null && rec.s2S3M != null) {
      out.set(track, {
        startFinish: rec.startFinish,
        s1S2M: rec.s1S2M,
        s2S3M: rec.s2S3M,
      })
    }
  }
  return out
}
