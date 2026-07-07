# Phase 0 Master Schema Full-Run Notes

## Scope
- Global registries are built from the full master workbooks.
- Driver identity, DOB, nationality, and trait enrichment are canonicalized from the driver registry workbook when a name match is found.
- Missing DOBs fall back to the Wikipedia-scraped supplemental dataset keyed by driver identity and series.
- Season bundles are emitted for all supported seasons and series combinations in the full calendar.

## Rescaling rules
- Existing 1-10 ratings are multiplied by 10 and clamped to 1-100.
- Existing 1-100 workbook fields are preserved as-is.
- Derived fields are computed from nearby source signals and then rounded to whole integers.

## Driver derivation rules
- `overall` is the average of the authored skill block, never copied from source.
- `startsRestarts`, `wetWeather`, `tireManagement`, `pressureHandling`, `feedbackQuality`, `technicalUnderstanding`, and `mechanicalSympathy` are derived from adjacent skills.
- `potential`, `developmentPotential`, `morale`, `trust`, `reputation`, `marketValue`, and contract salary are first-pass stand-ins derived from `overall`.
- Trailing rookie/status tokens are stripped from driver names before canonical IDs are built.
- Abbreviated season names are expanded to the registry's canonical full names when initials + surname matching resolves them.
- Driver and principal display names are ASCII-folded so emitted data contains no accents or abbreviated forms.
- Duplicate driver records that collapse after normalization are merged into one global entity with a combined career timeline.
- Composite shared-seat names are split on `/` and treated as separate driver identities instead of one franken-driver.
- Header/placeholder rows such as `Country` are dropped during source parsing.
- `Early Bloomer` or `Late Bloomer` is added when the registry provides a full DOB month.
- CART-only drivers that do not exist in the F1/IndyCar registry are listed in the gap report for later sourcing.

## Car derivation rules
- `fuelEnergyEfficiency`, `drag`, `downforce`, `chassisBalance`, `cooling`, `weightEfficiency`, `brakingStability`, `acceleration`, `topSpeed`, `tireWear`, `tireWarmup`, `tempControl`, `wetPerformance`, `setupWindow`, and `upgradeCompatibility` are derived from the available base ratings.
- `carOverall` is derived from the expanded car block and is never authored directly.

## Track derivation rules
- Season-by-season track workbook data is authoritative for per-race laps, distance, and track attributes/demand profile.
- Master track list data is authoritative for per-venue length and alias matching.

## Team / supplier / principal rules
- Team records use the lineage workbook as the canonical identity source.
- Team ratings are normalized from workbook values and/or season car ratings where needed.
- Suppliers are derived from the engine/chassis history workbook and backed by associated team-season signals when the supplier sheet lacks direct ratings.
- Principals are taken from the leadership workbook; generated principals are preserved where the source workbook labels them generated.

## Youth notes
- F1 youth comes from the real youth workbook.
- IndyCar youth comes from the real youth workbook.
- CART youth remains synthetic placeholder data and must be revisited before scale-up.

## Unmapped / review items
- Some source driver names are abbreviated (for example `D Coulthard`), so cleaned abbreviations are used unless an explicit alias is available.
- Supplier ratings are partly derived because the supplier master sheet does not provide a native 1-100 rating block.
- All 86 season bundles are emitted in this full regeneration pass.
