#!/usr/bin/env python3
"""Balance pass 3 — Race Operations Rating + midfield/top-4 rebalance.

Stacks on the merged rebalance (PR #48). For every season it:

1. Seeds a per-team Race Operations Rating (1-10), distinct from reputation:
      raceOps = 0.55*(reputation/10) + 0.45*((pitCrewOps + reliability)/2)
   (prestige correlates with resources, but a fragile/poorly-operated car pulls
   it down, so it is NOT just reputation/10).

2. Midfield buff — teams expected to finish 5th-8th (expectedStanding 5..8):
   Car Rating (average of the 5 sub-ratings):
     <4.2          -> raise average to 4.2
     4.2 .. 4.99   -> +0.3
     5.0 .. 5.99   -> +0.2
     >=6.0         -> unchanged
   Race Operations Rating:
     <4.5          -> raise to 4.5
     4.5 .. 5.49   -> +0.2
     >=5.5         -> unchanged
   The car delta is applied uniformly to all 5 sub-ratings (clamped 1-10).

3. Top-4 compression — among teams expected 1st-4th, if the best car average is
   more than 0.4 ahead of the 2nd-best, reduce the best car so the gap shrinks,
   capped at a 0.3 reduction in this pass. Race Operations for the top 4 are left
   at their seeded value.

4. Teams expected 9th or lower are left unchanged (backmarkers).

Originals are preserved in git history; an original->adjusted record is written
to scripts/balance_pass3_preview.csv. Run with --dry-run to preview only.
"""
import csv
import re
import sys
import pathlib

DATA = pathlib.Path("src/data")
CAR_KEYS = ["enginePower", "aeroEfficiency", "mechanicalGrip", "reliability", "pitCrewOperations"]


def r1(n: float) -> float:
    return round(n * 10) / 10


def clamp(n: float, lo: float = 1.0, hi: float = 10.0) -> float:
    return max(lo, min(hi, n))


def fmt(n: float) -> str:
    n = r1(n)
    return str(int(n)) if n == int(n) else f"{n:g}"


def seed_raceops(reputation: float, pit: float, rel: float) -> float:
    return r1(clamp(0.55 * (reputation / 10) + 0.45 * ((pit + rel) / 2)))


STRONG = False


def mid_car_delta(avg: float) -> float:
    if STRONG:
        # Roughly double the buff and lift the floor to 5.0 so midfield cars are
        # meaningfully closer to the front (still short of the top-4 ceiling).
        if avg < 5.0:
            return r1(5.0 - avg)
        if avg < 6.0:
            return 0.5
        if avg < 7.0:
            return 0.3
        return 0.0
    if avg < 4.2:
        return r1(4.2 - avg)
    if avg < 5.0:
        return 0.3
    if avg < 6.0:
        return 0.2
    return 0.0


def mid_ops_new(ops: float) -> float:
    if STRONG:
        if ops < 5.0:
            return 5.0
        if ops < 6.5:
            return r1(ops + 0.4)
        return ops
    if ops < 4.5:
        return 4.5
    if ops < 5.5:
        return r1(ops + 0.2)
    return ops


# ---- parsing helpers -------------------------------------------------------

def car_ratings_by_team(car_file: pathlib.Path) -> dict[str, dict[str, float]]:
    """teamId -> {key: value} for the 5 car sub-ratings (base ratings block)."""
    txt = car_file.read_text()
    out: dict[str, dict[str, float]] = {}
    # Each car object: teamId then a ratings: { ... } block (the first one is the
    # base ratings; developmentLevel is all-zero and comes later).
    for m in re.finditer(r"teamId: '(t-[^']+)'[\s\S]*?\bratings: \{([^}]*)\}", txt):
        tid = m.group(1)
        body = m.group(2)
        vals = {}
        ok = True
        for k in CAR_KEYS:
            km = re.search(rf"\b{k}: (-?\d+(?:\.\d+)?)", body)
            if not km:
                ok = False
                break
            vals[k] = float(km.group(1))
        if ok and tid not in out:
            out[tid] = vals
    return out


def teams_expected(team_file: pathlib.Path) -> dict[str, dict]:
    """teamId -> {name, reputation, expected} from the teams file."""
    txt = team_file.read_text()
    out: dict[str, dict] = {}
    for m in re.finditer(
        r"id: '(t-[^']+)',\s*\n\s*name: '([^']*)'[\s\S]*?reputation: (\d+(?:\.\d+)?),"
        r"(?:[\s\S]*?expectedStanding: (\d+),)?",
        txt,
    ):
        tid = m.group(1)
        if tid in out:
            continue
        out[tid] = {
            "name": m.group(2),
            "reputation": float(m.group(3)),
            "expected": int(m.group(4)) if m.group(4) else 99,
        }
    return out


# ---- main per-season processing -------------------------------------------

def process_season(suffix: str, rows: list[dict], dry: bool) -> None:
    team_file = DATA / "teams" / f"teams{suffix}.ts"
    car_file = DATA / "cars" / f"cars{suffix}.ts"
    if not team_file.exists() or not car_file.exists():
        print(f"WARN: missing files for {suffix}")
        return

    cars = car_ratings_by_team(car_file)
    teams = teams_expected(team_file)

    if "raceOperations" in team_file.read_text():
        sys.exit(f"ERROR: {team_file} already has raceOperations — refusing to double-run.")

    # 1. Seed raceOps for every team.
    seeded_ops: dict[str, float] = {}
    car_avg: dict[str, float] = {}
    for tid, info in teams.items():
        cv = cars.get(tid)
        if not cv:
            seeded_ops[tid] = r1(clamp(info["reputation"] / 10))
            car_avg[tid] = 5.0
            continue
        seeded_ops[tid] = seed_raceops(info["reputation"], cv["pitCrewOperations"], cv["reliability"])
        car_avg[tid] = sum(cv.values()) / len(CAR_KEYS)

    # 2. Compute car deltas + raceOps adjustments.
    car_delta: dict[str, float] = {tid: 0.0 for tid in teams}
    new_ops: dict[str, float] = dict(seeded_ops)
    for tid, info in teams.items():
        es = info["expected"]
        if 5 <= es <= 8:
            car_delta[tid] = mid_car_delta(car_avg[tid])
            new_ops[tid] = mid_ops_new(seeded_ops[tid])

    # 3. Top-4 car compression (reduce best car if >0.4 clear of 2nd).
    top4 = sorted([t for t in teams if teams[t]["expected"] <= 4], key=lambda t: -car_avg[t])
    if len(top4) >= 2:
        best, second = top4[0], top4[1]
        gap = car_avg[best] - car_avg[second]
        if gap > 0.4:
            reduction = min(round(gap - 0.4, 1), 0.3)
            if reduction > 0:
                car_delta[best] = -reduction

    # 4. Apply car deltas to the car file.
    car_txt = car_file.read_text()
    team_positions = [(m.start(), m.group(1)) for m in re.finditer(r"teamId: '(t-[^']+)'", car_txt)]

    def team_for(pos: int):
        chosen = None
        for p, tid in team_positions:
            if p < pos:
                chosen = tid
            else:
                break
        return chosen

    rating_block = re.compile(r"(\bratings: \{)([^}]*)(\})")

    def repl(m: re.Match) -> str:
        tid = team_for(m.start())
        d = car_delta.get(tid, 0.0) if tid else 0.0
        if not d:
            return m.group(0)
        body = m.group(2)
        # Only the base ratings block has non-zero values; skip developmentLevel.
        if not re.search(r"enginePower: (?!0\b)(-?\d+(?:\.\d+)?)", body):
            return m.group(0)
        new_body = body
        for k in CAR_KEYS:
            km = re.search(rf"\b{k}: (-?\d+(?:\.\d+)?)", body)
            if not km:
                continue
            val = float(km.group(1))
            new_body = re.sub(rf"(\b{k}: )(-?\d+(?:\.\d+)?)", lambda mm: f"{mm.group(1)}{fmt(clamp(val + d))}", new_body, count=1)
        return m.group(1) + new_body + m.group(3)

    new_car_txt = rating_block.sub(repl, car_txt)

    # 5. Insert raceOperations into each team object (after the reputation line).
    def ins(m: re.Match) -> str:
        block = m.group(0)
        idm = re.search(r"id: '(t-[^']+)'", block)
        if not idm:
            return block
        tid = idm.group(1)
        ops = new_ops.get(tid)
        if ops is None:
            return block
        return re.sub(
            r"(\n(\s*)reputation: \d+(?:\.\d+)?,)",
            lambda rm: f"{rm.group(1)}\n{rm.group(2)}raceOperations: {fmt(ops)},",
            block,
            count=1,
        )

    team_txt = team_file.read_text()
    # Process each team object individually.
    new_team_txt = re.sub(r"\{\s*\n\s*id: 't-[^']+',[\s\S]*?\n\s*\},", ins, team_txt)

    if not dry:
        car_file.write_text(new_car_txt)
        team_file.write_text(new_team_txt)

    # 6. Record preview rows.
    for tid, info in teams.items():
        orig_avg = r1(car_avg[tid])
        adj_avg = r1(car_avg[tid] + car_delta[tid])
        rows.append({
            "season": suffix,
            "team": info["name"],
            "expected": info["expected"],
            "origCarAvg": orig_avg,
            "adjCarAvg": adj_avg,
            "carChange": r1(adj_avg - orig_avg),
            "seededRaceOps": seeded_ops[tid],
            "adjRaceOps": new_ops[tid],
            "raceOpsChange": r1(new_ops[tid] - seeded_ops[tid]),
        })


if __name__ == "__main__":
    dry = "--dry-run" in sys.argv
    STRONG = "--strong" in sys.argv
    rows: list[dict] = []
    suffixes = sorted(p.stem[len("teams"):] for p in DATA.glob("teams/teams*.ts"))
    for suffix in suffixes:
        process_season(suffix, rows, dry)

    out = pathlib.Path("scripts/balance_pass3_preview.csv")
    with out.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    mode = "DRY-RUN (no files written)" if dry else "APPLIED"
    print(f"{mode}: {len(rows)} team rows across {len(suffixes)} seasons -> {out}")
