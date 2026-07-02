"""Verify known IndyCar regression values are correct."""
import re, os

ROOT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'seasons')

CHECKS = [
    (2009, 9, 60, "Watkins Glen"),
    (2012, 10, 85, "Toronto"),
    (2013, 11, 160, "Pocono"),
    (2014, 11, 200, "Pocono 500"),
]

for year, rnd, expected_laps, name in CHECKS:
    f = os.path.join(ROOT, f'season{year}IndyCar.ts')
    content = open(f, encoding='utf-8').read()
    races = re.findall(r"\{[^}]*id:\s*'r-[^']+'[^}]*\}", content)
    for race in races:
        r = re.search(r"round:\s*(\d+)", race)
        if r and int(r.group(1)) == rnd:
            laps = re.search(r"laps:\s*(\d+)", race)
            gp = re.search(r"gpName:\s*'([^']*)'", race)
            actual = int(laps.group(1)) if laps else 0
            status = "OK" if actual == expected_laps else f"WRONG (expected {expected_laps})"
            print(f"  {year} R{rnd} {name}: laps={actual} -> {status}")
            break
