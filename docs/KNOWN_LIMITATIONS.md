# Known Limitations

## regulationSetId

All seasons (F1 1990–2026, IndyCar 2008–2026) currently use `regulationSetId: 'reg-1995'`
as a placeholder. Year-specific regulation data (e.g., refueling bans, DRS introduction,
budget caps, aero formula changes) exists in the source workbooks' `Regulations_Rules_Changes`
sheets but is not yet wired into individual season records.

**Impact:** The simulation does not differentiate rule sets between eras. All seasons
run under the same generic regulation framework.

**Future work:** Create year-specific `reg-YYYY` regulation set objects from the workbook
data and update `gen_season.py` to emit the correct `regulationSetId` per season.

**Test coverage:** `src/data/seasonIntegration.test.ts` includes a test asserting all
seasons use `'reg-1995'`, with a comment explaining this is a documented limitation.
