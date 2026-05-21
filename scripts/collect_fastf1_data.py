#!/usr/bin/env python3
"""
Collect dashboard CSVs using the same logic as Data_Collection.ipynb.

- Lap times: all races per season from the FastF1 schedule (not a fixed track list).
- Telemetry: fastest lap per race, DRS mapped to strings (notebook drs_mapping).
- Overtakes: position changes from lap data + counts from overtake_counts_source.csv.

Outputs (default public/data):
  speed_metrics_final.csv
  fastest_laps_telemetry.csv
  drs_telemetry_data_miami.csv  (Miami rows from telemetry; used by Overtake map)
  overtake_data.csv             (only if --overtake-source exists)
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import fastf1
import pandas as pd

DEFAULT_YEARS = [2022, 2023, 2024, 2025, 2026]

# Per-year team → engine (matches notebook).
ENGINES_BY_YEAR: dict[int, dict[str, list[str]]] = {
    2022: {
        "Mercedes": ["Mercedes", "McLaren", "Aston Martin", "Williams"],
        "Ferrari": ["Ferrari", "Alfa Romeo", "Haas F1 Team"],
        "Honda": ["Red Bull Racing", "AlphaTauri"],
        "Renault": ["Alpine"],
    },
    2023: {
        "Mercedes": ["Mercedes", "McLaren", "Aston Martin", "Williams"],
        "Ferrari": ["Ferrari", "Alfa Romeo", "Haas F1 Team"],
        "Honda": ["Red Bull Racing", "AlphaTauri"],
        "Renault": ["Alpine"],
    },
    2024: {
        "Mercedes": ["Mercedes", "McLaren", "Aston Martin", "Williams"],
        "Ferrari": ["Ferrari", "Kick Sauber", "Haas F1 Team"],
        "Honda": ["Red Bull Racing", "RB"],
        "Renault": ["Alpine"],
    },
    2025: {
        "Mercedes": ["Mercedes", "McLaren", "Aston Martin", "Williams"],
        "Ferrari": ["Ferrari", "Kick Sauber", "Haas F1 Team"],
        "Honda": ["Red Bull Racing", "Racing Bulls"],
        "Renault": ["Alpine"],
    },
    2026: {
        "Mercedes": ["Mercedes", "McLaren", "Alpine", "Williams"],
        "Ferrari": ["Ferrari", "Cadillac", "Haas F1 Team"],
        "Ford": ["Red Bull Racing", "Racing Bulls"],
        "Honda": ["Aston Martin"],
        "Audi": ["Audi"],
    },
}

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

# Notebook drs_mapping (numeric telemetry → legend strings).
DRS_MAPPING: dict[int, str] = {
    0: "Off",
    1: "Off",
    2: "Unknown",
    3: "Unknown",
    8: "Detected, Eligible",
    10: "On",
    12: "On",
    14: "On",
}

RACE_SHORT_TO_GP: dict[str, str] = {
    "Australia": "Australian Grand Prix",
    "Japan": "Japanese Grand Prix",
    "Miami": "Miami Grand Prix",
    "China": "Chinese Grand Prix",
}

MIAMI_GP = "Miami Grand Prix"
CHINESE_GP = "Chinese Grand Prix"


def parse_years(raw: str | None) -> list[int]:
    if not raw:
        return list(DEFAULT_YEARS)
    return sorted({int(y.strip()) for y in raw.split(",") if y.strip()})


def skip_chinese_gp(year: int, event_name: str) -> bool:
    return year in (2022, 2023) and event_name == CHINESE_GP


def team_to_engine_map(year: int) -> dict[str, str]:
    year_engines = ENGINES_BY_YEAR.get(year, {})
    out: dict[str, str] = {}
    for engine_manufacturer, teams in year_engines.items():
        for team_name in teams:
            out[team_name] = engine_manufacturer
    return out


def event_names_for_year(year: int) -> list[str]:
    """All championship race weekends for a season (EventName, e.g. 'Monaco Grand Prix')."""
    schedule = fastf1.get_event_schedule(year, include_testing=False)
    if schedule is None or schedule.empty:
        return []
    names: list[str] = []
    for _, row in schedule.iterrows():
        name = str(row.get("EventName", "") or "").strip()
        if name:
            names.append(name)
    return names


def collect_lap_times_from_session(
    session,
    year: int,
    event_name: str,
    team_engine: dict[str, str],
) -> pd.DataFrame | None:
    laptimes = session.laps
    if laptimes is None or laptimes.empty:
        return None

    speeds = laptimes[
        [
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
        ]
    ].copy()

    speeds["Race"] = event_name
    speeds["Year"] = year
    speeds["Engine"] = speeds["Team"].map(team_engine)
    return speeds


def collect_fastest_lap_telemetry_from_session(
    session,
    year: int,
    event_name: str,
    max_points: int,
) -> pd.DataFrame | None:
    fastest_lap = session.laps.pick_fastest()
    driver = fastest_lap["Driver"]
    tel = fastest_lap.get_telemetry()

    temp_df = pd.DataFrame(
        {
            "Track": event_name,
            "Year": year,
            "Driver": driver,
            "X": tel["X"],
            "Y": tel["Y"],
            "Speed": tel["Speed"],
            "DRS": tel["DRS"],
        }
    )
    temp_df["DRS"] = temp_df["DRS"].map(DRS_MAPPING).fillna("Unknown")

    if max_points > 0 and len(temp_df) > max_points:
        step = max(1, len(temp_df) // max_points)
        temp_df = temp_df.iloc[::step].copy()

    return temp_df


def normalize_race_name_in_overtake_source(df: pd.DataFrame) -> pd.DataFrame:
    """Accept short names (notebook) or full '* Grand Prix' names."""
    out = df.copy()
    if "Race" not in out.columns:
        raise ValueError("Overtake source CSV must have a Race column")

    def map_race(r: str) -> str:
        r = str(r).strip()
        if r in RACE_SHORT_TO_GP:
            return RACE_SHORT_TO_GP[r]
        return r

    out["Race"] = out["Race"].map(map_race)
    return out


def build_overtake_data(
    lap_df: pd.DataFrame,
    overtake_source_path: Path,
) -> pd.DataFrame:
    """Notebook: position changes from laps + merge manual Overtakes counts."""
    position_changes = (
        lap_df.groupby(["Race", "Year"])["Position"]
        .apply(lambda x: (x.diff().abs() > 0).sum())
        .reset_index()
    )
    position_changes.rename(columns={"Position": "Number of Position Changes"}, inplace=True)

    overtakes = pd.read_csv(overtake_source_path)
    if "Overtakes" not in overtakes.columns:
        raise ValueError(f"{overtake_source_path} must include an Overtakes column")

    overtakes = normalize_race_name_in_overtake_source(overtakes)
    merged = pd.merge(overtakes, position_changes, on=["Race", "Year"], how="left")
    merged["% of Position Changes from Overtakes"] = (
        merged["Overtakes"] / merged["Number of Position Changes"]
    ) * 100
    return merged


def collect(
    out_dir: Path,
    years: list[int],
    cache_dir: Path,
    overtake_source: Path | None,
    max_telemetry_points: int,
) -> int:
    cache_dir.mkdir(parents=True, exist_ok=True)
    fastf1.Cache.enable_cache(str(cache_dir))

    lap_frames: list[pd.DataFrame] = []
    telemetry_frames: list[pd.DataFrame] = []
    errors = 0

    for year in years:
        team_engine = team_to_engine_map(year)
        events = event_names_for_year(year)
        print(f"Year {year}: {len(events)} events on schedule")

        for event_name in events:
            if skip_chinese_gp(year, event_name):
                print(f"  skip {event_name} {year} (cancelled 2022–2023)")
                continue

            label = f"{event_name} ({year})"
            try:
                print(f"  loading {label} …")
                session = fastf1.get_session(year, event_name, "R")
                session.load()

                lap_chunk = collect_lap_times_from_session(
                    session, year, event_name, team_engine
                )
                if lap_chunk is not None and not lap_chunk.empty:
                    lap_frames.append(lap_chunk)
                    print(f"    {len(lap_chunk)} lap rows")

                tel_chunk = collect_fastest_lap_telemetry_from_session(
                    session, year, event_name, max_telemetry_points
                )
                if tel_chunk is not None and not tel_chunk.empty:
                    telemetry_frames.append(tel_chunk)
                    print(f"    {len(tel_chunk)} telemetry rows")
            except Exception as exc:
                print(f"  FAILED {label}: {exc}", file=sys.stderr)
                errors += 1

    out_dir.mkdir(parents=True, exist_ok=True)

    if not lap_frames:
        print("No lap rows collected.", file=sys.stderr)
        errors += 1
        lap_df = pd.DataFrame(columns=LAP_COLUMNS)
    else:
        lap_df = pd.concat(lap_frames, ignore_index=True)
        lap_path = out_dir / "speed_metrics_final.csv"
        lap_df.to_csv(lap_path, index=False)
        print(f"Wrote {lap_path} ({len(lap_df)} rows)")

    if not telemetry_frames:
        print("No telemetry rows collected.", file=sys.stderr)
        errors += 1
        tel_df = pd.DataFrame(columns=["Track", "Year", "Driver", "X", "Y", "Speed", "DRS"])
    else:
        tel_df = pd.concat(telemetry_frames, ignore_index=True)
        tel_path = out_dir / "fastest_laps_telemetry.csv"
        tel_df.to_csv(tel_path, index=False)
        print(f"Wrote {tel_path} ({len(tel_df)} rows)")

        miami_df = tel_df[tel_df["Track"] == MIAMI_GP]
        if not miami_df.empty:
            miami_path = out_dir / "drs_telemetry_data_miami.csv"
            miami_df.to_csv(miami_path, index=False)
            print(f"Wrote {miami_path} ({len(miami_df)} rows)")

    if overtake_source and overtake_source.is_file():
        if lap_frames:
            overtake_df = build_overtake_data(lap_df, overtake_source)
            overtake_path = out_dir / "overtake_data.csv"
            overtake_df.to_csv(overtake_path, index=False)
            print(f"Wrote {overtake_path} ({len(overtake_df)} rows)")
        else:
            print("Skipping overtake_data.csv (no lap data).", file=sys.stderr)
    else:
        print(
            f"Skipping overtake_data.csv (source not found: {overtake_source}).",
            file=sys.stderr,
        )

    return 0 if errors == 0 else 1


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Collect FastF1 CSVs (notebook logic, all races per season)."
    )
    parser.add_argument("--out-dir", type=Path, default=Path("public/data"))
    parser.add_argument("--cache-dir", type=Path, default=Path(".fastf1-cache"))
    parser.add_argument("--years", type=str, default=None)
    parser.add_argument(
        "--overtake-source",
        type=Path,
        default=Path("public/data/overtake_counts_source.csv"),
        help="CSV with Race, Year, Overtakes (short or Grand Prix race names)",
    )
    parser.add_argument(
        "--max-telemetry-points",
        type=int,
        default=0,
        help="Cap samples per fastest lap (0 = full telemetry, matches notebook)",
    )
    args = parser.parse_args()
    years = parse_years(args.years)
    print(f"Years: {years}")
    return collect(
        args.out_dir,
        years,
        args.cache_dir,
        args.overtake_source,
        args.max_telemetry_points,
    )


if __name__ == "__main__":
    raise SystemExit(main())
