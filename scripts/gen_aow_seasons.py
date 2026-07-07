from __future__ import annotations

import math
import os
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import pandas as pd


ROOT = Path("/home/ubuntu/motorsport-sim-manager")
RAW_WORKBOOK = Path("/home/ubuntu/AOW_1990_2007_RAW_DATA.xlsx")
RATINGS_WORKBOOK = Path("/home/ubuntu/AOW_1990_2007_RATINGS.xlsx")
TRACK_AUDIT_WORKBOOK = Path(
    "/home/ubuntu/attachments/dbf9a50f-7944-4590-967b-d86ed29233b8/"
    "American_Open_Wheel_1990_2007_Game_Ready_Import_Workbook_TrackAudit.xlsx"
)
MASTER_TRACK_LIST_WORKBOOK = Path(
    "/home/ubuntu/attachments/a9d5d36f-ae8f-40a9-abb7-ec214f7bd351/"
    "MASTER_TRACK_LIST_F1_AOW_INDYCAR_1990_2026_KM_ONLY.xlsx"
)
MASTER_TEAM_HISTORY_WORKBOOK = Path(
    "/home/ubuntu/attachments/fc44352b-11c6-4f56-8872-942daa19e458/"
    "MASTER_TEAM_HISTORY_F1_AOW_INDYCAR_1990_2026.xlsx"
)
MODERN_SEASON_TRACK_RE = re.compile(
    r"\{\n\s*id:\s*'[^']+',\n\s*round:\s*\d+,\n\s*gpName:\s*'([^']+)',\n\s*trackId:\s*'[^']+',\n\s*trackName:\s*'([^']+)',\n\s*laps:\s*(\d+),\n\s*distanceKm:\s*([0-9.]+),",
    re.M,
)

VENUE_DISTANCE_TARGETS_KM = {
    "indianapolis motor speedway": 804.7,
    "indianapolis motor speedway road course": 310.0,
    "milwaukee mile": 400.0,
    "long beach": 289.0,
    "laguna seca": 289.0,
    "st petersburg": 290.0,
    "toronto": 245.0,
    "mid ohio sports car course": 270.0,
    "road america": 357.5,
    "gateway": 400.0,
    "homestead miami speedway": 482.8,
    "michigan international speedway": 350.0,
    "michigan international raceway": 350.0,
    "nazareth": 300.0,
    "portland international raceway": 290.0,
    "detroit": 300.0,
    "surfers paradise": 300.0,
    "burke lakefront airport": 300.0,
    "meadowlands street circuit": 300.0,
    "denver": 300.0,
    "vancouver": 300.0,
    "phoenix international raceway": 320.0,
    "iowa speedway": 350.0,
    "texas motor speedway": 483.0,
    "pocono raceway": 400.0,
    "walt disney world speedway": 355.0,
    "pikes peak international raceway": 360.0,
    "las vegas motor speedway": 400.0,
    "kansas speedway": 400.0,
    "kentucky speedway": 400.0,
    "chicagoland speedway": 400.0,
    "nashville superspeedway": 400.0,
    "atlanta motor speedway": 495.0,
    "richmond raceway": 360.0,
    "sonoma raceway": 300.0,
    "sonoma": 300.0,
    "motegi oval": 400.0,
}


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def fold_ascii(text: str) -> str:
    return (
        text.replace("’", "'")
        .replace("–", "-")
        .replace("—", "-")
        .replace("“", '"')
        .replace("”", '"')
        .replace("´", "'")
    )


def normalize(text: str) -> str:
    text = fold_ascii(str(text).strip())
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def slug(text: str) -> str:
    return normalize(text).replace(" ", "-")


def ts_str(text: str) -> str:
    return "'" + str(text).replace("\\", "\\\\").replace("'", "\\'") + "'"


def ts_num(value: float | int | None, digits: int = 1) -> str:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return "0"
    value = float(value)
    rounded = round(value, digits)
    if float(rounded).is_integer():
        return str(int(round(rounded)))
    return f"{rounded:.{digits}f}".rstrip("0").rstrip(".")


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def round1(value: float) -> float:
    return round(value * 10) / 10


STATUS_SUFFIX_TOKENS = {"R", "RY", "W", "C", "ROY"}


def is_status_token(token: str) -> bool:
    stripped = re.sub(r"[^A-Za-z]", "", token)
    return bool(stripped) and stripped == stripped.upper() and stripped in STATUS_SUFFIX_TOKENS


def clean_driver_name(name: str) -> str:
    text = unicodedata.normalize("NFKD", fold_ascii(str(name).strip())).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"\s+", " ", text).strip()
    parts = text.split()
    while parts and is_status_token(parts[-1]):
        parts.pop()
    return " ".join(parts) if parts else text


def collect_birth_years_from_sources() -> dict[str, int]:
    observations: dict[str, Counter[int]] = defaultdict(Counter)
    for folder, pattern in ((ROOT / "src/data/drivers", "drivers*.ts"), (ROOT / "src/data/market", "driverMarket*.ts"), (ROOT / "src/data/market", "youthProspects*.ts")):
        for path in folder.glob(pattern):
            text = path.read_text()
            year_match = re.search(r"(\d{4})", path.stem)
            if year_match is None:
                continue
            file_year = int(year_match.group(1))
            for match in re.finditer(r"name:\s*'([^']+)'.*?age:\s*(\d+)", text, re.S):
                name = clean_driver_name(match.group(1))
                age = int(match.group(2))
                observations[normalize(name)][file_year - age] += 1
    resolved: dict[str, int] = {}
    for name, counts in observations.items():
        best_count = max(counts.values())
        candidates = [year for year, count in counts.items() if count == best_count]
        resolved[name] = min(candidates)
    return resolved


def venue_alias_key(name: str) -> str:
    text = normalize(name)
    if "indianapolis motor speedway road course" in text:
        return "indianapolis motor speedway road course"
    if "indianapolis motor speedway" in text or text == "indianapolis":
        return "indianapolis motor speedway"
    if "long beach" in text:
        return "long beach"
    if "laguna seca" in text:
        return "laguna seca"
    if "st petersburg" in text:
        return "st petersburg"
    if "toronto" in text:
        return "toronto"
    if "milwaukee" in text:
        return "milwaukee mile"
    if "mid ohio" in text:
        return "mid ohio sports car course"
    if "road america" in text:
        return "road america"
    if "gateway" in text:
        return "gateway"
    if "homestead" in text:
        return "homestead miami speedway"
    if "michigan" in text:
        return "michigan international speedway"
    if "nazareth" in text:
        return "nazareth"
    if "portland" in text:
        return "portland international raceway"
    if "detroit" in text:
        return "detroit"
    if "surfers paradise" in text:
        return "surfers paradise"
    if "burke lakefront" in text:
        return "burke lakefront airport"
    if "meadowlands" in text:
        return "meadowlands street circuit"
    if "denver" in text:
        return "denver"
    if "vancouver" in text:
        return "vancouver"
    if "phoenix" in text:
        return "phoenix international raceway"
    if "iowa speedway" in text:
        return "iowa speedway"
    if "texas motor speedway" in text:
        return "texas motor speedway"
    if "pocono" in text:
        return "pocono raceway"
    if "walt disney world" in text:
        return "walt disney world speedway"
    if "pikes peak" in text:
        return "pikes peak international raceway"
    if "las vegas motor speedway" in text or "las vegas" in text:
        return "las vegas motor speedway"
    if "kansas speedway" in text or text == "kansas":
        return "kansas speedway"
    if "kentucky speedway" in text or "kentucky" in text:
        return "kentucky speedway"
    if "chicagoland" in text:
        return "chicagoland speedway"
    if "nashville superspeedway" in text or "nashville" in text:
        return "nashville superspeedway"
    if "atlanta motor speedway" in text or "atlanta" in text:
        return "atlanta motor speedway"
    if "richmond raceway" in text or "richmond" in text:
        return "richmond raceway"
    if "sonoma raceway" in text or text == "sonoma":
        return "sonoma raceway"
    if "motegi" in text:
        return "motegi oval"
    return text


def load_modern_track_libraries() -> tuple[dict[str, float], dict[tuple[str, str], tuple[int, float]]]:
    venue_lengths: dict[str, list[float]] = defaultdict(list)
    exact_races: dict[tuple[str, str], tuple[int, float]] = {}
    for path in sorted((ROOT / "src/data/seasons").glob("season20*IndyCar.ts")):
        text = path.read_text()
        for gp_name, track_name, laps_text, distance_text in MODERN_SEASON_TRACK_RE.findall(text):
            laps = int(laps_text)
            distance = float(distance_text)
            if laps <= 0 or distance <= 0:
                continue
            venue_key = venue_alias_key(track_name)
            venue_lengths[venue_key].append((distance / laps) / 1.609344)
            exact_races.setdefault((venue_key, normalize(gp_name)), (laps, distance))
    resolved_lengths = {
        key: sorted(values)[len(values) // 2]
        for key, values in venue_lengths.items()
        if values
    }
    return resolved_lengths, exact_races


def load_master_track_lengths() -> dict[str, float]:
    alias_df = pd.read_excel(MASTER_TRACK_LIST_WORKBOOK, sheet_name="Alias_Map")
    master_df = pd.read_excel(MASTER_TRACK_LIST_WORKBOOK, sheet_name="Master_Track_List")
    lengths: dict[str, float] = {}
    for _, row in master_df.iterrows():
        if pd.isna(row.get("Length_km")):
            continue
        length = float(row["Length_km"])
        name = normalize(str(row.get("Track_Name_For_Game", "")))
        if name:
            lengths[name] = length
    for _, row in alias_df.iterrows():
        if pd.isna(row.get("Length_km")):
            continue
        alias = normalize(str(row.get("Alias_Found_In_Calendars", "")))
        name = normalize(str(row.get("Track_Name_For_Game", "")))
        length = float(row["Length_km"])
        if alias:
          lengths[alias] = length
        if name:
            lengths[name] = length
    return lengths


def load_team_history_libraries() -> tuple[dict[tuple[int, str, str], dict], dict[str, str]]:
    history_df = pd.read_excel(MASTER_TEAM_HISTORY_WORKBOOK, sheet_name="TEAM_SEASON_ENTRIES")
    alias_df = pd.read_excel(MASTER_TEAM_HISTORY_WORKBOOK, sheet_name="TEAM_NAME_ALIAS_MAP")
    team_alias_map: dict[str, str] = {}
    for _, row in alias_df.iterrows():
        raw_name = normalize(str(row.get("Raw_Team_Name", "")))
        canonical = str(row.get("Canonical_Team_Name", "")).strip()
        if raw_name and canonical:
            team_alias_map[raw_name] = canonical
    history: dict[tuple[int, str, str], dict] = {}
    for _, row in history_df.iterrows():
        year = int(row["Season"])
        series = normalize_series_label(str(row["Series"]))
        if series is None:
            continue
        team_name = str(row.get("Canonical_Team_Name", "")).strip()
        if not team_name:
            team_name = str(row.get("Team_Name_That_Season", "")).strip()
        key = (year, series, normalize(team_name))
        history[key] = {
            "chassis": "" if pd.isna(row.get("Chassis")) else str(row.get("Chassis", "")).strip(),
            "engine": "" if pd.isna(row.get("Engine_or_Power_Unit")) else str(row.get("Engine_or_Power_Unit", "")).strip(),
            "tires": "" if pd.isna(row.get("Tires")) else str(row.get("Tires", "")).strip(),
            "team_name": team_name,
            "raw_team_name": str(row.get("Team_Name_That_Season", "")).strip(),
        }
    return history, team_alias_map


def season_series_label(year: int, series: str) -> str:
    if series == "CART":
        if year >= 2004:
            return f"{year} Champ Car World Series"
        return f"{year} CART PPG Indy Car World Series"
    return f"{year} Indy Racing League"


def season_id(year: int, series: str) -> str:
    return f"s-{year}-{series.lower()}"


def race_id(year: int, series: str, round_no: int) -> str:
    return f"r-{year}-{series.lower()}-{round_no}"


def team_id(year: int, series: str, team: str) -> str:
    return f"t-{year}-{series.lower()}-{slug(team)}"


def car_id(year: int, series: str, team: str) -> str:
    return f"car-{year}-{series.lower()}-{slug(team)}"


def driver_id(year: int, series: str, driver: str) -> str:
    return f"d-{year}-{series.lower()}-{slug(driver)}"


def track_id(year: int, series: str, venue: str) -> str:
    return f"{slug(venue)}-{year}{series}"


def team_short_name(team: str) -> str:
    cleaned = re.sub(r"\b(racing|motorsports|motor sports|team|enterprises|partners|inc|llc)\b", "", team, flags=re.I)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if not cleaned:
        cleaned = team
    words = cleaned.split()
    if len(words) == 1:
        return words[0][:12]
    if len(words) == 2:
        return " ".join(words)
    return " ".join(words[:2])


def accent_color(name: str) -> str:
    palette = [
        "#d7263d",
        "#1b998b",
        "#2d7dd2",
        "#f46036",
        "#3a86ff",
        "#8338ec",
        "#ff006e",
        "#6a4c93",
        "#2ec4b6",
        "#ff9f1c",
    ]
    idx = sum(ord(c) for c in name) % len(palette)
    return palette[idx]


def num_from_car_no(value) -> int:
    if pd.isna(value):
        return 0
    text = str(value)
    m = re.search(r"\d+", text)
    return int(m.group(0)) if m else 0


def setup_profile(archetype: str) -> dict:
    archetype = archetype or "Balanced Circuit"
    if archetype == "Street Circuit":
        return {
            "primarySetupProfile": "Balanced Road/Street",
            "downforceLevel": "Medium-High",
            "topSpeedEmphasis": 6.0,
            "mechanicalGripEmphasis": 8.0,
            "brakeDemand": 8.0,
            "reliabilityRiskFocus": 8.0,
            "strategyNotes": "Street-circuit focus: tyre life, restart execution and avoiding the wall matter more than outright top speed.",
            "aeroDemand": 8.0,
            "powerDemand": 6.0,
            "mechanicalDemand": 8.0,
            "riskDemand": 9.0,
        }
    if archetype in {"Oval/Speedway", "High-Speed Circuit"}:
        return {
            "primarySetupProfile": "Low-Downforce Oval",
            "downforceLevel": "Low",
            "topSpeedEmphasis": 9.0,
            "mechanicalGripEmphasis": 6.0,
            "brakeDemand": 4.0,
            "reliabilityRiskFocus": 7.0,
            "strategyNotes": "Oval setup rewards straight-line speed, aero efficiency and clean race execution.",
            "aeroDemand": 4.0,
            "powerDemand": 9.0,
            "mechanicalDemand": 6.0,
            "riskDemand": 6.0,
        }
    if archetype in {"Technical Circuit", "High Downforce Circuit"}:
        return {
            "primarySetupProfile": "Technical Road/Street",
            "downforceLevel": "High",
            "topSpeedEmphasis": 6.0,
            "mechanicalGripEmphasis": 7.0,
            "brakeDemand": 8.0,
            "reliabilityRiskFocus": 8.0,
            "strategyNotes": "Technical circuit: braking stability, rotation and traction dominate setup choice.",
            "aeroDemand": 8.0,
            "powerDemand": 6.0,
            "mechanicalDemand": 7.0,
            "riskDemand": 5.0,
        }
    if archetype == "Low-Speed Mechanical Grip Circuit":
        return {
            "primarySetupProfile": "Mechanical Grip Circuit",
            "downforceLevel": "Medium-High",
            "topSpeedEmphasis": 5.0,
            "mechanicalGripEmphasis": 8.0,
            "brakeDemand": 7.0,
            "reliabilityRiskFocus": 7.0,
            "strategyNotes": "Low-speed circuit: traction, bump absorption and mechanical grip carry more value than raw power.",
            "aeroDemand": 7.0,
            "powerDemand": 5.0,
            "mechanicalDemand": 8.0,
            "riskDemand": 5.0,
        }
    if archetype == "High-Risk Circuit":
        return {
            "primarySetupProfile": "Risk-Heavy Street/Temporary",
            "downforceLevel": "Medium-High",
            "topSpeedEmphasis": 6.0,
            "mechanicalGripEmphasis": 7.0,
            "brakeDemand": 8.0,
            "reliabilityRiskFocus": 9.0,
            "strategyNotes": "High-risk layout: brake stability, wall proximity and reliability management are critical.",
            "aeroDemand": 7.0,
            "powerDemand": 6.0,
            "mechanicalDemand": 7.0,
            "riskDemand": 9.0,
        }
    if archetype == "Endurance/Reliability Circuit":
        return {
            "primarySetupProfile": "Endurance-Balanced",
            "downforceLevel": "Medium",
            "topSpeedEmphasis": 7.0,
            "mechanicalGripEmphasis": 7.0,
            "brakeDemand": 6.0,
            "reliabilityRiskFocus": 9.0,
            "strategyNotes": "Endurance-leaning venue: reliability, tyre management and consistency matter more than one-lap pace.",
            "aeroDemand": 6.0,
            "powerDemand": 7.0,
            "mechanicalDemand": 7.0,
            "riskDemand": 4.0,
        }
    return {
        "primarySetupProfile": "Balanced Road/Street",
        "downforceLevel": "Medium",
        "topSpeedEmphasis": 7.0,
        "mechanicalGripEmphasis": 7.0,
        "brakeDemand": 7.0,
        "reliabilityRiskFocus": 7.0,
        "strategyNotes": "Balanced circuit: a broadly usable setup with no extreme emphasis.",
        "aeroDemand": 7.0,
        "powerDemand": 7.0,
        "mechanicalDemand": 7.0,
        "riskDemand": 7.0,
    }


def archetype_defaults(archetype: str) -> dict:
    return {
        "archetype": archetype,
        "Corners": 7.0,
        "Braking": 7.0,
        "Straights": 7.0,
        "Traction": 7.0,
        "Elevation Blind": 4.0,
        "Technical": 7.0,
        "Overtaking": 6.0,
        "Surface Bumpiness": 6.0,
        "Risk Wall": 6.0,
        "Endurance": 8.0,
        "RatingNotes": f"AOW archetype default for {archetype}.",
        **setup_profile(archetype),
    }


def season_label(series: str, year: int) -> str:
    if series == "CART":
        return "CART 2002-2007" if year >= 2002 else "CART 1990-2001"
    return "IndyCar 1996-2007"


def driver_overall_from_rank(rank: int, total: int) -> float:
    pct = 1.0 if total <= 1 else (total - rank) / (total - 1)
    base = 3.6 + 5.6 * (pct**0.68)
    bonus = 0.0
    if rank <= 3:
        bonus += 0.3
    if rank == 1:
        bonus += 0.2
    return clamp(base + bonus, 3.5, 9.7)


def spread_driver_skills(overall: float, season_mix: str) -> dict:
    o = overall
    if season_mix == "CART":
        return {
            "cornering": clamp(o + 0.1, 1, 10),
            "braking": clamp(o + 0.0, 1, 10),
            "straights": clamp(o - 0.1, 1, 10),
            "tractionAcceleration": clamp(o - 0.1, 1, 10),
            "elevationBlindCorners": clamp(o - 0.2, 1, 10),
            "technical": clamp(o + 0.0, 1, 10),
            "overtakingRacecraft": clamp(o + 0.0, 1, 10),
            "surfaceGripBumpiness": clamp(o - 0.1, 1, 10),
            "riskManagement": clamp(o + 0.1, 1, 10),
            "enduranceConsistency": clamp(o + 0.1, 1, 10),
            "qualifying": clamp(o + 0.1, 1, 10),
            "racePace": clamp(o + 0.2, 1, 10),
            "adaptability": clamp(o, 1, 10),
            "aggression": clamp(o - 0.1, 1, 10),
            "composure": clamp(o + 0.1, 1, 10),
        }
    return {
        "cornering": clamp(o + 0.0, 1, 10),
        "braking": clamp(o - 0.1, 1, 10),
        "straights": clamp(o + 0.2, 1, 10),
        "tractionAcceleration": clamp(o + 0.1, 1, 10),
        "elevationBlindCorners": clamp(o - 0.2, 1, 10),
        "technical": clamp(o - 0.1, 1, 10),
        "overtakingRacecraft": clamp(o + 0.0, 1, 10),
        "surfaceGripBumpiness": clamp(o - 0.1, 1, 10),
        "riskManagement": clamp(o + 0.1, 1, 10),
        "enduranceConsistency": clamp(o + 0.1, 1, 10),
        "qualifying": clamp(o + 0.1, 1, 10),
        "racePace": clamp(o + 0.2, 1, 10),
        "adaptability": clamp(o + 0.1, 1, 10),
        "aggression": clamp(o - 0.1, 1, 10),
        "composure": clamp(o + 0.1, 1, 10),
    }


def car_ratings_from_points(points_pct: float, best_pct: float, spec_equal: bool) -> dict:
    if spec_equal:
        engine = aero = 7.0
    else:
        engine = clamp(4.0 + 5.0 * (points_pct**0.75), 3.5, 9.7)
        aero = clamp(4.0 + 5.0 * (best_pct**0.78), 3.5, 9.7)
    mech = clamp(4.0 + 4.8 * ((0.7 * points_pct + 0.3 * best_pct) ** 0.72), 3.5, 9.7)
    rel = clamp(5.0 + 3.8 * (points_pct**0.62), 3.5, 9.5)
    pit = clamp(4.2 + 4.6 * (best_pct**0.6), 3.5, 9.5)
    return {
        "enginePower": round1(engine),
        "aeroEfficiency": round1(aero),
        "mechanicalGrip": round1(mech),
        "reliability": round1(rel),
        "pitCrewOperations": round1(pit),
    }


def points_percent(points: float, values: list[float]) -> float:
    if not values:
        return 0.0
    mx = max(values)
    if mx <= 0:
        return 0.0
    return max(0.0, min(1.0, points / mx))


def best_points_percent(best: float, values: list[float]) -> float:
    if not values:
        return 0.0
    mx = max(values)
    if mx <= 0:
        return 0.0
    return max(0.0, min(1.0, best / mx))


def parse_number(value) -> int:
    if pd.isna(value):
        return 0
    text = str(value)
    m = re.search(r"\d+", text)
    return int(m.group(0)) if m else 0


def normalize_series_label(series: str, year: int | None = None) -> str | None:
    s = normalize(series)
    if "cart" in s or "champ car" in s:
        return "CART"
    if "irl" in s or "indycar" in s:
        return "IndyCar"
    return None


def build_points_systems_module() -> None:
    out = ROOT / "src/data/pointsSystems/aowPointsSystems.ts"
    ensure_dir(out.parent)
    content = """import type { PointsSystem } from '../../types/gameTypes';

export const aowPointsSystems: Record<string, PointsSystem> = {
  'pts-cart-1990-2001': {
    id: 'pts-cart-1990-2001',
    name: 'CART 1990-2001 (20-16-14-12-10-8-6-5-4-3-2-1)',
    pointsByPosition: { 1: 20, 2: 16, 3: 14, 4: 12, 5: 10, 6: 8, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 },
  },
  'pts-indycar-1996-2007': {
    id: 'pts-indycar-1996-2007',
    name: 'IRL 1996-2007 (50-40-35-32-30-...)',
    pointsByPosition: {
      1: 50, 2: 40, 3: 35, 4: 32, 5: 30, 6: 28, 7: 26, 8: 24, 9: 22, 10: 20,
      11: 19, 12: 18, 13: 17, 14: 16, 15: 15, 16: 14, 17: 13, 18: 12, 19: 11,
      20: 10, 21: 9, 22: 8, 23: 7, 24: 6, 25: 5, 26: 4, 27: 3, 28: 2, 29: 1,
    },
  },
};
"""
    out.write_text(content)


def build_regulations_module() -> None:
    out = ROOT / "src/data/regulations/aowRegulations.ts"
    ensure_dir(out.parent)
    content = """import type { RegulationSet } from '../../types/gameTypes';

const BASE_DESIGN = {
  enginePowerWeight: 1,
  aeroEfficiencyWeight: 1,
  mechanicalGripWeight: 1,
  reliabilityWeight: 1,
  minimumReliability: 0,
};

const BASE_CARRYOVER = {
  enginePower: 1,
  aeroEfficiency: 1,
  mechanicalGrip: 1,
  reliability: 1,
  pitCrewOperations: 1,
};

export const aowRegulations: Record<string, RegulationSet> = {
  'reg-cart-1990-2001': {
    id: 'reg-cart-1990-2001',
    seasonYear: 1990,
    series: 'CART',
    pointsSystemId: 'pts-cart-1990-2001',
    qualifyingFormat: 'Timed qualifying',
    raceWeekendFormat: 'Practice / Qualifying / Race',
    testingLimit: undefined,
    budgetCap: undefined,
    designRules: { ...BASE_DESIGN },
    carryoverModifiers: { ...BASE_CARRYOVER },
    refuelingAllowed: true,
    drsEnabled: false,
    sprintSupport: false,
    pushToPass: false,
    tireChangeRules: 'Unrestricted tire changes',
    eraLabel: 'CART PPG / early Champ Car era',
    notes: [
      'Conventional CART-era chassis/engine competition before the spec-formula period.',
      'Refueling allowed and no DRS/sprint support.',
      'Competitive spread is driven by package strength, driver talent and team operations.',
    ],
  },
  'reg-cart-2002-2007': {
    id: 'reg-cart-2002-2007',
    seasonYear: 2002,
    series: 'CART',
    pointsSystemId: 'pts-cart-2002-2007',
    qualifyingFormat: 'Champ Car (two-round timed qualifying)',
    raceWeekendFormat: 'Practice / Qualifying / Race',
    testingLimit: undefined,
    budgetCap: undefined,
    designRules: { ...BASE_DESIGN },
    carryoverModifiers: { ...BASE_CARRYOVER },
    refuelingAllowed: true,
    drsEnabled: false,
    sprintSupport: false,
    pushToPass: true,
    tireChangeRules: 'Unrestricted tire changes',
    eraLabel: 'Champ Car Spec Formula (Panoz DP01 + Cosworth)',
    notes: [
      'Single-spec chassis (Panoz DP01) and Cosworth turbo V8 — engine/aero are equalised across teams.',
      'Push-to-pass available. Road courses and street circuits only in 2007.',
      'Competitive spread comes from driver talent, team operations and reliability rather than car development.',
    ],
  },
  'reg-indycar-1996-2007': {
    id: 'reg-indycar-1996-2007',
    seasonYear: 1996,
    series: 'IndyCar',
    pointsSystemId: 'pts-indycar-1996-2007',
    qualifyingFormat: 'Timed qualifying',
    raceWeekendFormat: 'Practice / Qualifying / Race',
    testingLimit: undefined,
    budgetCap: undefined,
    designRules: { ...BASE_DESIGN },
    carryoverModifiers: { ...BASE_CARRYOVER },
    refuelingAllowed: true,
    drsEnabled: false,
    sprintSupport: false,
    pushToPass: false,
    tireChangeRules: 'Unrestricted tire changes',
    eraLabel: 'IRL pre-unification era',
    notes: [
      'Early IRL seasons with a simple oval-first ruleset and later road/street expansion.',
      'Refueling allowed. No DRS or push-to-pass.',
      'Competitive spread is driven by power, oval pace, reliability and pit execution.',
    ],
  },
};
"""
    out.write_text(content)


def build_track_defaults() -> dict[str, dict]:
    return {
        "street circuit": archetype_defaults("Street Circuit"),
        "oval/speedway": archetype_defaults("Oval/Speedway"),
        "road course": archetype_defaults("Technical Circuit"),
        "technical circuit": archetype_defaults("Technical Circuit"),
        "high downforce circuit": archetype_defaults("High Downforce Circuit"),
        "high-speed circuit": archetype_defaults("High-Speed Circuit"),
        "low-speed mechanical grip circuit": archetype_defaults("Low-Speed Mechanical Grip Circuit"),
        "high-risk circuit": archetype_defaults("High-Risk Circuit"),
        "endurance/reliability circuit": archetype_defaults("Endurance/Reliability Circuit"),
        "balanced circuit": archetype_defaults("Balanced Circuit"),
        "stop-start circuit": archetype_defaults("Stop-Start Circuit"),
    }


def write_ts_header(path: Path) -> None:
    ensure_dir(path.parent)


def build_aow_data_modules(
    seasons: list[dict],
    season_bundles: dict[str, dict],
    market_bundles: dict[str, dict],
    available_seasons: list[dict],
    tracks_by_season: dict[str, list[dict]],
) -> None:
    out = ROOT / "src/data/aowSeasonData.ts"
    ensure_dir(out.parent)
    imports: list[str] = [
        "import type { Track } from '../types/gameTypes';",
        "import type { MarketDriver, YouthProspect } from '../types/marketTypes';",
        "import type { SeasonBundle } from './seasonCatalog';",
    ]
    season_imports: list[str] = []
    market_imports: list[str] = []
    track_imports: list[str] = []
    for s in seasons:
        year = s["year"]
        series = s["series"]
        tag = f"{year}{series}"
        season_imports.append(f"import {{ season{tag} }} from './seasons/season{tag}';")
        season_imports.append(f"import {{ teams{tag} }} from './teams/teams{tag}';")
        season_imports.append(f"import {{ drivers{tag} }} from './drivers/drivers{tag}';")
        season_imports.append(f"import {{ cars{tag} }} from './cars/cars{tag}';")
        track_imports.append(f"import {{ tracks{tag} }} from './tracks/tracks{tag}';")
        market_imports.append(f"import {{ driverMarket{tag} }} from './market/driverMarket{tag}';")
        market_imports.append(f"import {{ youthProspects{tag} }} from './market/youthProspects{tag}';")
    body = [
        "// AUTO-GENERATED by scripts/gen_aow_seasons.py.",
        "// Shared AOW imports/registries for 1990–2007 CART + IRL seasons.",
        "",
        *imports,
        *season_imports,
        *market_imports,
        *track_imports,
        "",
        "export const aowAvailableSeasons: { year: number; series: 'CART' | 'IndyCar'; label: string }[] = [",
    ]
    for s in available_seasons:
        body.append(
            f"  {{ year: {s['year']}, series: {ts_str(s['series'])} as 'CART' | 'IndyCar', label: {ts_str(s['label'])} }},"
        )
    body.append("];")
    body.append("")
    body.append("export const aowSeasonBundles: Record<string, SeasonBundle> = {")
    for key, bundle in season_bundles.items():
        body.append(
            f"  {ts_str(key)}: {{ season: season{bundle['tag']}, teams: teams{bundle['tag']}, drivers: drivers{bundle['tag']}, cars: cars{bundle['tag']} }},"
        )
    body.append("};")
    body.append("")
    body.append("export const aowMarketBundles: Record<string, { drivers: MarketDriver[]; youth: YouthProspect[] }> = {")
    for key, bundle in market_bundles.items():
        body.append(
            f"  {ts_str(key)}: {{ drivers: driverMarket{bundle['tag']}, youth: youthProspects{bundle['tag']} }},"
        )
    body.append("};")
    body.append("")
    body.append("export const aowTracks: Track[] = [")
    for s in seasons:
        tag = s["tag"]
        body.append(f"  ...tracks{tag},")
    body.append("];")
    body.append("")
    out.write_text("\n".join(body))


def choose_team(
    driver_name: str,
    season_entries: pd.DataFrame,
    team_points: dict[str, float],
) -> str:
    rows = season_entries[season_entries["Canonical_Driver"].astype(str) == driver_name]
    if rows.empty:
        return str(season_entries.iloc[0]["Canonical_Team"])
    counts = rows["Canonical_Team"].value_counts()
    teams = list(counts.index)
    if len(teams) == 1:
        return str(teams[0])
    best = max(
        teams,
        key=lambda t: (
            counts[t],
            team_points.get(t, 0),
        ),
    )
    return str(best)


def track_lookup_from_audit(track_df: pd.DataFrame) -> tuple[dict[str, dict], dict[str, dict]]:
    lookup: dict[str, dict] = {}
    defaults: dict[str, dict] = build_track_defaults()
    for _, row in track_df.iterrows():
        key = normalize(row["Track"])
        lookup[key] = {
            "Track": row["Track"],
            "TrackId": row["TrackId"],
            "Archetype": row["Track Archetype"],
            "Corners": float(row["Corners"]),
            "Braking": float(row["Braking"]),
            "Straights": float(row["Straights"]),
            "Traction": float(row["Traction"]),
            "Elevation Blind": float(row["Elevation Blind"]),
            "Technical": float(row["Technical"]),
            "Overtaking": float(row["Overtaking"]),
            "Surface Bumpiness": float(row["Surface Bumpiness"]),
            "Risk Wall": float(row["Risk Wall"]),
            "Endurance": float(row["Endurance"]),
            "PrimarySetupProfile": row["PrimarySetupProfile"],
            "DownforceLevel": row["DownforceLevel"],
            "TopSpeedEmphasis": float(row["TopSpeedEmphasis"]),
            "MechanicalGripEmphasis": float(row["MechanicalGripEmphasis"]),
            "BrakeDemand": float(row["BrakeDemand"]),
            "ReliabilityRiskFocus": float(row["ReliabilityRiskFocus"]),
            "AeroDemand": float(row["AeroDemand"]),
            "PowerDemand": float(row["PowerDemand"]),
            "MechanicalDemand": float(row["MechanicalDemand"]),
            "RiskDemand": float(row["RiskDemand"]),
            "RatingNotes": row["RatingNotes"] if pd.notna(row["RatingNotes"]) else "",
            "Track Type": row["Track Type"],
            "Location": row["Location"],
        }
    return lookup, defaults


def infer_laps_distance(
    track_length_km: float | None,
    archetype: str,
    track_name: str,
    gp_name: str,
    exact_race: tuple[int, float] | None = None,
) -> tuple[int, float]:
    if exact_race is not None and track_length_km is None:
        return int(exact_race[0]), float(exact_race[1])

    length_km = track_length_km or (2.0 * 1.609344)
    length_km = max(length_km, 0.1)
    venue_key = venue_alias_key(track_name)
    gp_key = normalize(gp_name)

    if "indy 500" in gp_key or ("indianapolis 500" in gp_key and "road course" not in venue_key):
        return 200, float(round(200 * length_km, 1))
    else:
        target_km = VENUE_DISTANCE_TARGETS_KM.get(venue_key)
        if target_km is None:
            archetype_key = normalize(archetype)
            if archetype_key in {"oval speedway", "high speed circuit"}:
                target_km = 400.0 if length_km <= 2.01 else 350.0
            elif archetype_key == "street circuit":
                target_km = 290.0
            else:
                target_km = 300.0

    laps = max(1, int(round(target_km / length_km)))
    distance = round(laps * length_km, 1)
    if distance > 540.0 and "indy 500" not in gp_key and "indianapolis 500" not in gp_key:
        laps = max(1, int(math.floor(540.0 / length_km)))
        distance = round(laps * length_km, 1)
    return laps, float(distance if distance > 0 else 1.0)


def generate() -> None:
    build_points_systems_module()
    build_regulations_module()
    raw = pd.ExcelFile(RAW_WORKBOOK)
    ratings_driver = pd.read_excel(RATINGS_WORKBOOK, sheet_name="Driver_Ratings")
    ratings_team = pd.read_excel(RATINGS_WORKBOOK, sheet_name="Car_Ratings")
    track_audit = pd.read_excel(TRACK_AUDIT_WORKBOOK, sheet_name="Track_Ratings")
    master_track_lengths = load_master_track_lengths()
    team_history_lookup, team_alias_map = load_team_history_libraries()
    modern_track_lengths, modern_exact_races = load_modern_track_libraries()

    calendar = pd.read_excel(RAW_WORKBOOK, sheet_name="Calendar")
    standings = pd.read_excel(RAW_WORKBOOK, sheet_name="Standings")
    entries = pd.read_excel(RAW_WORKBOOK, sheet_name="Team_Entries")

    calendar["SeriesCode"] = calendar["Canonical_Series"].apply(normalize_series_label)
    standings["SeriesCode"] = standings["Canonical_Series"].apply(normalize_series_label)
    entries["SeriesCode"] = entries["Canonical_Series"].apply(normalize_series_label)
    standings["DriverClean"] = standings["Canonical_Driver"].astype(str).map(clean_driver_name)
    entries["DriverClean"] = entries["Canonical_Driver"].astype(str).map(clean_driver_name)
    preferred_driver_names: dict[str, str] = {}
    for raw_name in entries["DriverClean"].dropna().astype(str):
        key = normalize(raw_name)
        preferred_driver_names.setdefault(key, raw_name)

    seasons = [
        {"year": y, "series": "CART", "tag": f"{y}CART"} for y in range(1990, 2008)
    ] + [
        {"year": y, "series": "IndyCar", "tag": f"{y}IndyCar"} for y in range(1996, 2008)
    ]

    track_lib, track_defaults = track_lookup_from_audit(track_audit)
    aow_dir = ROOT / "src/data"

    season_bundles: dict[str, dict] = {}
    market_bundles: dict[str, dict] = {}
    available_seasons: list[dict] = []
    season_defs: list[dict] = []
    tracks_by_season: dict[str, list[dict]] = {}
    workbook_rows: dict[str, list[dict]] = defaultdict(list)

    driver_cols = [
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
        "overall",
    ]
    team_cols = ["enginePower", "aeroEfficiency", "mechanicalGrip", "reliability", "pitCrewOperations"]

    driver_ratings_map: dict[tuple[int, str, str], dict] = {}
    for _, row in ratings_driver.iterrows():
        year = int(row["Season"])
        series = normalize_series_label(row["Series"], year)
        if series is None:
            continue
        key = (year, series, normalize(clean_driver_name(row["Driver"])))
        driver_ratings_map[key] = row.to_dict()

    driver_birth_years = collect_birth_years_from_sources()
    driver_birth_year_overrides = {
        "nigel mansell": 1953,
        "michele alboreto": 1956,
        "roberto moreno": 1959,
        "mauricio gugelmin": 1963,
        "gary brabham": 1961,
        "jj lehto": 1966,
        "mark blundell": 1966,
        "fabrizio barbazza": 1963,
        "stefan johansson": 1956,
        "alessandro zanardi": 1966,
        "alex zanardi": 1966,
        "adrian fernandez": 1965,
        "stephan gregoire": 1969,
        "mika salo": 1966,
        "gil de ferran": 1967,
        "vincenzo sospiri": 1966,
        "greg moore": 1975,
        "kenny brack": 1966,
        "andre lotterer": 1981,
        "gaston mazzacane": 1975,
        "scott dixon": 1980,
        "ryan hunter reay": 1980,
        "a j foyt iv": 1984,
        "ed carpenter": 1981,
        "marco andretti": 1987,
        "graham rahal": 1989,
        "milka duno": 1972,
    }
    driver_birth_years.update(driver_birth_year_overrides)

    team_ratings_map: dict[tuple[int, str, str], dict] = {}
    for _, row in ratings_team.iterrows():
        year = int(row["Season"])
        series = normalize_series_label(row["Series"], year)
        if series is None:
            continue
        key = (year, series, normalize(row["Team"]))
        team_ratings_map[key] = row.to_dict()

    for season in seasons:
        year = season["year"]
        series = season["series"]
        key = f"{year}-{series}"
        cal = calendar[(calendar["Canonical_Season"] == year) & (calendar["SeriesCode"] == series)].copy()
        ent = entries[(entries["Canonical_Season"] == year) & (entries["SeriesCode"] == series)].copy()
        std = standings[(standings["Canonical_Season"] == year) & (standings["SeriesCode"] == series)].copy()

        if cal.empty or ent.empty:
            continue

        available_seasons.append({"year": year, "series": series, "label": season_series_label(year, series)})

        # standings lookup
        std["DriverClean"] = std["Canonical_Driver"].astype(str).map(clean_driver_name)
        std["DriverKey"] = std["DriverClean"].map(normalize)
        std["PointsNum"] = pd.to_numeric(std["Canonical_Points"], errors="coerce").fillna(0)
        std["PositionNum"] = pd.to_numeric(std["Canonical_Position"], errors="coerce")
        points_lookup = {
            normalize(str(r["DriverClean"])): float(r["PointsNum"]) for _, r in std.iterrows()
        }
        pos_lookup = {
            normalize(str(r["DriverClean"])): int(r["PositionNum"])
            for _, r in std.iterrows()
            if not pd.isna(r["PositionNum"])
        }

        # team aggregation
        team_points: dict[str, float] = defaultdict(float)
        team_best: dict[str, float] = defaultdict(float)
        team_driver_points: dict[str, list[float]] = defaultdict(list)
        for _, row in ent.iterrows():
            team = str(row["Canonical_Team"])
            drv = normalize(clean_driver_name(str(row["Canonical_Driver"])))
            pts = points_lookup.get(drv, 0.0)
            team_points[team] += pts
            team_best[team] = max(team_best[team], pts)
            team_driver_points[team].append(pts)

        teams_raw = []
        for team, grp in ent.groupby("Canonical_Team"):
            team_rows = grp.copy()
            team_driver_names = sorted(
                {
                    preferred_driver_names.get(normalize(clean_driver_name(str(v))), clean_driver_name(str(v)))
                    for v in team_rows["Canonical_Driver"].tolist()
                },
                key=lambda d: (-points_lookup.get(normalize(d), 0.0), normalize(d)),
            )
            ratings_row = team_ratings_map.get((year, series, normalize(str(team))))
            if ratings_row is None:
                aggregate = team_points.get(str(team), 0.0)
                best = team_best.get(str(team), 0.0)
                max_points = max(team_points.values()) if team_points else 1.0
                pct = points_percent(aggregate, list(team_points.values()))
                best_pct = best_points_percent(best, list(team_points.values()))
                spec_equal = series == "CART" and year >= 2002
                ratings = car_ratings_from_points(pct, best_pct, spec_equal)
                notes = "Derived fallback team ratings from roster points."
            else:
                ratings = {k: round1(float(ratings_row[k])) for k in team_cols}
                notes = str(ratings_row.get("Basis/Notes", ""))
            teams_raw.append(
                {
                    "team": str(team),
                    "driver_names": team_driver_names,
                    "driver_ids": [],
                    "ratings": ratings,
                    "notes": notes,
                }
            )

        # choose canonical team for each driver
        driver_team_map: dict[str, str] = {}
        for _, row in ent.iterrows():
            driver = clean_driver_name(str(row["Canonical_Driver"]))
            team = str(row["Canonical_Team"])
            dkey = normalize(driver)
            if dkey not in driver_team_map:
                driver_team_map[dkey] = team
            else:
                current = driver_team_map[dkey]
                current_score = team_points.get(current, 0.0)
                new_score = team_points.get(team, 0.0)
                if new_score > current_score:
                    driver_team_map[dkey] = team

        drivers_raw = []
        driver_rows_seen: set[str] = set()
        standings_sorted = std.sort_values(["PointsNum", "PositionNum"], ascending=[False, True], na_position="last")
        for _, row in standings_sorted.iterrows():
            dname = preferred_driver_names.get(
                normalize(clean_driver_name(str(row["Canonical_Driver"]))),
                clean_driver_name(str(row["Canonical_Driver"])),
            )
            dkey = normalize(dname)
            if dkey in driver_rows_seen:
                continue
            driver_rows_seen.add(dkey)
            team_name = driver_team_map.get(dkey)
            if team_name is None and not ent.empty:
                team_name = str(ent.iloc[0]["Canonical_Team"])
            rid = driver_id(year, series, dname)
            lookup_row = driver_ratings_map.get((year, series, dkey))
            if lookup_row is None:
                total = len(standings_sorted)
                overall = driver_overall_from_rank(len(drivers_raw) + 1, total)
                skills = spread_driver_skills(overall, series)
                basis = "Fallback driver ratings from championship rank."
                champ_pos = row.get("Canonical_Position", "")
                points = float(row.get("Canonical_Points", 0) or 0)
            else:
                overall = float(lookup_row["overall"])
                skills = {k: float(lookup_row[k]) for k in driver_cols if k != "overall"}
                basis = str(lookup_row.get("Basis/Notes", ""))
                champ_pos = lookup_row.get("ChampPos", row.get("Canonical_Position", ""))
                points = float(lookup_row.get("Points", row.get("Canonical_Points", 0)) or 0)
            drivers_raw.append(
                {
                    "id": rid,
                    "name": dname,
                    "age": max(16, year - driver_birth_years.get(dkey, year - 25)),
                    "number": num_from_car_no(
                        ent[ent["DriverClean"] == dname]["Canonical_Car_No"].iloc[0]
                        if not ent[ent["DriverClean"] == dname].empty
                        else 0
                    ),
                    "team": team_name,
                    "team_id": team_id(year, series, team_name),
                    "points": points,
                    "champ_pos": champ_pos,
                    "ratings": {**skills, "overall": overall},
                    "basis": basis,
                    "team_name": team_name,
                }
            )

        # ensure every team has driver IDs in its roster, ordered by points.
        drivers_by_team: dict[str, list[str]] = defaultdict(list)
        for d in drivers_raw:
            drivers_by_team[d["team_name"]].append(d["id"])
        for team in teams_raw:
            team["driver_ids"] = drivers_by_team.get(team["team"], [])

        # Calendar + track data
        unique_tracks: dict[str, dict] = {}
        calendar_rows = []
        cal["RoundNum"] = pd.to_numeric(cal["Canonical_Round"], errors="coerce")
        cal["RaceDateNum"] = pd.to_datetime(cal["Canonical_Race_Date"], errors="coerce")
        ordered_calendar = cal.sort_values(["RaceDateNum", "RoundNum"], na_position="last")
        for idx, (_, row) in enumerate(ordered_calendar.iterrows(), start=1):
            venue = str(row["Canonical_Track"])
            venue_key = normalize(venue)
            alias_key = venue_alias_key(venue)
            track_data = track_lib.get(venue_key)
            track_length_km = master_track_lengths.get(alias_key) or master_track_lengths.get(venue_key)
            if track_length_km is None:
                modern_length_mi = modern_track_lengths.get(alias_key)
                if modern_length_mi is not None:
                    track_length_km = float(modern_length_mi * 1.609344)
            if track_data is None:
                archetype = str(row.get("Canonical_Track_Archetype", "")) if "Canonical_Track_Archetype" in row else ""
                archetype = archetype if archetype else ("Street Circuit" if "street" in normalize(venue) else "Oval/Speedway" if any(k in normalize(venue) for k in ["speedway", "motor speedway", "oval", "raceway"]) else "Technical Circuit")
                track_data = {**track_defaults.get(normalize(archetype), archetype_defaults(archetype))}
                track_data["Track"] = venue
                track_data["Archetype"] = archetype
                track_data["TrackId"] = track_id(year, series, venue)
                track_data["RatingNotes"] = f"AOW archetype default for {archetype}."
            else:
                track_data = dict(track_data)
                if not track_data.get("TrackId"):
                    track_data["TrackId"] = track_id(year, series, venue)
                if track_length_km is None and pd.notna(track_data.get("Track Length Km")):
                    track_length_km = float(track_data.get("Track Length Km"))
            unique_tracks[track_data["TrackId"]] = track_data
            exact_race = modern_exact_races.get((alias_key, normalize(str(row["Canonical_Race_Name"]))))
            if track_length_km is not None:
                exact_race = None
            laps, distance = infer_laps_distance(track_length_km, str(track_data["Archetype"]), venue, str(row["Canonical_Race_Name"]), exact_race=exact_race)
            calendar_rows.append(
                {
                    "id": race_id(year, series, idx),
                    "round": idx,
                    "gpName": str(row["Canonical_Race_Name"]),
                    "trackId": track_data["TrackId"],
                    "trackName": venue,
                    "laps": laps,
                    "distanceKm": distance,
                    "completed": False,
                }
            )

        standings_rows = list(drivers_raw)
        team_entry_rows = []
        for _, row in ent.iterrows():
            team_name = str(row["Canonical_Team"])
            team_key = normalize(team_alias_map.get(normalize(team_name), team_name))
            history = team_history_lookup.get((year, series, team_key), {})
            team_entry_rows.append(
                {
                    "team": team_alias_map.get(normalize(team_name), team_name),
                    "car_no": row["Canonical_Car_No"],
                    "driver": preferred_driver_names.get(
                        normalize(clean_driver_name(str(row["Canonical_Driver"]))),
                        clean_driver_name(str(row["Canonical_Driver"])),
                    ),
                    "chassis": str(row["Canonical_Chassis"]) if pd.notna(row["Canonical_Chassis"]) and str(row["Canonical_Chassis"]).strip() else history.get("chassis", ""),
                    "engine": str(row["Canonical_Engine"]) if pd.notna(row["Canonical_Engine"]) and str(row["Canonical_Engine"]).strip() else history.get("engine", ""),
                }
            )

        append_workbook_rows(
            workbook_rows,
            year,
            series,
            calendar_rows,
            standings_rows,
            team_entry_rows,
            teams_raw,
            drivers_raw,
            unique_tracks,
        )

        # season record
        points_id = "pts-cart-1990-2001" if series == "CART" and year <= 2001 else "pts-cart-2002-2007" if series == "CART" else "pts-indycar-1996-2007"
        reg_id = "reg-cart-1990-2001" if series == "CART" and year <= 2001 else "reg-cart-2002-2007" if series == "CART" else "reg-indycar-1996-2007"
        season_def = {
            "id": season_id(year, series),
            "year": year,
            "name": season_series_label(year, series),
            "series": series,
            "calendar": calendar_rows,
            "pointsSystemId": points_id,
            "regulationSetId": reg_id,
        }

        # market + youth stand-ins from the lower half of the roster
        sorted_drivers = sorted(drivers_raw, key=lambda d: (d["points"], d["champ_pos"] if isinstance(d["champ_pos"], int) else 9999))
        market_pick = sorted_drivers[: min(5, max(3, len(sorted_drivers) // 6 or 3))]
        youth_pick = sorted_drivers[min(3, len(sorted_drivers)) : min(8, len(sorted_drivers))]
        if not youth_pick:
            youth_pick = market_pick[:3]

        def market_driver_payload(d: dict, idx: int) -> dict:
            overall = clamp(float(d["ratings"]["overall"]) - 0.3, 3.5, 9.0)
            skills = spread_driver_skills(overall, series)
            role = "Reserve Driver" if idx % 2 == 0 else "Feeder Driver"
            suffix = chr(ord("a") + idx)
            return {
                "id": f"mkt-{year}-{series.lower()}-{slug(team_short_name(d['team']))}-{suffix}",
                "name": f"{year} {series} {d['team']} Reserve {suffix.upper()}",
                "age": 24 + (idx % 8),
                "nationality": "International",
                "context": f"{series} {year} market pool",
                "marketPool": f"{series} Market",
                "marketStatus": "Available",
                "primaryRole": role,
                "immediateF1Eligible": series == "CART" and year >= 2004,
                "skills": skills,
                "overall": round1(overall),
                "potential": round1(clamp(overall + 0.7, 3.6, 9.4)),
                "potentialDelta": round1(clamp(0.7 + (idx * 0.1), 0.2, 1.5)),
                "developmentRate": round1(clamp(1.0 + idx * 0.2, 0.5, 3.0)),
                "f1Readiness": 55 + idx * 5,
                "salary": round1(0.4 + idx * 0.15),
                "sponsorValue": round1(0.1 + idx * 0.08),
                "buyoutCost": round1(0.3 + idx * 0.12),
                "negotiationDifficulty": "Medium",
                "suggestedUse": role,
                "notes": "Derived from season roster points as a low-cost stand-in market option.",
            }

        def youth_payload(d: dict, idx: int) -> dict:
            overall = clamp(float(d["ratings"]["overall"]) - 0.9, 3.5, 8.2)
            skills = spread_driver_skills(overall, series)
            age = 16 + (idx % 4)
            birth_year = year - age
            suffix = chr(ord("a") + idx)
            return {
                "id": f"yth-{year}-{series.lower()}-{slug(team_short_name(d['team']))}-{suffix}",
                "name": f"{year} {series} {d['team']} Prospect {suffix.upper()}",
                "age": age,
                "birthYear": birth_year,
                "nationality": "International",
                "currentLevel": "Junior Open Wheel",
                "marketPool": f"{series} Youth",
                "marketStatus": "Prospect",
                "academyEligibleNow": True,
                "earliestFullAcademyYear": year,
                "skills": skills,
                "overall": round1(overall),
                "potential": round1(clamp(overall + 2.0, 4.5, 9.5)),
                "potentialDelta": round1(clamp(2.0 + idx * 0.2, 1.2, 3.8)),
                "developmentRate": round1(clamp(3.5 - idx * 0.2, 1.5, 5.0)),
                "yearsUntilF1Ready": 5 + (idx % 3),
                "signingCost": 0.1,
                "yearlyAcademyCost": 0.08,
                "riskLevel": "Medium",
                "suggestedPath": "Feeder series / Junior open-wheel ladder",
                "notes": "Derived youth stand-in from the season roster for a cheap academy pool.",
            }

        market_bundles[key] = {
            "tag": season["tag"],
            "drivers": [market_driver_payload(d, i) for i, d in enumerate(market_pick)],
            "youth": [youth_payload(d, i) for i, d in enumerate(youth_pick[:4])],
        }

        # write season/teams/drivers/cars/tracks/market TS files
        write_season_files(season, calendar_rows, unique_tracks, teams_raw, drivers_raw, market_bundles[key], points_id, reg_id)
        season_bundles[key] = {"tag": season["tag"], "season": season_def}
        tracks_by_season[key] = list(unique_tracks.values())

    build_aow_data_modules(seasons, season_bundles, market_bundles, available_seasons, tracks_by_season)
    export_game_workbook(Path("/home/ubuntu/AOW_1990_2007_GAME_DATA.xlsx"), workbook_rows)
    patch_core_files()


def write_season_files(
    season: dict,
    calendar_rows: list[dict],
    tracks: dict[str, dict],
    teams: list[dict],
    drivers: list[dict],
    market_bundle: dict,
    points_id: str,
    reg_id: str,
) -> None:
    year = season["year"]
    series = season["series"]
    tag = season["tag"]

    season_path = ROOT / f"src/data/seasons/season{tag}.ts"
    teams_path = ROOT / f"src/data/teams/teams{tag}.ts"
    drivers_path = ROOT / f"src/data/drivers/drivers{tag}.ts"
    cars_path = ROOT / f"src/data/cars/cars{tag}.ts"
    tracks_path = ROOT / f"src/data/tracks/tracks{tag}.ts"
    driver_market_path = ROOT / f"src/data/market/driverMarket{tag}.ts"
    youth_path = ROOT / f"src/data/market/youthProspects{tag}.ts"

    ensure_dir(season_path.parent)
    ensure_dir(teams_path.parent)
    ensure_dir(drivers_path.parent)
    ensure_dir(cars_path.parent)
    ensure_dir(tracks_path.parent)
    ensure_dir(driver_market_path.parent)

    track_ids = list(tracks.keys())

    # Track file
    track_lines = [
        f"// AUTO-GENERATED by scripts/gen_aow_seasons.py for {year} {series}.",
        "import type { Track } from '../../types/gameTypes';",
        "",
        f"export const tracks{tag}: Track[] = [",
    ]
    for track in tracks.values():
        setup = setup_profile(str(track["Archetype"]))
        track_lines.extend(
            [
                "  {",
                f"    id: {ts_str(track['TrackId'])},",
                f"    name: {ts_str(track['Track'])},",
                f"    gpName: {ts_str(track['Track'])},",
                f"    archetype: {ts_str(track['Archetype'])},",
                "    attributes: {",
                f"      corners: {ts_num(track['Corners'])},",
                f"      braking: {ts_num(track['Braking'])},",
                f"      straights: {ts_num(track['Straights'])},",
                f"      tractionAcceleration: {ts_num(track['Traction'])},",
                f"      elevationBlindCorners: {ts_num(track['Elevation Blind'])},",
                f"      technical: {ts_num(track['Technical'])},",
                f"      overtakingRacecraft: {ts_num(track['Overtaking'])},",
                f"      surfaceGripBumpiness: {ts_num(track['Surface Bumpiness'])},",
                f"      riskWallProximity: {ts_num(track['Risk Wall'])},",
                f"      enduranceConsistency: {ts_num(track['Endurance'])},",
                "    },",
                "    setupProfile: {",
                f"      primarySetupProfile: {ts_str(setup['primarySetupProfile'])},",
                f"      downforceLevel: {ts_str(setup['downforceLevel'])},",
                f"      topSpeedEmphasis: {ts_num(setup['topSpeedEmphasis'])},",
                f"      mechanicalGripEmphasis: {ts_num(setup['mechanicalGripEmphasis'])},",
                f"      brakeDemand: {ts_num(setup['brakeDemand'])},",
                f"      reliabilityRiskFocus: {ts_num(setup['reliabilityRiskFocus'])},",
                f"      strategyNotes: {ts_str(setup['strategyNotes'])},",
                f"      aeroDemand: {ts_num(setup['aeroDemand'])},",
                f"      powerDemand: {ts_num(setup['powerDemand'])},",
                f"      mechanicalDemand: {ts_num(setup['mechanicalDemand'])},",
                f"      riskDemand: {ts_num(setup['riskDemand'])},",
                "    },",
                f"    ratingNotes: {ts_str(track.get('RatingNotes') or ('AOW venue library: ' + str(track['Track'])))},",
                "  },",
            ]
        )
    track_lines.append("];")
    track_path = tracks_path
    track_path.write_text("\n".join(track_lines))

    # Season calendar
    season_lines = [
        f"// AUTO-GENERATED by scripts/gen_aow_seasons.py for {year} {series}.",
        "import type { Race, Season } from '../../types/gameTypes';",
        "",
        f"export const calendar{tag}: Race[] = [",
    ]
    for r in calendar_rows:
        season_lines.extend(
            [
                "  {",
                f"    id: {ts_str(r['id'])},",
                f"    round: {r['round']},",
                f"    gpName: {ts_str(r['gpName'])},",
                f"    trackId: {ts_str(r['trackId'])},",
                f"    trackName: {ts_str(r['trackName'])},",
                f"    laps: {r['laps']},",
                f"    distanceKm: {ts_num(r['distanceKm'], 1)},",
                "    completed: false,",
                "  },",
            ]
        )
    season_lines.extend(
        [
            "];",
            "",
            f"export const season{tag}: Season = {{",
            f"  id: {ts_str(season_id(year, series))},",
            f"  year: {year},",
            f"  name: {ts_str(season_series_label(year, series))},",
            f"  series: {ts_str(series)},",
            f"  calendar: calendar{tag},",
            f"  pointsSystemId: {ts_str(points_id)},",
            f"  regulationSetId: {ts_str(reg_id)},",
            "};",
        ]
    )
    season_path.write_text("\n".join(season_lines))

    # Teams
    team_lines = [
        f"// AUTO-GENERATED by scripts/gen_aow_seasons.py for {year} {series}.",
        "import type { Team } from '../../types/gameTypes';",
        "",
        f"export const teams{tag}: Team[] = [",
    ]
    for team in teams:
        ratings = team["ratings"]
        rep = clamp(40 + len(team["driver_ids"]) * 6 + team["ratings"]["pitCrewOperations"] * 4, 15, 98)
        race_ops = clamp((team["ratings"]["pitCrewOperations"] + team["ratings"]["reliability"]) / 2, 3.5, 9.8)
        diff = "Easy" if rep > 80 else "Medium" if rep > 60 else "Hard" if rep > 40 else "Very Hard"
        team_lines.extend(
            [
                "  {",
                f"    id: {ts_str(team_id(year, series, team['team']))},",
                f"    name: {ts_str(team['team'])},",
                f"    shortName: {ts_str(team_short_name(team['team']))},",
                f"    carId: {ts_str(car_id(year, series, team['team']))},",
                f"    driverIds: [{', '.join(ts_str(d) for d in team['driver_ids'])}],",
                f"    budget: {ts_num(20 + rep * 0.6, 1)},",
                f"    reputation: {int(round(rep))},",
                f"    raceOperations: {ts_num(race_ops)},",
                "    morale: 65,",
                f"    expectedStanding: {min(99, max(1, int(round(100 - rep / 1.6))))},",
                f"    difficulty: {ts_str(diff)},",
                f"    color: {ts_str(accent_color(team['team']))},",
                "  },",
            ]
        )
    team_lines.append("];")
    teams_path.write_text("\n".join(team_lines))

    # Cars
    car_lines = [
        f"// AUTO-GENERATED by scripts/gen_aow_seasons.py for {year} {series}.",
        "import type { Car } from '../../types/gameTypes';",
        "",
        f"export const cars{tag}: Car[] = [",
    ]
    for team in teams:
        c = team["ratings"]
        car_lines.extend(
            [
                "  {",
                f"    id: {ts_str(car_id(year, series, team['team']))},",
                f"    teamId: {ts_str(team_id(year, series, team['team']))},",
                f"    seasonYear: {year},",
                "    ratings: {",
                f"      enginePower: {ts_num(c['enginePower'])},",
                f"      aeroEfficiency: {ts_num(c['aeroEfficiency'])},",
                f"      mechanicalGrip: {ts_num(c['mechanicalGrip'])},",
                f"      reliability: {ts_num(c['reliability'])},",
                f"      pitCrewOperations: {ts_num(c['pitCrewOperations'])},",
                "    },",
                "    condition: 100,",
                "    developmentLevel: { enginePower: 0, aeroEfficiency: 0, mechanicalGrip: 0, reliability: 0, pitCrewOperations: 0 },",
                "  },",
            ]
        )
    car_lines.append("];")
    cars_path.write_text("\n".join(car_lines))

    # Drivers
    driver_lines = [
        f"// AUTO-GENERATED by scripts/gen_aow_seasons.py for {year} {series}.",
        "import type { Driver } from '../../types/gameTypes';",
        "",
        f"export const drivers{tag}: Driver[] = [",
    ]
    for d in drivers:
        r = d["ratings"]
        driver_lines.extend(
            [
                "  {",
                f"    id: {ts_str(d['id'])},",
                f"    name: {ts_str(d['name'])},",
                f"    number: {int(d['number'])},",
                f"    age: {int(d['age'])},",
                f"    teamId: {ts_str(d['team_id'])},",
                "    ratings: {",
                f"      cornering: {ts_num(r['cornering'])},",
                f"      braking: {ts_num(r['braking'])},",
                f"      straights: {ts_num(r['straights'])},",
                f"      tractionAcceleration: {ts_num(r['tractionAcceleration'])},",
                f"      elevationBlindCorners: {ts_num(r['elevationBlindCorners'])},",
                f"      technical: {ts_num(r['technical'])},",
                f"      overtakingRacecraft: {ts_num(r['overtakingRacecraft'])},",
                f"      surfaceGripBumpiness: {ts_num(r['surfaceGripBumpiness'])},",
                f"      riskManagement: {ts_num(r['riskManagement'])},",
                f"      enduranceConsistency: {ts_num(r['enduranceConsistency'])},",
                f"      qualifying: {ts_num(r['qualifying'])},",
                f"      racePace: {ts_num(r['racePace'])},",
                f"      adaptability: {ts_num(r['adaptability'])},",
                f"      aggression: {ts_num(r['aggression'])},",
                f"      composure: {ts_num(r['composure'])},",
                f"      overall: {ts_num(r['overall'])},",
                "    },",
                "    morale: 65,",
                "    confidence: 65,",
                "    traits: [],",
                "  },",
            ]
        )
    driver_lines.append("];")
    drivers_path.write_text("\n".join(driver_lines))

    # Market drivers
    market_driver_lines = [
        f"// AUTO-GENERATED by scripts/gen_aow_seasons.py for {year} {series}.",
        "import type { MarketDriver } from '../../types/marketTypes';",
        "",
        f"export const driverMarket{tag}: MarketDriver[] = [",
    ]
    for d in market_bundle["drivers"]:
        market_driver_lines.extend(
            [
                "  {",
                f"    id: {ts_str(d['id'])},",
                f"    name: {ts_str(d['name'])},",
                f"    age: {int(d['age'])},",
                f"    nationality: {ts_str(d['nationality'])},",
                f"    context: {ts_str(d['context'])},",
                f"    marketPool: {ts_str(d['marketPool'])},",
                f"    marketStatus: {ts_str(d['marketStatus'])},",
                f"    primaryRole: {ts_str(d['primaryRole'])},",
                f"    immediateF1Eligible: {str(bool(d['immediateF1Eligible'])).lower()},",
                "    skills: {",
                f"      cornering: {ts_num(d['skills']['cornering'])},",
                f"      braking: {ts_num(d['skills']['braking'])},",
                f"      straights: {ts_num(d['skills']['straights'])},",
                f"      tractionAcceleration: {ts_num(d['skills']['tractionAcceleration'])},",
                f"      elevationBlindCorners: {ts_num(d['skills']['elevationBlindCorners'])},",
                f"      technical: {ts_num(d['skills']['technical'])},",
                f"      overtakingRacecraft: {ts_num(d['skills']['overtakingRacecraft'])},",
                f"      surfaceGripBumpiness: {ts_num(d['skills']['surfaceGripBumpiness'])},",
                f"      riskManagement: {ts_num(d['skills']['riskManagement'])},",
                f"      enduranceConsistency: {ts_num(d['skills']['enduranceConsistency'])},",
                "    },",
                f"    overall: {ts_num(d['overall'])},",
                f"    potential: {ts_num(d['potential'])},",
                f"    potentialDelta: {ts_num(d['potentialDelta'])},",
                f"    developmentRate: {ts_num(d['developmentRate'])},",
                f"    f1Readiness: {int(d['f1Readiness'])},",
                f"    salary: {ts_num(d['salary'])},",
                f"    sponsorValue: {ts_num(d['sponsorValue'])},",
                f"    buyoutCost: {ts_num(d['buyoutCost'])},",
                f"    negotiationDifficulty: {ts_str(d['negotiationDifficulty'])},",
                f"    suggestedUse: {ts_str(d['suggestedUse'])},",
                f"    notes: {ts_str(d['notes'])},",
                "  },",
            ]
        )
    market_driver_lines.append("];")
    driver_market_path.write_text("\n".join(market_driver_lines))

    # Youth prospects
    youth_lines = [
        f"// AUTO-GENERATED by scripts/gen_aow_seasons.py for {year} {series}.",
        "import type { YouthProspect } from '../../types/marketTypes';",
        "",
        f"export const youthProspects{tag}: YouthProspect[] = [",
    ]
    for yth in market_bundle["youth"]:
        youth_lines.extend(
            [
                "  {",
                f"    id: {ts_str(yth['id'])},",
                f"    name: {ts_str(yth['name'])},",
                f"    age: {int(yth['age'])},",
                f"    birthYear: {int(yth['birthYear'])},",
                f"    nationality: {ts_str(yth['nationality'])},",
                f"    currentLevel: {ts_str(yth['currentLevel'])},",
                f"    marketPool: {ts_str(yth['marketPool'])},",
                f"    marketStatus: {ts_str(yth['marketStatus'])},",
                f"    academyEligibleNow: {str(bool(yth['academyEligibleNow'])).lower()},",
                f"    earliestFullAcademyYear: {int(yth['earliestFullAcademyYear'])},",
                "    skills: {",
                f"      cornering: {ts_num(yth['skills']['cornering'])},",
                f"      braking: {ts_num(yth['skills']['braking'])},",
                f"      straights: {ts_num(yth['skills']['straights'])},",
                f"      tractionAcceleration: {ts_num(yth['skills']['tractionAcceleration'])},",
                f"      elevationBlindCorners: {ts_num(yth['skills']['elevationBlindCorners'])},",
                f"      technical: {ts_num(yth['skills']['technical'])},",
                f"      overtakingRacecraft: {ts_num(yth['skills']['overtakingRacecraft'])},",
                f"      surfaceGripBumpiness: {ts_num(yth['skills']['surfaceGripBumpiness'])},",
                f"      riskManagement: {ts_num(yth['skills']['riskManagement'])},",
                f"      enduranceConsistency: {ts_num(yth['skills']['enduranceConsistency'])},",
                "    },",
                f"    overall: {ts_num(yth['overall'])},",
                f"    potential: {ts_num(yth['potential'])},",
                f"    potentialDelta: {ts_num(yth['potentialDelta'])},",
                f"    developmentRate: {ts_num(yth['developmentRate'])},",
                f"    yearsUntilF1Ready: {int(yth['yearsUntilF1Ready'])},",
                f"    signingCost: {ts_num(yth['signingCost'])},",
                f"    yearlyAcademyCost: {ts_num(yth['yearlyAcademyCost'])},",
                f"    riskLevel: {ts_str(yth['riskLevel'])},",
                f"    suggestedPath: {ts_str(yth['suggestedPath'])},",
                f"    notes: {ts_str(yth['notes'])},",
                "  },",
            ]
        )
    youth_lines.append("];")
    youth_path.write_text("\n".join(youth_lines))


def export_game_workbook(path: Path, rows: dict[str, list[dict]]) -> None:
    ensure_dir(path.parent)
    with pd.ExcelWriter(path, engine="openpyxl") as writer:
        for sheet_name in [
            "Calendar",
            "Standings",
            "Team_Entries",
            "Driver_Ratings",
            "Car_Ratings",
            "Track_Ratings",
            "Coverage",
        ]:
            frame = pd.DataFrame(rows.get(sheet_name, []))
            frame.to_excel(writer, sheet_name=sheet_name, index=False)


def append_workbook_rows(
    export_rows: dict[str, list[dict]],
    year: int,
    series: str,
    calendar_rows: list[dict],
    standings_rows: list[dict],
    team_entry_rows: list[dict],
    teams: list[dict],
    drivers: list[dict],
    tracks: dict[str, dict],
) -> None:
    for row in calendar_rows:
        export_rows["Calendar"].append(
            {
                "Season": year,
                "Series": series,
                "Round": row["round"],
                "Race Name": row["gpName"],
                "Track": row["trackName"],
                "TrackId": row["trackId"],
                "Laps": row["laps"],
                "DistanceKm": row["distanceKm"],
            }
        )

    for row in standings_rows:
        export_rows["Standings"].append(
            {
                "Season": year,
                "Series": series,
                "Driver": row["name"],
                "Team": row["team"],
                "Championship Position": row["champ_pos"],
                "Points": row["points"],
                "cornering": row["ratings"]["cornering"],
                "braking": row["ratings"]["braking"],
                "straights": row["ratings"]["straights"],
                "tractionAcceleration": row["ratings"]["tractionAcceleration"],
                "elevationBlindCorners": row["ratings"]["elevationBlindCorners"],
                "technical": row["ratings"]["technical"],
                "overtakingRacecraft": row["ratings"]["overtakingRacecraft"],
                "surfaceGripBumpiness": row["ratings"]["surfaceGripBumpiness"],
                "riskManagement": row["ratings"]["riskManagement"],
                "enduranceConsistency": row["ratings"]["enduranceConsistency"],
                "qualifying": row["ratings"]["qualifying"],
                "racePace": row["ratings"]["racePace"],
                "adaptability": row["ratings"]["adaptability"],
                "aggression": row["ratings"]["aggression"],
                "composure": row["ratings"]["composure"],
                "overall": row["ratings"]["overall"],
            }
        )

    for row in team_entry_rows:
        export_rows["Team_Entries"].append(
            {
                "Season": year,
                "Series": series,
                "Team": row["team"],
                "Car#": row["car_no"],
                "Driver": row["driver"],
                "Chassis": row["chassis"],
                "Engine": row["engine"],
            }
        )

    for team in teams:
        export_rows["Car_Ratings"].append(
            {
                "Season": year,
                "Series": series,
                "Team": team["team"],
                "enginePower": team["ratings"]["enginePower"],
                "aeroEfficiency": team["ratings"]["aeroEfficiency"],
                "mechanicalGrip": team["ratings"]["mechanicalGrip"],
                "reliability": team["ratings"]["reliability"],
                "pitCrewOperations": team["ratings"]["pitCrewOperations"],
            }
        )

    for driver in drivers:
        export_rows["Driver_Ratings"].append(
            {
                "Season": year,
                "Series": series,
                "Driver": driver["name"],
                "Team": driver["team"],
                "Championship Position": driver["champ_pos"],
                "Points": driver["points"],
                "cornering": driver["ratings"]["cornering"],
                "braking": driver["ratings"]["braking"],
                "straights": driver["ratings"]["straights"],
                "tractionAcceleration": driver["ratings"]["tractionAcceleration"],
                "elevationBlindCorners": driver["ratings"]["elevationBlindCorners"],
                "technical": driver["ratings"]["technical"],
                "overtakingRacecraft": driver["ratings"]["overtakingRacecraft"],
                "surfaceGripBumpiness": driver["ratings"]["surfaceGripBumpiness"],
                "riskManagement": driver["ratings"]["riskManagement"],
                "enduranceConsistency": driver["ratings"]["enduranceConsistency"],
                "qualifying": driver["ratings"]["qualifying"],
                "racePace": driver["ratings"]["racePace"],
                "adaptability": driver["ratings"]["adaptability"],
                "aggression": driver["ratings"]["aggression"],
                "composure": driver["ratings"]["composure"],
                "overall": driver["ratings"]["overall"],
                "Basis/Notes": driver["basis"],
            }
        )

    for track in tracks.values():
        export_rows["Track_Ratings"].append(
            {
                "Season": year,
                "Series": series,
                "Track": track["Track"],
                "TrackId": track["TrackId"],
                "Archetype": track["Archetype"],
                "corners": track["Corners"],
                "braking": track["Braking"],
                "straights": track["Straights"],
                "tractionAcceleration": track["Traction"],
                "elevationBlindCorners": track["Elevation Blind"],
                "technical": track["Technical"],
                "overtakingRacecraft": track["Overtaking"],
                "surfaceGripBumpiness": track["Surface Bumpiness"],
                "riskWallProximity": track["Risk Wall"],
                "enduranceConsistency": track["Endurance"],
            }
        )

    export_rows["Coverage"].append(
        {
            "Season": year,
            "Series": series,
            "CalendarRows": len(calendar_rows),
            "StandingsRows": len(standings_rows),
            "TeamEntriesRows": len(team_entry_rows),
            "DriverRatingsRows": len(drivers),
            "CarRatingsRows": len(teams),
            "TrackRatingsRows": len(tracks),
        }
    )


def patch_core_files() -> None:
    season_catalog = ROOT / "src/data/seasonCatalog.ts"
    catalog = season_catalog.read_text()
    if "aowAvailableSeasons" not in catalog:
        catalog = catalog.replace("import type { Series } from '../types/gameTypes';\n", "import type { Series } from '../types/gameTypes';\nimport { aowAvailableSeasons } from './aowSeasonData';\n")
        catalog = catalog.replace(
            "  { year: 2026, series: 'F1', label: '2026 Formula 1 World Championship' },\n",
            "  { year: 2026, series: 'F1', label: '2026 Formula 1 World Championship' },\n"
            "  ...aowAvailableSeasons,\n",
        )
        catalog = catalog.replace("  { year: 2007, series: 'CART', label: '2007 Champ Car World Series' },\n", "")
        season_catalog.write_text(catalog)

    season_loader = ROOT / "src/data/seasonLoader.ts"
    loader = season_loader.read_text()
    loader = loader.replace(
        "// IndyCar seasons 2008–2026\nfor (let year = 2008; year <= 2026; year++) {\n",
        "// IndyCar seasons 1996–2007 and 2008–2026\nfor (let year = 1996; year <= 2007; year++) {\n  const y = year;\n  loaders[seasonKey(y, 'IndyCar')] = makeLoader(\n    y, 'IndyCar',\n    () => import(`./seasons/season${y}IndyCar.ts`),\n    () => import(`./teams/teams${y}IndyCar.ts`),\n    () => import(`./drivers/drivers${y}IndyCar.ts`),\n    () => import(`./cars/cars${y}IndyCar.ts`),\n    () => import(`./tracks/tracks${y}IndyCar.ts`),\n  );\n}\n\n// IndyCar seasons 2008–2026\nfor (let year = 2008; year <= 2026; year++) {\n",
    )
    loader = loader.replace(
        "// CART / Champ Car seasons (pilot: 2007)\nfor (const year of [2007]) {\n",
        "// CART / Champ Car seasons 1990–2007\nfor (let year = 1990; year <= 2007; year++) {\n",
    )
    season_loader.write_text(loader)

    market_index = ROOT / "src/data/market/index.ts"
    market = market_index.read_text()
    market = market.replace(
        "// IndyCar seasons 2008–2026\nfor (let year = 2008; year <= 2026; year++) {\n",
        "// IndyCar seasons 1996–2007 and 2008–2026\nfor (let year = 1996; year <= 2007; year++) {\n  marketLoaders[`${year}-IndyCar`] = makeMarketLoader(year, 'IndyCar');\n}\n\n// IndyCar seasons 2008–2026\nfor (let year = 2008; year <= 2026; year++) {\n",
    )
    market = market.replace(
        "// CART / Champ Car seasons (pilot: 2007)\nfor (const year of [2007]) {\n",
        "// CART / Champ Car seasons 1990–2007\nfor (let year = 1990; year <= 2007; year++) {\n",
    )
    market_index.write_text(market)

    season_data = ROOT / "src/data/seasonData.ts"
    sd = season_data.read_text()
    if "aowSeasonData" not in sd:
        sd = sd.replace(
            "import { tracks2007CART } from './tracks/tracks2007CART';\n",
            "import { tracks2007CART } from './tracks/tracks2007CART';\nimport { aowSeasonBundles, aowMarketBundles, aowTracks } from './aowSeasonData';\n",
        )
        sd = sd.replace(
            "  ...tracks2024IndyCar, ...tracks2025IndyCar, ...tracks2026IndyCar,\n  ...tracks2007CART,\n]);\n",
            "  ...tracks2024IndyCar, ...tracks2025IndyCar, ...tracks2026IndyCar,\n  ...tracks2007CART,\n  ...aowTracks,\n]);\n",
        )
        sd = sd.replace(
            "  '2007-CART': { season: season2007CART, teams: teams2007CART, drivers: drivers2007CART, cars: cars2007CART },\n",
            "  '2007-CART': { season: season2007CART, teams: teams2007CART, drivers: drivers2007CART, cars: cars2007CART },\n  ...aowSeasonBundles,\n",
        )
        sd = sd.replace(
            "seedMarketBundleCache({\n  '1995-F1': { drivers: driverMarket1995, youth: youthProspects1995 },\n  '2007-CART': { drivers: driverMarket2007CART, youth: youthProspects2007CART },\n});\n",
            "seedMarketBundleCache({\n  '1995-F1': { drivers: driverMarket1995, youth: youthProspects1995 },\n  '2007-CART': { drivers: driverMarket2007CART, youth: youthProspects2007CART },\n  ...aowMarketBundles,\n});\n",
        )
        season_data.write_text(sd)

    pts = ROOT / "src/data/pointsSystems/pointsSystems.ts"
    pts_txt = pts.read_text()
    if "aowPointsSystems" not in pts_txt:
        pts_txt = pts_txt.replace(
            "import type { PointsSystem } from '../../types/gameTypes';\n",
            "import type { PointsSystem } from '../../types/gameTypes';\nimport { aowPointsSystems } from './aowPointsSystems';\n",
        )
        pts_txt = pts_txt.replace(
            "for (let _y = 2008; _y <= 2025; _y++) {\n  pointsSystems[`pts-indycar-${_y}`] = {\n    id: `pts-indycar-${_y}`,\n    name: `IndyCar ${_y} (50-40-35-...)`,\n    pointsByPosition: _indycarPoints,\n  };\n}\n\nexport function getPointsSystem(id: string): PointsSystem {\n  return pointsSystems[id] ?? pointsSystems['pts-1995'];\n}\n",
            "for (let _y = 2008; _y <= 2025; _y++) {\n  pointsSystems[`pts-indycar-${_y}`] = {\n    id: `pts-indycar-${_y}`,\n    name: `IndyCar ${_y} (50-40-35-...)`,\n    pointsByPosition: _indycarPoints,\n  };\n}\n\nObject.assign(pointsSystems, aowPointsSystems);\n\nexport function getPointsSystem(id: string): PointsSystem {\n  return pointsSystems[id] ?? pointsSystems['pts-1995'];\n}\n",
        )
        pts.write_text(pts_txt)

    regs = ROOT / "src/data/regulations/regulations.ts"
    regs_txt = regs.read_text()
    if "aowRegulations" not in regs_txt:
        regs_txt = regs_txt.replace(
            "import type { RegulationChangeEvent, RegulationSet } from '../../types/gameTypes';\n",
            "import type { RegulationChangeEvent, RegulationSet } from '../../types/gameTypes';\nimport { aowRegulations } from './aowRegulations';\n",
        )
        regs_txt = regs_txt.replace(
            "export const regulationSets: Record<string, RegulationSet> = {\n",
            "export const regulationSets: Record<string, RegulationSet> = {\n",
        )
        regs_txt = regs_txt.replace(
            "};\n\n// IndyCar 2008–2025: consistent 50-40-35-32-30-... points structure\n",
            "};\n\nObject.assign(regulationSets, aowRegulations);\n\n// IndyCar 2008–2025: consistent 50-40-35-32-30-... points structure\n",
        )
        regs.write_text(regs_txt)

    idx = ROOT / "src/data/index.ts"
    idx_txt = idx.read_text()
    if "56 seasons" in idx_txt:
        idx_txt = idx_txt.replace("Heavy historical season data (teams, drivers, cars, tracks for all 56 seasons)", "Heavy historical season data (teams, drivers, cars, tracks for all 86 seasons)")
        idx.write_text(idx_txt)

    lazy = ROOT / "src/data/lazySeasonData.ts"
    lazy_txt = lazy.read_text()
    if "56 seasons" in lazy_txt:
        lazy_txt = lazy_txt.replace("comprehensive seasonLoader.ts which covers all 56 seasons", "comprehensive seasonLoader.ts which covers all 86 seasons")
        lazy.write_text(lazy_txt)


if __name__ == "__main__":
    generate()
