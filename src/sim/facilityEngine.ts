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
  FacilitySpecialization,
} from '../types/facilityTypes';
import type {
  DevelopmentCategory,
  ProjectRiskLevel,
  DevelopmentOutcome,
} from '../types/gameTypes';

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

// Which facility types each specialization boosts.
export const SPECIALIZATION_FACILITIES: Record<FacilitySpecialization, FacilityType[]> = {
  AeroFocused: ['WindTunnel', 'DataCenter'],
  ReliabilityFocused: ['ReliabilityLab', 'Manufacturing'],
  YouthFocused: ['DriverAcademy', 'Simulator'],
  ProductionFocused: ['Factory', 'Manufacturing'],
  Balanced: [],
};

const SPECIALIZATION_BONUS = 0.25; // +25% effect for boosted facilities

// Apply specialization bonus to a single facility's effects.
function applySpecializationBonus(
  facility: Facility,
  specialization: FacilitySpecialization | undefined,
): Record<string, number> {
  if (!specialization || specialization === 'Balanced') return facility.effects;
  const boosted = SPECIALIZATION_FACILITIES[specialization];
  if (!boosted.includes(facility.type)) return facility.effects;
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(facility.effects)) {
    out[key] = Math.round(value * (1 + SPECIALIZATION_BONUS) * 1000) / 1000;
  }
  return out;
}

// Compute effective facility effects accounting for specialization.
export function effectiveFacilityEffects(
  facility: Facility,
  state: FacilitiesState | undefined,
): Record<string, number> {
  return applySpecializationBonus(facility, state?.specialization);
}

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

// Aggregate a single named effect across all of a team's facilities, applying
// specialization bonuses where applicable.
export function facilityEffect(
  facilities: FacilitiesState | undefined,
  key: FacilityEffectKey,
): number {
  if (!facilities) return 0;
  return facilities.facilities.reduce(
    (sum, f) => sum + (applySpecializationBonus(f, facilities.specialization)[key] ?? 0),
    0,
  );
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

// ---------------------------------------------------------------------------
// Development overhaul: facility-driven slots, time, outcomes
// ---------------------------------------------------------------------------

// Maps each development category to the facility types that influence it.
export const CATEGORY_FACILITY_MAP: Record<DevelopmentCategory, FacilityType[]> = {
  Engine: ['Factory', 'DataCenter'],
  Aero: ['WindTunnel', 'DataCenter'],
  Mechanical: ['Factory', 'Manufacturing'],
  Reliability: ['ReliabilityLab', 'Manufacturing'],
  PitCrew: ['PitCrewCenter'],
  Strategy: ['Simulator', 'DataCenter'],
  Driver: ['DriverAcademy', 'Simulator'],
  Facilities: ['Factory'],
  Research: ['WindTunnel', 'DataCenter', 'Simulator'],
};

// Average level of the facilities relevant to a development category (1-5).
// Falls back to the overall average if no specific facilities are found.
export function relevantFacilityLevel(
  facilities: FacilitiesState | undefined,
  category: DevelopmentCategory,
): number {
  if (!facilities) return 1;
  const relevantTypes = CATEGORY_FACILITY_MAP[category] ?? [];
  const relevant = facilities.facilities.filter((f) => relevantTypes.includes(f.type));
  if (relevant.length === 0) {
    const all = facilities.facilities;
    return all.reduce((sum, f) => sum + f.level, 0) / all.length;
  }
  return relevant.reduce((sum, f) => sum + f.level, 0) / relevant.length;
}

// Development slots: 1 slot per facility level (1-5), based on the average
// level of ALL facilities. This makes every facility upgrade matter for
// project throughput.
export function developmentSlots(facilities: FacilitiesState | undefined): number {
  if (!facilities) return 1;
  const avg =
    facilities.facilities.reduce((sum, f) => sum + f.level, 0) /
    facilities.facilities.length;
  return Math.max(1, Math.round(avg));
}

// Time multiplier based on relevant facility level (1-5).
// Level 1: x1.40, Level 2: x1.20, Level 3: x1.00, Level 4: x0.85, Level 5: x0.70
export function facilityTimeMultiplier(facilityLevel: number): number {
  const table = [1.4, 1.2, 1.0, 0.85, 0.7];
  const idx = Math.max(0, Math.min(4, Math.round(facilityLevel) - 1));
  return table[idx];
}

// Impact multiplier based on facility level (1-5).
// Higher facilities amplify the magnitude of development gains.
export function facilityImpactMultiplier(facilityLevel: number): number {
  const table = [0.8, 0.9, 1.0, 1.1, 1.2];
  const idx = Math.max(0, Math.min(4, Math.round(facilityLevel) - 1));
  return table[idx];
}

// Outcome probability table by facility level (1-5) and risk level.
// Returns probabilities for each DevelopmentOutcome.
// The probabilities sum to 1.0.
export type OutcomeChances = Record<DevelopmentOutcome, number>;

export function facilityOutcomeChances(
  facilityLevel: number,
  riskLevel: ProjectRiskLevel,
  staffBonus = 0,
): OutcomeChances {
  const lvl = Math.max(1, Math.min(5, Math.round(facilityLevel)));

  // Base success distribution by facility level (1-5).
  // Higher facilities shift probability from failure toward great success.
  const baseByLevel: Record<number, OutcomeChances> = {
    1: { GreatSuccess: 0.03, FullSuccess: 0.12, PartialSuccess: 0.25, MinorSuccess: 0.25, Failed: 0.33, RareBackfire: 0.02 },
    2: { GreatSuccess: 0.06, FullSuccess: 0.20, PartialSuccess: 0.30, MinorSuccess: 0.24, Failed: 0.17, RareBackfire: 0.03 },
    3: { GreatSuccess: 0.10, FullSuccess: 0.30, PartialSuccess: 0.30, MinorSuccess: 0.18, Failed: 0.10, RareBackfire: 0.02 },
    4: { GreatSuccess: 0.15, FullSuccess: 0.35, PartialSuccess: 0.27, MinorSuccess: 0.13, Failed: 0.08, RareBackfire: 0.02 },
    5: { GreatSuccess: 0.20, FullSuccess: 0.40, PartialSuccess: 0.22, MinorSuccess: 0.10, Failed: 0.06, RareBackfire: 0.02 },
  };

  const chances = { ...baseByLevel[lvl] };

  // Risk level shifts the distribution.
  const riskShifts: Record<ProjectRiskLevel, Partial<OutcomeChances>> = {
    Safe: { GreatSuccess: -0.03, FullSuccess: 0.05, PartialSuccess: 0.05, MinorSuccess: 0.03, Failed: -0.09, RareBackfire: -0.01 },
    Standard: {},
    Aggressive: { GreatSuccess: 0.05, FullSuccess: -0.03, PartialSuccess: -0.05, MinorSuccess: -0.05, Failed: 0.05, RareBackfire: 0.03 },
    Experimental: { GreatSuccess: 0.10, FullSuccess: -0.08, PartialSuccess: -0.08, MinorSuccess: -0.07, Failed: 0.08, RareBackfire: 0.05 },
  };

  const shift = riskShifts[riskLevel];
  for (const key of Object.keys(chances) as DevelopmentOutcome[]) {
    chances[key] = Math.max(0, chances[key] + (shift[key] ?? 0));
  }

  // Staff bonus shifts probability from Failed/MinorSuccess toward FullSuccess/GreatSuccess.
  const bonus = Math.max(-0.15, Math.min(0.2, staffBonus));
  chances.GreatSuccess = Math.max(0, chances.GreatSuccess + bonus * 0.3);
  chances.FullSuccess = Math.max(0, chances.FullSuccess + bonus * 0.4);
  chances.Failed = Math.max(0, chances.Failed - bonus * 0.5);
  chances.MinorSuccess = Math.max(0, chances.MinorSuccess - bonus * 0.2);

  // Normalize to sum 1.0.
  const total = Object.values(chances).reduce((a, b) => a + b, 0);
  if (total > 0) {
    for (const key of Object.keys(chances) as DevelopmentOutcome[]) {
      chances[key] = chances[key] / total;
    }
  }

  return chances;
}

// Estimate an AI team's effective facility level (1-5) from its organization
// ratings (0-100 scale). Used so AI teams follow the same development system.
export function aiFacilityLevel(
  staffQuality: number,
  research: number,
): number {
  const avg = (staffQuality + research) / 2;
  return Math.max(1, Math.min(5, Math.ceil(avg / 20)));
}
