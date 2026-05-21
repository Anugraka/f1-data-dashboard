Put data files here so the dashboard can fetch them at runtime.

To regenerate CSVs from FastF1 (notebook logic, full calendar), see [docs/DATA_REFRESH.md](../../docs/DATA_REFRESH.md).

**Overtake chart:** edit `overtake_counts_source.csv` (manual overtake totals); the collector merges it with position changes from lap data into `overtake_data.csv`.

## Lap times CSV

Save your FastF1-exported lap times CSV as:

- `public/data/speed_metrics_final.csv`

Expected columns (case sensitive):

- `Driver`
- `Team`
- `LapTime`
- `Sector1Time`
- `Sector2Time`
- `Sector3Time`
- `Race`
- `Year`

Optional columns (ignored if present):

- `SpeedST`
- `Deleted`

The app will automatically pick the latest `Year` available for the selected `Race`.

