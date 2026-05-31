import type { Circuit, TrackSegment } from '../types'
import { STATIC_THUMB_SECTORS } from './staticCircuitThumbs'

/** Display/metadata overrides keyed by FastF1 `EventName` / CSV `Race`. */
export type CircuitCatalogEntry = {
  fastF1RaceName: string
  id: string
  name: string
  sidebarLabel?: string
  fullName: string
  country: string
  /** `sector_positions.csv` track label (start/finish + sector boundaries). */
  sectorCsvTrack?: string
  /** Optional pre-built sidebar thumb (else generated from telemetry). */
  thumbSectors?: TrackSegment[]
  /** Slug for `VITE_TRACK_POSITIONS_BASE_URL/{slug}` when set. */
  positionsUrlSlug?: string
  lapUiYearAllowlist?: readonly number[]
  speedChartYearAllowlist?: readonly number[]
  lapChartFootnote?: string
  /** Shown under Speed and Overtake charts (e.g. Shanghai cancellation note). */
  chartFootnote?: string
}

/** Known circuits with rich metadata; unknown GPs get defaults from {@link defaultCatalogEntry}. */
export const CIRCUIT_CATALOG: CircuitCatalogEntry[] = [
  {
    fastF1RaceName: 'Australian Grand Prix',
    id: 'australia',
    name: 'Australia',
    sidebarLabel: 'Melbourne',
    fullName: 'Albert Park Grand Prix Circuit',
    country: 'Australia',
    sectorCsvTrack: 'Australia',
    positionsUrlSlug: 'australia',
    lapChartFootnote:
      'Note: The 2025 Australian Grand Prix was held in heavy rain conditions, which may have influenced the lap times recorded during that race.',
  },
  {
    fastF1RaceName: 'Chinese Grand Prix',
    id: 'shanghai',
    name: 'Shanghai',
    fullName: 'Shanghai International Circuit',
    country: 'China',
    sectorCsvTrack: 'China',
    positionsUrlSlug: 'shanghai',
    lapUiYearAllowlist: [2024, 2025, 2026],
    speedChartYearAllowlist: [2024, 2025, 2026],
    chartFootnote:
      'Note: The Chinese Grand Prix was cancelled in 2022 and 2023 due to ongoing COVID-19 restrictions.',
  },
  {
    fastF1RaceName: 'Japanese Grand Prix',
    id: 'japan',
    name: 'Japan',
    sidebarLabel: 'Suzuka',
    fullName: 'Suzuka International Racing Course',
    country: 'Japan',
    sectorCsvTrack: 'Japan',
    positionsUrlSlug: 'japan',
  },
  {
    fastF1RaceName: 'Miami Grand Prix',
    id: 'miami',
    name: 'Miami',
    fullName: 'Miami International Autodrome',
    country: 'United States',
    sectorCsvTrack: 'Miami',
    positionsUrlSlug: 'miami',
  },
]

const catalogByRace = new Map(CIRCUIT_CATALOG.map((e) => [e.fastF1RaceName, e]))

export function catalogEntryForRace(raceName: string): CircuitCatalogEntry {
  const hit = catalogByRace.get(raceName.trim())
  if (hit) return hit
  return defaultCatalogEntry(raceName)
}

export function slugFromGrandPrix(raceName: string): string {
  const stem = raceName.replace(/\s+Grand Prix$/i, '').trim()
  const slug = stem
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'circuit'
}

function defaultCatalogEntry(raceName: string): CircuitCatalogEntry {
  const stem = raceName.replace(/\s+Grand Prix$/i, '').trim() || raceName
  return {
    fastF1RaceName: raceName,
    id: slugFromGrandPrix(raceName),
    name: stem,
    fullName: raceName,
    country: stem,
    positionsUrlSlug: slugFromGrandPrix(raceName),
  }
}

export function thumbSectorsForCatalogEntry(entry: CircuitCatalogEntry): TrackSegment[] | undefined {
  return entry.thumbSectors ?? STATIC_THUMB_SECTORS[entry.id]
}

export function catalogEntryToCircuit(
  entry: CircuitCatalogEntry,
  thumbSectors?: TrackSegment[],
): Circuit {
  const base = (import.meta as any).env?.VITE_TRACK_POSITIONS_BASE_URL as string | undefined
  const positionsUrl = base
    ? `${base.replace(/\/$/, '')}/${entry.positionsUrlSlug ?? entry.id}`
    : undefined

  return {
    id: entry.id,
    name: entry.name,
    sidebarLabel: entry.sidebarLabel,
    fullName: entry.fullName,
    country: entry.country,
    gpLabel: `Grand Prix · ${entry.name}`,
    fastF1RaceName: entry.fastF1RaceName,
    thumbSectors,
    positionsUrl,
    sectorCsvTrack: entry.sectorCsvTrack,
    lapUiYearAllowlist: entry.lapUiYearAllowlist,
    speedChartYearAllowlist: entry.speedChartYearAllowlist,
    lapChartFootnote: entry.lapChartFootnote,
    chartFootnote: entry.chartFootnote,
  }
}
