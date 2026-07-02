import re, os
ROOT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data')

# Missing circuit lengths
MISSING = {
    "nurburgring gp-strecke": 5.148,
    "nurburgring": 5.148,
    "autodromo internacional do algarve": 4.653,
    "algarve international circuit": 4.653,
    "bahrain outer track": 3.543,
    "lusail international circuit": 5.380,
    "lusail": 5.380,
}

F1_YEAR_LAPS = {
    2020: {1:52, 2:71, 3:52, 4:71, 5:44, 6:53, 7:60, 8:56, 9:53, 10:44, 11:59, 12:63, 13:53, 14:71, 15:71, 16:78, 17:55},
    2021: {1:58, 2:57, 3:56, 4:53, 5:66, 6:78, 7:70, 8:51, 9:71, 10:52, 11:70, 12:67, 13:44, 14:53, 15:58, 16:53, 17:53, 18:56, 19:71, 20:71, 21:55, 22:58},
    2023: {1:58, 2:57, 3:56, 4:57, 5:66, 6:78, 7:70, 8:51, 9:71, 10:52, 11:70, 12:67, 13:44, 14:53, 15:58, 16:53, 17:53, 18:56, 19:71, 20:71, 21:55, 22:50},
    2024: {1:58, 2:57, 3:56, 4:57, 5:66, 6:78, 7:70, 8:51, 9:71, 10:52, 11:70, 12:67, 13:44, 14:53, 15:58, 16:53, 17:53, 18:56, 19:71, 20:71, 21:55, 22:50, 23:50, 24:55},
    2025: {1:58, 2:57, 3:56, 4:57, 5:66, 6:78, 7:70, 8:51, 9:71, 10:52, 11:70, 12:67, 13:44, 14:53, 15:58, 16:53, 17:53, 18:56, 19:71, 20:71, 21:55, 22:50, 23:50, 24:55},
}

for year in range(2020, 2026):
    f = os.path.join(ROOT, "seasons", f"season{year}.ts")
    content = open(f, encoding="utf-8").read()
    laps_data = F1_YEAR_LAPS.get(year, {})

    def fix_race(match):
        full = match.group(0)
        if "distanceKm: undefined" not in full:
            return full
        rnd = int(re.search(r"round: (\d+)", full).group(1))
        tname_match = re.search(r"trackName: '([^']+)'", full)
        if not tname_match:
            return full
        tname = tname_match.group(1).lower()
        track_len = 0
        for cname, length in MISSING.items():
            if cname in tname or tname in cname:
                track_len = length
                break
        laps = laps_data.get(rnd, 0)
        if laps and track_len:
            dist = round(laps * track_len, 1)
            full = re.sub(r"distanceKm: undefined", f"distanceKm: {dist}", full)
        return full

    content = re.sub(r"\{[^}]*id: 'r-\d+-\d+'[^}]*\}", fix_race, content)
    open(f, "w", encoding="utf-8").write(content)
    remaining = len(re.findall(r"distanceKm: undefined", content))
    print(f"F1 {year}: remaining undefined = {remaining}")
