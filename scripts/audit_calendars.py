import re, os

# F1 calendar audit
print("=== F1 Calendar Audit ===")
for y in range(2016, 2026):
    f = f'src/data/seasons/season{y}.ts'
    if not os.path.exists(f):
        continue
    content = open(f, encoding='utf-8').read()
    laps_zero = len(re.findall(r'laps: 0[,\s]', content))
    dist_undef = len(re.findall(r'distanceKm: undefined', content))
    total_races = len(re.findall(r'trackId:', content))
    print(f'{y}: {total_races} races, {laps_zero} with laps:0, {dist_undef} with distanceKm:undefined')

# IndyCar calendar audit
print("\n=== IndyCar Calendar Audit ===")
for y in range(2008, 2027):
    f = f'src/data/seasons/season{y}IndyCar.ts'
    if not os.path.exists(f):
        continue
    content = open(f, encoding='utf-8').read()
    laps_zero = len(re.findall(r'laps: 0[,\s]', content))
    dist_undef = len(re.findall(r'distanceKm: undefined', content))
    total_races = len(re.findall(r'trackId:', content))
    gpnames = re.findall(r"gpName: '([^']+)'", content)
    date_like = [g for g in gpnames if re.match(r'\d{4}-\d{2}-\d{2}', g) or re.match(r'\d{1,2}/\d{1,2}/\d{2,4}', g)]
    print(f'{y} IndyCar: {total_races} races, {laps_zero} laps:0, {dist_undef} dist:undef, {len(date_like)} date-like gpNames')
    if date_like:
        print(f'  Date gpNames: {date_like[:5]}')

# Duplicate track ID audit
print("\n=== Duplicate Track ID Audit ===")
from collections import Counter

# F1 tracks
for y in range(1990, 2027):
    f = f'src/data/tracks/tracks{y}.ts'
    if not os.path.exists(f):
        continue
    content = open(f, encoding='utf-8').read()
    ids = re.findall(r"id: '([^']+)'", content)
    counts = Counter(ids)
    dups = {k: v for k, v in counts.items() if v > 1}
    if dups:
        print(f'F1 {y}: duplicate track IDs: {dups}')

# IndyCar tracks
for y in range(2008, 2027):
    f = f'src/data/tracks/tracks{y}IndyCar.ts'
    if not os.path.exists(f):
        continue
    content = open(f, encoding='utf-8').read()
    ids = re.findall(r"id: '([^']+)'", content)
    counts = Counter(ids)
    dups = {k: v for k, v in counts.items() if v > 1}
    if dups:
        print(f'IndyCar {y}: duplicate track IDs: {dups}')

# 1997 Trulli teamId check
print("\n=== 1997 Trulli teamId ===")
f = 'src/data/drivers/drivers1997.ts'
if os.path.exists(f):
    content = open(f, encoding='utf-8').read()
    trulli_section = [line for line in content.split('\n') if 'trulli' in line.lower()]
    for line in trulli_section:
        print(f'  {line.strip()}')

# regulationSetId audit
print("\n=== regulationSetId Audit ===")
for y in range(1990, 2027):
    f = f'src/data/seasons/season{y}.ts'
    if not os.path.exists(f):
        continue
    content = open(f, encoding='utf-8').read()
    reg = re.search(r"regulationSetId: '([^']+)'", content)
    if reg:
        print(f'F1 {y}: {reg.group(1)}')

for y in range(2008, 2027):
    f = f'src/data/seasons/season{y}IndyCar.ts'
    if not os.path.exists(f):
        continue
    content = open(f, encoding='utf-8').read()
    reg = re.search(r"regulationSetId: '([^']+)'", content)
    if reg:
        print(f'IndyCar {y}: {reg.group(1)}')

print("\nDone")
