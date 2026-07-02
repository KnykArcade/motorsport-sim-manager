"""Fix F1 2023 calendar - Imola was cancelled so rounds are shifted.
The previous fix script assumed Imola was round 6, but the TS file
has Monaco as round 6 (Imola removed)."""
import re, os

ROOT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'seasons')

# Correct 2023 F1 calendar (Imola cancelled, 22 races)
F1_2023 = {
    1: (57, 308.2),    # Bahrain
    2: (50, 308.5),    # Saudi Arabian
    3: (58, 306.1),    # Australian
    4: (51, 306.0),    # Azerbaijan
    5: (57, 308.3),    # Miami
    6: (78, 260.3),    # Monaco
    7: (66, 307.2),    # Spanish
    8: (70, 305.3),    # Canadian
    9: (71, 306.5),    # Austrian
    10: (52, 306.2),   # British
    11: (70, 306.6),   # Hungarian
    12: (44, 308.1),   # Belgian
    13: (72, 306.6),   # Dutch
    14: (53, 306.7),   # Italian
    15: (62, 306.1),   # Singapore
    16: (53, 307.5),   # Japanese
    17: (57, 308.6),   # Qatar
    18: (56, 308.7),   # US
    19: (71, 305.4),   # Mexico City
    20: (71, 305.9),   # Sao Paulo
    21: (50, 310.0),   # Las Vegas
    22: (58, 306.2),   # Abu Dhabi
}

f = os.path.join(ROOT, 'season2023.ts')
content = open(f, encoding='utf-8').read()
changes = []

def fix_race(match):
    full = match.group(0)
    rnd_match = re.search(r"round:\s*(\d+)", full)
    if not rnd_match:
        return full
    rnd = int(rnd_match.group(1))
    if rnd not in F1_2023:
        return full
    new_laps, new_dist = F1_2023[rnd]
    old_laps_match = re.search(r"laps:\s*(\d+)", full)
    old_laps = int(old_laps_match.group(1)) if old_laps_match else 0
    old_dist_match = re.search(r"distanceKm:\s*([\d.]+|undefined)", full)
    old_dist = old_dist_match.group(1) if old_dist_match else 'undefined'
    changed = False
    if new_laps != old_laps:
        full = re.sub(r"laps:\s*\d+", f"laps: {new_laps}", full)
        changed = True
    if str(new_dist) != str(old_dist):
        full = re.sub(r"distanceKm:\s*[\d.]+|distanceKm:\s*undefined", f"distanceKm: {new_dist}", full)
        changed = True
    if changed:
        gp = re.search(r"gpName:\s*'([^']*)'", full)
        gp_name = gp.group(1) if gp else '?'
        changes.append(f"  2023 R{rnd} ({gp_name}): laps {old_laps}->{new_laps}, dist {old_dist}->{new_dist}")
    return full

new_content = re.sub(r"\{[^}]*id:\s*'r-\d+-\d+'[^}]*\}", fix_race, content)
if new_content != content:
    open(f, 'w', encoding='utf-8').write(new_content)
    for c in changes:
        print(c)
else:
    print("  2023: no changes needed")

print("\nDone.")
