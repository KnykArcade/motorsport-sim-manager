"""Generate CART 2007 (Champ Car World Series) TypeScript seed data.

Pilot for the master-workbook import pipeline. Combines two sources:
  * PASS24 master workbook  -> calendar + track demand ratings (identity + on-track character)
  * scripts/research/cart_2007.json -> researched teams, drivers, cars (ratings)

The workbook alone has NO driver/car ratings for the new seasons, so those are
authored from real 2007 championship results (see the JSON `_meta`). Emitted
.ts files are the runtime source of truth; the spreadsheet is not read at runtime.

Usage:
    XLSX=/path/to/PASS24.xlsx python3 scripts/gen_cart_2007.py
"""
import json
import os
import re
import unicodedata

import openpyxl

XLSX = os.environ.get(
    "XLSX",
    "/home/ubuntu/attachments/beba34c7-6af4-44e5-ba27-05e42f9a1510/"
    "Motorsport_Sim_Manager_MASTER_GAME_RATINGS_WORKBOOK_PASS24_NON_WEATHER_FINAL_LOCK.xlsx",
)
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("OUT", os.path.join(HERE, "..", "src", "data"))
RESEARCH = os.path.join(HERE, "research", "cart_2007.json")

SERIES = "CART"
YEAR = 2007
SUFFIX = "CART"  # export/file suffix, matches seasonLoader convention

KM_PER_MI = 1.609344


def slug(s):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()


def ts_str(s):
    if s is None:
        s = ""
    s = str(s).replace("\xa0", " ").strip()
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"


def r1(x):
    return round(float(x) * 10) / 10


def clamp(x, lo=1.0, hi=10.0):
    return max(lo, min(hi, x))


def num(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    m = re.search(r"-?\d+(\.\d+)?", str(v))
    return float(m.group(0)) if m else None


# --------------------------------------------------------------- workbook read
def load_sheet(wb, name, header_token):
    ws = wb[name]
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    hi = next(i for i, r in enumerate(rows[:6])
              if any(str(c).strip() == header_token for c in r if c is not None))
    hdr = [str(c).strip() if c is not None else None for c in rows[hi]]
    idx = {h: i for i, h in enumerate(hdr) if h}
    data = [r for r in rows[hi + 1:] if any(c is not None for c in r)]
    return idx, data


def wb_calendar_and_tracks(wb):
    """Return (calendar rounds, track dict) for the ChampCar-scheme rows."""
    idx, data = load_sheet(wb, "IMPORT_RaceCalendar", "race_id")
    cal = {}
    for r in data:
        if r[idx["series_code"]] != SERIES or r[idx["season_year"]] != YEAR:
            continue
        tid = r[idx["track_id"]]
        if not (tid and str(tid).endswith("2007ChampCar")):
            continue
        rn = int(r[idx["round_number"]])
        cal[rn] = {h: r[i] for h, i in idx.items()}

    idx, data = load_sheet(wb, "TRACK_RATINGS_MASTER", "track_rating_id")
    tracks = {}
    for r in data:
        if r[idx["series_code"]] != SERIES or r[idx["season_year"]] != YEAR:
            continue
        tid = r[idx["track_id"]]
        if not (tid and str(tid).endswith("2007ChampCar")):
            continue
        if r[idx["corners"]] is None:
            continue
        tracks[tid] = {h: r[i] for h, i in idx.items()}
    return cal, tracks


# ------------------------------------------------------------------ emit tracks
HEADER = (
    "// AUTO-GENERATED for CART 2007 by scripts/gen_cart_2007.py.\n"
    "// Sources: PASS24 master workbook (calendar + track demand ratings) and\n"
    "// scripts/research/cart_2007.json (researched teams/drivers/cars).\n"
    "// Edit ratings here directly; this file is the runtime source of truth.\n\n"
)


def emit_tracks(tracks):
    path = os.path.join(OUT, "tracks", f"tracks{YEAR}{SUFFIX}.ts")
    with open(path, "w") as f:
        f.write(HEADER)
        f.write("import type { Track } from '../../types/gameTypes';\n\n")
        f.write(f"export const tracks{YEAR}{SUFFIX}: Track[] = [\n")
        for tid, t in tracks.items():
            corners = num(t["corners"]); braking = num(t["braking"])
            straights = num(t["straights"]); risk = num(t["risk_wall"])
            mech = num(t["mechanical_grip_emphasis"]) or 5.0
            df = str(t["downforce_level"] or "").lower()
            aero_demand = clamp((corners + (8 if "high" in df else 5 if "med" in df else 3)) / 2)
            f.write("  {\n")
            f.write(f"    id: {ts_str(tid)},\n")
            f.write(f"    name: {ts_str(t['track_name'])},\n")
            f.write(f"    gpName: {ts_str(t['track_name'])},\n")
            f.write(f"    archetype: {ts_str(t['track_archetype'] or 'Balanced Circuit')},\n")
            f.write("    attributes: {\n")
            f.write(f"      corners: {r1(corners)},\n")
            f.write(f"      braking: {r1(braking)},\n")
            f.write(f"      straights: {r1(straights)},\n")
            f.write(f"      tractionAcceleration: {r1(num(t['traction']))},\n")
            f.write(f"      elevationBlindCorners: {r1(num(t['elevation_blind']))},\n")
            f.write(f"      technical: {r1(num(t['technical']))},\n")
            f.write(f"      overtakingRacecraft: {r1(num(t['overtaking']))},\n")
            f.write(f"      surfaceGripBumpiness: {r1(num(t['surface_bumpiness']))},\n")
            f.write(f"      riskWallProximity: {r1(risk)},\n")
            f.write(f"      enduranceConsistency: {r1(num(t['endurance']))},\n")
            f.write("    },\n")
            f.write("    setupProfile: {\n")
            f.write(f"      primarySetupProfile: {ts_str(t['primary_setup_profile'] or 'Balanced Road/Street')},\n")
            f.write(f"      downforceLevel: {ts_str(t['downforce_level'] or 'Medium')},\n")
            f.write(f"      topSpeedEmphasis: {r1(num(t['top_speed_emphasis']) or 5.0)},\n")
            f.write(f"      mechanicalGripEmphasis: {r1(mech)},\n")
            f.write(f"      brakeDemand: {r1(braking)},\n")
            f.write(f"      reliabilityRiskFocus: {r1(num(t['endurance']))},\n")
            f.write("      strategyNotes: 'Champ Car spec formula (Panoz DP01 + Cosworth): setup, restarts and Push-to-Pass timing decide track position.',\n")
            f.write(f"      aeroDemand: {r1(aero_demand)},\n")
            f.write(f"      powerDemand: {r1(straights)},\n")
            f.write(f"      mechanicalDemand: {r1(mech)},\n")
            f.write(f"      riskDemand: {r1(risk)},\n")
            f.write("    },\n")
            f.write(f"    ratingNotes: {ts_str(t['notes'] or 'PASS24 workbook track demand ratings.')},\n")
            f.write("  },\n")
        f.write("];\n")
    return path


def emit_season(cal, tracks, meta):
    path = os.path.join(OUT, "seasons", f"season{YEAR}{SUFFIX}.ts")
    with open(path, "w") as f:
        f.write(HEADER)
        f.write("import type { Race, Season } from '../../types/gameTypes';\n")
        f.write(f"import {{ tracks{YEAR}{SUFFIX} }} from '../tracks/tracks{YEAR}{SUFFIX}';\n\n")
        f.write(f"export const calendar{YEAR}{SUFFIX}: Race[] = [\n")
        for rn in sorted(cal):
            c = cal[rn]
            tid = c["track_id"]
            laps = num(c["intended_scheduled_laps"])
            dist = num(c["intended_scheduled_distance_km"])
            tname = tracks.get(tid, {}).get("track_name", c["track_name"])
            f.write("  {\n")
            f.write(f"    id: {ts_str(f'r-{YEAR}-cart-{rn}')},\n")
            f.write(f"    round: {rn},\n")
            f.write(f"    gpName: {ts_str(c['race_name'])},\n")
            f.write(f"    trackId: {ts_str(tid)},\n")
            f.write(f"    trackName: {ts_str(tname)},\n")
            f.write(f"    laps: {int(laps) if laps else 60},\n")
            f.write(f"    distanceKm: {r1(dist) if dist else 'undefined'},\n")
            f.write("    completed: false,\n")
            f.write("  },\n")
        f.write("];\n\n")
        f.write(f"void tracks{YEAR}{SUFFIX};\n\n")
        f.write(f"export const season{YEAR}{SUFFIX}: Season = {{\n")
        f.write(f"  id: 's-{YEAR}-cart',\n")
        f.write(f"  year: {YEAR},\n")
        f.write(f"  name: {ts_str(meta['label'])},\n")
        f.write("  series: 'CART',\n")
        f.write(f"  calendar: calendar{YEAR}{SUFFIX},\n")
        f.write(f"  pointsSystemId: {ts_str(meta['points_system_id'])},\n")
        f.write(f"  regulationSetId: {ts_str(meta['regulation_set_id'])},\n")
        f.write("};\n")
    return path


def team_id(tslug):
    return f"t-{tslug}"


def car_id(tslug):
    return f"car-{tslug}-{YEAR}"


def driver_id(name):
    return f"d-{YEAR}{SUFFIX}-{slug(name)}"


def emit_teams(research):
    drivers = research["drivers"]
    by_team = {}
    for d in drivers:
        by_team.setdefault(d["team"], []).append(d)
    path = os.path.join(OUT, "teams", f"teams{YEAR}{SUFFIX}.ts")
    with open(path, "w") as f:
        f.write(HEADER)
        f.write("import type { Team } from '../../types/gameTypes';\n\n")
        f.write(f"export const teams{YEAR}{SUFFIX}: Team[] = [\n")
        for t in sorted(research["teams"], key=lambda x: x["expectedStanding"]):
            tslug = t["id"]
            tdrivers = sorted(by_team.get(tslug, []), key=lambda d: d["number"])
            ids = ", ".join(ts_str(driver_id(d["name"])) for d in tdrivers)
            f.write("  {\n")
            f.write(f"    id: {ts_str(team_id(tslug))},\n")
            f.write(f"    name: {ts_str(t['name'])},\n")
            f.write(f"    shortName: {ts_str(t['shortName'])},\n")
            f.write(f"    country: {ts_str(t['country'])},\n")
            f.write(f"    carId: {ts_str(car_id(tslug))},\n")
            f.write(f"    driverIds: [{ids}],\n")
            f.write(f"    budget: {int(t['budget'])},\n")
            f.write(f"    reputation: {t['reputation']},\n")
            f.write(f"    raceOperations: {r1(t['raceOperations'])},\n")
            f.write("    morale: 65,\n")
            f.write(f"    expectedStanding: {t['expectedStanding']},\n")
            f.write(f"    difficulty: {ts_str(t['difficulty'])},\n")
            f.write(f"    color: {ts_str(t['color'])},\n")
            f.write("  },\n")
        f.write("];\n")
    return path


def emit_cars(research):
    path = os.path.join(OUT, "cars", f"cars{YEAR}{SUFFIX}.ts")
    with open(path, "w") as f:
        f.write(HEADER)
        f.write("import type { Car } from '../../types/gameTypes';\n\n")
        f.write(f"export const cars{YEAR}{SUFFIX}: Car[] = [\n")
        for t in sorted(research["teams"], key=lambda x: x["expectedStanding"]):
            tslug = t["id"]
            c = t["car"]
            f.write("  {\n")
            f.write(f"    id: {ts_str(car_id(tslug))},\n")
            f.write(f"    teamId: {ts_str(team_id(tslug))},\n")
            f.write(f"    seasonYear: {YEAR},\n")
            f.write("    ratings: {\n")
            for k in ["enginePower", "aeroEfficiency", "mechanicalGrip", "reliability", "pitCrewOperations"]:
                f.write(f"      {k}: {r1(c[k])},\n")
            f.write("    },\n")
            f.write("    condition: 100,\n")
            f.write("    developmentLevel: { enginePower: 0, aeroEfficiency: 0, mechanicalGrip: 0, reliability: 0, pitCrewOperations: 0 },\n")
            f.write("  },\n")
        f.write("];\n")
    return path


def emit_drivers(research):
    path = os.path.join(OUT, "drivers", f"drivers{YEAR}{SUFFIX}.ts")
    with open(path, "w") as f:
        f.write(HEADER)
        f.write("import type { Driver } from '../../types/gameTypes';\n\n")
        f.write(f"export const drivers{YEAR}{SUFFIX}: Driver[] = [\n")
        for d in sorted(research["drivers"], key=lambda x: -x["r"]["overall"]):
            r = d["r"]
            f.write("  {\n")
            f.write(f"    id: {ts_str(driver_id(d['name']))},\n")
            f.write(f"    name: {ts_str(d['name'])},\n")
            f.write(f"    number: {d['number']},\n")
            f.write(f"    nationality: {ts_str(d['nationality'])},\n")
            f.write(f"    age: {d['age']},\n")
            f.write(f"    teamId: {ts_str(team_id(d['team']))},\n")
            f.write("    ratings: {\n")
            for k in ["cornering", "braking", "straights", "tractionAcceleration",
                      "elevationBlindCorners", "technical", "overtakingRacecraft",
                      "surfaceGripBumpiness", "riskManagement", "enduranceConsistency",
                      "qualifying", "racePace", "adaptability", "aggression",
                      "composure", "overall"]:
                f.write(f"      {k}: {r1(r[k])},\n")
            f.write("    },\n")
            f.write("    morale: 65,\n    confidence: 65,\n    traits: [],\n")
            f.write("  },\n")
        f.write("];\n")
    return path


def skills_block(base):
    """Expand a single skill anchor into the 10 MarketSkillRatings fields."""
    keys = ["cornering", "braking", "straights", "tractionAcceleration",
            "elevationBlindCorners", "technical", "overtakingRacecraft",
            "surfaceGripBumpiness", "riskManagement", "enduranceConsistency"]
    offs = [0.1, 0.0, -0.1, 0.0, -0.2, 0.0, 0.1, -0.1, -0.1, 0.1]
    return {k: r1(clamp(base + o)) for k, o in zip(keys, offs)}


def emit_market(research):
    path = os.path.join(OUT, "market", f"driverMarket{YEAR}{SUFFIX}.ts")
    with open(path, "w") as f:
        f.write(HEADER)
        f.write("import type { MarketDriver } from '../../types/marketTypes';\n\n")
        f.write(f"export const driverMarket{YEAR}{SUFFIX}: MarketDriver[] = [\n")
        for m in research.get("market", []):
            sk = skills_block(m["overall"])
            f.write("  {\n")
            f.write(f"    id: {ts_str('m-' + str(YEAR) + SUFFIX + '-' + slug(m['name']))},\n")
            f.write(f"    name: {ts_str(m['name'])},\n")
            f.write(f"    age: {m['age']},\n")
            f.write(f"    nationality: {ts_str(m['nationality'])},\n")
            f.write(f"    context: {ts_str(m['context'])},\n")
            f.write("    marketPool: 'Champ Car',\n    marketStatus: 'Available',\n")
            f.write(f"    primaryRole: {ts_str(m['role'])},\n")
            f.write("    immediateF1Eligible: false,\n")
            f.write("    skills: {\n")
            for k, v in sk.items():
                f.write(f"      {k}: {v},\n")
            f.write("    },\n")
            f.write(f"    overall: {r1(m['overall'])},\n")
            f.write(f"    potential: {r1(m['potential'])},\n")
            f.write(f"    potentialDelta: {r1(m['potential'] - m['overall'])},\n")
            f.write("    developmentRate: 5.0,\n    f1Readiness: 40,\n")
            f.write(f"    salary: {r1(0.3 + m['overall'] * 0.15)},\n")
            f.write("    sponsorValue: 0.5,\n")
            f.write(f"    buyoutCost: {r1(0.5 + m['overall'] * 0.2)},\n")
            f.write("    negotiationDifficulty: 'Low',\n")
            f.write("    suggestedUse: 'Mid-season substitute or reserve driver.',\n")
            f.write("    notes: 'Real 2007 Champ Car part-time / substitute entrant.',\n")
            f.write("  },\n")
        f.write("];\n")

    path2 = os.path.join(OUT, "market", f"youthProspects{YEAR}{SUFFIX}.ts")
    with open(path2, "w") as f:
        f.write(HEADER)
        f.write("import type { YouthProspect } from '../../types/marketTypes';\n\n")
        f.write(f"export const youthProspects{YEAR}{SUFFIX}: YouthProspect[] = [\n")
        for y in research.get("youth", []):
            sk = skills_block(y["overall"])
            f.write("  {\n")
            f.write(f"    id: {ts_str('y-' + str(YEAR) + SUFFIX + '-' + slug(y['name']))},\n")
            f.write(f"    name: {ts_str(y['name'])},\n")
            f.write(f"    age: {y['age']},\n")
            f.write(f"    birthYear: {YEAR - y['age']},\n")
            f.write(f"    nationality: {ts_str(y['nationality'])},\n")
            f.write(f"    currentLevel: {ts_str(y['level'])},\n")
            f.write("    marketPool: 'Atlantic Championship',\n    marketStatus: 'Prospect',\n")
            f.write("    academyEligibleNow: true,\n")
            f.write(f"    earliestFullAcademyYear: {YEAR},\n")
            f.write("    skills: {\n")
            for k, v in sk.items():
                f.write(f"      {k}: {v},\n")
            f.write("    },\n")
            f.write(f"    overall: {r1(y['overall'])},\n")
            f.write(f"    potential: {r1(y['potential'])},\n")
            f.write(f"    potentialDelta: {r1(y['potential'] - y['overall'])},\n")
            f.write("    developmentRate: 6.5,\n    yearsUntilF1Ready: 2,\n")
            f.write("    signingCost: 0,\n    yearlyAcademyCost: 0,\n")
            f.write("    riskLevel: 'Medium',\n")
            f.write("    suggestedPath: 'Atlantic Championship graduate; develop toward a Champ Car seat.',\n")
            f.write("    notes: 'Real 2007 Atlantic Championship front-runner.',\n")
            f.write("  },\n")
        f.write("];\n")
    return [path, path2]


def main():
    wb = openpyxl.load_workbook(XLSX, data_only=True, read_only=True)
    research = json.load(open(RESEARCH))
    meta = research["_meta"]
    cal, tracks = wb_calendar_and_tracks(wb)
    written = [
        emit_tracks(tracks),
        emit_season(cal, tracks, meta),
        emit_teams(research),
        emit_cars(research),
        emit_drivers(research),
        *emit_market(research),
    ]
    print(f"CART {YEAR}: {len(tracks)} tracks, {len(cal)} races, "
          f"{len(research['teams'])} teams, {len(research['drivers'])} drivers")
    for w in written:
        print("  wrote", os.path.relpath(w, OUT))


if __name__ == "__main__":
    main()
