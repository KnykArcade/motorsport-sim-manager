#!/usr/bin/env python3
"""Car-only second rebalance pass.

Stacks on the first rebalance (scripts/rebalance_ratings.py): for each season,
teams projected to finish 5th or lower (expectedStanding >= 5) have their car
reduced by a band chosen from the car's average rating. The band's single delta
is applied uniformly to all five car sub-ratings (clamped 1-10). Projected
top-4 teams, and any car averaging <=2.99, are left unchanged. Driver and team
ratings are untouched.
"""
import re
import pathlib

DATA = pathlib.Path("src/data")
CAR_KEYS = ["enginePower", "aeroEfficiency", "mechanicalGrip", "reliability", "pitCrewOperations"]


def r1(n: float) -> float:
    return round(n * 10) / 10


def clamp(n: float) -> float:
    return max(1.0, min(10.0, n))


def car_delta(avg: float) -> float:
    if avg >= 8.0:
        return 2.5
    if avg >= 7.0:
        return 2.1
    if avg >= 6.0:
        return 1.9
    if avg >= 5.0:
        return 1.5
    if avg >= 4.0:
        return 1.0
    if avg >= 3.0:
        return 0.8
    return 0.0


def fmt(n: float) -> str:
    return str(int(n)) if n == int(n) else f"{n:g}"


def team_expected(team_file: pathlib.Path) -> dict[str, int]:
    txt = team_file.read_text()
    out: dict[str, int] = {}
    for m in re.finditer(r"id: '(t-[^']+)'[\s\S]*?expectedStanding: (\d+)", txt):
        out.setdefault(m.group(1), int(m.group(2)))
    return out


def process_cars(car_file: pathlib.Path, expected: dict[str, int]) -> int:
    txt = car_file.read_text()
    # Split into segments at each `ratings: {...}` block, tracking the governing
    # teamId (the most recent `teamId: '...'` before the block).
    rating_block = re.compile(r"(\bratings: \{)([^}]*)(\})")

    # Build a list of (pos, teamId) for teamId occurrences.
    team_positions = [(m.start(), m.group(1)) for m in re.finditer(r"teamId: '(t-[^']+)'", txt)]

    def team_for(pos: int) -> str | None:
        chosen = None
        for p, tid in team_positions:
            if p < pos:
                chosen = tid
            else:
                break
        return chosen

    changed = [0]

    def repl(m: re.Match) -> str:
        body = m.group(2)
        tid = team_for(m.start())
        if tid is None or expected.get(tid, 99) < 5:
            return m.group(0)
        vals = {}
        for k in CAR_KEYS:
            km = re.search(rf"\b{k}: (-?\d+(?:\.\d+)?)", body)
            if not km:
                return m.group(0)
            vals[k] = float(km.group(1))
        avg = sum(vals.values()) / len(CAR_KEYS)
        d = car_delta(avg)
        if d == 0:
            return m.group(0)
        new_body = body
        for k in CAR_KEYS:
            new_body = re.sub(rf"(\b{k}: )(-?\d+(?:\.\d+)?)", lambda mm, kk=k: f"{mm.group(1)}{fmt(clamp(r1(vals[kk] - d)))}", new_body, count=1)
        changed[0] += 1
        return m.group(1) + new_body + m.group(3)

    new = rating_block.sub(repl, txt)
    if new != txt:
        car_file.write_text(new)
    return changed[0]


if __name__ == "__main__":
    total_cars = 0
    total_teams_adjusted = 0
    for car_file in sorted(DATA.glob("cars/cars*.ts")):
        suffix = car_file.stem[len("cars"):]  # e.g. "2008" or "2026IndyCar"
        team_file = DATA / "teams" / f"teams{suffix}.ts"
        if not team_file.exists():
            print(f"WARN: no team file for {car_file.name}")
            continue
        expected = team_expected(team_file)
        n = process_cars(car_file, expected)
        total_cars += 1 if n else 0
        total_teams_adjusted += n
        print(f"{car_file.name}: {n} cars reduced")
    print(f"\nfiles touched: {total_cars}, total cars reduced: {total_teams_adjusted}")
