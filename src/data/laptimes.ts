import { ENGINE_COLORS } from './circuits'
import type { EngineManufacturer, TeamLap, YearBestTeamLap } from '../types'

export type SectorKey = 'LapTime' | 'Sector1Time' | 'Sector2Time' | 'Sector3Time'

export type LapTimesRow = {
  Driver: string
  Team: string
  LapTime: string
  Sector1Time: string
  Sector2Time: string
  Sector3Time: string
  SpeedST?: string
  Deleted?: string
  Race: string
  Year: string
  /** Per-lap engine supplier from CSV (e.g. Renault for Alpine in earlier seasons). */
  Engine?: string
}

function parseCsv(text: string) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean)
  if (lines.length === 0) return []
  const headers = splitCsvLine(lines[0])
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line)
    const row: Record<string, string> = {}
    for (let i = 0; i < headers.length; i++) row[headers[i]] = values[i] ?? ''
    return row
  })
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

function parseTimeSeconds(v: string): number | null {
  const s = v.trim()
  if (!s) return null
  // Accept FastF1/pandas strings like:
  // - "0 days 00:01:30.342000"
  // - "00:01:30.342000"
  // - "1:30.342"
  // - "90.342"
  const td = s.match(/^(\d+)\s+days?\s+(\d+):(\d+):(\d+(?:\.\d+)?)$/i)
  if (td) {
    const days = Number(td[1])
    const hh = Number(td[2])
    const mm = Number(td[3])
    const ss = Number(td[4])
    const total = days * 86400 + hh * 3600 + mm * 60 + ss
    return Number.isFinite(total) ? total : null
  }
  const hms = s.match(/^(\d+):(\d+):(\d+(?:\.\d+)?)$/)
  if (hms) {
    const hh = Number(hms[1])
    const mm = Number(hms[2])
    const ss = Number(hms[3])
    const total = hh * 3600 + mm * 60 + ss
    return Number.isFinite(total) ? total : null
  }
  // Accept "M:SS.sss" or "SS.sss"
  const m = s.match(/^(\d+):(\d+(?:\.\d+)?)$/)
  if (m) return Number(m[1]) * 60 + Number(m[2])
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const TEAM_ENGINE: Record<string, EngineManufacturer> = {
  // Update these if your CSV uses different team names
  'Red Bull Racing': 'Honda',
  'Ferrari': 'Ferrari',
  'Mercedes': 'Mercedes',
  'McLaren': 'Mercedes',
  'Aston Martin': 'Mercedes',
  'Williams': 'Mercedes',
  'Alpine': 'Mercedes',
  'Haas F1 Team': 'Ferrari',
  'Racing Bulls': 'Honda',
  'Sauber': 'Audi',
  'Audi': 'Audi',
  'Cadillac': 'Ford',
  'RB': 'Honda',
  'Kick Sauber': 'Audi',
}

function engineForTeam(team: string): EngineManufacturer {
  return TEAM_ENGINE[team] ?? 'Mercedes'
}

function engineFromCsvOrTeam(r: LapTimesRow, team: string): EngineManufacturer {
  const raw = (r.Engine ?? '').trim()
  if (raw && Object.hasOwn(ENGINE_COLORS, raw)) {
    return raw as EngineManufacturer
  }
  return engineForTeam(team)
}

export async function loadLapTimesCsv(path = '/data/laptimes.csv'): Promise<LapTimesRow[]> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`Failed to load ${path} (HTTP ${res.status})`)
  const text = await res.text()
  const rows = parseCsv(text) as unknown as LapTimesRow[]
  return rows
}

const MIAMI_GP_RACE = 'Miami Grand Prix'
const MIAMI_OVERLAY_CSV = '/data/miami_2026.csv'

function normalizeYearCell(y: string): string {
  return String(y ?? '')
    .trim()
    .replace(/\.0+$/, '')
}

/**
 * Loads `speed_metrics_final.csv`, then replaces any Miami Grand Prix / 2026 rows with data from
 * `miami_2026.csv` (same columns). If the overlay file is missing or fails, returns the main file only.
 */
export async function loadMergedLapTimesForDashboard(): Promise<LapTimesRow[]> {
  const main = await loadLapTimesCsv('/data/speed_metrics_final.csv')
  try {
    const extra = await loadLapTimesCsv(MIAMI_OVERLAY_CSV)
    const kept = main.filter((r) => {
      const race = (r.Race ?? '').trim()
      const y = normalizeYearCell(r.Year ?? '')
      return !(race === MIAMI_GP_RACE && y === '2026')
    })
    return [...kept, ...extra]
  } catch {
    return main
  }
}

export function averageLapTimesByTeam(rows: LapTimesRow[], opts: { race: string; year?: string; sector: SectorKey }) {
  const { race, year, sector } = opts

  const filtered = rows.filter((r) => {
    if ((r.Race ?? '').trim() !== race) return false
    if (year && (r.Year ?? '').trim() !== year) return false
    if ((r.Deleted ?? '').trim().toLowerCase() === 'true') return false
    return true
  })

  const byTeam = new Map<string, { sum: number; n: number; engine: EngineManufacturer }>()
  for (const r of filtered) {
    const team = (r.Team ?? '').trim()
    if (!team) continue
    const secs = parseTimeSeconds((r as any)[sector] ?? '')
    if (secs == null) continue
    const eng = engineFromCsvOrTeam(r, team)
    let agg = byTeam.get(team)
    if (!agg) {
      agg = { sum: 0, n: 0, engine: eng }
      byTeam.set(team, agg)
    }
    agg.sum += secs
    agg.n += 1
  }

  const out: TeamLap[] = Array.from(byTeam.entries()).map(([team, agg]) => ({
    team,
    engine: agg.engine,
    lapTime: Math.round((agg.sum / Math.max(1, agg.n)) * 1000) / 1000,
  }))

  return out.sort((a, b) => a.lapTime - b.lapTime)
}

export function countRowsForRaceYear(rows: LapTimesRow[], race: string, year?: string) {
  return rows.filter((r) => {
    if ((r.Race ?? '').trim() !== race) return false
    if (year && (r.Year ?? '').trim() !== year) return false
    if ((r.Deleted ?? '').trim().toLowerCase() === 'true') return false
    return true
  }).length
}

export function latestYearForRace(rows: LapTimesRow[], race: string) {
  let best: number | null = null
  for (const r of rows) {
    if ((r.Race ?? '').trim() !== race) continue
    const y = Number((r.Year ?? '').trim())
    if (!Number.isFinite(y)) continue
    if (best == null || y > best) best = y
  }
  return best?.toString()
}

/** Distinct years present in the CSV for this race, oldest → newest. */
export function yearsForRace(rows: LapTimesRow[], race: string): string[] {
  const set = new Set<string>()
  for (const r of rows) {
    if ((r.Race ?? '').trim() !== race) continue
    const y = (r.Year ?? '').trim()
    if (y) set.add(y)
  }
  return Array.from(set).sort((a, b) => Number(a) - Number(b))
}

/**
 * Lap chart seasons shown in the UI: intersect CSV years with per-circuit allowlists (tracks where
 * we only want a subset of seasons in the dropdown).
 */
const LAP_UI_YEAR_ALLOWLIST: Record<string, readonly number[]> = {
  shanghai: [2024, 2025, 2026],
  miami: [2022, 2023, 2024, 2025, 2026],
}

function allowedYearsSetForCircuit(circuitId: string): Set<number> | null {
  const list = LAP_UI_YEAR_ALLOWLIST[circuitId]
  if (!list?.length) return null
  return new Set(list)
}

/** Like {@link yearsForRace}, but restricted to the circuit’s UI allowlist when defined. */
export function yearsForRaceUi(rows: LapTimesRow[], race: string, circuitId: string): string[] {
  const raw = yearsForRace(rows, race)
  const allow = allowedYearsSetForCircuit(circuitId)
  if (!allow) return raw
  return raw.filter((y) => allow.has(Number(y))).sort((a, b) => Number(a) - Number(b))
}

/** Latest CSV year for this race that is allowed in the UI for this circuit. */
export function latestYearForRaceUi(rows: LapTimesRow[], race: string, circuitId: string): string | undefined {
  const ys = yearsForRaceUi(rows, race, circuitId)
  if (ys.length === 0) return undefined
  return ys[ys.length - 1]
}

/**
 * For each year in the CSV for `race`, compute each team’s average for `sector`, then keep the
 * team with the lowest average (fastest). Matches “best team by average lap” for that year.
 * Pass `years` to restrict which seasons are included (e.g. UI filter).
 */
export function fastestTeamAverageByYear(
  rows: LapTimesRow[],
  opts: { race: string; sector: SectorKey; years?: string[] },
): YearBestTeamLap[] {
  const { race, sector } = opts
  const out: YearBestTeamLap[] = []
  const yearList = opts.years ?? yearsForRace(rows, race)
  for (const year of yearList) {
    const teams = averageLapTimesByTeam(rows, { race, year, sector })
    if (teams.length === 0) continue
    const best = teams[0]
    out.push({
      year,
      team: best.team,
      engine: best.engine,
      lapTime: best.lapTime,
    })
  }
  return out
}

