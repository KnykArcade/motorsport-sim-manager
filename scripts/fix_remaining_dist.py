"""Fix remaining distanceKm: undefined in F1 2020-2025 calendars."""
import re
import os

ROOT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data')

# Additional circuit lengths for tracks missing from the first pass
EXTRA_CIRCUIT_DATA = {
    "red bull ring": 4.318,
    "silverstone circuit": 5.891,
    "mugello circuit": 5.245,
    "mugello": 5.245,
    "istanbul park": 5.338,
    "portimao": 4.653,
    "autodromo do algarve": 4.653,
    "imola": 4.909,
    "autodromo enzo e dino ferrari": 4.909,
    "jeddah corniche circuit": 6.174,
    "jeddah": 6.174,
    "losail international circuit": 5.380,
    "losail": 5.380,
    "miami international autodrome": 5.412,
    "miami": 5.412,
    "las vegas strip circuit": 6.201,
    "las vegas": 6.201,
    "sakhir": 5.412,
    "bahrain international circuit": 5.412,
    "suzuka circuit": 5.807,
    "suzuka": 5.807,
    "circuit of the americas": 5.513,
    "autodromo hermanos rodriguez": 4.304,
    "autodromo jose carlos pace": 4.309,
    "interlagos": 4.309,
    "yas marina circuit": 5.281,
    "marina bay street circuit": 5.063,
    "sepang international circuit": 5.543,
    "hockenheimring": 4.574,
    "hungaroring": 4.381,
    "circuit de spa-francorchamps": 7.004,
    "autodromo nazionale monza": 5.793,
    "circuit gilles villeneuve": 4.361,
    "baku city circuit": 6.003,
    "circuit de monaco": 3.337,
    "circuit de barcelona-catalunya": 4.655,
    "sochi autodrom": 5.848,
    "shanghai international circuit": 5.451,
    "albert park": 5.303,
    "paul ricard": 5.842,
    "circuit paul ricard": 5.842,
    "zandvoort": 4.259,
    "circuit zandvoort": 4.259,
}

# F1 lap counts per year per round
F1_YEAR_LAPS = {
    2020: {1:52, 2:71, 3:52, 4:71, 5:44, 6:53, 7:60, 8:56, 9:53, 10:44, 11:59, 12:63, 13:53, 14:71, 15:71, 16:78, 17:55},
    2021: {1:58, 2:57, 3:56, 4:53, 5:66, 6:78, 7:70, 8:51, 9:71, 10:52, 11:70, 12:67, 13:44, 14:53, 15:58, 16:53, 17:53, 18:56, 19:71, 20:71, 21:55, 22:58},
    2022: {1:58, 2:57, 3:56, 4:57, 5:66, 6:78, 7:70, 8:51, 9:71, 10:52, 11:70, 12:67, 13:44, 14:53, 15:58, 16:53, 17:53, 18:56, 19:71, 20:71, 21:55, 22:50},
    2023: {1:58, 2:57, 3:56, 4:57, 5:66, 6:78, 7:70, 8:51, 9:71, 10:52, 11:70, 12:67, 13:44, 14:53, 15:58, 16:53, 17:53, 18:56, 19:71, 20:71, 21:55, 22:50},
    2024: {1:58, 2:57, 3:56, 4:57, 5:66, 6:78, 7:70, 8:51, 9:71, 10:52, 11:70, 12:67, 13:44, 14:53, 15:58, 16:53, 17:53, 18:56, 19:71, 20:71, 21:55, 22:50, 23:50, 24:55},
    2025: {1:58, 2:57, 3:56, 4:57, 5:66, 6:78, 7:70, 8:51, 9:71, 10:52, 11:70, 12:67, 13:44, 14:53, 15:58, 16:53, 17:53, 18:56, 19:71, 20:71, 21:55, 22:50, 23:50, 24:55},
}


def fix_remaining_distance():
    for year in range(2020, 2026):
        season_file = os.path.join(ROOT, "seasons", f"season{year}.ts")
        if not os.path.exists(season_file):
            continue
        content = open(season_file, encoding="utf-8").read()

        # Read track names from the tracks file
        tracks_file = os.path.join(ROOT, "tracks", f"tracks{year}.ts")
        track_lengths = {}
        if os.path.exists(tracks_file):
            tc = open(tracks_file, encoding="utf-8").read()
            track_entries = re.findall(r"id: '([^']+)',\s*name: '([^']+)'", tc)
            for tid, tname in track_entries:
                tname_lower = tname.lower()
                for circuit_name, length_km in EXTRA_CIRCUIT_DATA.items():
                    if circuit_name in tname_lower or tname_lower in circuit_name:
                        track_lengths[tid] = length_km
                        break

        laps_data = F1_YEAR_LAPS.get(year, {})

        def fix_race(match):
            full = match.group(0)
            round_match = re.search(r"round: (\d+)", full)
            if not round_match:
                return full
            rnd = int(round_match.group(1))

            # Check if distanceKm is undefined
            dist_match = re.search(r"distanceKm: undefined", full)
            if not dist_match:
                return full  # Already has a value

            track_id_match = re.search(r"trackId: '([^']+)'", full)
            track_len = 0
            if track_id_match:
                track_len = track_lengths.get(track_id_match.group(1), 0)

            laps = laps_data.get(rnd, 0)
            dist_km = round(laps * track_len, 1) if laps and track_len else None

            if dist_km is not None:
                full = re.sub(r"distanceKm: undefined", f"distanceKm: {dist_km}", full)
            return full

        content = re.sub(r"\{[^}]*id: 'r-\d+-\d+'[^}]*\}", fix_race, content)
        open(season_file, "w", encoding="utf-8").write(content)

        # Count remaining undefined
        remaining = len(re.findall(r"distanceKm: undefined", content))
        print(f"F1 {year}: remaining distanceKm:undefined = {remaining}")


if __name__ == "__main__":
    fix_remaining_distance()
