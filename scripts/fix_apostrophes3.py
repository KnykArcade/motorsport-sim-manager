import os, glob

ROOT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data')

for subdir in ['tracks', 'seasons']:
    dir_path = os.path.join(ROOT, subdir)
    for f in sorted(glob.glob(os.path.join(dir_path, "*.ts"))):
        content = open(f, encoding='utf-8').read()
        lines = content.split('\n')
        fixed = False
        new_lines = []
        for line in lines:
            stripped = line.strip()
            # Check any line with string values that might have unescaped apostrophes
            # Look for lines where single-quote count is odd (indicates broken string)
            if "'" in stripped:
                quote_count = 0
                for i, c in enumerate(stripped):
                    if c == "'" and (i == 0 or stripped[i-1] != '\\'):
                        quote_count += 1
                if quote_count > 2 and quote_count % 2 == 1:
                    # This line likely has an unescaped apostrophe
                    # Find the first and last quote
                    first_q = stripped.index("'")
                    last_q = stripped.rindex("'")
                    prefix = stripped[:first_q+1]
                    value = stripped[first_q+1:last_q]
                    suffix = stripped[last_q:]
                    escaped_value = value.replace("'", "\\'")
                    new_line = line[:len(line)-len(stripped)] + prefix + escaped_value + suffix
                    new_lines.append(new_line)
                    fixed = True
                    print(f"  Fixed in {os.path.basename(f)}: {stripped[:80]}...")
                    continue
            new_lines.append(line)
        
        if fixed:
            open(f, 'w', encoding='utf-8').write('\n'.join(new_lines))

print("Done")
