export type OvertakeSeasonRow = {
  year: string
  race: string
  overtakes: number
  positionChanges: number
  /** Percent of position changes attributed to overtakes (0–100). */
  pctFromOvertakes: number
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

function pctFromOvertakesColumn(headers: string[]): number {
  const exact = headers.indexOf('% of Position Changes from Overtakes')
  if (exact >= 0) return exact
  return headers.findIndex(
    (h) => h.includes('%') && h.includes('Position') && h.includes('Overtakes'),
  )
}

export async function loadOvertakeDataCsv(path = '/data/overtake_data.csv') {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`Failed to load ${path} (HTTP ${res.status})`)
  const text = await res.text()
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean)
  if (lines.length < 2) return []
  const headers = splitCsvLine(lines[0])

  const iYear = headers.indexOf('Year')
  const iRace = headers.indexOf('Race')
  const iOvertakes = headers.indexOf('Overtakes')
  const iPos =
    headers.indexOf('Number of Position Changes') >= 0
      ? headers.indexOf('Number of Position Changes')
      : headers.findIndex((h) => /position changes/i.test(h) && !/^%/i.test(h.trim()))
  const iPct = pctFromOvertakesColumn(headers)

  if (iYear < 0 || iRace < 0 || iOvertakes < 0 || iPos < 0) {
    throw new Error(`Overtake data CSV missing columns. Found: ${headers.join(', ')}`)
  }

  const rows: OvertakeSeasonRow[] = []
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line)
    const year = cols[iYear] ?? ''
    const race = cols[iRace] ?? ''
    const overtakes = Number(cols[iOvertakes])
    const positionChanges = Number(cols[iPos])
    let pct = iPct >= 0 ? Number(cols[iPct]) : NaN
    if (!year || !race || !Number.isFinite(overtakes) || !Number.isFinite(positionChanges)) continue
    if (!Number.isFinite(pct)) {
      pct = positionChanges > 0 ? (100 * overtakes) / positionChanges : 0
    }
    rows.push({ year, race, overtakes, positionChanges, pctFromOvertakes: pct })
  }
  return rows
}

/** Rows for one grand prix name (must match `fastF1RaceName` / CSV `Race`), sorted by year ascending. */
export function overtakesForRace(rows: OvertakeSeasonRow[], raceName: string): OvertakeSeasonRow[] {
  const r = raceName.trim()
  return rows
    .filter((x) => (x.race ?? '').trim() === r)
    .sort((a, b) => Number(a.year) - Number(b.year))
}
