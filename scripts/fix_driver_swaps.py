"""Fix F1 mid-season driver swaps in starting rosters.

For each known case, remove the driver from the team they did NOT start the season with.

Historical opening-season lineups:
- 2001 Frentzen: started at Jordan, moved to Prost mid-season (after German GP)
  -> Remove from Prost, keep on Jordan
- 2003 Wilson: started at Minardi, moved to Jaguar mid-season (after German GP)
  -> Remove from Jaguar, keep on Minardi
- 2016 Verstappen: started at Toro Rosso, moved to Red Bull after Spanish GP (round 4)
  -> Remove from Red Bull, keep on Toro Rosso
- 2017 Sainz: started at Toro Rosso, moved to Renault after US GP (round 17)
  -> Remove from Renault, keep on Toro Rosso
- 2019 Gasly: started at Red Bull, demoted to Toro Rosso after Hungarian GP (round 12)
  -> Remove from Toro Rosso, keep on Red Bull
- 2025 Tsunoda: started at Racing Bulls, moved to Red Bull after round 2
  -> Remove from Red Bull, keep on Racing Bulls
"""
import re, os

ROOT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'teams')

# Map: year -> (driver_id, team_to_remove_from)
SWAPS = {
    2001: ('d-2001-heinz-harald-frentzen', 't-prost-acer'),
    2003: ('d-2003-justin-wilson', 't-jaguar-cosworth'),
    2016: ('d-2016-max-verstappen', 't-red-bull-racing-tag-heuer'),
    2017: ('d-2017-carlos-sainz', 't-renault'),
    2019: ('d-2019-pierre-gasly', 't-scuderia-toro-rosso-honda'),
    2025: ('d-2025-yuki-tsunoda', 't-red-bull-racing'),
}

for year, (driver_id, team_to_remove) in SWAPS.items():
    f = os.path.join(ROOT, f'teams{year}.ts')
    if not os.path.exists(f):
        print(f"WARNING: {f} not found")
        continue
    content = open(f, encoding='utf-8').read()
    
    # Find the team block for team_to_remove
    # Team blocks look like: { id: 't-xxx', ... driverIds: ['d1', 'd2', ...], ... }
    def fix_team_block(match):
        block = match.group(0)
        tid_match = re.search(r"id:\s*'([^']+)'", block)
        if not tid_match or tid_match.group(1) != team_to_remove:
            return block
        
        # Remove the driver_id from driverIds array
        # Pattern: 'd-xxx' in the driverIds array
        # Handle: driverIds: ['d-2001-heinz-harald-frentzen', 'd-other'] -> driverIds: ['d-other']
        # Handle: driverIds: ['d-other', 'd-2001-heinz-harald-frentzen'] -> driverIds: ['d-other']
        # Handle: driverIds: ['d-2001-heinz-harald-frentzen'] -> driverIds: []
        
        # First, find the driverIds array
        dids_match = re.search(r"driverIds:\s*\[([^\]]*)\]", block)
        if not dids_match:
            return block
        
        dids_str = dids_match.group(1)
        # Remove the driver ID and clean up commas
        # Remove 'd-xxx' with surrounding quotes
        dids_str = re.sub(rf"'{re.escape(driver_id)}'\s*,?\s*", '', dids_str)
        # Clean up any trailing/leading commas/spaces
        dids_str = dids_str.strip().strip(',').strip()
        # Rebuild
        new_block = block[:dids_match.start()] + f"driverIds: [{dids_str}]" + block[dids_match.end():]
        
        print(f"  {year}: Removed {driver_id} from {team_to_remove}")
        return new_block
    
    new_content = re.sub(r"\{[^}]*id:\s*'t-[^']+'[^}]*\}", fix_team_block, content)
    
    if new_content != content:
        open(f, 'w', encoding='utf-8').write(new_content)
    else:
        print(f"  {year}: No change made (driver not found in team?)")

print("\nDone. Verifying...")
