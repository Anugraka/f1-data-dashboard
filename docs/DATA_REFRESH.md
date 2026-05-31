# Refreshing race data (GitHub Actions + FastF1)

The dashboard reads static CSVs from `public/data/`. The collector script mirrors **Data_Collection.ipynb** but loops over **every race** on the FastF1 calendar for each year (not only the four sidebar circuits).

**Sidebar tracks** are discovered automatically: any race that has rows in both `speed_metrics_final.csv` and `fastest_laps_telemetry.csv` gets a sidebar tab with Lap Time, Speed, and Overtake modes. **Order** follows the 2026 calendar in `src/data/raceOrder2026.ts` (must match CSV `Race` / FastF1 `EventName`). Known GPs use hand-tuned labels, thumbs, and footnotes via `src/data/circuitCatalog.ts`; new GPs get defaults (auto-generated thumb from telemetry).

## What it updates

| File | Source |
|------|--------|
| `speed_metrics_final.csv` | All race laps + per-year engine mapping (notebook) |
| `fastest_laps_telemetry.csv` | Fastest lap telemetry, DRS mapped with `drs_mapping` |
| `overtake_data.csv` | `overtake_counts_source.csv` + position-change counts from laps (optional; missing rows are logged, not fatal) |

**Not updated:** `sector_positions.csv`, `miami_2026.csv` (edit manually if needed).

## Overtake counts (manual input)

The notebook used **Overtake Data - Sheet2 (2).csv**. In this repo that role is:

`public/data/overtake_counts_source.csv`

Columns: `Race`, `Year`, `Overtakes` — `Race` may be short (`Australia`) or full (`Australian Grand Prix`). Add a row for each race/year you want on the Overtake chart. Position-change totals are computed automatically from lap data when the collector runs.

## Run on GitHub

1. Push the project to [Anugraka/f1-data-dashboard](https://github.com/Anugraka/f1-data-dashboard).
2. **Actions → Refresh F1 data (FastF1) → Run workflow**.
3. Optional **years**: e.g. `2025,2026` (faster than all seasons).
4. Commits to `main` trigger **Deploy Firebase Hosting** (needs `FIREBASE_TOKEN` secret — see below).

Schedule: **Mondays 06:00 UTC**. Scheduled runs use **`--weekly`**:

1. Detect which **2026 GP** just finished (FastF1 schedule, last 8 days UTC).
2. **Merge** into existing `speed_metrics_final.csv` / telemetry — no full re-download of every season.
3. For that circuit only, fetch **2022–2026** (skips China 2022–2023).

~5 sessions per week → stays under FastF1’s **500 API calls/hour** limit while keeping all years on disk.

**Optional calendar:** `public/data/race_weekends_2026.csv` — fill `WeekendEnd` (YYYY-MM-DD) if you want a manual fallback when schedule detection finds nothing.

**First-time / missing tracks:** run manually with **events** set to one GP at a time, e.g. `Monaco Grand Prix` (workflow input or `--events "Monaco Grand Prix"`). Repeat per circuit until the repo has full history. **Full calendar in one job** still risks rate limits.

**Manual weekly override:** Actions → **events** = `Canadian Grand Prix` (or whichever GP just ran) to force-refresh that track for all years.

**Sidebar missing a new GP?** The track needs rows in both lap and telemetry CSVs as **`Canadian Grand Prix`**. Re-run with **events** = `Canadian Grand Prix`, then deploy.

Job timeout: **3 hours**.

## One-time setup: `FIREBASE_TOKEN`

1. `npm install -g firebase-tools` then `firebase login:ci`
2. Repo **Settings → Secrets → Actions →** secret `FIREBASE_TOKEN`

## Run locally

```bash
pip install -r scripts/requirements-data.txt
# Weekly-style (matches GitHub schedule)
python scripts/collect_fastf1_data.py --weekly --years 2022,2023,2024,2025,2026 --session-delay 6
# One circuit, all years (bootstrap a new sidebar track)
python scripts/collect_fastf1_data.py --events "Monaco Grand Prix" --years 2022,2023,2024,2025,2026 --session-delay 6
# Optional: cap telemetry size for a quicker test run
python scripts/collect_fastf1_data.py --max-telemetry-points 1500
```

Cache: `.fastf1-cache/` (gitignored).

## Notebook parity

| Notebook | Script |
|----------|--------|
| Fixed `tracks` list | `fastf1.get_event_schedule(year, include_testing=False)` |
| Skip China 2022–2023 | Same |
| `engines22` … `engines26` | `ENGINES_BY_YEAR` |
| `get_telemetry()` + `drs_mapping` | Same |
| Overtake sheet merge | `overtake_counts_source.csv` |

## Troubleshooting

- **`RateLimitExceededError: any API: 500 calls/h`:** Too many sessions in one job. Use `--weekly` or `--events "One Grand Prix"` per run. Re-run after ~1 hour.
- **Failed event / year:** Session may not exist yet (future rounds). Re-run with a smaller `--years` list after the race.
- **Huge CSV / slow CI:** Use `--max-telemetry-points 1500` in the workflow command if needed.
- **Overtake chart empty for a circuit:** Add that GP to `overtake_counts_source.csv` (Race, Year, Overtakes). The dashboard shows a message instead of an error; the refresh job still succeeds.
