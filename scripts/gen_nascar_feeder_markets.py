#!/usr/bin/env python3
"""Generate NASCAR adult/youth market seeds from historical feeder standings.

Sources:
  - race-database.com Xfinity/Busch standings (series 11)
  - race-database.com Truck standings (series 12, 1995+)
  - race-database.com Cup standings (series 2; active-seat exclusion)
  - race-database.com driver directories (birth year / nationality)

No age is guessed. Drivers without a documented birth year are written to the
QA report and omitted until their identity can be resolved.
"""

from __future__ import annotations

import argparse
import csv
import concurrent.futures
import html
import json
import re
import time
import unicodedata
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "tmp" / "nascar_feeder_research_cache"
QA_PATH = ROOT / "outputs" / "registry_cleanup" / "nascar_feeder_birth_year_gaps.csv"
SERIES = {2: "Cup", 11: "Xfinity/Busch", 12: "Truck"}
HISTORICAL_YEARS = range(1990, 2016)
USER_AGENT = "MotorsportSimManager/1.0 historical-data-import"
SOURCE_GAPS: list[dict] = []


def normalize(value: str) -> str:
    return re.sub(
        r"\s+", " ",
        re.sub(r"[^a-z0-9]+", " ", unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()),
    ).strip()


def slug(value: str) -> str:
    return normalize(value).replace(" ", "-")


def fetch(url: str, cache_name: str, refresh: bool) -> str:
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / cache_name
    if path.exists() and not refresh:
        return path.read_text(encoding="utf-8")
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    last_error: Exception | None = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                text = response.read().decode("utf-8", errors="ignore")
            break
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as error:
            last_error = error
            time.sleep(1.5 * (attempt + 1))
    else:
        raise RuntimeError(f"Failed to fetch {url}: {last_error}")
    path.write_text(text, encoding="utf-8")
    time.sleep(0.15)
    return text


def clean_cell(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", value))).strip()


def driver_directory(refresh: bool) -> dict[str, dict]:
    records: dict[str, dict] = {}
    pattern = re.compile(
        r'<tr><td><a href="?/driver/career\.php\?driver_id=([^"&>]+)"?>(.*?)</a></td>'
        r"<td>(.*?)</td><td>(.*?)</td><td>(.*?)</td></tr>",
        re.I | re.S,
    )
    for series_id in (2, 11, 12):
        url = f"https://www.race-database.com/driver/series.php?series_id={series_id}"
        text = fetch(url, f"directory-{series_id}.html", refresh)
        for driver_id, name, born, _died, country in pattern.findall(text):
            display = clean_cell(name)
            key = normalize(display)
            birth_year = int(clean_cell(born)) if re.fullmatch(r"\d{4}", clean_cell(born)) else None
            existing = records.get(key, {})
            records[key] = {
                "driverId": existing.get("driverId", driver_id),
                "name": existing.get("name", display),
                "birthYear": existing.get("birthYear") or birth_year,
                "nationality": existing.get("nationality") or clean_cell(country) or "Unknown",
                "identitySource": url,
                "careerUrl": f"https://www.race-database.com/driver/career.php?driver_id={driver_id}",
                "seriesIds": sorted(set(existing.get("seriesIds", [])) | {series_id}),
            }
    return records


def standings(year: int, series_id: int, refresh: bool) -> list[dict]:
    if series_id == 12 and year < 1995:
        return []
    url = f"https://www.race-database.com/standings/standings.php?series_id={series_id}&year={year}"
    try:
        text = fetch(url, f"standings-{series_id}-{year}.html", refresh)
    except RuntimeError as error:
        SOURCE_GAPS.append({"Season": year, "Driver": "SOURCE PAGE UNAVAILABLE", "Series": SERIES[series_id], "Source URL": url})
        print(f"WARNING: {error}")
        return []
    rows = re.findall(r"<tr>(.*?)</tr>", text, re.I | re.S)
    results: list[dict] = []
    for row in rows:
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.I | re.S)
        if len(cells) < 5:
            continue
        rank_text = clean_cell(cells[0])
        link = re.search(r"driver_id=([^\"&>]+)", cells[1])
        if not rank_text.isdigit() or not link:
            continue
        name = clean_cell(cells[1])
        numbers = [clean_cell(cell).replace(",", "") for cell in cells]
        results.append({
            "rank": int(rank_text),
            "driverId": link.group(1),
            "name": name,
            "points": int(float(numbers[2])) if re.fullmatch(r"-?\d+(?:\.\d+)?", numbers[2]) else 0,
            "starts": int(float(numbers[3])) if re.fullmatch(r"\d+(?:\.\d+)?", numbers[3]) else 0,
            "wins": int(float(numbers[5])) if len(numbers) > 5 and re.fullmatch(r"\d+(?:\.\d+)?", numbers[5]) else 0,
            "seriesId": series_id,
            "sourceUrl": url,
        })
    return results


def ratings(row: dict, field_size: int, youth: bool) -> tuple[dict, int, int]:
    rank_strength = 1 - ((row["rank"] - 1) / max(1, field_size - 1))
    activity = min(1.0, row["starts"] / 30)
    win_bonus = min(8, row["wins"] * 2)
    overall = round((38 if youth else 45) + rank_strength * 24 + activity * 8 + win_bonus)
    overall = max(35, min(88, overall))
    potential = min(99, overall + (18 if youth else 8))
    skill = {
        "cornering": overall,
        "braking": max(1, overall - 1),
        "straights": min(100, overall + 2),
        "tractionAcceleration": overall,
        "elevationBlindCorners": max(1, overall - 2),
        "technical": overall,
        "overtakingRacecraft": min(100, overall + 1),
        "surfaceGripBumpiness": overall,
        "riskManagement": max(1, overall - (3 if youth else 1)),
        "enduranceConsistency": max(1, overall - (2 if youth else 0)),
    }
    return skill, overall, potential


def ts_json(value) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2)


def modern_youth(directory: dict[str, dict], refresh: bool) -> dict[int, list[dict]]:
    """Resolve 2016-2026 minors from driver career histories.

    Race Database's aggregate standings endpoint ends after 2015, while the
    individual career histories continue to expose national-series seasons.
    Only drivers with documented birth years are queried.
    """
    directory_url = "https://nascar-reference.com/drivers?show=all"
    directory_html = fetch(directory_url, "nascar-reference-drivers.html", refresh)
    cards = re.findall(
        r'<a href="(/drivers/[^"]+)"[^>]*>.*?<h3[^>]*>(.*?)</h3>',
        directory_html,
        re.I | re.S,
    )
    # NASCAR Reference lists active drivers first (131 at source-audit time).
    # Keep a buffer for part-time national-series entrants.
    candidates = []
    seen_urls: set[str] = set()
    for path, raw_name in cards[:220]:
        url = f"https://nascar-reference.com{path}"
        if url in seen_urls:
            continue
        seen_urls.add(url)
        candidates.append({"name": clean_cell(raw_name), "careerUrl": url})

    def load(identity: dict) -> tuple[dict, str | None]:
        cache_name = f"nascar-reference-{slug(identity['name'])}.html"
        try:
            return identity, fetch(identity["careerUrl"], cache_name, refresh)
        except RuntimeError:
            return identity, None

    pools: dict[int, list[dict]] = {year: [] for year in range(2016, 2027)}
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        for identity, text in executor.map(load, candidates):
            if not text:
                continue
            birthday = re.search(r"Birthday</span>\s*<div[^>]*>(\d{2})-(\d{2})-(\d{4})</div>", text, re.I)
            if not birthday:
                continue
            identity["birthYear"] = int(birthday.group(3))
            identity["nationality"] = "USA"
            identity["identitySource"] = identity["careerUrl"]
            seasons = {int(year) for year in re.findall(r'data-sort="(20\d{2})"', text)}
            for year in sorted(seasons):
                if year not in pools:
                    continue
                age = year - identity["birthYear"]
                if not 12 <= age <= 17:
                    continue
                pools[year].append({
                    "identity": identity,
                    "seriesId": 11,
                    "age": age,
                })
    return pools


def youth_record(year: int, identity: dict, series_id: int, age: int, rank: int, field_size: int) -> dict:
    row = {"rank": rank, "starts": 1, "wins": 0}
    skills, overall, potential = ratings(row, field_size, True)
    source_url = identity["careerUrl"]
    return {
        "id": f"youth-nascar-{year}-{slug(identity['name'])}",
        "name": identity["name"],
        "age": age,
        "birthYear": identity["birthYear"],
        "nationality": identity["nationality"],
        "currentLevel": SERIES[series_id],
        "marketPool": "Shared Motorsport Youth Market",
        "marketStatus": "Academy Prospect",
        "seriesPreferences": [{"series": "NASCAR", "weight": 100}],
        "academyEligibleNow": True,
        "earliestFullAcademyYear": year,
        "skills": skills,
        "overall": overall,
        "potential": potential,
        "potentialDelta": potential - overall,
        "developmentRate": 65,
        "yearsUntilF1Ready": max(1, 18 - age),
        "signingCost": round(0.02 + potential / 100 * 0.13, 2),
        "yearlyAcademyCost": round(0.01 + potential / 100 * 0.09, 2),
        "riskLevel": "Medium",
        "suggestedPath": "NASCAR development ladder",
        "notes": f"Documented {SERIES[series_id]} participation. Source: {source_url} Identity: {identity['identitySource']}",
    }


def generate(refresh: bool) -> None:
    directory = driver_directory(refresh)
    gaps: list[dict] = []
    for year in HISTORICAL_YEARS:
        cup = standings(year, 2, refresh)
        feeder = standings(year, 11, refresh) + standings(year, 12, refresh)
        cup_names = {normalize(row["name"]) for row in cup}
        by_name: dict[str, dict] = {}
        for row in sorted(feeder, key=lambda item: (item["rank"], item["seriesId"])):
            key = normalize(row["name"])
            if key in cup_names:
                continue
            current = by_name.get(key)
            if current is None or row["points"] > current["points"]:
                by_name[key] = row

        adults: list[dict] = []
        youth_pool: list[dict] = []
        field_size = max(1, len(by_name))
        for key, row in by_name.items():
            identity = directory.get(key)
            if not identity or identity["birthYear"] is None:
                gaps.append({"Season": year, "Driver": row["name"], "Series": SERIES[row["seriesId"]], "Source URL": row["sourceUrl"]})
                continue
            age = year - identity["birthYear"]
            is_youth = 12 <= age <= 17
            if age < 12:
                continue
            skills, overall, potential = ratings(row, field_size, is_youth)
            source_note = f"{SERIES[row['seriesId']]} standings: rank {row['rank']}, {row['starts']} starts, {row['wins']} wins."
            if is_youth:
                youth_pool.append({
                    "id": f"youth-nascar-{year}-{slug(row['name'])}",
                    "name": row["name"],
                    "age": age,
                    "birthYear": identity["birthYear"],
                    "nationality": identity["nationality"],
                    "currentLevel": SERIES[row["seriesId"]],
                    "marketPool": "Shared Motorsport Youth Market",
                    "marketStatus": "Academy Prospect",
                    "seriesPreferences": [{"series": "NASCAR", "weight": 100}],
                    "academyEligibleNow": True,
                    "earliestFullAcademyYear": year,
                    "skills": skills,
                    "overall": overall,
                    "potential": potential,
                    "potentialDelta": potential - overall,
                    "developmentRate": 65,
                    "yearsUntilF1Ready": max(1, 18 - age),
                    "signingCost": round(0.02 + potential / 100 * 0.13, 2),
                    "yearlyAcademyCost": round(0.01 + potential / 100 * 0.09, 2),
                    "riskLevel": "Medium",
                    "suggestedPath": "NASCAR development ladder",
                    "notes": f"{source_note} Source: {row['sourceUrl']} Identity: {identity['identitySource']}",
                })
            else:
                adults.append({
                    "id": f"driver-market-nascar-{year}-{slug(row['name'])}",
                    "name": row["name"],
                    "age": age,
                    "nationality": identity["nationality"],
                    "context": SERIES[row["seriesId"]],
                    "marketPool": "Shared Motorsport Driver Market",
                    "marketStatus": "Available",
                    "primaryRole": "Driver",
                    "seriesPreferences": [{"series": "NASCAR", "weight": 100}],
                    "immediateF1Eligible": True,
                    "skills": skills,
                    "overall": overall,
                    "potential": potential,
                    "potentialDelta": potential - overall,
                    "developmentRate": 50,
                    "f1Readiness": max(35, overall - 5),
                    "salary": round(max(0.2, overall / 20), 2),
                    "sponsorValue": 0,
                    "buyoutCost": 0,
                    "negotiationDifficulty": "Medium",
                    "suggestedUse": "Race / reserve driver",
                    "notes": f"{source_note} Source: {row['sourceUrl']} Identity: {identity['identitySource']}",
                })

        market_path = ROOT / "src" / "data" / "market" / f"driverMarket{year}NASCAR.ts"
        youth_path = ROOT / "src" / "data" / "market" / f"youthProspects{year}NASCAR.ts"
        market_path.write_text(
            "// AUTO-GENERATED by scripts/gen_nascar_feeder_markets.py. Do not hand-edit.\n"
            "import type { MarketDriver } from '../../types/marketTypes';\n\n"
            f"export const driverMarket{year}NASCAR: MarketDriver[] = {ts_json(adults)} as const satisfies MarketDriver[];\n",
            encoding="utf-8",
        )
        youth_path.write_text(
            "// AUTO-GENERATED by scripts/gen_nascar_feeder_markets.py. Do not hand-edit.\n"
            "import type { YouthProspect } from '../../types/marketTypes';\n\n"
            f"export const youthProspects{year}NASCAR: YouthProspect[] = {ts_json(youth_pool)} as const satisfies YouthProspect[];\n",
            encoding="utf-8",
        )
        print(f"{year}: {len(adults)} adult, {len(youth_pool)} youth")

    modern = modern_youth(directory, refresh)
    for year, entries in modern.items():
        deduped: dict[str, dict] = {}
        for entry in entries:
            deduped.setdefault(normalize(entry["identity"]["name"]), entry)
        youth_pool = [
            youth_record(year, entry["identity"], entry["seriesId"], entry["age"], rank, len(deduped))
            for rank, entry in enumerate(deduped.values(), 1)
        ]
        youth_path = ROOT / "src" / "data" / "market" / f"youthProspects{year}NASCAR.ts"
        youth_path.write_text(
            "// AUTO-GENERATED by scripts/gen_nascar_feeder_markets.py. Do not hand-edit.\n"
            "import type { YouthProspect } from '../../types/marketTypes';\n\n"
            f"export const youthProspects{year}NASCAR: YouthProspect[] = {ts_json(youth_pool)} as const satisfies YouthProspect[];\n",
            encoding="utf-8",
        )
        print(f"{year}: {len(youth_pool)} modern youth")

    QA_PATH.parent.mkdir(parents=True, exist_ok=True)
    with QA_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["Season", "Driver", "Series", "Source URL"])
        writer.writeheader()
        writer.writerows(gaps + SOURCE_GAPS)
    print(f"QA gaps: {len(gaps)} identities, {len(SOURCE_GAPS)} source pages -> {QA_PATH}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true")
    generate(parser.parse_args().refresh)
