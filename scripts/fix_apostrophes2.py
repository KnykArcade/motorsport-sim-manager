import os, glob

ROOT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'seasons')

for f in sorted(glob.glob(os.path.join(ROOT, "season*.ts"))):
    content = open(f, encoding='utf-8').read()
    lines = content.split('\n')
    fixed = False
    new_lines = []
    for line in lines:
        # Count single quotes (not preceded by backslash)
        # Simple heuristic: if a line has gpName or trackName and has an odd number of unescaped single quotes
        stripped = line.strip()
        if any(stripped.startswith(field) for field in ['gpName:', 'trackName:', 'name:', 'country:']):
            # Count single quotes not preceded by backslash
            quote_count = 0
            for i, c in enumerate(stripped):
                if c == "'" and (i == 0 or stripped[i-1] != '\\'):
                    quote_count += 1
            if quote_count > 2 and quote_count % 2 == 1:
                # Odd number of quotes — likely unescaped apostrophe
                # Find the value between first and last quote
                first_q = stripped.index("'")
                last_q = stripped.rindex("'")
                prefix = stripped[:first_q+1]
                value = stripped[first_q+1:last_q]
                suffix = stripped[last_q:]
                # Escape apostrophes in the value
                escaped_value = value.replace("'", "\\'")
                # Reconstruct
                new_line = line[:len(line)-len(stripped)] + prefix + escaped_value + suffix
                new_lines.append(new_line)
                fixed = True
                print(f"  Fixed in {os.path.basename(f)}: {stripped[:60]}...")
                continue
        new_lines.append(line)
    
    if fixed:
        open(f, 'w', encoding='utf-8').write('\n'.join(new_lines))

print("Done")
