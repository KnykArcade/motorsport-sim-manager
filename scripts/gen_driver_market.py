"""Generate TypeScript seed data for the 1995 driver market and youth academy.

Run once to (re)produce src/data/market/*.ts from the Driver Market workbook.
The Excel file is NOT parsed at runtime; this is a build-time conversion kept for
reproducibility.

Usage:
    XLSX=/path/to/F1_1995_Driver_Market_Expanded.xlsx python3 scripts/gen_driver_market.py
"""
import os
import re
import unicodedata

import openpyxl

XLSX = os.environ.get(
    "XLSX",
    "/home/ubuntu/attachments/5c330f12-a73d-483b-8a08-b203c724fa37/"
    "cUserstnickOneDriveDesktopF1_RatingF1_1995_Driver_Market_Expanded.xlsx",
)
OUT = os.environ.get("OUT", "/home/ubuntu/repos/motorsport-sim-manager/src/data/market")


def num(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return v
    s = str(v).replace("\xa0", "").strip()
    try:
        return float(s) if "." in s else int(s)
    except ValueError:
        return None


def slug(s):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s


def ts(v):
    if v is None:
        return "0"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    s = str(v).replace("\\", "\\\\").replace("'", "\\'").strip()
    return f"'{s}'"


def yesno(v):
    return str(v).strip().lower() in ("yes", "true", "y")


def skills(row, base):
    """Map the 10 driving-skill columns (starting at index `base`) to TS."""
    keys = [
        "cornering", "braking", "straights", "tractionAcceleration",
        "elevationBlindCorners", "technical", "overtakingRacecraft",
        "surfaceGripBumpiness", "riskManagement", "enduranceConsistency",
    ]
    parts = []
    for i, k in enumerate(keys):
        parts.append(f"{k}: {num(row[base + i]) or 0}")
    return "{ " + ", ".join(parts) + " }"


def rows_of(wb, sheet, header_row=2):
    ws = wb[sheet]
    rows = list(ws.iter_rows(values_only=True))
    return [r for r in rows[header_row + 1:] if r[0]]


def gen_senior(wb):
    rows = rows_of(wb, "Driver_Market")
    out = [
        "// AUTO-GENERATED from F1_1995_Driver_Market_Expanded.xlsx by",
        "// scripts/gen_driver_market.py. Edit ratings here directly.",
        "",
        "import type { MarketDriver } from '../../types/marketTypes';",
        "",
        "export const driverMarket1995: MarketDriver[] = [",
    ]
    for r in rows:
        out.append("  {")
        out.append(f"    id: 'mkt-{slug(r[0])}',")
        out.append(f"    name: {ts(r[0])},")
        out.append(f"    age: {num(r[1]) or 0},")
        out.append(f"    nationality: {ts(r[2])},")
        out.append(f"    context: {ts(r[3])},")
        out.append(f"    marketPool: {ts(r[4])},")
        out.append(f"    marketStatus: {ts(r[5])},")
        out.append(f"    primaryRole: {ts(r[6])},")
        out.append(f"    immediateF1Eligible: {ts(yesno(r[7]))},")
        out.append(f"    skills: {skills(r, 8)},")
        out.append(f"    overall: {num(r[18]) or 0},")
        out.append(f"    potential: {num(r[19]) or 0},")
        out.append(f"    potentialDelta: {num(r[20]) or 0},")
        out.append(f"    developmentRate: {num(r[21]) or 0},")
        out.append(f"    f1Readiness: {num(r[22]) or 0},")
        out.append(f"    salary: {num(r[23]) or 0},")
        out.append(f"    sponsorValue: {num(r[24]) or 0},")
        out.append(f"    buyoutCost: {num(r[25]) or 0},")
        out.append(f"    negotiationDifficulty: {ts(r[26])},")
        out.append(f"    suggestedUse: {ts(r[27])},")
        out.append(f"    notes: {ts(r[28])},")
        out.append("  },")
    out.append("];")
    out.append("")
    return "\n".join(out)


def gen_youth(wb):
    rows = rows_of(wb, "Youth_Prospects_U18")
    out = [
        "// AUTO-GENERATED from F1_1995_Driver_Market_Expanded.xlsx by",
        "// scripts/gen_driver_market.py. Edit ratings here directly.",
        "",
        "import type { YouthProspect } from '../../types/marketTypes';",
        "",
        "export const youthProspects1995: YouthProspect[] = [",
    ]
    for r in rows:
        out.append("  {")
        out.append(f"    id: 'yth-{slug(r[0])}',")
        out.append(f"    name: {ts(r[0])},")
        out.append(f"    age: {num(r[1]) or 0},")
        out.append(f"    birthYear: {num(r[2]) or 0},")
        out.append(f"    nationality: {ts(r[3])},")
        out.append(f"    currentLevel: {ts(r[4])},")
        out.append(f"    marketPool: {ts(r[5])},")
        out.append(f"    marketStatus: {ts(r[6])},")
        out.append(f"    academyEligibleNow: {ts(yesno(r[7]))},")
        out.append(f"    earliestFullAcademyYear: {num(r[8]) or 0},")
        out.append(f"    skills: {skills(r, 9)},")
        out.append(f"    overall: {num(r[19]) or 0},")
        out.append(f"    potential: {num(r[20]) or 0},")
        out.append(f"    potentialDelta: {num(r[21]) or 0},")
        out.append(f"    developmentRate: {num(r[22]) or 0},")
        out.append(f"    yearsUntilF1Ready: {num(r[23]) or 0},")
        out.append(f"    signingCost: {num(r[24]) or 0},")
        out.append(f"    yearlyAcademyCost: {num(r[25]) or 0},")
        out.append(f"    riskLevel: {ts(r[26])},")
        out.append(f"    suggestedPath: {ts(r[27])},")
        out.append(f"    notes: {ts(r[28])},")
        out.append("  },")
    out.append("];")
    out.append("")
    return "\n".join(out)


def main():
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "driverMarket1995.ts"), "w") as fh:
        fh.write(gen_senior(wb))
    with open(os.path.join(OUT, "youthProspects1995.ts"), "w") as fh:
        fh.write(gen_youth(wb))
    print("Wrote driverMarket1995.ts and youthProspects1995.ts to", OUT)


if __name__ == "__main__":
    main()
