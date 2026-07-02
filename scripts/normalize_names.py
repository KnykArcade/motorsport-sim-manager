"""Normalize all driver/team/market names to ASCII and check for duplicates.

Replaces corrupted Unicode replacement chars (U+FFFD) and normalizes
all non-ASCII characters using NFKD decomposition.
"""
import os
import re
import unicodedata
import glob

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "data")

# Known corrupted name fixes (replacement char patterns)
CORRUPTED_FIXES = {
    "Kimi R\ufffdikk\ufffdnen": "Kimi Raikkonen",
    "R\ufffdikk\ufffdnen": "Raikkonen",
}

def to_ascii(text):
    """Convert any non-ASCII characters to ASCII equivalents."""
    # First, apply known corrupted fixes
    for bad, good in CORRUPTED_FIXES.items():
        text = text.replace(bad, good)
    # NFKD decomposition: separates base chars from diacritics
    normalized = unicodedata.normalize("NFKD", text)
    # Encode to ASCII, ignoring non-ASCII (drops diacritics)
    ascii_text = normalized.encode("ascii", "ignore").decode()
    # Fix any remaining replacement characters
    ascii_text = ascii_text.replace("\ufffd", "")
    return ascii_text

def process_file(filepath):
    """Process a single .ts file, normalizing all string literals."""
    # Try UTF-8 first, then latin-1 (which never fails)
    content = None
    for enc in ["utf-8", "latin-1"]:
        try:
            with open(filepath, "r", encoding=enc) as f:
                content = f.read()
            break
        except UnicodeDecodeError:
            continue
    if content is None:
        return False

    # Check if file has any non-ASCII content
    if not re.search(r'[^\x00-\x7F]', content):
        return False  # No changes needed

    # Find all single-quoted strings and normalize their contents
    def replace_string(m):
        prefix = m.group(1)
        string_content = m.group(2)
        normalized = to_ascii(string_content)
        return f"{prefix}'{normalized}'"

    # Match: name: 'some string' or : 'some string' patterns
    # We want to normalize string values, not code
    new_content = re.sub(
        r"(:\s*)'([^']*)'",
        replace_string,
        content
    )

    if new_content != content:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
        return True
    return False

def check_duplicates():
    """Check for duplicate driver names within each year's driver file."""
    duplicates_found = False
    for filepath in sorted(glob.glob(os.path.join(DATA_DIR, "drivers", "drivers*.ts"))):
        content = None
        for enc in ["utf-8", "latin-1"]:
            try:
                with open(filepath, "r", encoding=enc) as f:
                    content = f.read()
                break
            except UnicodeDecodeError:
                continue
        if content is None:
            continue
        names = re.findall(r"name:\s*'([^']*)'", content)
        seen = {}
        for name in names:
            if name in seen:
                seen[name] += 1
            else:
                seen[name] = 1
        dups = {n: c for n, c in seen.items() if c > 1}
        if dups:
            basename = os.path.basename(filepath)
            print(f"  DUPLICATES in {basename}: {dups}")
            duplicates_found = True
    return duplicates_found

def main():
    print("=== Normalizing non-ASCII names ===")
    changed = 0
    for filepath in sorted(glob.glob(os.path.join(DATA_DIR, "**", "*.ts"), recursive=True)):
        if process_file(filepath):
            print(f"  Fixed: {os.path.basename(filepath)}")
            changed += 1
    print(f"\n{changed} files normalized.")

    print("\n=== Checking for duplicate driver names ===")
    dups = check_duplicates()
    if not dups:
        print("  No duplicates found.")
    else:
        print("\n  *** Duplicates found - need manual review ***")

if __name__ == "__main__":
    main()
