"""Print IndyCar 2008-2015 race names per round to build correct mappings."""
import re, os

ROOT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'seasons')

for year in range(2008, 2016):
    f = os.path.join(ROOT, f'season{year}IndyCar.ts')
    if not os.path.exists(f):
        continue
    content = open(f, encoding='utf-8').read()
    races = re.findall(r"\{[^}]*id:\s*'r-[^']+'[^}]*\}", content)
    print(f"\n--- IndyCar {year} ({len(races)} races) ---")
    for race in races:
        rnd = re.search(r"round:\s*(\d+)", race)
        gp = re.search(r"gpName:\s*'([^']*)'", race)
        track = re.search(r"trackName:\s*'([^']*)'", race)
        laps = re.search(r"laps:\s*(\d+)", race)
        print(f"  R{rnd.group(1) if rnd else '?'}: {gp.group(1) if gp else '?'} | {track.group(1) if track else '?'} | laps={laps.group(1) if laps else '?'}")
