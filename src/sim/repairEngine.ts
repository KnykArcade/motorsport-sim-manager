// Crash damage classification and repair costing. Pure and deterministic: the
// caller supplies a [0,1) roll so the same race state always yields the same
// damage. Mechanical retirements are reliability (not crash damage) and are
// classified as 'None' here.

import type { RaceFinishStatus } from '../types/gameTypes';

export type DamageSeverity = 'None' | 'Light' | 'Moderate' | 'Heavy' | 'Wrecked';

const CRASH_RE = /crash|collision|spun|spin|contact|barrier|gravel|wall|accident|hit/i;
const MINOR_RE = /ran wide|lock-?up|off-?track|moment|damage|wide/i;

const REPAIR_COST: Record<DamageSeverity, number> = {
  None: 0,
  Light: 150_000,
  Moderate: 400_000,
  Heavy: 900_000,
  Wrecked: 1_600_000,
};

// How many condition points the damage removes for the next round (before the
// standard between-race recovery is applied).
const CONDITION_HIT: Record<DamageSeverity, number> = {
  None: 0,
  Light: 8,
  Moderate: 18,
  Heavy: 35,
  Wrecked: 55,
};

export function classifyCrashDamage(
  status: RaceFinishStatus,
  incidents: string[],
  roll = 0,
): DamageSeverity {
  const text = incidents.join(' ');
  const crashed = CRASH_RE.test(text);
  if (status === 'DNF') {
    if (!crashed) return 'None'; // mechanical / non-contact retirement
    return roll < 0.4 ? 'Wrecked' : 'Heavy';
  }
  // Driver finished the race.
  if (crashed) return roll < 0.5 ? 'Moderate' : 'Light';
  if (MINOR_RE.test(text)) return 'Light';
  return 'None';
}

export function repairCost(severity: DamageSeverity): number {
  return REPAIR_COST[severity];
}

export function damageConditionHit(severity: DamageSeverity): number {
  return CONDITION_HIT[severity];
}
