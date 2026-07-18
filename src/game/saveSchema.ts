// Increment whenever persisted GameState requires a migration/backfill.
// Saves created before this field existed are treated as schema version 0.
export const CURRENT_SAVE_SCHEMA_VERSION = 2;
