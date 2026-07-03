// Staff & facilities (Living Universe Phase 1 — types only).
//
// Facilities are long-term, upgradeable assets that compound over many seasons:
// they affect development speed/success, setup feedback quality, repair speed,
// youth development, scouting, recruitment and carryover. Money in $M.

export type FacilityType =
  | 'WindTunnel'
  | 'Simulator'
  | 'Factory'
  | 'Manufacturing'
  | 'ReliabilityLab'
  | 'PitCrewCenter'
  | 'DriverAcademy'
  | 'DataCenter'
  | 'ScoutingNetwork';

// A team's declared facility specialization direction. Choosing a path grants a
// bonus to the associated facilities' effects, but locks the team into that
// direction for the season. This gives each team a recognizable infrastructure
// identity beyond just upgrading everything uniformly.
export type FacilitySpecialization =
  | 'AeroFocused'      // WindTunnel + DataCenter get +25% effect
  | 'ReliabilityFocused' // ReliabilityLab + Manufacturing get +25% effect
  | 'YouthFocused'     // DriverAcademy + Simulator get +25% effect
  | 'ProductionFocused' // Factory + Manufacturing get +25% effect
  | 'Balanced';        // no bonus, no penalty

export const FACILITY_SPECIALIZATION_LABELS: Record<FacilitySpecialization, string> = {
  AeroFocused: 'Aero-Focused',
  ReliabilityFocused: 'Reliability-Focused',
  YouthFocused: 'Youth-Focused',
  ProductionFocused: 'Production-Focused',
  Balanced: 'Balanced',
};

export const FACILITY_SPECIALIZATION_DESCRIPTIONS: Record<FacilitySpecialization, string> = {
  AeroFocused: 'Wind Tunnel and Data Center effects boosted by 25%.',
  ReliabilityFocused: 'Reliability Lab and Manufacturing effects boosted by 25%.',
  YouthFocused: 'Driver Academy and Simulator effects boosted by 25%.',
  ProductionFocused: 'Factory and Manufacturing effects boosted by 25%.',
  Balanced: 'No specialization bonus — all facilities operate at base efficiency.',
};

export type Facility = {
  id: string;
  teamId: string;
  type: FacilityType;
  level: number;
  maxLevel: number;
  upgradeCost: number; // $M to reach the next level
  upgradeDurationWeeks: number;
  // Named effect contributions, e.g. { developmentSpeed: 0.1, repairSpeed: 0.05 }.
  effects: Record<string, number>;
};

// An in-progress facility upgrade, resolved after its duration elapses.
export type FacilityUpgradeOrder = {
  facilityId: string;
  fromLevel: number;
  toLevel: number;
  startedSeasonYear: number;
  weeksRemaining: number;
  cost: number;
};

// The player team's facilities state, persisted in career mode.
export type FacilitiesState = {
  teamId: string;
  facilities: Facility[];
  pendingUpgrades: FacilityUpgradeOrder[];
  specialization?: FacilitySpecialization;
};
