"""Fix driver teamId fields to match opening-season team assignments."""
import re, os

ROOT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'drivers')

FIXES = {
    2003: ('d-2003-justin-wilson', 't-jaguar-cosworth', 't-minardi-cosworth'),
    2016: ('d-2016-max-verstappen', 't-red-bull-racing-tag-heuer', 't-toro-rosso-ferrari'),
    2017: ('d-2017-carlos-sainz', 't-renault', 't-toro-rosso'),
    2019: ('d-2019-pierre-gasly', 't-scuderia-toro-rosso-honda', 't-red-bull-racing-honda'),
    2025: ('d-2025-yuki-tsunoda', 't-red-bull-racing', 't-racing-bulls'),
}

for year, (driver_id, old_team, new_team) in FIXES.items():
    f = os.path.join(ROOT, f'drivers{year}.ts')
    content = open(f, encoding='utf-8').read()
    # Find the driver block and replace teamId
    def fix_driver(match):
        block = match.group(0)
        id_match = re.search(r"id:\s*'([^']+)'", block)
        if not id_match or id_match.group(1) != driver_id:
            return block
        old_block = block
        block = block.replace(f"teamId: '{old_team}'", f"teamId: '{new_team}'")
        if block != old_block:
            print(f"  {year}: Fixed {driver_id} teamId {old_team} -> {new_team}")
        return block
    
    new_content = re.sub(r"\{[^}]*id:\s*'d-[^']+'[^}]*\}", fix_driver, content)
    if new_content != content:
        open(f, 'w', encoding='utf-8').write(new_content)

print("Done.")
