import type { LapTimesRow } from './laptimes'
import type { TelemetryPoint } from './telemetry'
import type { SectorBoundaries } from './sectorPositions'
import {
  catalogEntryForRace,
  catalogEntryToCircuit,
  thumbSectorsForCatalogEntry,
} from './circuitCatalog'
import { compareCircuitsBy2026Calendar } from './raceOrder2026'
import { canonicalRaceName, racesMatch } from './raceNameCanonical'
import { buildThumbSectorsFromTelemetry } from './buildThumbSectors'
import type { Circuit } from '../types'
import { latestYearForTrack, pickDriverWithMostPoints } from './telemetry'

function uniqueCanonicalRacesFromLaps(rows: LapTimesRow[]): string[] {
  const set = new Set<string>()
  for (const r of rows) {
    const race = (r.Race ?? '').trim()
    if (race) set.add(canonicalRaceName(race))
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

function hasTelemetryForRace(points: TelemetryPoint[], canonicalRace: string): boolean {
  return points.some((p) => racesMatch(p.track ?? '', canonicalRace))
}

function representativeLapXY(
  points: TelemetryPoint[],
  race: string,
  sectorPositions: Map<string, SectorBoundaries> | null,
  sectorCsvTrack: string | undefined,
): { lap: { x: number; y: number }[]; startFinish: { x: number; y: number } | null } {
  const track = race.trim()
  const latest = latestYearForTrack(points, track)
  const yearPoints = points.filter((p) => (p.track ?? '').trim() === track && (!latest || p.year === latest))
  if (yearPoints.length < 2) return { lap: [], startFinish: null }

  const driver = pickDriverWithMostPoints(yearPoints)
  const lap = (driver ? yearPoints.filter((p) => p.driver === driver) : yearPoints).map((p) => ({
    x: p.x,
    y: p.y,
  }))

  let startFinish: { x: number; y: number } | null = null
  if (sectorCsvTrack && sectorPositions) {
    const b = sectorPositions.get(sectorCsvTrack)
    if (b?.startFinish) startFinish = b.startFinish
  }

  return { lap, startFinish }
}

/**
 * Build sidebar circuits for every race that has both lap-time rows and fastest-lap telemetry.
 * Metadata/thumbs come from {@link circuitCatalog} when available; others use sensible defaults.
 */
export function discoverCircuitsFromData(
  lapRows: LapTimesRow[],
  telemetry: TelemetryPoint[],
  sectorPositions: Map<string, SectorBoundaries> | null,
): Circuit[] {
  const races = uniqueCanonicalRacesFromLaps(lapRows).filter((race) =>
    hasTelemetryForRace(telemetry, race),
  )

  const circuits: Circuit[] = []
  for (const race of races) {
    const entry = catalogEntryForRace(race)
    let thumb = thumbSectorsForCatalogEntry(entry)

    if (!thumb?.length) {
      const { lap, startFinish } = representativeLapXY(
        telemetry,
        race,
        sectorPositions,
        entry.sectorCsvTrack,
      )
      thumb = buildThumbSectorsFromTelemetry(lap, startFinish)
    }

    circuits.push(catalogEntryToCircuit(entry, thumb.length ? thumb : undefined))
  }

  return circuits.sort(compareCircuitsBy2026Calendar)
}
