"""Verify known F1 regression values are correct."""
import re, os

ROOT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'seasons')

CHECKS = [
    (2020, 1, 71, "Austrian GP"),
    (2025, 6, 57, "Miami GP"),
    (2025, 8, 78, "Monaco GP"),
]

for year, rnd, expected_laps, name in CHECKS:
    f = os.path.join(ROOT, f'season{year}.ts')
    content = open(f, encoding='utf-8').read()
    races = re.findall(r"\{[^}]*id:\s*'r-\d+-\d+'[^}]*\}", content)
    for race in races:
        r = re.search(r"round:\s*(\d+)", race)
        if r and int(r.group(1)) == rnd:
            laps = re.search(r"laps:\s*(\d+)", race)
            gp = re.search(r"gpName:\s*'([^']*)'", race)
            actual = int(laps.group(1)) if laps else 0
            status = "OK" if actual == expected_laps else f"WRONG (expected {expected_laps})"
            print(f"  {year} R{rnd} {name}: laps={actual} -> {status}")
            break
