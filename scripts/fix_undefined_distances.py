"""Fix F1 1990 and 2006-2015 distanceKm=undefined by calculating from laps * track_length.

Track lengths sourced from Formula1.com circuit guides and Wikipedia.
"""
import re, os

ROOT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'seasons')

# F1 circuit lengths in km, keyed by track name (lowercase)
CIRCUIT_LENGTHS_KM = {
    # 1990 tracks
    'phoenix street circuit': 3.721,
    'interlagos / autodromo jose carlos pace': 4.309,
    'interlagos': 4.309,
    'autodromo jose carlos pace': 4.309,
    'imola / autodromo enzo e dino ferrari': 4.909,
    'autodromo enzo e dino ferracci': 4.909,
    'autodromo enzo e dino ferrari': 4.909,
    'imola': 4.909,
    'circuit de monaco': 3.337,
    'monaco': 3.337,
    'circuit gilles villeneuve': 4.361,
    'montreal': 4.361,
    'hermanos rodriguez': 4.304,
    'autodromo hermanos rodriguez': 4.304,
    'magny-cours': 4.411,
    'circuit de nevers': 4.411,
    'magny-cours / circuit de nevers': 4.411,
    'silverstone circuit': 5.226,  # 1990 layout
    'silverstone': 5.226,
    'hockenheimring': 6.815,  # 1990 layout (long forest circuit)
    'hockenheim': 6.815,
    'hockenheimring gp-strecke': 4.574,
    'hungaroring': 4.380,
    'spa-francorchamps': 6.940,  # 1990 layout
    'circuit de spa-francorchamps': 7.004,  # current layout
    'monza': 5.800,  # 1990 layout
    'autodromo nazionale monza': 5.793,
    'estoril': 4.349,
    'autodromo do estoril': 4.349,
    'jerez': 4.428,
    'circuito de jerez': 4.428,
    'suzuka circuit': 5.859,  # 1990 layout
    'suzuka': 5.807,
    'adelaide street circuit': 3.780,
    'adelaide': 3.780,
    # 2006-2015 tracks
    'bahrain international circuit': 5.412,
    'bahrain': 5.412,
    'sepang international circuit': 5.543,
    'sepang': 5.543,
    'albert park circuit': 5.303,  # 2006 layout
    'albert park': 5.303,
    'albert park grand prix circuit': 5.278,
    'san marino': 4.909,
    'nurburgring gp-strecke': 5.148,
    'nurburgring': 5.148,
    'european grand prix': 5.148,
    'circuit de catalunya': 4.655,
    'circuit de barcelona-catalunya': 4.657,
    'barcelona': 4.655,
    'istanbul park': 5.338,
    'istanbul': 5.338,
    'circuit gilles villeneuve': 4.361,
    'indianapolis motor speedway': 4.192,
    'magny-cours': 4.411,
    'valencia street circuit': 5.419,
    'valencia': 5.419,
    'spa': 7.004,
    'marina bay street circuit': 5.067,  # 2008-2015 layout
    'marina bay': 5.067,
    'singapore': 5.067,
    'fuji speedway': 4.563,
    'fuji': 4.563,
    'shanghai international circuit': 5.451,
    'shanghai': 5.451,
    'yas marina circuit': 5.281,
    'yas marina': 5.281,
    'abu dhabi': 5.281,
    'korean international circuit': 5.615,
    'yeongam': 5.615,
    'korea': 5.615,
    'buddh international circuit': 5.125,
    'buddh': 5.125,
    'india': 5.125,
    'circuit of the americas': 5.513,
    'cota': 5.513,
    'austin': 5.513,
    'sochi autodrom': 5.848,
    'sochi': 5.848,
    'red bull ring': 4.318,
    'spielberg': 4.318,
    'autodromo internacional do algarve': 4.653,
    'portimao': 4.653,
    'algarve international circuit': 4.653,
    'autodromo jose carlos pace': 4.309,
    'autodromo hermanos rodriguez': 4.304,
    'mexico city': 4.304,
    'baku city circuit': 6.003,
    'baku': 6.003,
    'jeddah corniche circuit': 6.174,
    'jeddah': 6.174,
    'miami international autodrome': 5.412,
    'miami': 5.412,
    'circuit zandvoort': 4.259,
    'zandvoort': 4.259,
    'las vegas strip circuit': 6.201,
    'las vegas': 6.201,
    'lusail international circuit': 5.380,
    'lusail': 5.380,
    'qatar': 5.380,
    'sakhir': 3.543,
    'bahrain outer track': 3.543,
    'mugello circuit': 5.245,
    'mugello': 5.245,
    'kyalami': 4.263,
    'kyalami racing circuit': 4.263,
    'okayama international circuit': 3.703,
    'ti ait': 3.703,
    'circuit paul ricard': 5.842,
    'paul ricard': 5.842,
    'ricard': 5.842,
    'avus': 8.300,
    'avus berlin': 8.300,
    'detroit street circuit': 4.023,
    'detroit': 4.023,
    'phoenix': 3.721,
    'rosenberg': 4.318,
}

def get_circuit_length(track_name):
    key = track_name.lower().strip()
    if key in CIRCUIT_LENGTHS_KM:
        return CIRCUIT_LENGTHS_KM[key]
    # Try partial match
    for name, length in CIRCUIT_LENGTHS_KM.items():
        if name in key or key in name:
            return length
    return None

def fix_undefined_distances(year, is_indycar=False):
    suffix = 'IndyCar' if is_indycar else ''
    f = os.path.join(ROOT, f'season{year}{suffix}.ts')
    if not os.path.exists(f):
        return
    content = open(f, encoding='utf-8').read()
    
    changes = []
    
    def fix_race(match):
        full = match.group(0)
        dist_match = re.search(r"distanceKm:\s*undefined", full)
        if not dist_match:
            return full
        
        laps_match = re.search(r"laps:\s*(\d+)", full)
        if not laps_match:
            return full
        laps = int(laps_match.group(1))
        
        track_match = re.search(r"trackName:\s*'([^']*)'", full)
        track_name = track_match.group(1) if track_match else ''
        
        circuit_len = get_circuit_length(track_name)
        if circuit_len and laps > 0:
            new_dist = round(laps * circuit_len, 1)
            full = re.sub(r"distanceKm:\s*undefined", f"distanceKm: {new_dist}", full)
            gp = re.search(r"gpName:\s*'([^']*)'", full)
            gp_name = gp.group(1) if gp else '?'
            rnd_match = re.search(r"round:\s*(\d+)", full)
            rnd_str = rnd_match.group(1) if rnd_match else '?'
            changes.append(f"  {year} R{rnd_str} ({gp_name}): dist undefined->{new_dist} (laps={laps}, track={track_name}, len={circuit_len}km)")
            return full
        else:
            gp = re.search(r"gpName:\s*'([^']*)'", full)
            gp_name = gp.group(1) if gp else '?'
            print(f"  WARNING: {year} ({gp_name}): could not find circuit length for '{track_name}'")
            return full
    
    new_content = re.sub(r"\{[^}]*id:\s*'r-[^']+'[^}]*\}", fix_race, content)
    
    if new_content != content:
        open(f, 'w', encoding='utf-8').write(new_content)
        for c in changes:
            print(c)

# Fix F1 years with undefined distanceKm
for year in [1990] + list(range(2006, 2016)):
    print(f"\n--- F1 {year} ---")
    fix_undefined_distances(year)

print("\nDone.")
