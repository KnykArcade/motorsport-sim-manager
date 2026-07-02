"""Verify mid-season driver swaps are fixed and check driver teamId assignments."""
import re, os

ROOT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data')

# Expected opening-season team assignments
EXPECTED = {
    2001: ('d-2001-heinz-harald-frentzen', 't-jordan-honda'),
    2003: ('d-2003-justin-wilson', 't-minardi-cosworth'),
    2016: ('d-2016-max-verstappen', 't-toro-rosso-ferrari'),
    2017: ('d-2017-carlos-sainz', 't-toro-rosso'),
    2019: ('d-2019-pierre-gasly', 't-red-bull-racing-honda'),
    2025: ('d-2025-yuki-tsunoda', 't-racing-bulls'),
}

print("=== Team roster check ===")
for year, (driver_id, expected_team) in EXPECTED.items():
    f = os.path.join(ROOT, 'teams', f'teams{year}.ts')
    content = open(f, encoding='utf-8').read()
    # Find all teams with this driver
    team_blocks = re.findall(r"\{[^}]*id:\s*'t-[^']+'[^}]*\}", content)
    teams_with_driver = []
    for block in team_blocks:
        tid = re.search(r"id:\s*'([^']+)'", block).group(1)
        dids = re.findall(r"'([^']+)'", re.search(r"driverIds:\s*\[([^\]]*)\]", block).group(1))
        if driver_id in dids:
            teams_with_driver.append(tid)
    
    status = "OK" if teams_with_driver == [expected_team] else "MISMATCH"
    print(f"  {year} {driver_id}: on teams {teams_with_driver} (expected [{expected_team}]) -> {status}")

print("\n=== Driver teamId check ===")
for year, (driver_id, expected_team) in EXPECTED.items():
    f = os.path.join(ROOT, 'drivers', f'drivers{year}.ts')
    content = open(f, encoding='utf-8').read()
    # Find the driver record
    driver_block = re.search(rf"\{{[^}}]*id:\s*'{re.escape(driver_id)}'[^}}]*\}}", content)
    if driver_block:
        team_id_match = re.search(r"teamId:\s*'([^']+)'", driver_block.group(0))
        if team_id_match:
            actual_team = team_id_match.group(1)
            status = "OK" if actual_team == expected_team else f"NEEDS FIX (should be {expected_team})"
            print(f"  {year} {driver_id}: teamId={actual_team} -> {status}")
        else:
            print(f"  {year} {driver_id}: no teamId field found")
    else:
        print(f"  {year} {driver_id}: driver not found in file")
