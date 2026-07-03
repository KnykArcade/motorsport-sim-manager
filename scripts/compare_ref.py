"""Compare lap values between reference and working directories for 2016-2026 seasons."""
import re, os

ref_dir = r"C:\Users\tnick\Downloads\motorsport-sim-manager-ref\motorsport-sim-manager-main\src\data\seasons"
work_dir = r"C:\Users\tnick\CascadeProjects\motorsport-sim-manager\motorsport-sim-manager-devin-1995-f1-mvp\src\data\seasons"

for year in range(2016, 2027):
    for suffix in ["", "IndyCar"]:
        fname = f"season{year}{suffix}.ts"
        ref_path = os.path.join(ref_dir, fname)
        work_path = os.path.join(work_dir, fname)
        if not os.path.exists(ref_path) or not os.path.exists(work_path):
            continue
        ref_content = open(ref_path, encoding='utf-8').read()
        work_content = open(work_path, encoding='utf-8').read()
        ref_laps = re.findall(r"laps: (\d+)", ref_content)
        work_laps = re.findall(r"laps: (\d+)", work_content)
        if len(ref_laps) != len(work_laps):
            print(f"{fname}: lap count differs ({len(ref_laps)} vs {len(work_laps)})")
            continue
        diffs = sum(1 for a, b in zip(ref_laps, work_laps) if a != b)
        if diffs > 0:
            print(f"{fname}: {diffs} lap values differ")
            for i, (a, b) in enumerate(zip(ref_laps, work_laps)):
                if a != b:
                    print(f"  round {i+1}: ref={a} work={b}")

# Also check distanceKm
print("\n--- distanceKm comparison ---")
for year in range(2016, 2027):
    for suffix in ["", "IndyCar"]:
        fname = f"season{year}{suffix}.ts"
        ref_path = os.path.join(ref_dir, fname)
        work_path = os.path.join(work_dir, fname)
        if not os.path.exists(ref_path) or not os.path.exists(work_path):
            continue
        ref_content = open(ref_path, encoding='utf-8').read()
        work_content = open(work_path, encoding='utf-8').read()
        ref_dists = re.findall(r"distanceKm: ([\d.]+|undefined)", ref_content)
        work_dists = re.findall(r"distanceKm: ([\d.]+|undefined)", work_content)
        if len(ref_dists) != len(work_dists):
            print(f"{fname}: distanceKm count differs ({len(ref_dists)} vs {len(work_dists)})")
            continue
        diffs = sum(1 for a, b in zip(ref_dists, work_dists) if a != b)
        if diffs > 0:
            print(f"{fname}: {diffs} distanceKm values differ")
            for i, (a, b) in enumerate(zip(ref_dists, work_dists)):
                if a != b:
                    print(f"  round {i+1}: ref={a} work={b}")
