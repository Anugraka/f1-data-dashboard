import type { Circuit, EngineManufacturer, TeamLap } from '../types'

/** Lap chart bar / legend colors (color-blind friendly palette). */
export const ENGINE_COLORS: Record<EngineManufacturer, string> = {
  Mercedes: '#00D2BE',
  Ferrari: '#FF2800',
  Ford: '#0082C8',
  Honda: '#F4A460',
  Audi: '#808080',
  Renault: '#8783D1',
}

const spaTeams: TeamLap[] = [
  { team: 'Mercedes', engine: 'Mercedes', lapTime: 76.2 },
  { team: 'Ferrari', engine: 'Ferrari', lapTime: 76.8 },
  { team: 'Red Bull Racing', engine: 'Honda', lapTime: 77.1 },
  { team: 'McLaren', engine: 'Mercedes', lapTime: 77.5 },
  { team: 'Audi', engine: 'Audi', lapTime: 78.0 },
  { team: 'Haas F1 Team', engine: 'Ferrari', lapTime: 78.6 },
  { team: 'Racing Bulls', engine: 'Honda', lapTime: 79.1 },
  { team: 'Alpine', engine: 'Mercedes', lapTime: 79.8 },
  { team: 'Williams', engine: 'Mercedes', lapTime: 80.4 },
  { team: 'Cadillac', engine: 'Ford', lapTime: 81.2 },
  { team: 'Aston Martin', engine: 'Mercedes', lapTime: 82.0 },
]

/**
 * Sidebar thumbs: lap-time sector colors & equal arc-length thirds (start/finish from `sector_positions.csv`).
 * Regenerate: `node scripts/generate-thumb-sector-paths.mjs`
 */
export const circuits: Circuit[] = [
  {
    id: 'australia',
    name: 'Australia',
    sidebarLabel: 'Melbourne',
    fullName: 'Albert Park Grand Prix Circuit',
    country: 'Australia',
    gpLabel: '2026 Australian GP',
    thumbSectors: [
      {
        d: 'M 36.50 16.69 L 35.45 17.85 L 33.80 19.66 L 32.27 21.33 L 31.24 22.45 L 30.47 23.43 L 30.14 24.53 L 30.33 25.65 L 30.42 27.15 L 29.83 28.86 L 28.72 30.15 L 27.52 31.39 L 26.53 32.50 L 25.10 34.28 L 23.91 35.95 L 22.74 37.82 L 21.93 39.20 L 21.28 40.39 L 21.01 41.24 L 21.20 42.14 L 21.79 42.46 L 22.61 42.57 L 23.68 42.80 L 24.28 43.32 L 24.61 44.22 L 24.54 45.49 L 24.32 47.11 L 24.36 49.07 L 25.23 50.75 L 26.23 51.66 L 27.60 52.68 L 29.44 53.67 L 31.70 54.84',
        color: '#E10600',
      },
      {
        d: 'M 31.70 54.84 L 32.91 55.66 L 34.19 55.85 L 36.03 54.74 L 37.75 54.25 L 39.38 53.61 L 41.05 51.97 L 41.92 50.11 L 42.45 47.81 L 42.62 45.10 L 42.35 42.48 L 41.72 40.37 L 40.54 36.85 L 40.30 34.29 L 40.64 31.53 L 41.37 29.34 L 42.31 27.48 L 43.67 25.76 L 45.30 24.14 L 46.65 23.13 L 47.78 23.04 L 48.80 23.19 L 50.22 23.08 L 51.51 22.02',
        color: '#00A3E0',
      },
      {
        d: 'M 51.51 22.02 L 52.87 20.70 L 53.80 19.80 L 55.11 18.39 L 56.37 16.26 L 57.04 14.43 L 57.65 12.36 L 58.12 10.67 L 58.64 8.79 L 58.96 7.01 L 58.99 6.30 L 58.43 5.58 L 57.72 5.33 L 56.29 4.90 L 55.24 4.61 L 53.78 4.15 L 52.47 4.16 L 51.45 5.12 L 50.76 6.43 L 50.12 7.98 L 49.56 9.14 L 49.09 9.72 L 48.49 9.74 L 48.10 9.40 L 47.65 8.62 L 47.15 7.92 L 46.15 7.35 L 45.04 7.53 L 44.06 8.25 L 43.14 9.26 L 41.93 10.63 L 40.42 12.33 L 39.16 13.76 L 37.62 15.47 L 36.71 16.46',
        color: '#FFD200',
      },
    ],
    positionsUrl: (import.meta as any).env?.VITE_TRACK_POSITIONS_BASE_URL
      ? `${(import.meta as any).env.VITE_TRACK_POSITIONS_BASE_URL.replace(/\/$/, '')}/australia`
      : undefined,
    fastF1RaceName: 'Australian Grand Prix',
  },
  {
    id: 'shanghai',
    name: 'Shanghai',
    fullName: 'Shanghai International Circuit',
    country: 'China',
    gpLabel: '2026 Chinese GP',
    thumbSectors: [
      {
        d: 'M 44.85 14.63 L 41.54 13.80 L 38.60 13.05 L 35.05 12.16 L 31.41 11.25 L 26.80 10.08 L 23.26 9.26 L 20.44 10.47 L 19.31 12.66 L 19.30 14.50 L 20.60 16.58 L 21.73 16.85 L 23.12 16.07 L 23.29 15.03 L 22.78 13.56 L 22.91 12.46 L 23.47 11.84 L 25.28 12.62 L 25.94 15.97 L 24.54 18.40 L 23.22 20.19 L 21.24 22.86 L 19.28 25.53 L 17.45 28.68 L 16.31 32.67 L 15.47 35.60 L 14.96 37.37 L 14.84 38.50 L 15.37 39.02 L 16.35 38.63 L 18.53 36.44 L 20.26 33.32',
        color: '#E10600',
      },
      {
        d: 'M 20.26 33.32 L 21.69 30.37 L 23.22 27.25 L 25.54 24.91 L 28.08 24.43 L 30.87 25.73 L 32.85 29.14 L 34.04 31.78 L 36.09 33.28 L 38.02 33.10 L 39.67 31.57 L 40.69 29.14 L 41.75 27.34 L 43.27 27.88 L 44.25 29.26 L 45.09 31.16 L 43.63 34.25 L 41.46 38.52 L 40.13 41.15 L 38.48 44.40 L 36.84 47.61 L 36.09 49.06 L 35.45 50.26 L 34.57 50.17 L 33.77 49.12 L 32.14 48.40 L 30.93 49.72 L 30.36 52.02 L 30.65 53.60 L 32.28 55.47 L 34.76 55.85 L 37.06 54.79 L 38.89 52.24',
        color: '#00A3E0',
      },
      {
        d: 'M 38.89 52.24 L 40.71 48.95 L 42.89 45.00 L 45.16 40.91 L 46.82 37.92 L 49.06 33.86 L 50.68 30.95 L 53.32 26.17 L 55.26 22.68 L 57.15 19.27 L 59.71 14.64 L 61.72 11.02 L 63.09 8.55 L 64.82 5.41 L 65.16 4.74 L 64.70 4.15 L 64.02 4.46 L 63.04 5.17 L 60.96 7.64 L 59.42 10.14 L 58.02 12.43 L 56.51 14.93 L 55.61 16.43 L 54.14 17.02 L 51.42 16.28 L 49.20 15.73 L 46.03 14.93 L 44.96 14.66',
        color: '#FFD200',
      },
    ],
    fastF1RaceName: 'Chinese Grand Prix',
    positionsUrl: (import.meta as any).env?.VITE_TRACK_POSITIONS_BASE_URL
      ? `${(import.meta as any).env.VITE_TRACK_POSITIONS_BASE_URL.replace(/\/$/, '')}/shanghai`
      : undefined,
  },
  {
    id: 'japan',
    name: 'Japan',
    sidebarLabel: 'Suzuka',
    fullName: 'Suzuka International Racing Course',
    country: 'Japan',
    gpLabel: '2026 Japanese GP',
    thumbSectors: [
      {
        d: 'M 60.62 35.57 L 62.70 32.77 L 65.02 29.64 L 67.03 26.93 L 69.54 23.51 L 71.64 20.68 L 74.14 17.29 L 75.76 14.99 L 76.40 12.34 L 75.78 9.73 L 74.31 8.50 L 72.77 8.64 L 71.60 9.79 L 69.77 13.35 L 68.22 15.49 L 65.96 16.39 L 64.03 16.93 L 62.80 18.77 L 62.04 21.70 L 60.68 23.27 L 59.06 23.74 L 56.90 24.06 L 55.32 25.30 L 54.58 27.04 L 55.12 29.49 L 55.66 33.18 L 53.99 35.11 L 51.64 36.21 L 48.92 36.53',
        color: '#E10600',
      },
      {
        d: 'M 48.92 36.53 L 45.92 35.60 L 43.58 33.61 L 40.93 29.64 L 38.55 27.79 L 36.20 27.35 L 34.59 27.36 L 33.51 28.29 L 33.19 29.81 L 32.88 31.81 L 32.43 34.19 L 31.97 36.66 L 31.60 38.89 L 31.62 41.67 L 32.39 43.82 L 32.82 45.12 L 31.98 46.44 L 31.31 46.06 L 30.73 44.98 L 29.88 43.22 L 28.72 41.18 L 26.48 38.63 L 24.35 37.82 L 21.61 37.73 L 19.15 38.33 L 16.56 39.47 L 14.13 41.32 L 11.98 44.67 L 10.98 47.41 L 10.01 49.73 L 7.97 51.50 L 6.09 51.43',
        color: '#00A3E0',
      },
      {
        d: 'M 6.09 51.43 L 4.14 50.36 L 3.60 48.54 L 4.06 46.84 L 5.30 45.18 L 7.07 43.61 L 9.26 41.90 L 12.34 39.86 L 15.19 38.28 L 18.26 36.97 L 21.55 35.68 L 24.90 34.38 L 28.45 33.01 L 31.26 31.92 L 34.67 30.76 L 37.42 31.67 L 39.91 33.35 L 42.47 35.94 L 44.15 37.85 L 45.85 39.76 L 47.10 40.48 L 48.12 40.14 L 48.98 39.60 L 49.97 39.94 L 51.05 41.04 L 53.05 41.59 L 55.06 41.12 L 57.44 39.60 L 59.27 37.40 L 60.37 35.91',
        color: '#FFD200',
      },
    ],
    fastF1RaceName: 'Japanese Grand Prix',
    positionsUrl: (import.meta as any).env?.VITE_TRACK_POSITIONS_BASE_URL
      ? `${(import.meta as any).env.VITE_TRACK_POSITIONS_BASE_URL.replace(/\/$/, '')}/japan`
      : undefined,
  },
  {
    id: 'miami',
    name: 'Miami',
    fullName: 'Miami International Autodrome',
    country: 'United States',
    gpLabel: '2026 Miami GP',
    thumbSectors: [
      {
        d: 'M 34.02 41.10 L 37.48 38.58 L 41.13 35.98 L 45.05 33.46 L 47.86 31.75 L 49.33 30.14 L 49.07 28.54 L 48.34 27.62 L 46.97 25.82 L 46.49 22.69 L 45.39 19.22 L 42.89 17.25 L 40.31 16.46 L 37.27 16.58 L 34.53 17.75 L 31.31 20.04 L 28.88 21.84 L 25.93 23.87 L 22.53 25.33 L 19.54 24.72 L 16.52 23.09 L 13.68 23.80 L 11.26 25.96 L 8.02 26.66 L 5.61 25.55 L 3.84 23.30 L 3.60 20.58 L 4.42 19.08 L 6.30 18.57 L 8.05 18.53 L 10.99 18.14',
        color: '#E10600',
      },
      {
        d: 'M 10.99 18.14 L 14.13 17.42 L 17.85 17.18 L 21.86 17.38 L 25.72 17.44 L 29.92 17.27 L 34.10 15.76 L 40.03 13.84 L 45.11 13.54 L 50.24 14.42 L 53.63 15.65 L 57.89 17.31 L 61.79 19.01 L 65.38 20.89 L 68.70 22.80 L 71.40 24.88 L 72.09 26.75 L 71.33 27.89 L 69.95 29.32 L 69.40 30.88 L 69.64 32.12 L 70.66 33.34 L 72.13 33.66 L 74.16 33.89 L 75.79 35.43 L 76.32 36.66 L 76.10 38.06 L 75.55 39.09 L 76.01 41.11 L 76.40 42.45 L 75.82 43.55 L 75.11 43.90 L 73.80 44.14',
        color: '#00A3E0',
      },
      {
        d: 'M 73.80 44.14 L 70.91 44.24 L 68.22 44.34 L 64.85 44.45 L 61.75 44.53 L 57.02 44.65 L 52.73 44.78 L 48.19 44.96 L 44.13 45.13 L 37.53 45.39 L 31.66 45.57 L 26.53 45.69 L 22.10 45.79 L 18.16 46.11 L 14.89 46.46 L 13.02 46.29 L 12.19 45.33 L 12.50 44.13 L 13.51 43.14 L 15.01 42.12 L 17.16 40.98 L 20.18 41.72 L 23.52 43.47 L 27.92 43.95 L 32.39 42.21 L 33.87 41.21',
        color: '#FFD200',
      },
    ],
    fastF1RaceName: 'Miami Grand Prix',
    positionsUrl: (import.meta as any).env?.VITE_TRACK_POSITIONS_BASE_URL
      ? `${(import.meta as any).env.VITE_TRACK_POSITIONS_BASE_URL.replace(/\/$/, '')}/miami`
      : undefined,
  },
]

export function teamsForCircuit(id: string): TeamLap[] {
  if (id === 'spa') return [...spaTeams].sort((a, b) => a.lapTime - b.lapTime)
  const jitter = id === 'monaco' ? 0.4 : id === 'monza' ? -0.2 : 0.1
  return spaTeams.map((t) => ({
    ...t,
    lapTime: Math.round((t.lapTime + jitter + (t.team.length % 7) * 0.05) * 10) / 10,
  })).sort((a, b) => a.lapTime - b.lapTime)
}
