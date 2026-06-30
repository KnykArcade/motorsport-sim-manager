// Facilities: long-term, upgradeable assets that compound over many seasons.
// They feed concrete gameplay effects (development success, setup feedback,
// repair costs, youth development). Upgrades are ordered (and paid for) during a
// season and resolved at the next season rollover, so they behave as long-term
// investments. Pure and deterministic. Money in $M.

import type {
  Facility,
  FacilityType,
  FacilitiesState,
  FacilityUpgradeOrder,
} from '../types/facilityTypes';

// Canonical effect keys produced by facilities.
export type FacilityEffectKey =
  | 'developmentSuccess' // + to development project success chance (0-1)
  | 'developmentSpeed' // + fraction to development progress per race
  | 'setupFeedback' // + flat setup-confidence points (0-100 scale)
  | 'repairCostReduction' // fraction of crash repair cost waived (0-1)
  | 'youthDevelopment' // + fraction to academy progression per offseason
  | 'pitStop' // + to effective pit-crew operations
  | 'reliability' // + to effective reliability
  | 'scouting'; // + scouting accuracy (used by a later phase)

type FacilitySpec = {
  label: string;
  description: string;
  maxLevel: number;
  baseUpgradeCost: number; // $M to go from L1 -> L2; scales with current level
  upgradeWeeks: number;
  // Effect magnitude granted PER LEVEL (total at level L = perLevel * L).
  perLevel: Partial<Record<FacilityEffectKey, number>>;
};

export const FACILITY_SPECS: Record<FacilityType, FacilitySpec> = {
  WindTunnel: {
    label: 'Wind Tunnel',
    description: 'Aero research — raises development success and speed.',
    maxLevel: 5,
    baseUpgradeCost: 6,
    upgradeWeeks: 24,
    perLevel: { developmentSuccess: 0.02, developmentSpeed: 0.05 },
  },
  Simulator: {
    label: 'Simulator',
    description: 'Driver-in-the-loop sim — better setup feedback and driver growth.',
    maxLevel: 5,
    baseUpgradeCost: 4,
    upgradeWeeks: 16,
    perLevel: { setupFeedback: 1.5, youthDevelopment: 0.02 },
  },
  Factory: {
    label: 'Factory',
    description: 'Design & build capacity — faster development turnaround.',
    maxLevel: 5,
    baseUpgradeCost: 5,
    upgradeWeeks: 24,
    perLevel: { developmentSpeed: 0.06 },
  },
  Manufacturing: {
    label: 'Manufacturing',
    description: 'In-house parts quality — cheaper repairs, better reliability.',
    maxLevel: 5,
    baseUpgradeCost: 4,
    upgradeWeeks: 20,
    perLevel: { repairCostReduction: 0.05, reliability: 0.4 },
  },
  ReliabilityLab: {
    label: 'Reliability Lab',
    description: 'Stress-testing rig — fewer failures, cheaper repairs.',
    maxLevel: 5,
    baseUpgradeCost: 3.5,
    upgradeWeeks: 18,
    perLevel: { repairCostReduction: 0.04, reliability: 0.5 },
  },
  PitCrewCenter: {
    label: 'Pit Crew Center',
    description: 'Training facility — sharper pit-stop execution.',
    maxLevel: 5,
    baseUpgradeCost: 2.5,
    upgradeWeeks: 12,
    perLevel: { pitStop: 0.4 },
  },
  DriverAcademy: {
    label: 'Driver Academy',
    description: 'Youth program — faster academy progression.',
    maxLevel: 5,
    baseUpgradeCost: 3,
    upgradeWeeks: 20,
    perLevel: { youthDevelopment: 0.06 },
  },
  DataCenter: {
    label: 'Data Center',
    description: 'Compute & analytics — aids development and setup work.',
    maxLevel: 5,
    baseUpgradeCost: 3,
    upgradeWeeks: 16,
    perLevel: { developmentSuccess: 0.015, setupFeedback: 1 },
  },
  ScoutingNetwork: {
    label: 'Scouting Network',
    description: 'Global scouts — improves talent assessment accuracy.',
    maxLevel: 5,
    baseUpgradeCost: 2,
    upgradeWeeks: 14,
    perLevel: { scouting: 0.1 },
  },
};

const FACILITY_TYPES = Object.keys(FACILITY_SPECS) as FacilityType[];

function effectsAtLevel(type: FacilityType, level: number): Record<string, number> {
  const spec = FACILITY_SPECS[type];
  const out: Record<string, number> = {};
  for (const [key, perLevel] of Object.entries(spec.perLevel)) {
    out[key] = Math.round(perLevel * level * 1000) / 1000;
  }
  return out;
}

// $M required to take a facility from its current level to the next.
export function upgradeCostFor(facility: Facility): number {
  return Math.round(FACILITY_SPECS[facility.type].baseUpgradeCost * facility.level * 10) / 10;
}

export function canUpgrade(facility: Facility): boolean {
  return facility.level < facility.maxLevel;
}

function buildFacility(teamId: string, type: FacilityType, level: number): Facility {
  const spec = FACILITY_SPECS[type];
  const lvl = Math.max(1, Math.min(spec.maxLevel, level));
  const base: Facility = {
    id: `fac-${teamId}-${type}`,
    teamId,
    type,
    level: lvl,
    maxLevel: spec.maxLevel,
    upgradeCost: 0,
    upgradeDurationWeeks: spec.upgradeWeeks,
    effects: effectsAtLevel(type, lvl),
  };
  base.upgradeCost = upgradeCostFor(base);
  return base;
}

// All facilities start near the bottom; a higher-reputation team begins a touch
// further along (rep is 1-100 -> +0..2 starting levels).
export function createInitialFacilities(teamId: string, reputation = 0): FacilitiesState {
  const startLevel = 1 + Math.min(2, Math.floor(reputation / 35));
  return {
    teamId,
    facilities: FACILITY_TYPES.map((type) => buildFacility(teamId, type, startLevel)),
    pendingUpgrades: [],
  };
}

// Aggregate a single named effect across all of a team's facilities.
export function facilityEffect(
  facilities: FacilitiesState | undefined,
  key: FacilityEffectKey,
): number {
  if (!facilities) return 0;
  return facilities.facilities.reduce((sum, f) => sum + (f.effects[key] ?? 0), 0);
}

export function facilityDevelopmentSuccessBonus(f?: FacilitiesState): number {
  return Math.min(0.25, facilityEffect(f, 'developmentSuccess'));
}
export function facilitySetupFeedbackBonus(f?: FacilitiesState): number {
  return Math.min(15, facilityEffect(f, 'setupFeedback'));
}
export function facilityRepairCostReduction(f?: FacilitiesState): number {
  return Math.min(0.6, facilityEffect(f, 'repairCostReduction'));
}
export function facilityYouthDevelopmentBonus(f?: FacilitiesState): number {
  return Math.min(0.6, facilityEffect(f, 'youthDevelopment'));
}

// Order an upgrade: returns the new state plus the $M cost to charge, or null if
// the facility is already maxed or has a pending order.
export function orderUpgrade(
  state: FacilitiesState,
  facilityId: string,
): { state: FacilitiesState; cost: number } | null {
  const facility = state.facilities.find((f) => f.id === facilityId);
  if (!facility || !canUpgrade(facility)) return null;
  if (state.pendingUpgrades.some((u) => u.facilityId === facilityId)) return null;
  const cost = upgradeCostFor(facility);
  const order: FacilityUpgradeOrder = {
    facilityId,
    fromLevel: facility.level,
    toLevel: facility.level + 1,
    startedSeasonYear: 0,
    weeksRemaining: facility.upgradeDurationWeeks,
    cost,
  };
  return { state: { ...state, pendingUpgrades: [...state.pendingUpgrades, order] }, cost };
}

// Resolve all pending upgrades (called at the season rollover): each ordered
// facility advances one level and effects/next-cost are recomputed.
export function resolvePendingUpgrades(state: FacilitiesState): {
  state: FacilitiesState;
  completed: FacilityUpgradeOrder[];
} {
  if (state.pendingUpgrades.length === 0) return { state, completed: [] };
  const completed = state.pendingUpgrades;
  const facilities = state.facilities.map((f) => {
    const order = completed.find((u) => u.facilityId === f.id);
    if (!order) return f;
    return buildFacility(f.teamId, f.type, order.toLevel);
  });
  return { state: { ...state, facilities, pendingUpgrades: [] }, completed };
}
