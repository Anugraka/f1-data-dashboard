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
import time
import unicodedata
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import fastf1
import pandas as pd

try:
    from fastf1.exceptions import RateLimitExceededError
except ImportError:
    RateLimitExceededError = Exception  # type: ignore[misc, assignment]

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

DEFAULT_CALENDAR_CSV = Path("public/data/race_weekends_2026.csv")

# Canonical dashboard name → other FastF1 spellings for the same GP.
EVENT_ALIASES: dict[str, list[str]] = {
    "Sao Paulo Grand Prix": ["São Paulo Grand Prix", "Sao Paulo Grand Prix"],
    "Barcelona-Catalunya Grand Prix": [
        "Barcelona-Catalunya Grand Prix",
        "Spanish Grand Prix",
    ],
}

TEL_COLUMNS = ["Track", "Year", "Driver", "X", "Y", "Speed", "DRS"]


def parse_years(raw: str | None) -> list[int]:
    if not raw:
        return list(DEFAULT_YEARS)
    return sorted({int(y.strip()) for y in raw.split(",") if y.strip()})


def skip_chinese_gp(year: int, event_name: str) -> bool:
    return year in (2022, 2023) and _normalize_event_key(event_name) in (
        _normalize_event_key(CHINESE_GP),
        _normalize_event_key("Chinese Grand Prix"),
    )


def _normalize_event_key(name: str) -> str:
    s = unicodedata.normalize("NFKD", name.strip())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.casefold()


def utc_today() -> date:
    return datetime.now(timezone.utc).date()


def _parse_weekend_end(value: object) -> date | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return pd.Timestamp(text).date()
    except (TypeError, ValueError):
        return None


def events_from_calendar_csv(
    calendar_path: Path,
    today: date,
    lookback_days: int,
) -> list[str]:
    if not calendar_path.is_file():
        return []
    df = pd.read_csv(calendar_path)
    if "EventName" not in df.columns:
        return []
    start = today - timedelta(days=lookback_days)
    found: list[str] = []
    for _, row in df.iterrows():
        name = str(row.get("EventName", "") or "").strip()
        if not name:
            continue
        end = _parse_weekend_end(row.get("WeekendEnd"))
        if end is None:
            continue
        if start <= end <= today:
            found.append(name)
    return found


def events_from_fastf1_2026_schedule(today: date, lookback_days: int) -> list[str]:
    """Use the 2026 championship schedule to see which GP weekend just finished."""
    start = today - timedelta(days=lookback_days)
    found: list[str] = []
    try:
        schedule = fastf1.get_event_schedule(2026, include_testing=False)
    except Exception as exc:
        print(f"Could not load 2026 FastF1 schedule: {exc}", file=sys.stderr)
        return []

    if schedule is None or schedule.empty:
        return []

    for _, row in schedule.iterrows():
        name = str(row.get("EventName", "") or "").strip()
        if not name:
            continue
        event_date = row.get("EventDate")
        if event_date is None or (isinstance(event_date, float) and pd.isna(event_date)):
            continue
        try:
            d = pd.Timestamp(event_date).date()
        except (TypeError, ValueError):
            continue
        if start <= d <= today:
            found.append(name)
    return found


def detect_weekly_events_to_refresh(
    calendar_path: Path,
    lookback_days: int,
    today: date | None = None,
) -> list[str]:
    """
    Pick GP(s) whose race weekend ended in the last `lookback_days` (UTC).
    FastF1 2026 schedule first; optional CSV fallback if dates are filled in.
    """
    today = today or utc_today()
    fastf1_events = events_from_fastf1_2026_schedule(today, lookback_days)
    if fastf1_events:
        print(f"Weekly refresh (FastF1 2026 schedule, last {lookback_days}d): {fastf1_events}")
        return list(dict.fromkeys(fastf1_events))

    csv_events = events_from_calendar_csv(calendar_path, today, lookback_days)
    if csv_events:
        print(f"Weekly refresh (calendar CSV, last {lookback_days}d): {csv_events}")
        return list(dict.fromkeys(csv_events))

    print(
        f"No GP weekend ended between {today - timedelta(days=lookback_days)} and {today} (UTC).",
    )
    return []


def resolve_event_name_for_year(
    canonical: str,
    year: int,
    schedule_cache: dict[int, list[str]],
) -> str | None:
    if year not in schedule_cache:
        schedule_cache[year] = event_names_for_year(year)
    events = schedule_cache[year]
    candidates = [canonical, *EVENT_ALIASES.get(canonical, [])]
    for candidate in candidates:
        if candidate in events:
            return candidate
    key = _normalize_event_key(canonical)
    for event in events:
        if _normalize_event_key(event) == key:
            return event
    for event in events:
        for alias in EVENT_ALIASES.get(canonical, []):
            if _normalize_event_key(event) == _normalize_event_key(alias):
                return event
    return None


def parse_events_arg(raw: str | None) -> list[str] | None:
    if not raw or not raw.strip():
        return None
    return [e.strip() for e in raw.split(",") if e.strip()]


def team_to_engine_map(year: int) -> dict[str, str]:
    year_engines = ENGINES_BY_YEAR.get(year, {})
    out: dict[str, str] = {}
    for engine_manufacturer, teams in year_engines.items():
        for team_name in teams:
            out[team_name] = engine_manufacturer
    return out


def race_years_in_csv(path: Path, race_col: str, year_col: str = "Year") -> set[tuple[str, int]]:
    if not path.is_file():
        return set()
    df = pd.read_csv(path, usecols=[race_col, year_col])
    out: set[tuple[str, int]] = set()
    for race, year in zip(df[race_col], df[year_col]):
        r = str(race).strip()
        try:
            y = int(year)
        except (TypeError, ValueError):
            continue
        if r:
            out.add((r, y))
    return out


def should_skip_incremental(
    year: int,
    event_name: str,
    lap_keys: set[tuple[str, int]],
    tel_keys: set[tuple[str, int]],
    freshness_year: int,
) -> bool:
    """Skip re-download for older seasons already present in both output CSVs."""
    if year >= freshness_year:
        return False
    key = (event_name, year)
    return key in lap_keys and key in tel_keys


def load_session_with_retry(
    year: int,
    event_name: str,
    *,
    rate_limit_wait: int,
    rate_limit_retries: int,
) -> object:
    label = f"{event_name} ({year})"
    for attempt in range(rate_limit_retries + 1):
        try:
            session = fastf1.get_session(year, event_name, "R")
            session.load()
            return session
        except RateLimitExceededError:
            if attempt >= rate_limit_retries:
                raise
            print(
                f"  rate limited on {label}; waiting {rate_limit_wait}s "
                f"(attempt {attempt + 1}/{rate_limit_retries}) …",
                file=sys.stderr,
            )
            time.sleep(rate_limit_wait)
    raise RuntimeError("unreachable")


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


def drop_race_year_rows(df: pd.DataFrame, race_col: str, event_name: str, year: int) -> pd.DataFrame:
    if df.empty or race_col not in df.columns or "Year" not in df.columns:
        return df
    mask = (df[race_col].astype(str).str.strip() == event_name) & (df["Year"].astype(int) == year)
    return df.loc[~mask].copy()


def load_existing_outputs(lap_path: Path, tel_path: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    if lap_path.is_file():
        lap_df = pd.read_csv(lap_path)
    else:
        lap_df = pd.DataFrame(columns=LAP_COLUMNS)
    if tel_path.is_file():
        tel_df = pd.read_csv(tel_path)
    else:
        tel_df = pd.DataFrame(columns=TEL_COLUMNS)
    return lap_df, tel_df


def collect(
    out_dir: Path,
    years: list[int],
    cache_dir: Path,
    overtake_source: Path | None,
    max_telemetry_points: int,
    *,
    events_filter: list[str] | None,
    incremental: bool,
    session_delay: float,
    rate_limit_wait: int,
    rate_limit_retries: int,
) -> int:
    cache_dir.mkdir(parents=True, exist_ok=True)
    fastf1.Cache.enable_cache(str(cache_dir))

    out_dir.mkdir(parents=True, exist_ok=True)
    lap_path = out_dir / "speed_metrics_final.csv"
    tel_path = out_dir / "fastest_laps_telemetry.csv"

    merge_existing = incremental or events_filter is not None
    if merge_existing:
        lap_df, tel_df = load_existing_outputs(lap_path, tel_path)
        print(f"Loaded existing data: {len(lap_df)} lap rows, {len(tel_df)} telemetry rows")
    else:
        lap_df = pd.DataFrame(columns=LAP_COLUMNS)
        tel_df = pd.DataFrame(columns=TEL_COLUMNS)

    lap_keys = race_years_in_csv(lap_path, "Race") if lap_path.is_file() else set()
    tel_keys = race_years_in_csv(tel_path, "Track") if tel_path.is_file() else set()
    freshness_year = max(years)
    schedule_cache: dict[int, list[str]] = {}

    if incremental and not events_filter:
        print(
            f"Incremental mode: skip older seasons already on disk; "
            f"always refresh year {freshness_year}+",
        )

    errors = 0
    fetched = 0
    skipped = 0

    def process_session(year: int, event_name: str) -> None:
        nonlocal lap_df, tel_df, lap_keys, tel_keys, errors, fetched, skipped

        if skip_chinese_gp(year, event_name):
            print(f"  skip {event_name} {year} (cancelled 2022–2023)")
            skipped += 1
            return

        if incremental and events_filter is None and should_skip_incremental(
            year, event_name, lap_keys, tel_keys, freshness_year
        ):
            print(f"  skip {event_name} ({year}) (already in CSV)")
            skipped += 1
            return

        label = f"{event_name} ({year})"
        try:
            print(f"  loading {label} …")
            session = load_session_with_retry(
                year,
                event_name,
                rate_limit_wait=rate_limit_wait,
                rate_limit_retries=rate_limit_retries,
            )
            team_engine = team_to_engine_map(year)

            lap_chunk = collect_lap_times_from_session(
                session, year, event_name, team_engine
            )
            if lap_chunk is not None and not lap_chunk.empty:
                lap_df = drop_race_year_rows(lap_df, "Race", event_name, year)
                lap_df = pd.concat([lap_df, lap_chunk], ignore_index=True)
                lap_keys.add((event_name, year))
                print(f"    {len(lap_chunk)} lap rows")

            tel_chunk = collect_fastest_lap_telemetry_from_session(
                session, year, event_name, max_telemetry_points
            )
            if tel_chunk is not None and not tel_chunk.empty:
                tel_df = drop_race_year_rows(tel_df, "Track", event_name, year)
                tel_df = pd.concat([tel_df, tel_chunk], ignore_index=True)
                tel_keys.add((event_name, year))
                print(f"    {len(tel_chunk)} telemetry rows")

            fetched += 1
            if session_delay > 0:
                time.sleep(session_delay)
        except Exception as exc:
            print(f"  FAILED {label}: {exc}", file=sys.stderr)
            errors += 1

    if events_filter:
        for canonical in events_filter:
            print(f"=== {canonical}: years {years} ===")
            for year in years:
                event_name = resolve_event_name_for_year(
                    canonical, year, schedule_cache
                )
                if not event_name:
                    print(f"  skip {canonical} ({year}): not on {year} schedule")
                    skipped += 1
                    continue
                process_session(year, event_name)
    else:
        for year in years:
            events = event_names_for_year(year)
            print(f"Year {year}: {len(events)} events on schedule")

            for event_name in events:
                process_session(year, event_name)

    print(f"Sessions fetched: {fetched}, skipped: {skipped}")

    if lap_df.empty:
        print("No lap rows in output.", file=sys.stderr)
        errors += 1
    else:
        lap_df.to_csv(lap_path, index=False)
        print(f"Wrote {lap_path} ({len(lap_df)} rows)")

    if tel_df.empty:
        print("No telemetry rows in output.", file=sys.stderr)
        errors += 1
    else:
        tel_df.to_csv(tel_path, index=False)
        print(f"Wrote {tel_path} ({len(tel_df)} rows)")

        miami_df = tel_df[tel_df["Track"] == MIAMI_GP]
        if not miami_df.empty:
            miami_path = out_dir / "drs_telemetry_data_miami.csv"
            miami_df.to_csv(miami_path, index=False)
            print(f"Wrote {miami_path} ({len(miami_df)} rows)")

    if overtake_source and overtake_source.is_file():
        if not lap_df.empty:
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
    parser.add_argument(
        "--incremental",
        action="store_true",
        help="Skip race/years already in output CSVs for seasons before the newest year in --years",
    )
    parser.add_argument(
        "--session-delay",
        type=float,
        default=0.0,
        help="Seconds to wait after each successful session (reduces API rate-limit hits)",
    )
    parser.add_argument(
        "--rate-limit-wait",
        type=int,
        default=3700,
        help="Seconds to wait when FastF1 returns 500 calls/h, then retry",
    )
    parser.add_argument(
        "--rate-limit-retries",
        type=int,
        default=2,
        help="Retries after rate-limit wait",
    )
    parser.add_argument(
        "--weekly",
        action="store_true",
        help=(
            "Monday-style update: detect the GP that just ran (2026 schedule), "
            "merge 2022–2026 for that circuit only into existing CSVs"
        ),
    )
    parser.add_argument(
        "--calendar",
        type=Path,
        default=DEFAULT_CALENDAR_CSV,
        help="Optional WeekendEnd dates per EventName (fallback if FastF1 schedule misses)",
    )
    parser.add_argument(
        "--lookback-days",
        type=int,
        default=8,
        help="With --weekly, refresh GPs whose race date fell within this many days (UTC)",
    )
    parser.add_argument(
        "--events",
        type=str,
        default=None,
        help="Comma-separated EventNames to refresh (e.g. 'Monaco Grand Prix'); overrides --weekly",
    )
    args = parser.parse_args()
    years = parse_years(args.years)
    print(f"Years: {years}")

    events_filter = parse_events_arg(args.events)
    if args.weekly and not events_filter:
        events_filter = detect_weekly_events_to_refresh(
            args.calendar,
            args.lookback_days,
        )
        if not events_filter:
            print("Nothing to fetch this week; keeping existing CSVs.")
            return 0

    if events_filter:
        print(f"Events to refresh: {events_filter}")

    return collect(
        args.out_dir,
        years,
        args.cache_dir,
        args.overtake_source,
        args.max_telemetry_points,
        events_filter=events_filter,
        incremental=args.incremental,
        session_delay=args.session_delay,
        rate_limit_wait=args.rate_limit_wait,
        rate_limit_retries=args.rate_limit_retries,
    )


if __name__ == "__main__":
    raise SystemExit(main())
