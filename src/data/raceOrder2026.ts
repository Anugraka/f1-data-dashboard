/**
 * 2026 championship calendar order for the sidebar (user-provided).
 * Matches FastF1 `EventName` / CSV `Race` when data is collected.
 */
export const RACE_ORDER_2026 = [
  'Australian Grand Prix',
  'Chinese Grand Prix',
  'Japanese Grand Prix',
  'Miami Grand Prix',
  'Canadian Grand Prix',
  'Monaco Grand Prix',
  'Barcelona-Catalunya Grand Prix',
  'Austrian Grand Prix',
  'British Grand Prix',
  'Belgian Grand Prix',
  'Hungarian Grand Prix',
  'Dutch Grand Prix',
  'Italian Grand Prix',
  'Spanish Grand Prix',
  'Azerbaijan Grand Prix',
  'Singapore Grand Prix',
  'United States Grand Prix',
  'Mexico City Grand Prix',
  'Sao Paulo Grand Prix',
  'Las Vegas Grand Prix',
  'Qatar Grand Prix',
  'Abu Dhabi Grand Prix',
] as const

const orderIndexByRace = new Map<string, number>(
  RACE_ORDER_2026.map((name, index) => [name, index]),
)

/** Lower index = earlier on calendar; unknown races sort after the list. */
export function raceOrderIndex2026(fastF1RaceName: string | undefined): number {
  if (!fastF1RaceName) return RACE_ORDER_2026.length
  const idx = orderIndexByRace.get(fastF1RaceName.trim())
  return idx !== undefined ? idx : RACE_ORDER_2026.length
}

export function compareCircuitsBy2026Calendar(
  a: { fastF1RaceName?: string; name: string },
  b: { fastF1RaceName?: string; name: string },
): number {
  const diff = raceOrderIndex2026(a.fastF1RaceName) - raceOrderIndex2026(b.fastF1RaceName)
  if (diff !== 0) return diff
  return a.name.localeCompare(b.name)
}
