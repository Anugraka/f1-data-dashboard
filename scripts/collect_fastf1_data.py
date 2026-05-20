#!/usr/bin/env python3
"""
Fetch lap times and fastest-lap telemetry via FastF1 and write CSVs for the dashboard.

Outputs (under --out-dir, default public/data):
  - speed_metrics_final.csv
  - fastest_laps_telemetry.csv
  - drs_telemetry_data_miami.csv  (Miami fastest laps; richer DRS for Overtake map)

Does not update overtake_data.csv (aggregate stats are maintained separately).

Usage:
  python scripts/collect_fastf1_data.py
  python scripts/collect_fastf1_data.py --years 2024,2025
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import fastf1
import pandas as pd

# FastF1 session location keys (not always identical to CSV Race column).
RACE_CONFIG: list[dict] = [
    {
        "race": "Australian Grand Prix",
        "location": "Australia",
        "years": [2022, 2023, 2024, 2025, 2026],
    },
    {
        "race": "Chinese Grand Prix",
        "location": "China",
        "years": [2024, 2025, 2026],
    },
    {
        "race": "Japanese Grand Prix",
        "location": "Japan",
        "years": [2022, 2023, 2024, 2025, 2026],
    },
    {
        "race": "Miami Grand Prix",
        "location": "Miami",
        "years": [2022, 2023, 2024, 2025, 2026],
    },
]

LAP_COLUMNS = [
    "Driver",
    "Team",
    "LapNumber",
    "LapTime",
    "Sector1Time",
    "Sector2Time",
    "Sector3Time",
    "SpeedST",
    "Position",
    "Deleted",
    "Race",
    "Year",
    "Engine",
]

MIAMI_GP = "Miami Grand Prix"


def parse_years(raw: str | None) -> list[int]:
    if not raw:
        return sorted({y for cfg in RACE_CONFIG for y in cfg["years"]})
    return sorted({int(y.strip()) for y in raw.split(",") if y.strip()})


def load_race_session(year: int, location: str):
    session = fastf1.get_session(year, location, "R")
    session.load(laps=True, telemetry=True, weather=False, messages=False)
    return session


def laps_to_export_rows(session, race_name: str, year: int) -> pd.DataFrame:
    laps = session.laps.copy()
    if laps is None or laps.empty:
        return pd.DataFrame(columns=LAP_COLUMNS)

    out = pd.DataFrame()
    out["Driver"] = laps["Driver"]
    out["Team"] = laps["Team"]
    out["LapNumber"] = laps["LapNumber"]
    out["LapTime"] = laps["LapTime"]
    out["Sector1Time"] = laps.get("Sector1Time", pd.Series([pd.NaT] * len(laps)))
    out["Sector2Time"] = laps.get("Sector2Time", pd.Series([pd.NaT] * len(laps)))
    out["Sector3Time"] = laps.get("Sector3Time", pd.Series([pd.NaT] * len(laps)))
    out["SpeedST"] = laps.get("SpeedST", pd.Series([pd.NA] * len(laps)))
    out["Position"] = laps.get("Position", pd.Series([pd.NA] * len(laps)))
    if "Deleted" in laps.columns:
        out["Deleted"] = laps["Deleted"].astype(bool)
    elif "IsAccurate" in laps.columns:
        out["Deleted"] = ~laps["IsAccurate"].astype(bool)
    else:
        out["Deleted"] = False
    out["Race"] = race_name
    out["Year"] = str(year)
    out["Engine"] = ""
    return out[LAP_COLUMNS]


def downsample_telemetry(car_data: pd.DataFrame, max_points: int) -> pd.DataFrame:
    if len(car_data) <= max_points:
        return car_data
    step = max(1, len(car_data) // max_points)
    return car_data.iloc[::step].copy()


def car_data_to_telemetry_rows(
    car_data: pd.DataFrame,
    track: str,
    year: int,
    driver: str,
    max_points: int,
) -> list[dict]:
    df = downsample_telemetry(car_data, max_points)
    rows: list[dict] = []
    for _, row in df.iterrows():
        x = row.get("X")
        y = row.get("Y")
        speed = row.get("Speed")
        if pd.isna(x) or pd.isna(y) or pd.isna(speed):
            continue
        drs = row.get("DRS", "")
        if pd.isna(drs):
            drs_str = ""
        elif isinstance(drs, (int, float)):
            drs_str = str(int(drs))
        else:
            drs_str = str(drs)
        rows.append(
            {
                "Track": track,
                "Year": str(year),
                "Driver": driver,
                "X": float(x),
                "Y": float(y),
                "Speed": float(speed),
                "DRS": drs_str,
            }
        )
    return rows


def fastest_lap_telemetry(session, race_name: str, year: int, max_points: int) -> list[dict]:
    laps = session.laps
    if laps is None or laps.empty:
        return []
    try:
        fastest = laps.pick_fastest()
    except Exception:
        return []
    if fastest is None or (hasattr(fastest, "empty") and fastest.empty):
        return []

    driver = str(fastest.get("Driver", "") or "")
    try:
        car_data = fastest.get_car_data().add_distance()
    except Exception as exc:
        print(f"  telemetry skip {race_name} {year}: {exc}", file=sys.stderr)
        return []

    return car_data_to_telemetry_rows(car_data, race_name, year, driver, max_points)


def collect(
    out_dir: Path,
    years: list[int],
    cache_dir: Path,
    max_telemetry_points: int,
) -> int:
    cache_dir.mkdir(parents=True, exist_ok=True)
    fastf1.Cache.enable_cache(str(cache_dir))

    lap_frames: list[pd.DataFrame] = []
    telemetry_rows: list[dict] = []
    miami_telemetry_rows: list[dict] = []
    errors = 0

    for cfg in RACE_CONFIG:
        race_name = cfg["race"]
        location = cfg["location"]
        for year in years:
            if year not in cfg["years"]:
                continue
            label = f"{race_name} ({year})"
            try:
                print(f"Loading {label} …")
                session = load_race_session(year, location)
            except Exception as exc:
                print(f"  FAILED {label}: {exc}", file=sys.stderr)
                errors += 1
                continue

            lap_df = laps_to_export_rows(session, race_name, year)
            if not lap_df.empty:
                lap_frames.append(lap_df)
                print(f"  laps: {len(lap_df)}")

            tel = fastest_lap_telemetry(session, race_name, year, max_telemetry_points)
            if tel:
                telemetry_rows.extend(tel)
                print(f"  telemetry points: {len(tel)}")
                if race_name == MIAMI_GP:
                    miami_telemetry_rows.extend(tel)

    out_dir.mkdir(parents=True, exist_ok=True)

    if lap_frames:
        laps_all = pd.concat(lap_frames, ignore_index=True)
        laps_path = out_dir / "speed_metrics_final.csv"
        laps_all.to_csv(laps_path, index=False)
        print(f"Wrote {laps_path} ({len(laps_all)} rows)")
    else:
        print("No lap rows collected; speed_metrics_final.csv not written.", file=sys.stderr)
        errors += 1

    if telemetry_rows:
        tel_df = pd.DataFrame(telemetry_rows)
        tel_path = out_dir / "fastest_laps_telemetry.csv"
        tel_df.to_csv(tel_path, index=False)
        print(f"Wrote {tel_path} ({len(tel_df)} rows)")
    else:
        print("No telemetry rows collected.", file=sys.stderr)
        errors += 1

    if miami_telemetry_rows:
        miami_df = pd.DataFrame(miami_telemetry_rows)
        miami_path = out_dir / "drs_telemetry_data_miami.csv"
        miami_df.to_csv(miami_path, index=False)
        print(f"Wrote {miami_path} ({len(miami_df)} rows)")

    return 0 if errors == 0 else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect FastF1 CSVs for the F1 dashboard.")
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=Path("public/data"),
        help="Directory for output CSV files",
    )
    parser.add_argument(
        "--cache-dir",
        type=Path,
        default=Path(".fastf1-cache"),
        help="FastF1 HTTP cache directory",
    )
    parser.add_argument(
        "--years",
        type=str,
        default=None,
        help="Comma-separated years (default: all configured years)",
    )
    parser.add_argument(
        "--max-telemetry-points",
        type=int,
        default=1200,
        help="Max samples per fastest lap (keeps CSV size reasonable)",
    )
    args = parser.parse_args()
    years = parse_years(args.years)
    print(f"Years: {years}")
    return collect(args.out_dir, years, args.cache_dir, args.max_telemetry_points)


if __name__ == "__main__":
    raise SystemExit(main())
