# Refreshing race data (GitHub Actions + FastF1)

The dashboard reads static CSVs from `public/data/`. To update them after each race without running notebooks locally, use the **Refresh F1 data (FastF1)** workflow.

## What it updates

| File | Source |
|------|--------|
| `speed_metrics_final.csv` | FastF1 race laps (all laps for configured GPs/years) |
| `fastest_laps_telemetry.csv` | FastF1 fastest-lap car telemetry (X, Y, Speed, DRS) |
| `drs_telemetry_data_miami.csv` | Same for Miami only (Overtake map DRS coloring) |

**Not updated by the workflow:** `overtake_data.csv`, `sector_positions.csv`, `miami_2026.csv` — edit these manually or extend `scripts/collect_fastf1_data.py`.

## Run on GitHub (no Git installed on your laptop)

1. Push this repo to [Anugraka/f1-data-dashboard](https://github.com/Anugraka/f1-data-dashboard) (full project, not only a notebook).
2. Open **Actions** → **Refresh F1 data (FastF1)** → **Run workflow**.
3. Optional: set **years** to e.g. `2026` to refresh only the latest season (faster).
4. When the job succeeds, it commits CSV changes to `main`.
5. Deploy the site: `npm run deploy` (or add a second workflow that deploys on push to `main`).

Scheduled runs: **every Monday 06:00 UTC** (tweak cron in `.github/workflows/refresh-f1-data.yml` if needed).

## Run locally

```bash
pip install -r scripts/requirements-data.txt
python scripts/collect_fastf1_data.py
# or: python scripts/collect_fastf1_data.py --years 2025,2026
```

First run downloads a lot from F1 timing servers; cache lives in `.fastf1-cache/` (gitignored).

## After data changes

```bash
npm run build
npm run deploy
```

Firebase Hosting serves files from `public/` in the build output, so new CSVs must be built and deployed.

## Troubleshooting

- **Workflow fails on a GP/year:** That session may not exist in FastF1 yet (e.g. future 2026 round). Use **years** input to limit scope, or adjust `RACE_CONFIG` in `scripts/collect_fastf1_data.py`.
- **Job succeeds but site unchanged:** You still need a **deploy** step; committing CSVs only updates the Git repo.
- **Align with your notebook:** If `Data_Collection.ipynb` uses different logic, port that logic into `collect_fastf1_data.py` and keep one script as the source of truth.
