export type EngineManufacturer = 'Audi' | 'Ferrari' | 'Ford' | 'Honda' | 'Mercedes' | 'Renault'

export interface TrackSegment {
  d: string
  color: string
}

export interface TrackPoint {
  x: number
  y: number
}

export interface TeamLap {
  team: string
  engine: EngineManufacturer
  lapTime: number
}

/** One bar per year: team with the fastest *average* lap that year (from CSV). */
export interface YearBestTeamLap {
  year: string
  team: string
  engine: EngineManufacturer
  lapTime: number
}

export interface Circuit {
  id: string
  name: string
  /** First line in the track sidebar; defaults to `name` (e.g. city vs country name). */
  sidebarLabel?: string
  fullName: string
  country: string
  gpLabel: string
  /** Monochrome fallback preview path (viewBox 0 0 80 60) if `thumbSectors` is absent */
  thumbPath?: string
  /** Lap-time style sector strokes for sidebar (equal arc-length thirds; same colors as the map). */
  thumbSectors?: TrackSegment[]
  /** Race name as it appears in your FastF1-derived CSV (Race column). */
  fastF1RaceName?: string
  /**
   * Optional static SVG segments for the circuit map (legacy/stub data).
   * If `positionsUrl` is present, the UI will prefer the API-driven layout.
   */
  trackSegments?: TrackSegment[]
  /**
   * URL that returns the circuit centerline/position samples.
   * Expected JSON: an array of points or an object containing an array of points.
   */
  positionsUrl?: string
}
