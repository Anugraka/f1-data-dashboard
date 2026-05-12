import { useEffect, useMemo, useState } from 'react'
import { circuits } from './data/circuits'
import { CircuitMapCard, MODE_OPTIONS } from './components/CircuitMapCard'
import { OvertakeDynamicsChart } from './components/OvertakeDynamicsChart'
import { LapTimesChart } from './components/LapTimesChart'
import { HomePage } from './components/HomePage'
import { MainHeader } from './components/MainHeader'
import { Sidebar } from './components/Sidebar'
import { TopSpeedLineChart } from './components/TopSpeedLineChart'
import {
  averageLapTimesByTeam,
  countRowsForRaceYear,
  fastestTeamAverageByYear,
  loadMergedLapTimesForDashboard,
  yearsForRaceUi,
  type SectorKey,
} from './data/laptimes'
import {
  CIRCUIT_ID_TO_SECTOR_CSV_TRACK,
  loadSectorPositionsCsv,
  type SectorBoundaries,
} from './data/sectorPositions'
import {
  loadDrsTelemetryMiamiCsv,
  loadFastestLapsTelemetryCsv,
  speedChartYearsForCircuit,
  speedBoxPlotSeriesForTrack,
  type SpeedSectorScope,
  type TelemetryPoint,
} from './data/telemetry'
import { loadOvertakeDataCsv, overtakesForRace } from './data/overtakes'

const SECTOR_LABELS = ['Full Lap', 'Sector 1', 'Sector 2', 'Sector 3'] as const

/** Shown under lap / speed / overtake chart titles when Shanghai is selected. */
const SHANGHAI_GP_CANCEL_NOTE =
  'Note: The Chinese Grand Prix was cancelled in 2022 and 2023 due to ongoing COVID-19 restrictions.'

type UiSector = (typeof SECTOR_LABELS)[number]
type UiMode = (typeof MODE_OPTIONS)[number]

function sectorToKey(sector: UiSector): SectorKey {
  if (sector === 'Sector 1') return 'Sector1Time'
  if (sector === 'Sector 2') return 'Sector2Time'
  if (sector === 'Sector 3') return 'Sector3Time'
  return 'LapTime'
}

function App() {
  const [showHome, setShowHome] = useState(true)
  const [selectedId, setSelectedId] = useState('australia')
  const [mode, setMode] = useState<UiMode>('Lap Time')
  const [sector, setSector] = useState<UiSector>('Full Lap')
  /** `'all'` = Fastest Average Lap per Year; otherwise a season from the CSV. */
  const [lapChartYear, setLapChartYear] = useState<'all' | string>('all')
  const [lapRows, setLapRows] = useState<Awaited<ReturnType<typeof loadMergedLapTimesForDashboard>>>([])
  const [lapRowsError, setLapRowsError] = useState<string | null>(null)
  const [telemetryRows, setTelemetryRows] = useState<TelemetryPoint[] | null>(null)
  const [telemetryError, setTelemetryError] = useState<string | null>(null)
  const [miamiDrsRows, setMiamiDrsRows] = useState<TelemetryPoint[] | null>(null)
  const [miamiDrsError, setMiamiDrsError] = useState<string | null>(null)
  const [overtakeRows, setOvertakeRows] = useState<Awaited<ReturnType<typeof loadOvertakeDataCsv>> | null>(null)
  const [overtakeError, setOvertakeError] = useState<string | null>(null)
  const [sectorPositionsMap, setSectorPositionsMap] = useState<Map<string, SectorBoundaries> | null>(null)
  const circuit = useMemo(
    () => circuits.find((c) => c.id === selectedId) ?? circuits[0],
    [selectedId],
  )

  const raceName = circuit.fastF1RaceName ?? ''

  const yearOptions = useMemo(
    () => (raceName ? yearsForRaceUi(lapRows, raceName, circuit.id) : []),
    [lapRows, raceName, circuit.id],
  )

  useEffect(() => {
    setLapChartYear('all')
  }, [selectedId])

  useEffect(() => {
    if (lapChartYear === 'all') return
    if (yearOptions.length > 0 && !yearOptions.includes(lapChartYear)) {
      setLapChartYear('all')
    }
  }, [lapChartYear, yearOptions])

  const resolvedLapYear = lapChartYear === 'all' ? 'all' : lapChartYear

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLapRowsError(null)
        const rows = await loadMergedLapTimesForDashboard()
        if (!cancelled) setLapRows(rows)
      } catch (e) {
        if (!cancelled) setLapRowsError(e instanceof Error ? e.message : 'Failed to load lap time CSV.')
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setOvertakeError(null)
        setOvertakeRows(null)
        const rows = await loadOvertakeDataCsv('/data/overtake_data.csv')
        if (!cancelled) setOvertakeRows(rows)
      } catch (e) {
        if (!cancelled) {
          setOvertakeError(e instanceof Error ? e.message : 'Failed to load overtakes CSV.')
          setOvertakeRows([])
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setTelemetryError(null)
        setTelemetryRows(null)
        const rows = await loadFastestLapsTelemetryCsv('/data/fastest_laps_telemetry.csv')
        if (!cancelled) setTelemetryRows(rows)
      } catch (e) {
        if (!cancelled) {
          setTelemetryError(e instanceof Error ? e.message : 'Failed to load telemetry CSV.')
          setTelemetryRows([])
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setMiamiDrsError(null)
        setMiamiDrsRows(null)
        const rows = await loadDrsTelemetryMiamiCsv('/data/drs_telemetry_data_miami.csv')
        if (!cancelled) setMiamiDrsRows(rows)
      } catch (e) {
        if (!cancelled) {
          setMiamiDrsError(e instanceof Error ? e.message : 'Failed to load Miami DRS telemetry CSV.')
          setMiamiDrsRows([])
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const m = await loadSectorPositionsCsv('/data/sector_positions.csv')
        if (!cancelled) setSectorPositionsMap(m)
      } catch {
        if (!cancelled) setSectorPositionsMap(new Map())
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const teamData = useMemo(() => {
    if (!raceName || resolvedLapYear === 'all' || !resolvedLapYear) return []
    return averageLapTimesByTeam(lapRows, {
      race: raceName,
      year: resolvedLapYear,
      sector: sectorToKey(sector),
    })
  }, [raceName, lapRows, sector, resolvedLapYear])

  const allYearsData = useMemo(() => {
    if (!raceName || resolvedLapYear !== 'all') return []
    return fastestTeamAverageByYear(lapRows, {
      race: raceName,
      sector: sectorToKey(sector),
      years: yearOptions,
    })
  }, [raceName, lapRows, sector, resolvedLapYear, yearOptions])

  const speedChartYears = useMemo(() => speedChartYearsForCircuit(circuit.id), [circuit.id])

  const sectorStartFinish = useMemo(() => {
    const csvTrack = CIRCUIT_ID_TO_SECTOR_CSV_TRACK[circuit.id]
    if (!csvTrack || !sectorPositionsMap) return null
    return sectorPositionsMap.get(csvTrack)?.startFinish ?? null
  }, [circuit.id, sectorPositionsMap])

  /** One peak speed per chart year; sector matches the map (full lap or S1–S3). */
  const speedSeries = useMemo(() => {
    const track = circuit.fastF1RaceName
    if (!track || !telemetryRows) return []
    return speedBoxPlotSeriesForTrack(
      telemetryRows,
      track,
      sector as SpeedSectorScope,
      speedChartYears,
      sectorStartFinish,
    )
  }, [circuit.fastF1RaceName, telemetryRows, speedChartYears, sector, sectorStartFinish])

  const speedChartTitle = useMemo(() => {
    const raw = circuit.fastF1RaceName?.trim()
    const gpPart = raw
      ? /Grand Prix$/i.test(raw)
        ? raw
        : `${raw} Grand Prix`
      : `${circuit.name} Grand Prix`
    return `Speed Distribution of Fastest Lap per Year - ${gpPart}`
  }, [circuit.fastF1RaceName, circuit.name])

  const overtakesForCircuit = useMemo(() => {
    if (!raceName || overtakeRows === null) return []
    return overtakesForRace(overtakeRows, raceName)
  }, [overtakeRows, raceName])

  const telemetryLoading = telemetryRows === null && !telemetryError
  const overtakeLoading = overtakeRows === null && !overtakeError

  const debugInfo = useMemo(() => {
    if (!raceName) return null
    if (resolvedLapYear === 'all') {
      const n = lapRows.filter(
        (r) =>
          (r.Race ?? '').trim() === raceName && (r.Deleted ?? '').trim().toLowerCase() !== 'true',
      ).length
      return { race: raceName, year: 'all' as const, n }
    }
    const y = resolvedLapYear
    const n = y ? countRowsForRaceYear(lapRows, raceName, y) : 0
    return { race: raceName, year: y, n }
  }, [raceName, lapRows, resolvedLapYear])

  const lapChartTitle = useMemo(() => {
    const raceTitle = raceName || circuit.gpLabel
    if (resolvedLapYear === 'all') {
      const raceStem = raceName
        ? raceName.replace(/\s+Grand Prix$/i, '').trim()
        : circuit.gpLabel.replace(/^\d{4}\s+/i, '').replace(/\s+GP$/i, '').trim() || circuit.name
      if (sector === 'Full Lap') {
        return `Fastest Average Lap per Year - ${raceStem} Grand Prix`
      }
      return `Fastest Average ${sector} per Year - ${raceStem} Grand Prix`
    }
    return `Average ${sector} Times by Team - ${resolvedLapYear ?? '…'} ${raceTitle}`
  }, [circuit.gpLabel, circuit.name, raceName, resolvedLapYear, sector])

  const overtakeChartTitle = useMemo(() => {
    const raceStem = raceName
      ? raceName.replace(/\s+Grand Prix$/i, '').trim()
      : circuit.gpLabel.replace(/^\d{4}\s+/i, '').replace(/\s+GP$/i, '').trim() || circuit.name
    return `Overtaking Dynamics per Year - ${raceStem} Grand Prix`
  }, [circuit.gpLabel, circuit.name, raceName])

  const lapChartEmpty =
    resolvedLapYear === 'all' ? allYearsData.length === 0 : teamData.length === 0

  const lapChartYDomain = useMemo((): [number, number] => {
    return sector === 'Full Lap' ? [75, 115] : [15, 45]
  }, [sector])

  const lapChartFootnote = useMemo(() => {
    if (circuit.id === 'australia') {
      if (resolvedLapYear === 'all' || resolvedLapYear === '2025') {
        return 'Note: The 2025 Australian Grand Prix was held in heavy rain conditions, which may have influenced the lap times recorded during that race.'
      }
      return undefined
    }
    if (circuit.id === 'shanghai') {
      return SHANGHAI_GP_CANCEL_NOTE
    }
    return undefined
  }, [circuit.id, resolvedLapYear])

  const shanghaiFootnoteForModes = circuit.id === 'shanghai' ? SHANGHAI_GP_CANCEL_NOTE : undefined

  return (
    <div className="flex min-h-screen bg-zinc-100/80">
      <Sidebar
        circuits={circuits}
        selectedId={selectedId}
        isHome={showHome}
        onHome={() => setShowHome(true)}
        onSelectCircuit={(id) => {
          setSelectedId(id)
          setShowHome(false)
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <MainHeader
          title="Formula One Track Data Analysis"
          subtitle={
            showHome
              ? 'Choose a circuit in the sidebar to view the laptime, speed, and overtake data.'
              : `${circuit.fullName} · ${circuit.country}`
          }
        />
        <main className="flex flex-1 flex-col gap-6 p-6">
          {showHome ? (
            <HomePage />
          ) : (
            <>
              <CircuitMapCard
                circuit={circuit}
                mode={mode}
                sector={sector}
                onModeChange={setMode}
                onSectorChange={setSector}
                telemetry={telemetryRows}
                telemetryError={telemetryError}
                miamiDrsTelemetry={miamiDrsRows}
                miamiDrsTelemetryError={miamiDrsError}
                sectorPositionsMap={sectorPositionsMap}
              />
              {mode === 'Speed' ? (
                <TopSpeedLineChart
                  title={speedChartTitle}
                  data={speedSeries}
                  years={speedChartYears}
                  loading={telemetryLoading}
                  error={telemetryError}
                  footnote={shanghaiFootnoteForModes}
                />
              ) : mode === 'Overtake' ? (
                <OvertakeDynamicsChart
                  title={overtakeChartTitle}
                  data={overtakesForCircuit}
                  loading={overtakeLoading}
                  error={overtakeError}
                  footnote={shanghaiFootnoteForModes}
                />
              ) : lapRowsError ? (
                <section className="rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600 shadow-sm">
                  Couldn’t load lap time data. Put your CSV at{' '}
                  <code className="font-mono">public/data/speed_metrics_final.csv</code>. (
                  {lapRowsError})
                </section>
              ) : (
                <section className="flex flex-col gap-3">
                  <label className="flex items-center gap-2 text-sm text-zinc-700" htmlFor="lap-chart-year">
                    <span className="font-medium text-zinc-600">Lap data year</span>
                    <select
                      id="lap-chart-year"
                      className="h-9 min-w-[220px] rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-800 outline-none ring-indigo-500/20 focus:ring-2"
                      value={lapChartYear}
                      onChange={(e) => {
                        const v = e.target.value
                        setLapChartYear(v === 'all' ? 'all' : v)
                      }}
                    >
                      <option value="all">Fastest Average Lap per Year</option>
                      {yearOptions.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </label>
                  {lapChartEmpty && debugInfo ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      No chart rows matched. Looking for Race="<span className="font-mono">{debugInfo.race}</span>"
                      {debugInfo.year ? (
                        <>
                          {' '}
                          Year="<span className="font-mono">{String(debugInfo.year)}</span>"
                        </>
                      ) : null}
                      . Matched laps: <span className="font-mono">{debugInfo.n}</span>. Sector key:{' '}
                      <span className="font-mono">{sectorToKey(sector)}</span>.
                    </div>
                  ) : null}
                  {resolvedLapYear === 'all' ? (
                    <LapTimesChart
                      variant="allYears"
                      title={lapChartTitle}
                      data={allYearsData}
                      yDomain={lapChartYDomain}
                      footnote={lapChartFootnote}
                    />
                  ) : (
                    <LapTimesChart
                      variant="singleYear"
                      title={lapChartTitle}
                      data={teamData}
                      yDomain={lapChartYDomain}
                      footnote={lapChartFootnote}
                    />
                  )}
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
