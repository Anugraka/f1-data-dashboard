Put data files here so the dashboard can fetch them at runtime.

To regenerate lap/telemetry CSVs from FastF1 via GitHub Actions, see [docs/DATA_REFRESH.md](../../docs/DATA_REFRESH.md).

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

