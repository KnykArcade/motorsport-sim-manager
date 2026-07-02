"""Full audit of F1 and IndyCar season data for:
1. Mid-season driver swaps (same driver on multiple teams' starting rosters)
2. Wrong/zero lap counts and distanceKm
3. Duplicate track IDs within track files
4. Date-like gpName values
5. Unresolvable track/driver/team references
"""
import re, os, glob, json
from collections import Counter, defaultdict

ROOT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data')

def find_field(content, pattern):
    return re.findall(pattern, content)

# ── 1. Mid-season driver swaps ──
print("=" * 70)
print("1. MID-SEASON DRIVER SWAPS (same driver on multiple teams' rosters)")
print("=" * 70)

for year in range(1990, 2027):
    f = os.path.join(ROOT, 'teams', f'teams{year}.ts')
    if not os.path.exists(f):
        continue
    content = open(f, encoding='utf-8').read()
    # Extract team blocks with their driverIds
    team_blocks = re.findall(r"\{[^}]*id:\s*'t-[^']+'[^}]*\}", content)
    driver_to_teams = defaultdict(list)
    for block in team_blocks:
        tid_match = re.search(r"id:\s*'([^']+)'", block)
        if not tid_match:
            continue
        tid = tid_match.group(1)
        dids = re.findall(r"driverIds:\s*\[([^\]]*)\]", block)
        if dids:
            for did in re.findall(r"'([^']+)'", dids[0]):
                driver_to_teams[did].append(tid)
    
    swaps = {d: teams for d, teams in driver_to_teams.items() if len(teams) > 1}
    if swaps:
        for did, teams in sorted(swaps.items()):
            print(f"  {year} F1: {did} on teams: {', '.join(teams)}")

# ── 2. Calendar laps and distanceKm audit ──
print("\n" + "=" * 70)
print("2. CALENDAR LAPS/DISTANCE AUDIT")
print("=" * 70)

# F1
print("\n--- F1 ---")
for year in range(1990, 2027):
    f = os.path.join(ROOT, 'seasons', f'season{year}.ts')
    if not os.path.exists(f):
        continue
    content = open(f, encoding='utf-8').read()
    # Extract race blocks
    races = re.findall(r"\{[^}]*id:\s*'r-\d+-\d+'[^}]*\}", content)
    issues = []
    for race in races:
        rnd = re.search(r"round:\s*(\d+)", race)
        gp = re.search(r"gpName:\s*'([^']*)'", race)
        laps = re.search(r"laps:\s*(\d+)", race)
        dist = re.search(r"distanceKm:\s*([\d.]+|undefined)", race)
        track = re.search(r"trackName:\s*'([^']*)'", race)
        
        rnd_num = rnd.group(1) if rnd else '?'
        gp_name = gp.group(1) if gp else '?'
        laps_val = int(laps.group(1)) if laps else 0
        dist_val = dist.group(1) if dist else 'missing'
        track_name = track.group(1) if track else '?'
        
        if laps_val == 0:
            issues.append(f"  {year} R{rnd_num} {gp_name}: laps=0")
        if dist_val == 'undefined' or dist_val == 'missing':
            issues.append(f"  {year} R{rnd_num} {gp_name}: distanceKm={dist_val}")
        # Check for date-like gpName
        if re.match(r'\d{4}-\d{2}-\d{2}', gp_name) or re.match(r'\d{1,2}/\d{1,2}/\d{2,4}', gp_name):
            issues.append(f"  {year} R{rnd_num} gpName is date-like: {gp_name}")
    
    if issues:
        for iss in issues:
            print(iss)

# IndyCar
print("\n--- IndyCar ---")
for year in range(2008, 2027):
    f = os.path.join(ROOT, 'seasons', f'season{year}IndyCar.ts')
    if not os.path.exists(f):
        continue
    content = open(f, encoding='utf-8').read()
    races = re.findall(r"\{[^}]*id:\s*'r-[^']+'[^}]*\}", content)
    issues = []
    for race in races:
        rnd = re.search(r"round:\s*(\d+)", race)
        gp = re.search(r"gpName:\s*'([^']*)'", race)
        laps = re.search(r"laps:\s*(\d+)", race)
        dist = re.search(r"distanceKm:\s*([\d.]+|undefined)", race)
        track = re.search(r"trackName:\s*'([^']*)'", race)
        
        rnd_num = rnd.group(1) if rnd else '?'
        gp_name = gp.group(1) if gp else '?'
        laps_val = int(laps.group(1)) if laps else 0
        dist_val = dist.group(1) if dist else 'missing'
        track_name = track.group(1) if track else '?'
        
        if laps_val == 0:
            issues.append(f"  {year} R{rnd_num} {gp_name}: laps=0")
        if dist_val == 'undefined' or dist_val == 'missing':
            issues.append(f"  {year} R{rnd_num} {gp_name}: distanceKm={dist_val}")
        if re.match(r'\d{4}-\d{2}-\d{2}', gp_name) or re.match(r'\d{1,2}/\d{1,2}/\d{2,4}', gp_name):
            issues.append(f"  {year} R{rnd_num} gpName is date-like: {gp_name}")
    
    if issues:
        for iss in issues:
            print(iss)

# ── 3. Duplicate track IDs ──
print("\n" + "=" * 70)
print("3. DUPLICATE TRACK IDs WITHIN TRACK FILES")
print("=" * 70)

for year in range(1990, 2027):
    for pattern in [f'tracks{year}.ts', f'tracks{year}IndyCar.ts']:
        f = os.path.join(ROOT, 'tracks', pattern)
        if not os.path.exists(f):
            continue
        content = open(f, encoding='utf-8').read()
        ids = re.findall(r"id:\s*'([^']+)'", content)
        dupes = {tid: count for tid, count in Counter(ids).items() if count > 1}
        if dupes:
            for tid, count in dupes.items():
                print(f"  {pattern}: trackId '{tid}' appears {count} times")

# ── 4. Print all F1 race details for manual review ──
print("\n" + "=" * 70)
print("4. ALL F1 RACE DETAILS (for manual review of known-bad examples)")
print("=" * 70)

for year in [2020, 2025]:
    f = os.path.join(ROOT, 'seasons', f'season{year}.ts')
    if not os.path.exists(f):
        continue
    content = open(f, encoding='utf-8').read()
    races = re.findall(r"\{[^}]*id:\s*'r-\d+-\d+'[^}]*\}", content)
    print(f"\n--- F1 {year} ---")
    for race in races:
        rnd = re.search(r"round:\s*(\d+)", race)
        gp = re.search(r"gpName:\s*'([^']*)'", race)
        laps = re.search(r"laps:\s*(\d+)", race)
        dist = re.search(r"distanceKm:\s*([\d.]+|undefined)", race)
        track = re.search(r"trackName:\s*'([^']*)'", race)
        print(f"  R{rnd.group(1) if rnd else '?'}: {gp.group(1) if gp else '?'} | {track.group(1) if track else '?'} | laps={laps.group(1) if laps else '?'} | dist={dist.group(1) if dist else '?'}")

# ── 5. Print IndyCar race details for known-bad examples ──
print("\n" + "=" * 70)
print("5. INDYCAR RACE DETAILS (for known-bad examples)")
print("=" * 70)

for year in [2009, 2012, 2013, 2014]:
    f = os.path.join(ROOT, 'seasons', f'season{year}IndyCar.ts')
    if not os.path.exists(f):
        continue
    content = open(f, encoding='utf-8').read()
    races = re.findall(r"\{[^}]*id:\s*'r-[^']+'[^}]*\}", content)
    print(f"\n--- IndyCar {year} ---")
    for race in races:
        rnd = re.search(r"round:\s*(\d+)", race)
        gp = re.search(r"gpName:\s*'([^']*)'", race)
        laps = re.search(r"laps:\s*(\d+)", race)
        dist = re.search(r"distanceKm:\s*([\d.]+|undefined)", race)
        track = re.search(r"trackName:\s*'([^']*)'", race)
        print(f"  R{rnd.group(1) if rnd else '?'}: {gp.group(1) if gp else '?'} | {track.group(1) if track else '?'} | laps={laps.group(1) if laps else '?'} | dist={dist.group(1) if dist else '?'}")

print("\n\nAudit complete.")
