import re, os
ROOT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data')

for year in range(2020, 2026):
    f = os.path.join(ROOT, "seasons", f"season{year}.ts")
    content = open(f, encoding="utf-8").read()
    # Find races with distanceKm: undefined
    races = re.findall(r"\{[^}]*id: 'r-\d+-\d+'[^}]*\}", content)
    for race in races:
        if "distanceKm: undefined" in race:
            rnd = re.search(r"round: (\d+)", race)
            tid = re.search(r"trackId: '([^']+)'", race)
            tname = re.search(r"trackName: '([^']+)'", race)
            print(f"F1 {year} round {rnd.group(1)}: trackId={tid.group(1)} trackName={tname.group(1)}")
