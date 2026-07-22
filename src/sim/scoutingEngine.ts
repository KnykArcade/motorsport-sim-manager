// Scouting / fog of war (Living Universe Phase 9).
//
// A driver's current form is observable from racing, but their true ceiling is
// not: market drivers, youth prospects and (optionally) staff are seen through
// fog. A target's *potential* is shown as a range and its skills may read
// "Unknown" until you invest scouting effort. Accuracy rises with the effort you
// spend on a target and with your Scouting Network facility, narrowing the range
// and sharpening the skills toward the truth. Pure and deterministic.

import type { FacilitiesState } from '../types/facilityTypes';
import type { Driver, DriverRatings } from '../types/gameTypes';
import type { StaffMember } from '../types/staffTypes';
import type { MarketSkillRatings } from '../types/marketTypes';
import type {
  ScoutedEntityType,
  ScoutingReport,
  ScoutingState,
  VisibleRating,
} from '../types/scoutingTypes';
import { facilityEffect } from './facilityEngine';
import { MILLION } from './financeEngine';
import { createSeededRandom, deriveSeed } from './random';

const SKILL_KEYS: (keyof MarketSkillRatings)[] = [
  'cornering',
  'braking',
  'straights',
  'tractionAcceleration',
  'elevationBlindCorners',
  'technical',
  'overtakingRacecraft',
  'surfaceGripBumpiness',
  'riskManagement',
  'enduranceConsistency',
];

// Effort added to a target each time you scout it (0-100 scale). A better
// Scouting Network makes each trip more productive.
const SCOUT_STEP = 25;
// At/above this accuracy a target has the best available report. It still shows
// a narrow range, not confirmed truth.
const REVEAL_ACCURACY = 0.9;
// Below this accuracy a skill is too uncertain to show a number at all.
const UNKNOWN_ACCURACY = 0.25;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
function clampRating(n: number): number {
  return Math.max(1, Math.min(100, Math.round(n)));
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Base accuracy conferred by the team's Scouting Network facility (0.15-0.65).
export function scoutingNetworkAccuracy(facilities?: FacilitiesState): number {
  return clamp01(0.15 + Math.min(0.5, facilityEffect(facilities, 'scouting')));
}

// How well a target is known: the network baseline (effort 0) interpolated up to
// best-report certainty at maximum effort, so investing fully narrows a target
// while a stronger network gives a better starting picture.
export function effectiveAccuracy(scoutingLevel: number, networkAccuracy: number): number {
  const effort = clamp01(scoutingLevel / 100);
  return Math.min(0.9, clamp01(networkAccuracy + effort * (1 - networkAccuracy)));
}

export function isRevealed(accuracy: number): boolean {
  return accuracy >= REVEAL_ACCURACY;
}

// A stable per-(entity, key) bias in [-1, 1] so the fog is deterministic but
// each rating is fogged differently (some over-, some under-estimated).
function bias(seed: string, entityId: string, key: string): number {
  return createSeededRandom(deriveSeed(seed, 'scout', entityId, key)).variance(1);
}

// The visible potential: always a range that widens as accuracy falls and is
// recentred by a deterministic bias.
export function visiblePotentialRange(
  truePotential: number,
  accuracy: number,
  seed: string,
  entityId: string,
  entityType: ScoutedEntityType = 'Driver',
): [number, number] {
  const youth = entityType === 'YouthProspect';
  const spread = (1 - accuracy) * (youth ? 40 : 25);
  const adjustedSpread = Math.max(youth ? 11 : 4, spread * (youth ? 1.15 : 1.28));
  const center = clampRating(truePotential + bias(seed, entityId, 'potential') * adjustedSpread * 0.5);
  return [round1(clampRating(center - adjustedSpread)), round1(clampRating(center + adjustedSpread))];
}

// The visible value of a single skill: 'Unknown' when too poorly scouted,
// otherwise a noisy range. Even the best report never confirms the true value.
export function visibleSkill(
  trueValue: number,
  accuracy: number,
  seed: string,
  entityId: string,
  key: string,
  entityType: ScoutedEntityType = 'Driver',
): VisibleRating {
  if (accuracy < UNKNOWN_ACCURACY) return 'Unknown';
  const youth = entityType === 'YouthProspect';
  const spread = Math.max(youth ? 8 : 3, (1 - accuracy) * (youth ? 38 : 28));
  const center = clampRating(trueValue + bias(seed, entityId, key) * spread * 0.5);
  return [round1(clampRating(center - spread)), round1(clampRating(center + spread))];
}

export type ScoutTarget = {
  id: string;
  skills: MarketSkillRatings;
  potential: number;
};

export function driverScoutTarget(driver: Pick<Driver, 'id' | 'ratings'>): ScoutTarget {
  return {
    id: driver.id,
    skills: driverRatingsToMarketSkills(driver.ratings),
    potential: driver.ratings.overall,
  };
}

export function staffScoutTarget(staff: Pick<StaffMember, 'id' | 'rating'>): ScoutTarget {
  const rating = staff.rating <= 10 ? staff.rating * 10 : staff.rating;
  const skills = Object.fromEntries(SKILL_KEYS.map((key) => [key, rating])) as unknown as MarketSkillRatings;
  return { id: staff.id, skills, potential: rating };
}

function driverRatingsToMarketSkills(ratings: DriverRatings): MarketSkillRatings {
  return {
    cornering: ratings.cornering,
    braking: ratings.braking,
    straights: ratings.straights,
    tractionAcceleration: ratings.tractionAcceleration,
    elevationBlindCorners: ratings.elevationBlindCorners,
    technical: ratings.technical,
    overtakingRacecraft: ratings.overtakingRacecraft,
    surfaceGripBumpiness: ratings.surfaceGripBumpiness,
    riskManagement: ratings.riskManagement,
    enduranceConsistency: ratings.enduranceConsistency,
  };
}

// Build (or rebuild) the scouting report for a target at a given effort level.
export function buildScoutingReport(
  target: ScoutTarget,
  entityType: ScoutedEntityType,
  scoutingLevel: number,
  networkAccuracy: number,
  seed: string,
  now: string,
): ScoutingReport {
  const accuracy = effectiveAccuracy(scoutingLevel, networkAccuracy);
  const visibleRatings: Record<string, VisibleRating> = {};
  for (const key of SKILL_KEYS) {
    visibleRatings[key] = visibleSkill(target.skills[key], accuracy, seed, target.id, key, entityType);
  }
  const notes: string[] = [];
  if (isRevealed(accuracy)) {
    notes.push('Fully scouted — ratings confirmed.');
  } else if (accuracy >= UNKNOWN_ACCURACY) {
    notes.push('Partially scouted — figures are estimates.');
  } else {
    notes.push('Barely known — invest scouting to learn more.');
  }
  if (isRevealed(accuracy)) notes[0] = 'Best available report - ratings remain projected ranges.';
  return {
    entityId: target.id,
    entityType,
    scoutingLevel,
    accuracy: round1(accuracy * 100) / 100,
    visibleRatings,
    potentialRange: visiblePotentialRange(target.potential, accuracy, seed, target.id, entityType),
    notes,
    lastUpdated: now,
  };
}

// Base cost ($M) of one scouting trip by target type — established senior
// drivers cost more to scout than youth/staff.
const SCOUT_BASE_COST_M: Record<ScoutedEntityType, number> = {
  Driver: 0.6,
  YouthProspect: 0.35,
  Staff: 0.4,
};

// The cost (raw dollars) of the next scouting trip on a target. Refining a
// target you already know is progressively more expensive (deeper intel), so
// cost scales with the effort already invested.
export function scoutingCost(entityType: ScoutedEntityType, currentScoutingLevel: number): number {
  const baseM = SCOUT_BASE_COST_M[entityType];
  const refinement = 1 + clamp01(currentScoutingLevel / 100) * 0.8;
  return Math.round(baseM * refinement * MILLION);
}

export function createInitialScoutingState(
  teamId: string,
  facilities?: FacilitiesState,
): ScoutingState {
  return {
    teamId,
    networkAccuracy: scoutingNetworkAccuracy(facilities),
    reports: {},
    activeAssignments: [],
    shortlist: [],
  };
}

// Spend one round of scouting effort on a target: raise its effort level (faster
// with a stronger network) and rebuild its report. Pure — returns new state.
export function recordScouting(
  state: ScoutingState,
  target: ScoutTarget,
  entityType: ScoutedEntityType,
  facilities: FacilitiesState | undefined,
  seed: string,
  now: string,
): ScoutingState {
  const networkAccuracy = scoutingNetworkAccuracy(facilities);
  const existing = state.reports[target.id];
  const step = SCOUT_STEP + Math.min(25, Math.round(facilityEffect(facilities, 'scouting') * 50));
  const scoutingLevel = Math.min(100, (existing?.scoutingLevel ?? 0) + step);
  const report = buildScoutingReport(target, entityType, scoutingLevel, networkAccuracy, seed, now);
  return {
    ...state,
    networkAccuracy,
    reports: { ...state.reports, [target.id]: report },
  };
}

export type FogView = {
  accuracy: number;
  revealed: boolean;
  maxed: boolean;
  potential: { revealed: boolean; value?: number; range: [number, number] };
  skills: Record<string, VisibleRating>;
  notes: string[];
};

// The fogged view of a target for display: uses an existing report when present,
// otherwise the network-only baseline (unscouted). Combines per-target effort
// with the live network accuracy so facility upgrades sharpen old reports too.
export function fogView(
  target: ScoutTarget,
  report: ScoutingReport | undefined,
  networkAccuracy: number,
  seed: string,
  entityType: ScoutedEntityType = report?.entityType ?? 'Driver',
): FogView {
  const scoutingLevel = report?.scoutingLevel ?? 0;
  const accuracy = effectiveAccuracy(scoutingLevel, networkAccuracy);
  const revealed = isRevealed(accuracy);
  const range = visiblePotentialRange(target.potential, accuracy, seed, target.id, entityType);
  const skills: Record<string, VisibleRating> = {};
  for (const key of SKILL_KEYS) {
    skills[key] = visibleSkill(target.skills[key], accuracy, seed, target.id, key, entityType);
  }
  return {
    accuracy,
    revealed,
    maxed: scoutingLevel >= 100,
    potential: { revealed, value: undefined, range },
    skills,
    notes: report?.notes ?? ['Unscouted — assign scouts to learn the true ceiling.'],
  };
}

// Refresh stored reports against the current network accuracy (called at the
// season rollover, when facility upgrades may have completed). Effort levels are
// retained; only the derived figures are recomputed.
export function refreshScoutingNetwork(
  state: ScoutingState | undefined,
  facilities: FacilitiesState | undefined,
): ScoutingState | undefined {
  if (!state) return state;
  return { ...state, networkAccuracy: scoutingNetworkAccuracy(facilities) };
}
