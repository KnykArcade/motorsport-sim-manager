"""Apply race lap/distance corrections to existing season calendar files.

Reads Motorsport_Master_Race_Lap_Distance_Corrections.xlsx and patches the
`laps` and `distanceKm` fields on the matching Race object (keyed by RaceId)
in src/data/seasons/season<year>.ts. Only rows where ApplyToGame == 'APPLY'
are touched (per the workbook's own loader rules). Idempotent.

Usage: python3 scripts/apply_lap_distance_corrections.py [path-to-xlsx]
"""
import os
import re
import sys

import openpyxl

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEASONS = os.path.join(REPO, "src", "data", "seasons")
DEFAULT_WB = (
    "/home/ubuntu/attachments/62c5f395-3fea-4ae5-9680-c0f10021c39a/"
    "Motorsport_Master_Race_Lap_Distance_Corrections.xlsx"
)


def num(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return v
    m = re.search(r"-?\d+(\.\d+)?", str(v))
    return float(m.group(0)) if m else None


def fmt(n):
    # Emit ints without a trailing .0; keep up to 3 decimals otherwise.
    if n == int(n):
        return str(int(n))
    return ("%.3f" % n).rstrip("0").rstrip(".")


def season_file(series, year):
    tag = "" if series == "F1" else series
    return os.path.join(SEASONS, f"season{year}{tag}.ts")


def main():
    wb_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_WB
    wb = openpyxl.load_workbook(wb_path, read_only=True, data_only=True)
    ws = wb["Master_Corrections"]
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    hdr = [str(c) for c in rows[0]]
    idx = {h: i for i, h in enumerate(hdr)}

    # Group APPLY corrections by season file.
    per_file = {}
    for r in rows[1:]:
        if not r or r[idx["ApplyToGame"]] is None:
            continue
        if str(r[idx["ApplyToGame"]]).strip().upper() != "APPLY":
            continue
        series, year = r[idx["Series"]], int(num(r[idx["Year"]]))
        race_id = str(r[idx["RaceId"]]).strip()
        laps = num(r[idx["CorrectLaps"]])
        dist = num(r[idx["CorrectDistanceKm"]])
        per_file.setdefault((series, year), {})[race_id] = (laps, dist)

    total, patched = 0, 0
    for (series, year), corrections in sorted(per_file.items()):
        path = season_file(series, year)
        if not os.path.exists(path):
            print(f"!! missing {os.path.relpath(path, REPO)} — skipping {series} {year}")
            continue
        text = open(path, encoding="utf-8").read()
        n_file = 0
        for race_id, (laps, dist) in corrections.items():
            total += 1
            # Locate the race object block by its id, then patch laps/distanceKm.
            block = re.search(
                r"(\{\s*id:\s*'" + re.escape(race_id) + r"',.*?\})",
                text, re.S,
            )
            if not block:
                print(f"   ?? {race_id} not found in {os.path.basename(path)}")
                continue
            b = block.group(1)
            nb = b
            if laps is not None:
                nb = re.sub(r"laps:\s*[\d.]+", f"laps: {fmt(laps)}", nb, count=1)
            if dist is not None:
                nb = re.sub(r"distanceKm:\s*[\d.]+", f"distanceKm: {fmt(dist)}", nb, count=1)
            if nb != b:
                text = text.replace(b, nb, 1)
                n_file += 1
        if n_file:
            open(path, "w", encoding="utf-8").write(text)
            patched += n_file
        print(f"  {series} {year}: {n_file}/{len(corrections)} races patched")
    print(f"Done. {patched} races patched across {len(per_file)} seasons ({total} APPLY rows).")


if __name__ == "__main__":
    main()
