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
};
