import re, os, glob

ROOT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'seasons')

# Find all season files and check for unescaped apostrophes in string literals
for f in sorted(glob.glob(os.path.join(ROOT, "season*.ts"))):
    content = open(f, encoding='utf-8').read()
    lines = content.split('\n')
    fixed = False
    new_lines = []
    for line in lines:
        # Check for gpName, trackName, or other string fields with unescaped apostrophes
        # Pattern: field: 'value with unescaped ' inside'
        # We look for lines where a single-quoted string has an unescaped apostrophe
        new_line = line
        
        # Find all single-quoted strings and check for unescaped apostrophes
        # Simple approach: find patterns like 'word's word' and fix them
        for field in ['gpName', 'trackName', 'name', 'country', 'archetype']:
            pattern = rf"({field}: ')(.*?)(')"
            matches = list(re.finditer(pattern, line))
            for m in matches:
                val = m.group(2)
                if "'" in val and "\\'" not in val:
                    # Escape the apostrophe
                    escaped_val = val.replace("'", "\\'")
                    new_line = new_line.replace(f"'{val}'", f"'{escaped_val}'")
                    fixed = True
        
        new_lines.append(new_line)
    
    if fixed:
        open(f, 'w', encoding='utf-8').write('\n'.join(new_lines))
        print(f"Fixed apostrophes in {os.path.basename(f)}")

print("Done")
