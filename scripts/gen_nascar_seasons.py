#!/usr/bin/env python3
"""Generate NASCAR Phase 0 season bundles from the manufacturer-ready master workbook.

Emits 1990, 2000, 2010 and 2026 Winston Cup / Cup Series data:
  - src/data/phase0/generated/globalNASCAR{year}.ts
  - src/data/phase0/generated/season{year}NASCAR.ts
  - src/data/teams/teams{year}NASCAR.ts
  - src/data/drivers/drivers{year}NASCAR.ts
  - src/data/cars/cars{year}NASCAR.ts
  - src/data/market/driverMarket{year}NASCAR.ts
  - src/data/market/youthProspects{year}NASCAR.ts
"""

from __future__ import annotations

import json
import math
import re
import unicodedata
from pathlib import Path
from statistics import mean

import pandas as pd

ROOT = Path("/home/ubuntu/motorsport-sim-manager")
WORKBOOK = Path(
    "/home/ubuntu/attachments/e0989ac8-701d-43cc-8d05-5832e862a1c8/"
    "NASCAR_MASTER_ALL_SEASONS_RULES_POINTS_1990_2026.xlsx"
)
CACHE = Path("/home/ubuntu/tmp/nascar_race_cache.json")

YEARS = [1990, 2000, 2010, 2026]

MI_TO_KM = 1.60934
KM_TO_MI = 0.621371

# Base track lengths (miles). Overrides per year are applied in YEAR_OVERRIDES.
BASE_LENGTHS = {
    "TRK_NASCAR_DAYTONA": 2.5,
    "TRK_NASCAR_RICHMOND": 0.75,
    "TRK_NASCAR_ROCKINGHAM": 1.017,
    "TRK_NASCAR_ATLANTA": 1.54,
    "TRK_NASCAR_DARLINGTON": 1.366,
    "TRK_NASCAR_BRISTOL": 0.533,
    "TRK_NASCAR_NORTH_WILKESBORO": 0.625,
    "TRK_NASCAR_MARTINSVILLE": 0.526,
    "TRK_NASCAR_TALLADEGA": 2.66,
    "TRK_NASCAR_CHARLOTTE": 1.5,
    "TRK_NASCAR_DOVER": 1.0,
    "TRK_NASCAR_SONOMA": 1.99,
    "TRK_NASCAR_POCONO": 2.5,
    "TRK_NASCAR_MICHIGAN": 2.0,
    "TRK_NASCAR_WATKINS_GLEN": 2.45,
    "TRK_NASCAR_PHOENIX": 1.0,
    "TRK_NASCAR_NEW_HAMPSHIRE": 1.058,
    "TRK_NASCAR_INDIANAPOLIS": 2.5,
    "TRK_NASCAR_TEXAS": 1.5,
    "TRK_NASCAR_CALIFORNIA": 2.0,
    "TRK_NASCAR_LAS_VEGAS": 1.5,
    "TRK_NASCAR_HOMESTEAD": 1.5,
    "TRK_NASCAR_CHICAGOLAND": 1.5,
    "TRK_NASCAR_KANSAS": 1.5,
    "TRK_NASCAR_KENTUCKY": 1.5,
    "TRK_NASCAR_CHARLOTTE_ROVAL": 2.28,
    "TRK_NASCAR_BRISTOL_DIRT": 0.533,
    "TRK_NASCAR_COTA": 3.426,
    "TRK_NASCAR_DAYTONA_ROAD": 3.61,
    "TRK_NASCAR_INDIANAPOLIS_ROAD": 2.439,
    "TRK_NASCAR_NASHVILLE": 1.333,
    "TRK_NASCAR_ROAD_AMERICA": 4.048,
    "TRK_NASCAR_WWT": 1.25,
    "TRK_NASCAR_CHICAGO_STREET": 2.2,
    "TRK_NASCAR_IOWA": 0.875,
    "TRK_NASCAR_MEXICO_CITY": 2.518,
    "TRK_NASCAR_CORONADO_STREET": 3.4,
}

YEAR_OVERRIDES = {
    1990: {"TRK_NASCAR_SONOMA": 2.52},
}

# Race name numbers are in kilometres for these tracks.
KM_TRACKS = {"TRK_NASCAR_PHOENIX", "TRK_NASCAR_SONOMA"}

# Race name numbers are lap counts for these tracks.
LAP_TRACKS = {
    "TRK_NASCAR_BRISTOL",
    "TRK_NASCAR_BRISTOL_DIRT",
    "TRK_NASCAR_MARTINSVILLE",
    "TRK_NASCAR_RICHMOND",
    "TRK_NASCAR_NORTH_WILKESBORO",
    "TRK_NASCAR_IOWA",
    "TRK_NASCAR_NEW_HAMPSHIRE",
    "TRK_NASCAR_DOVER",
}

# Map (trackId, number in race name) -> known lap count.
KM_NUMBER_LAPS = {
    ("TRK_NASCAR_PHOENIX", 500): 312,
    ("TRK_NASCAR_SONOMA", 300): 74,
    ("TRK_NASCAR_SONOMA", 350): 110,
}

# No-number defaults for tracks that don't put a number in the race title.
NO_NUMBER_DEFAULT = {
    "TRK_NASCAR_COTA": 95,
    "TRK_NASCAR_BRISTOL_DIRT": 250,
    "TRK_NASCAR_DAYTONA_ROAD": 52,
}

RACE_CACHE: dict[str, dict] = {}


def load_cache() -> None:
    global RACE_CACHE
    if CACHE.exists():
        RACE_CACHE = json.loads(CACHE.read_text(encoding="utf-8"))


def fold_ascii(text: str) -> str:
    return (
        unicodedata.normalize("NFKD", str(text))
        .encode("ascii", "ignore")
        .decode("ascii")
    )


def norm(text: str) -> str:
    text = fold_ascii(text).lower()
    text = re.sub(r"[^a-z0-9]+", " ", text).strip()
    return re.sub(r"\s+", " ", text)


def slug(text: str) -> str:
    return norm(text).replace(" ", "-")


def team_id(year: int, name: str) -> str:
    return f"NASCAR_{year}_TEAM_{slug(name).upper().replace('-', '_')}"


def legacy_team_id(year: int, name: str) -> str:
    return f"t-{year}-nascar-{slug(name)}"


def legacy_car_id(year: int, name: str) -> str:
    return f"car-{year}-nascar-{slug(name)}"


def driver_id(year: int, name: str) -> str:
    return f"driver-nascar-{year}-{slug(name)}"


def legacy_driver_id(year: int, name: str) -> str:
    return f"d-{year}-nascar-{slug(name)}"


def safe_int(value, default: int = 0) -> int:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return default
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return default


def safe_float(value, default: float = 0.0) -> float:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def as_int_1_100(value, default: int = 50) -> int:
    v = safe_float(value, None)
    if v is None:
        return default
    if v <= 10:
        v *= 10
    return int(max(1, min(100, round(v))))


def track_type_info(archetype: str) -> dict:
    a = str(archetype).lower()
    if "road" in a:
        return {"type": "road", "category": "Road", "ovalSubtype": None}
    if "street" in a:
        return {"type": "street", "category": "Street", "ovalSubtype": None}
    if "superspeedway" in a:
        return {"type": "oval", "category": "Oval", "ovalSubtype": "Superspeedway"}
    if "short" in a or "short track" in a:
        return {"type": "oval", "category": "Oval", "ovalSubtype": "Short Oval"}
    return {"type": "oval", "category": "Oval", "ovalSubtype": "Speedway"}


def car_overall(row: dict) -> int:
    return int(
        round(
            mean(
                [
                    as_int_1_100(row.get("enginePower")),
                    as_int_1_100(row.get("aeroEfficiency")),
                    as_int_1_100(row.get("mechanicalGrip")),
                    as_int_1_100(row.get("reliability")),
                    as_int_1_100(row.get("pitCrewOperations")),
                ]
            )
        )
    )


def driver_overall(row: dict) -> int:
    cols = [
        "cornering",
        "braking",
        "straights",
        "tractionAcceleration",
        "elevationBlindCorners",
        "technical",
        "overtakingRacecraft",
        "surfaceGripBumpiness",
        "riskManagement",
        "enduranceConsistency",
        "qualifying",
        "racePace",
        "adaptability",
        "aggression",
        "composure",
    ]
    return int(round(mean([as_int_1_100(row.get(c)) for c in cols])))


def track_length_miles(year: int, tid: str) -> float | None:
    return YEAR_OVERRIDES.get(year, {}).get(tid) or BASE_LENGTHS.get(tid)


def compute_laps(year: int, tid: str, race_name: str, actual_laps: int | None) -> int | None:
    length = track_length_miles(year, tid)
    if not length:
        return actual_laps
    m = re.search(r"(\d+)(k?)\b", race_name, re.IGNORECASE)
    if m:
        n = int(m.group(1))
        is_km = bool(m.group(2)) or tid in KM_TRACKS
        key = (tid, n)
        if key in KM_NUMBER_LAPS:
            return KM_NUMBER_LAPS[key]
        if is_km:
            return int(round(n * KM_TO_MI / length))
        if tid in LAP_TRACKS:
            return n
        comp = int(round(n / length))
        if actual_laps and year < 2000 and abs(actual_laps - comp) <= 20:
            return actual_laps
        return comp
    # No number in race title
    if tid == "TRK_NASCAR_WATKINS_GLEN":
        return 100 if year >= 2026 else 90
    if tid in NO_NUMBER_DEFAULT:
        return NO_NUMBER_DEFAULT[tid]
    if tid == "TRK_NASCAR_BRISTOL":
        return 500
    if tid == "TRK_NASCAR_PHOENIX":
        return 312
    if actual_laps:
        return actual_laps
    return None


def get_actual_laps(year: int, rnd: int) -> int | None:
    data = RACE_CACHE.get(str(year * 100 + rnd), {})
    laps = data.get("laps")
    if laps is not None:
        try:
            v = int(float(laps))
            if v > 0:
                return v
        except (ValueError, TypeError):
            pass
    return None


def write_ts(path: Path, imports: list[str], from_module: str, body: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        fh.write("// AUTO-GENERATED by scripts/gen_nascar_seasons.py. Do not hand-edit.\n")
        if imports:
            fh.write("import type {\n")
            for item in imports:
                fh.write(f"  {item},\n")
            fh.write(f"}} from '{from_module}';\n\n")
        fh.write(body)
        fh.write("\n")


def to_json(data) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2)


def synthesize_car_ratings(year: int, entries: pd.DataFrame, standings: pd.DataFrame) -> pd.DataFrame:
    """Create a Car_Ratings-like DataFrame when the sheet is missing (2026)."""
    team_points = (
        standings.groupby("Team")["Points"]
        .sum()
        .to_dict()
    )
    max_points = max([safe_float(v, 0.0) for v in team_points.values()]) if team_points else 1.0
    teams = entries["Team"].unique()
    rows = []
    for team in teams:
        points = safe_float(team_points.get(team, 0), 0.0)
        overall = max(35, min(99, int(35 + ((points / max_points) if max_points else 0) * 64)))
        rows.append(
            {
                "Season": year,
                "Series": "NASCAR",
                "Team": team,
                "enginePower": overall,
                "aeroEfficiency": overall,
                "mechanicalGrip": overall,
                "reliability": overall,
                "pitCrewOperations": overall,
            }
        )
    return pd.DataFrame(rows)


def synthesize_driver_ratings(year: int, entries: pd.DataFrame, standings: pd.DataFrame) -> pd.DataFrame:
    """Create a Driver_Ratings-like DataFrame when the sheet is missing (2026)."""
    driver_points = {str(k): safe_float(v, 0.0) for k, v in standings.set_index("Driver")["Points"].to_dict().items()}
    driver_team = {}
    for _, row in entries.iterrows():
        name = str(row["Driver"]).strip()
        if name not in driver_team:
            driver_team[name] = str(row["Team"]).strip()
    for _, row in standings.iterrows():
        name = str(row["Driver"]).strip()
        if name not in driver_team:
            driver_team[name] = str(row["Team"]).strip()
    max_points = max([safe_float(v, 0.0) for v in driver_points.values()]) if driver_points else 1.0
    names = set(entries["Driver"].unique()) | set(standings["Driver"].unique())
    cols = [
        "cornering",
        "braking",
        "straights",
        "tractionAcceleration",
        "elevationBlindCorners",
        "technical",
        "overtakingRacecraft",
        "surfaceGripBumpiness",
        "riskManagement",
        "enduranceConsistency",
        "qualifying",
        "racePace",
        "adaptability",
        "aggression",
        "composure",
    ]
    rows = []
    for name in names:
        points = safe_float(driver_points.get(name, 0), 0.0)
        overall = max(35, min(99, int(35 + ((points / max_points) if max_points else 0) * 64)))
        row = {
            "Season": year,
            "Series": "NASCAR",
            "Driver": name,
            "Team": driver_team.get(name, ""),
        }
        for c in cols:
            row[c] = overall
        rows.append(row)
    return pd.DataFrame(rows)


def make_driver_source(year: int, row: dict, team_name: str, overall: int) -> dict:
    def f(col: str) -> int:
        return as_int_1_100(row.get(col))

    return {
        "driverId": driver_id(year, row["Driver"]),
        "name": str(row["Driver"]).strip(),
        "nationality": "United States",
        "traits": [],
        "seriesAffinity": [{"series": "NASCAR", "strength": 100}],
        "careerTimeline": [],
        "cornering": f("cornering"),
        "braking": f("braking"),
        "straights": f("straights"),
        "tractionAcceleration": f("tractionAcceleration"),
        "elevationBlindCorners": f("elevationBlindCorners"),
        "technical": f("technical"),
        "overtakingRacecraft": f("overtakingRacecraft"),
        "surfaceGripBumpiness": f("surfaceGripBumpiness"),
        "riskManagement": f("riskManagement"),
        "enduranceConsistency": f("enduranceConsistency"),
        "qualifying": f("qualifying"),
        "racePace": f("racePace"),
        "adaptability": f("adaptability"),
        "aggression": f("aggression"),
        "composure": f("composure"),
        "startsRestarts": overall,
        "wetWeather": overall,
        "tireManagement": overall,
        "pressureHandling": overall,
        "feedbackQuality": overall,
        "technicalUnderstanding": overall,
        "mechanicalSympathy": overall,
        "overall": overall,
        "potential": min(99, overall + 5),
        "developmentPotential": max(10, 100 - overall),
        "morale": overall,
        "trust": overall,
        "reputation": overall,
        "marketValue": overall,
        "contract": {
            "teamId": team_id(year, team_name) if team_name else "",
            "yearsLeft": 1,
            "salary": round(overall * 0.5),
            "options": [],
        },
    }


def make_car_source(year: int, team_name: str, row: dict, overall: int) -> dict:
    def c(col: str) -> int:
        return as_int_1_100(row.get(col))

    return {
        "carId": legacy_car_id(year, team_name),
        "teamId": team_id(year, team_name),
        "seasonYear": year,
        "series": "NASCAR",
        "enginePower": c("enginePower"),
        "fuelEnergyEfficiency": 50,
        "drag": max(1, min(100, 100 - c("aeroEfficiency"))),
        "downforce": c("aeroEfficiency"),
        "chassisBalance": overall,
        "cooling": c("reliability"),
        "weightEfficiency": overall,
        "mechanicalGrip": c("mechanicalGrip"),
        "brakingStability": round((c("enginePower") + c("mechanicalGrip")) / 2),
        "acceleration": round((c("enginePower") + c("mechanicalGrip")) / 2),
        "topSpeed": round((c("enginePower") * 0.6 + c("aeroEfficiency") * 0.4)),
        "tireWear": max(
            1, min(100, 100 - round((c("mechanicalGrip") + c("reliability")) / 2))
        ),
        "tireWarmup": 50,
        "tempControl": c("reliability"),
        "wetPerformance": round((c("mechanicalGrip") + c("reliability")) / 2),
        "reliability": c("reliability"),
        "setupWindow": c("pitCrewOperations"),
        "upgradeCompatibility": 50,
        "carOverall": overall,
    }


def make_track_source(year: int, row: dict) -> dict:
    track_name = str(row["Track"]).strip()
    track_id = str(row["TrackId"]).strip()
    archetype = str(row["Archetype"]).strip()
    info = track_type_info(archetype)
    length_miles = track_length_miles(year, track_id)
    length_km = round((length_miles or 2.5) * MI_TO_KM, 3)

    def t(col: str) -> int:
        return as_int_1_100(row.get(col))

    corners = t("corners")
    technical = t("technical")
    risk_wall = t("riskWallProximity")
    track_obj = {
        "trackId": track_id,
        "name": track_name,
        "facility": track_name,
        "configNote": "NASCAR configuration",
        "type": info["type"],
        "category": info["category"],
        "subcategory": archetype,
        "location": track_name,
        "city": "",
        "stateProvinceRegion": "",
        "country": "United States",
        "locationDisplay": f"{track_name}, United States",
        "locationConfidence": "Source-Derived",
        "locationSource": "NASCAR master workbook",
        "lengthKm": length_km,
        "seasonsUsed": [{"year": year, "series": "NASCAR"}],
        "aliases": [track_id],
        "attributes": {
            "corners": corners,
            "braking": t("braking"),
            "straights": t("straights"),
            "tractionAcceleration": t("tractionAcceleration"),
            "elevationBlindCorners": t("elevationBlindCorners"),
            "technical": technical,
            "overtakingRacecraft": t("overtakingRacecraft"),
            "surfaceGripBumpiness": t("surfaceGripBumpiness"),
            "riskWallProximity": risk_wall,
            "enduranceConsistency": t("enduranceConsistency"),
        },
        "demandProfile": {
            "downforceDemand": corners,
            "powerDemand": t("straights"),
            "mechanicalDemand": technical,
            "brakeDemand": t("braking"),
            "tireDemand": t("surfaceGripBumpiness"),
            "coolingDemand": 50,
            "riskDemand": risk_wall,
            "tractionDemand": t("tractionAcceleration"),
            "overtakingDifficulty": max(1, min(100, 100 - t("overtakingRacecraft"))),
            "tireWearSeverity": t("surfaceGripBumpiness"),
            "reliabilityStress": t("enduranceConsistency"),
            "setupComplexity": technical,
            "pitStrategySensitivity": 50,
            "safetyCarCautionRisk": 50,
            "overallTrackDifficulty": round((corners + technical + risk_wall) / 3),
            "winnerBaseline": 50,
        },
    }
    if info["ovalSubtype"]:
        track_obj["ovalSubtype"] = info["ovalSubtype"]
    return track_obj


def build_team_groups(entries: pd.DataFrame) -> list[dict]:
    """Group Team_Entries into split teams. Each team is limited to 2 entries."""
    primary = entries.drop_duplicates(subset=["EntryId"], keep="first")
    groups: list[dict] = []
    for team_name, team_rows in primary.groupby("Team"):
        team_rows = team_rows.reset_index(drop=True)
        for i in range(0, len(team_rows), 2):
            chunk = team_rows.iloc[i : i + 2]
            suffix = "" if len(team_rows) <= 2 else f" team {i // 2 + 1}"
            groups.append(
                {
                    "teamName": str(team_name).strip() + suffix,
                    "baseTeamName": str(team_name).strip(),
                    "entries": chunk.to_dict("records"),
                }
            )
    return groups


def generate_year(year: int) -> None:
    out = {
        "season": ROOT / "src" / "data" / "phase0" / "generated" / f"season{year}NASCAR.ts",
        "global": ROOT / "src" / "data" / "phase0" / "generated" / f"globalNASCAR{year}.ts",
        "teams": ROOT / "src" / "data" / "teams" / f"teams{year}NASCAR.ts",
        "drivers": ROOT / "src" / "data" / "drivers" / f"drivers{year}NASCAR.ts",
        "cars": ROOT / "src" / "data" / "cars" / f"cars{year}NASCAR.ts",
        "market": ROOT / "src" / "data" / "market" / f"driverMarket{year}NASCAR.ts",
        "youth": ROOT / "src" / "data" / "market" / f"youthProspects{year}NASCAR.ts",
    }

    calendar_df = pd.read_excel(WORKBOOK, sheet_name="Calendar")
    standings_df = pd.read_excel(WORKBOOK, sheet_name="Standings")
    entries_df = pd.read_excel(WORKBOOK, sheet_name="Team_Entries")
    driver_ratings_df = pd.read_excel(WORKBOOK, sheet_name="Driver_Ratings")
    car_ratings_df = pd.read_excel(WORKBOOK, sheet_name="Car_Ratings")
    track_ratings_df = pd.read_excel(WORKBOOK, sheet_name="Track_Ratings")

    calendar_df = calendar_df[calendar_df["Season"] == year].sort_values("Round")
    standings_df = standings_df[standings_df["Season"] == year]
    entries_df = entries_df[entries_df["Season"] == year]
    driver_ratings_df = driver_ratings_df[driver_ratings_df["Season"] == year]
    car_ratings_df = car_ratings_df[car_ratings_df["Season"] == year]
    track_ratings_df = track_ratings_df[track_ratings_df["Season"] == year]

    # Synthesize missing sheets (2026 only)
    if car_ratings_df.empty:
        car_ratings_df = synthesize_car_ratings(year, entries_df, standings_df)
    if driver_ratings_df.empty:
        driver_ratings_df = synthesize_driver_ratings(year, entries_df, standings_df)

    # Calendar with laps and distance
    races: list[dict] = []
    for _, row in calendar_df.iterrows():
        rnd = safe_int(row["Round"])
        actual = get_actual_laps(year, rnd)
        tid = str(row["TrackId"]).strip()
        name = str(row["Race Name"]).strip()
        laps = compute_laps(year, tid, name, actual)
        if laps is None:
            laps = 100
        length_miles = track_length_miles(year, tid) or 2.5
        distance_km = round(laps * length_miles * MI_TO_KM, 3)
        races.append(
            {
                "round": rnd,
                "raceName": name,
                "trackId": tid,
                "trackName": str(row["Track"]).strip(),
                "laps": laps,
                "distanceKm": distance_km,
            }
        )

    # Driver ratings map
    driver_ratings_by_name: dict[str, dict] = {}
    for _, row in driver_ratings_df.iterrows():
        driver_ratings_by_name[str(row["Driver"]).strip()] = row.to_dict()

    # Car ratings map by base team name
    car_ratings_by_team: dict[str, dict] = {}
    for _, row in car_ratings_df.iterrows():
        car_ratings_by_team[str(row["Team"]).strip()] = row.to_dict()

    # Team groups (split for teams with 3+ entries)
    team_groups = build_team_groups(entries_df)

    # Global drivers
    global_drivers: list[dict] = []
    for _, row in driver_ratings_df.iterrows():
        name = str(row["Driver"]).strip()
        overall = driver_overall(row)
        team_name = str(row.get("Team", "")).strip()
        global_drivers.append(make_driver_source(year, row.to_dict(), team_name, overall))

    # Global teams and cars
    global_teams: list[dict] = []
    global_cars: list[dict] = []
    for idx, group in enumerate(team_groups):
        team_name = group["teamName"]
        base_name = group["baseTeamName"]
        car_row = car_ratings_by_team.get(base_name, {})
        overall = car_overall(car_row) or 50
        t_slug = slug(team_name)

        global_teams.append(
            {
                "teamLineageId": team_id(year, team_name),
                "series": "NASCAR",
                "canonicalName": team_name,
                "namePerPeriod": [{"fromYear": year, "toYear": year, "name": team_name}],
                "nameChangeEvents": [
                    {
                        "year": year,
                        "newName": team_name,
                        "note": "First season this lineage appears in uploaded source data.",
                    }
                ],
                "reputation": overall,
                "raceOperations": overall,
                "pitCrewOperations": as_int_1_100(car_row.get("pitCrewOperations")),
                "developmentRate": 50,
                "facilities": overall,
                "sponsorStrength": overall,
                "commercialStrength": overall,
                "politicalInfluence": overall,
                "financeHealth": overall,
                "budget": int(overall * 1_000_000),
            }
        )

        global_cars.append(make_car_source(year, team_name, car_row, overall))

    # Global tracks
    global_tracks: list[dict] = []
    for _, row in track_ratings_df.iterrows():
        global_tracks.append(make_track_source(year, row.to_dict()))

    # Legacy teams / drivers / cars
    legacy_teams: list[dict] = []
    legacy_drivers: list[dict] = []
    legacy_cars: list[dict] = []
    primary_driver_names: set[str] = set()

    for idx, group in enumerate(team_groups):
        team_name = group["teamName"]
        base_name = group["baseTeamName"]
        car_row = car_ratings_by_team.get(base_name, {})
        overall = car_overall(car_row) or 50
        driver_ids = []

        for entry in group["entries"]:
            driver_name = str(entry["Driver"]).strip()
            primary_driver_names.add(driver_name)
            driver_ids.append(legacy_driver_id(year, driver_name))
            legacy_drivers.append(
                {
                    "id": legacy_driver_id(year, driver_name),
                    "name": driver_name,
                    "number": safe_int(entry["Car#"]),
                    "teamId": legacy_team_id(year, team_name),
                    "ratings": {
                        "cornering": 50,
                        "braking": 50,
                        "straights": 50,
                        "tractionAcceleration": 50,
                        "elevationBlindCorners": 50,
                        "technical": 50,
                        "overtakingRacecraft": 50,
                        "surfaceGripBumpiness": 50,
                        "riskManagement": 50,
                        "enduranceConsistency": 50,
                        "qualifying": 50,
                        "racePace": 50,
                        "adaptability": 50,
                        "aggression": 50,
                        "composure": 50,
                        "overall": 50,
                    },
                    "morale": 65,
                    "confidence": 65,
                    "traits": [],
                }
            )

        legacy_teams.append(
            {
                "id": legacy_team_id(year, team_name),
                "name": team_name,
                "shortName": "",
                "carId": legacy_car_id(year, team_name),
                "driverIds": driver_ids,
                "budget": 50,
                "reputation": overall,
                "raceOperations": overall,
                "morale": 65,
                "expectedStanding": idx + 1,
                "difficulty": "Medium",
                "color": "#60a5fa",
                "country": "United States",
            }
        )

        legacy_cars.append(
            {
                "id": legacy_car_id(year, team_name),
                "teamId": legacy_team_id(year, team_name),
                "seasonYear": year,
                "ratings": {
                    "enginePower": as_int_1_100(car_row.get("enginePower")),
                    "aeroEfficiency": as_int_1_100(car_row.get("aeroEfficiency")),
                    "mechanicalGrip": as_int_1_100(car_row.get("mechanicalGrip")),
                    "reliability": as_int_1_100(car_row.get("reliability")),
                    "pitCrewOperations": as_int_1_100(car_row.get("pitCrewOperations")),
                },
                "condition": 100,
                "developmentLevel": {
                    "enginePower": 0,
                    "aeroEfficiency": 0,
                    "mechanicalGrip": 0,
                    "reliability": 0,
                    "pitCrewOperations": 0,
                },
            }
        )

    # Season bundle
    team_entries: list[dict] = []
    for group in team_groups:
        for entry in group["entries"]:
            team_entries.append(
                {
                    "teamId": team_id(year, group["teamName"]),
                    "carNumber": str(entry["Car#"]).strip(),
                    "driverId": driver_id(year, str(entry["Driver"]).strip()),
                    "chassis": str(entry.get("Chassis", "")).strip(),
                    "engine": str(entry.get("Engine", "")).strip(),
                }
            )

    standings: list[dict] = []
    for _, row in standings_df.iterrows():
        name = str(row["Driver"]).strip()
        team_cell = row.get("Team")
        team_id_val = ""
        if pd.notna(team_cell):
            team_id_val = team_id(year, str(team_cell).strip())
        standings.append(
            {
                "driverId": driver_id(year, name),
                "teamId": team_id_val,
                "position": safe_int(row["Championship Position"]),
                "points": round(safe_float(row["Points"]), 1),
            }
        )

    driver_assignments = [
        {
            "entityId": driver_id(year, str(row["Driver"]).strip()),
            "label": str(row["Driver"]).strip(),
            "sourceSheet": "Driver_Ratings",
        }
        for _, row in driver_ratings_df.iterrows()
    ]
    team_assignments = [
        {
            "entityId": team_id(year, str(row["Team"]).strip()),
            "label": str(row["Team"]).strip(),
            "sourceSheet": "Car_Ratings",
        }
        for _, row in car_ratings_df.iterrows()
    ]
    track_assignments = [
        {
            "entityId": str(row["TrackId"]).strip(),
            "label": str(row["Track"]).strip(),
            "sourceSheet": "Track_Ratings",
        }
        for _, row in track_ratings_df.iterrows()
    ]

    season_bundle = {
        "season": year,
        "series": "NASCAR",
        "seasonId": f"{year}-NASCAR",
        "calendar": races,
        "standings": standings,
        "teamEntries": team_entries,
        "driverAssignments": driver_assignments,
        "teamAssignments": team_assignments,
        "trackAssignments": track_assignments,
        "supplierAssignments": [],
        "tireAssignments": [],
        "principalAssignments": [],
        "youthAssignments": [],
    }

    # Market drivers
    market_drivers: list[dict] = []
    for _, row in driver_ratings_df.iterrows():
        name = str(row["Driver"]).strip()
        if name in primary_driver_names:
            continue
        overall = driver_overall(row)

        def mk(col: str) -> int:
            return as_int_1_100(row.get(col))

        market_drivers.append(
            {
                "id": driver_id(year, name),
                "name": name,
                "age": 30,
                "nationality": "United States",
                "context": "NASCAR",
                "marketPool": "NASCAR",
                "marketStatus": "Free Agent",
                "primaryRole": "Driver",
                "immediateF1Eligible": False,
                "skills": {
                    "cornering": mk("cornering"),
                    "braking": mk("braking"),
                    "straights": mk("straights"),
                    "tractionAcceleration": mk("tractionAcceleration"),
                    "elevationBlindCorners": mk("elevationBlindCorners"),
                    "technical": mk("technical"),
                    "overtakingRacecraft": mk("overtakingRacecraft"),
                    "surfaceGripBumpiness": mk("surfaceGripBumpiness"),
                    "riskManagement": mk("riskManagement"),
                    "enduranceConsistency": mk("enduranceConsistency"),
                },
                "overall": overall,
                "potential": min(99, overall + 10),
                "potentialDelta": 10,
                "developmentRate": 50,
                "f1Readiness": 0,
                "salary": round(overall * 0.01, 2),
                "sponsorValue": round(overall * 0.005, 2),
                "buyoutCost": 0.0,
                "negotiationDifficulty": "Medium",
                "suggestedUse": "Stand-in / reserve",
                "notes": "",
            }
        )

    # Youth prospects
    youth_names = _youth_names_for_year(year)
    youth_prospects: list[dict] = []
    for i, name in enumerate(youth_names):
        potential = 55 + i * 5
        skills = {
            "cornering": 45 + i * 3,
            "braking": 46 + i * 2,
            "straights": 48 + i * 2,
            "tractionAcceleration": 45 + i * 2,
            "elevationBlindCorners": 42 + i * 3,
            "technical": 44 + i * 2,
            "overtakingRacecraft": 43 + i * 3,
            "surfaceGripBumpiness": 41 + i * 2,
            "riskManagement": 40 + i * 3,
            "enduranceConsistency": 47 + i * 2,
        }
        youth_prospects.append(
            {
                "id": f"youth-nascar-{year}-{i + 1}",
                "name": name,
                "age": 17,
                "birthYear": year - 17,
                "nationality": "United States",
                "currentLevel": "Late Model",
                "marketPool": "NASCAR",
                "marketStatus": "Academy Prospect",
                "academyEligibleNow": True,
                "earliestFullAcademyYear": year,
                "skills": skills,
                "overall": 50,
                "potential": potential,
                "potentialDelta": potential - 50,
                "developmentRate": 50,
                "yearsUntilF1Ready": 5,
                "signingCost": 0.05,
                "yearlyAcademyCost": 0.03,
                "riskLevel": "Medium",
                "suggestedPath": "NASCAR Truck development",
                "notes": "",
            }
        )

    # Emit
    write_ts(
        out["global"],
        ["GlobalDriver", "GlobalTeam", "GlobalCar", "GlobalTrack"],
        "../../../types/gameTypes",
        f"export const nascar{year}Drivers: GlobalDriver[] = "
        + to_json(global_drivers)
        + " as const satisfies GlobalDriver[];\n\n"
        f"export const nascar{year}Teams: GlobalTeam[] = "
        + to_json(global_teams)
        + " as const satisfies GlobalTeam[];\n\n"
        f"export const nascar{year}Cars: GlobalCar[] = "
        + to_json(global_cars)
        + " as const satisfies GlobalCar[];\n\n"
        f"export const nascar{year}Tracks: GlobalTrack[] = "
        + to_json(global_tracks)
        + " as const satisfies GlobalTrack[];\n",
    )

    write_ts(
        out["season"],
        ["Phase0SeasonBundle"],
        "../../../types/gameTypes",
        f"export const season{year}NASCARPhase0: Phase0SeasonBundle = "
        + to_json(season_bundle)
        + " as const satisfies Phase0SeasonBundle;\n",
    )

    write_ts(
        out["teams"],
        ["Team"],
        "../../types/gameTypes",
        f"export const teams{year}NASCAR: Team[] = "
        + to_json(legacy_teams)
        + " as const satisfies Team[];\n",
    )

    write_ts(
        out["drivers"],
        ["Driver"],
        "../../types/gameTypes",
        f"export const drivers{year}NASCAR: Driver[] = "
        + to_json(legacy_drivers)
        + " as const satisfies Driver[];\n",
    )

    write_ts(
        out["cars"],
        ["Car"],
        "../../types/gameTypes",
        f"export const cars{year}NASCAR: Car[] = "
        + to_json(legacy_cars)
        + " as const satisfies Car[];\n",
    )

    write_ts(
        out["market"],
        ["MarketDriver"],
        "../../types/marketTypes",
        f"export const driverMarket{year}NASCAR: MarketDriver[] = "
        + to_json(market_drivers)
        + " as const satisfies MarketDriver[];\n",
    )

    write_ts(
        out["youth"],
        ["YouthProspect"],
        "../../types/marketTypes",
        f"export const youthProspects{year}NASCAR: YouthProspect[] = "
        + to_json(youth_prospects)
        + " as const satisfies YouthProspect[];\n",
    )

    print(f"Generated {year} NASCAR files.")


def _youth_names_for_year(year: int) -> list[str]:
    if year == 1990:
        return [
            "Bobby Hamilton Jr.",
            "Casey Atwood",
            "Jason Keller",
            "Hank Parker Jr.",
            "David Green",
        ]
    if year == 2000:
        return [
            "Brian Vickers",
            "Aric Almirola",
            "Kyle Busch",
            "Reed Sorenson",
            "Denny Hamlin",
        ]
    if year == 2010:
        return [
            "Austin Dillon",
            "Trevor Bayne",
            "Ricky Stenhouse Jr.",
            "Ryan Blaney",
            "Chase Elliott",
        ]
    return [
        "Rajah Caruth",
        "Nick Sanchez",
        "Corey Heim",
        "Lawless Alan",
        "Brent Crews",
    ]


def generate() -> None:
    load_cache()
    for year in YEARS:
        generate_year(year)


if __name__ == "__main__":
    generate()
