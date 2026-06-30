#!/usr/bin/env python3
"""One-off rebalance of game ratings (1-10 scale).

Applies band-based reductions to driver, car and team ratings to widen the
performance gap between elite and midfield while leaving weak entries (<=4.0)
untouched. See PR description for the exact band tables. Idempotent only in the
sense that re-running will re-apply the bands, so run exactly once.
"""
import re
import pathlib

DATA = pathlib.Path("src/data")


def r1(n: float) -> float:
    return round(n * 10) / 10


def clamp(n: float) -> float:
    return max(1.0, min(10.0, n))


def adj_driver(v: float) -> float:
    if v <= 4.0:
        return v
    if v <= 5.0:
        d = 0.4
    elif v <= 6.0:
        d = 0.7
    elif v <= 7.0:
        d = 0.8
    elif v <= 8.0:
        d = 0.7
    elif v <= 9.0:
        d = 0.5
    else:
        d = 0.3
    return r1(clamp(v - d))


def adj_car(v: float) -> float:
    if v <= 4.0:
        return v
    if v <= 5.0:
        d = 0.5
    elif v <= 6.0:
        d = 1.0
    elif v <= 7.0:
        d = 1.2
    elif v <= 8.0:
        d = 1.0
    elif v <= 9.0:
        d = 0.7
    else:
        d = 0.4
    return r1(clamp(v - d))


def adj_team(v: float) -> float:
    if v <= 4.0:
        return v
    if v <= 5.0:
        d = 0.4
    elif v <= 6.0:
        d = 0.8
    elif v <= 7.0:
        d = 1.0
    elif v <= 8.0:
        d = 0.9
    elif v <= 9.0:
        d = 0.6
    else:
        d = 0.3
    return r1(clamp(v - d))


def fmt(n: float) -> str:
    # Match existing style: integers may be written as "9" or "9.0"; we always
    # emit one decimal for clarity, except keep integers clean when whole.
    if n == int(n):
        return str(int(n))
    return f"{n:g}"


def replace_keys(text: str, keys: set[str], band) -> str:
    pat = re.compile(r'\b(' + '|'.join(map(re.escape, keys)) + r'): (-?\d+(?:\.\d+)?)')

    def repl(m: re.Match) -> str:
        return f"{m.group(1)}: {fmt(band(float(m.group(2))))}"

    return pat.sub(repl, text)


CAR_KEYS = {"enginePower", "aeroEfficiency", "mechanicalGrip", "reliability", "pitCrewOperations"}
SKILL_KEYS = {
    "cornering", "braking", "straights", "tractionAcceleration", "elevationBlindCorners",
    "technical", "overtakingRacecraft", "surfaceGripBumpiness", "riskManagement",
    "enduranceConsistency",
}
# Driver grid ratings: all skills + pace/quali + headline, EXCLUDING aggression (a style axis).
DRIVER_KEYS = SKILL_KEYS | {"qualifying", "racePace", "adaptability", "composure", "overall"}
# Market / youth: skills + overall + potential only (money/readiness fields untouched).
MARKET_KEYS = SKILL_KEYS | {"overall", "potential"}


def process(glob: str, keys: set[str], band) -> int:
    n = 0
    for p in sorted(DATA.glob(glob)):
        txt = p.read_text()
        new = replace_keys(txt, keys, band)
        if new != txt:
            p.write_text(new)
            n += 1
    return n


def process_teams() -> int:
    # Team rating = reputation / 10 (0-100 -> 0-10); band applied, written back *10.
    pat = re.compile(r'\b(reputation): (-?\d+(?:\.\d+)?)')

    def repl(m: re.Match) -> str:
        rep = float(m.group(2))
        adj = adj_team(r1(rep / 10))
        return f"{m.group(1)}: {int(round(adj * 10))}"

    n = 0
    for p in sorted(DATA.glob("teams/teams*.ts")):
        txt = p.read_text()
        new = pat.sub(repl, txt)
        if new != txt:
            p.write_text(new)
            n += 1
    return n


if __name__ == "__main__":
    c = process("cars/cars*.ts", CAR_KEYS, adj_car)
    d = process("drivers/drivers*.ts", DRIVER_KEYS, adj_driver)
    m = process("market/driverMarket*.ts", MARKET_KEYS, adj_driver)
    y = process("market/youthProspects*.ts", MARKET_KEYS, adj_driver)
    t = process_teams()
    print(f"cars files changed: {c}")
    print(f"driver files changed: {d}")
    print(f"market files changed: {m}")
    print(f"youth files changed: {y}")
    print(f"team files changed: {t}")
