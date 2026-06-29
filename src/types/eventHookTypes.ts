// Historical event hooks (Living Universe Phase 1 — types only).
//
// Each season can fire historical or alternate-history events: a manufacturer
// entering, a sponsor withdrawal, a team in financial crisis, a driver
// retirement/injury, a regulation reset, calendar/track changes, rebrands, etc.
// In historical mode some are likely/scripted; in career mode some are dynamic.

export type EventTriggerType =
  | 'FixedDate'
  | 'Conditional'
  | 'RandomChance'
  | 'CareerModeOnly';

export type HistoricalEventCategory =
  | 'Manufacturer'
  | 'Financial'
  | 'Sponsor'
  | 'EngineSupplier'
  | 'Driver'
  | 'Regulation'
  | 'Calendar'
  | 'Team';

export type HistoricalEventHook = {
  id: string;
  seasonYear: number;
  title: string;
  description: string;
  category: HistoricalEventCategory;
  triggerType: EventTriggerType;
  probability?: number; // 0-1 for RandomChance
  conditions?: string[]; // human-readable condition keys for Conditional
  // Named effects applied when the event fires.
  effects: Record<string, unknown>;
  canBePrevented?: boolean;
};

// A record of an event that actually fired in a save, for the universe history.
export type FiredEvent = {
  hookId: string;
  seasonYear: number;
  title: string;
  resolved: boolean;
  prevented?: boolean;
};
