# Master Data Archive and Recovery

This folder preserves a human-readable snapshot of the final driver universe and playable season catalog for 1990-2026. The TypeScript data under `src/data` remains the game's authoritative source. The workbook is a recovery and auditing copy generated from that source, not a second database that must be edited by hand.

## Current preserved baseline

- 1,782 unique real-driver identities
- 9,620 year-specific driver records
- 4,391 active-roster records
- 4,523 adult-market records
- 706 youth-market records
- 123 playable seasons: F1 37, CART 14, Champ Car 4, IndyCar 31, NASCAR 37
- Season range: 1990 through 2026

The archive test rejects a drop below the approved driver-record baseline. It also rejects duplicate driver IDs, unresolved same-identity collisions, generated or placeholder market drivers, duplicate year/series seasons, and driver-history records that do not resolve to a master identity.

## Regenerate the portable recovery files

Run:

```powershell
npm run archive:data
```

This creates `artifacts/master-archive/current/` with:

- `master-archive.json`: the complete normalized archive
- `master-drivers.csv`: one row per driver identity
- `driver-history.csv`: every year-specific active, adult-market, and youth-market record
- `master-seasons.csv`: every playable season
- `manifest.json`: counts, validation results, source commit, and SHA-256 checksums

## Regenerate the Excel workbook

On the Codex Windows workspace, run:

```powershell
npm run archive:workbook
```

That command first regenerates and validates the portable files, then replaces the workbook in this folder and creates visual previews under the ignored `artifacts/master-archive/previews/` directory.

## Restore after accidental data loss

1. Prefer the latest Git commit containing the authoritative `src/data` files.
2. If source history is incomplete, download the newest `Publish Master Data Archive` GitHub release.
3. Verify every portable file against the SHA-256 values in `manifest.json`.
4. Use `master-archive.json` for a programmatic rebuild. Use the CSV files or workbook to inspect and repair individual records.
5. Restore data into the appropriate `src/data` modules; do not make the workbook a runtime dependency.
6. Run `npm run archive:data`, `npm run typecheck`, `npm run lint`, and the complete test suite. The restored result must meet or exceed the preserved baseline and have no integrity violations.

Every CI run uploads a 90-day recovery package. The manual release workflow creates a permanent GitHub release for milestone backups.
