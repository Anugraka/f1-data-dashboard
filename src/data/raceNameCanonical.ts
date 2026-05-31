/**
 * Canonical CSV / sidebar race name is always the first entry (e.g. Canadian Grand Prix).
 * Other strings are legacy FastF1 ingest spellings only — never written to CSVs.
 * Keep in sync with EVENT_ALIASES in scripts/collect_fastf1_data.py.
 */
const RACE_ALIASES: Record<string, readonly string[]> = {
  'Canadian Grand Prix': ['Canadian Grand Prix', 'Canada Grand Prix'], // ingest alias only
  'Sao Paulo Grand Prix': ['São Paulo Grand Prix', 'Sao Paulo Grand Prix'],
  'Barcelona-Catalunya Grand Prix': ['Barcelona-Catalunya Grand Prix', 'Spanish Grand Prix'],
  'United States Grand Prix': ['United States Grand Prix', 'USA Grand Prix', 'U.S. Grand Prix'],
  'Mexico City Grand Prix': ['Mexico City Grand Prix', 'Mexican Grand Prix'],
}

function normalizeRaceKey(name: string): string {
  return name
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

/** Preferred EventName / CSV `Race` label for this GP. */
export function canonicalRaceName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return trimmed
  const key = normalizeRaceKey(trimmed)
  for (const [canonical, aliases] of Object.entries(RACE_ALIASES)) {
    for (const candidate of [canonical, ...aliases]) {
      if (normalizeRaceKey(candidate) === key) return canonical
    }
  }
  return trimmed
}

export function racesMatch(a: string, b: string): boolean {
  return canonicalRaceName(a) === canonicalRaceName(b)
}
