"""Audit duplicate track IDs within track files."""
import re, os

ROOT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'tracks')

for f in sorted(os.listdir(ROOT)):
    if not f.endswith('.ts'):
        continue
    filepath = os.path.join(ROOT, f)
    content = open(filepath, encoding='utf-8').read()
    # Extract all track IDs
    ids = re.findall(r"id:\s*'([^']+)'", content)
    seen = {}
    dups = []
    for tid in ids:
        if tid in seen:
            seen[tid] += 1
            dups.append(tid)
        else:
            seen[tid] = 1
    if dups:
        print(f"\n{f}: DUPLICATES FOUND")
        for d in set(dups):
            print(f"  '{d}' appears {seen[d]} times")
    # Also check for tracks that share the same id but different names
