// Driver Confidence / Trust / Ego system (Living Universe Phase 7 extension).
//
// Event-driven updates to driver self-confidence, trust in car/team/principal,
// ego satisfaction, and overall confidence state. Includes promise management
// and performance impact calculations. Pure and deterministic.

import type { DriverRelationship, ConfidenceState, DriverPromise, PromiseType } from '../types/relationshipTypes';

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

// ---------------------------------------------------------------------------
// Confidence State computation
// ---------------------------------------------------------------------------

export function computeConfidenceState(rel: DriverRelationship): ConfidenceState {
  const score = overallConfidenceScore(rel);
  if (score >= 85) return 'Inspired';
  if (score >= 70) return 'Confident';
  if (score >= 58) return 'Settled';
  if (score >= 45) return 'Neutral';
  if (score >= 30) return 'Concerned';
  if (score >= 18) return 'Frustrated';
  if (score >= 8) return 'Disillusioned';
  return 'Checked Out';
}

export function overallConfidenceScore(rel: DriverRelationship): number {
  return Math.round(
    rel.selfConfidence * 0.30 +
    rel.trustInCar * 0.20 +
    rel.trustInTeam * 0.15 +
    rel.trustInPrincipal * 0.15 +
    rel.morale * 0.15 +
    (100 - rel.frustration) * 0.05,
  );
}

// ---------------------------------------------------------------------------
// Performance impact
// ---------------------------------------------------------------------------

export function confidencePerformanceModifier(rel: DriverRelationship): number {
  const state = computeConfidenceState(rel);
  switch (state) {
    case 'Inspired': return 0.08;
    case 'Confident': return 0.04;
    case 'Settled': return 0.02;
    case 'Neutral': return 0;
    case 'Concerned': return -0.03;
    case 'Frustrated': return -0.06;
    case 'Disillusioned': return -0.10;
    case 'Checked Out': return -0.15;
  }
}

export function egoSatisfaction(rel: DriverRelationship, isFavored: boolean): number {
  const expected = rel.ego / 100;
  const actual = isFavored ? 1 : 0.3;
  return Math.round((actual - expected) * 100);
}

// ---------------------------------------------------------------------------
// Event Reactions
// ---------------------------------------------------------------------------

export type ConfidenceUpdate = {
  driverId: string;
  selfConfidenceDelta?: number;
  trustInCarDelta?: number;
  trustInTeamDelta?: number;
  trustInPrincipalDelta?: number;
  teamTrustInDriverDelta?: number;
  moraleDelta?: number;
  frustrationDelta?: number;
  egoDelta?: number;
  reason?: string;
};

export type RaceEventContext = {
  driverId: string;
  finishingPosition: number;
  totalDrivers: number;
  qualifiedPosition: number;
  dnf: boolean;
  teammateFinishingPosition?: number;
  teammateDNF?: boolean;
  teamOrderIssued: boolean;
  wasFavoredInOrders: boolean;
  wasDisadvantagedInOrders: boolean;
  carReliabilityDNF: boolean;
  strategyRiskLevel: 'conservative' | 'balanced' | 'aggressive';
  pointsScored: number;
  podium: boolean;
  win: boolean;
};

export function reactToRaceResult(
  rel: DriverRelationship,
  ctx: RaceEventContext,
): ConfidenceUpdate[] {
  const updates: ConfidenceUpdate[] = [];
  const traits = rel.personalityTraits;

  // --- Race finish ---
  if (ctx.dnf) {
    const carBlame = ctx.carReliabilityDNF;
    updates.push({
      driverId: ctx.driverId,
      selfConfidenceDelta: carBlame ? -2 : -8,
      trustInCarDelta: carBlame ? -10 : -6,
      frustrationDelta: carBlame ? 7 : 6,
      teamTrustInDriverDelta: carBlame ? -4 : -2,
      moraleDelta: -4,
      reason: carBlame ? 'DNF from car failure' : 'DNF from incident',
    });
    if (!carBlame && ctx.strategyRiskLevel === 'aggressive') {
      updates.push({
        driverId: ctx.driverId,
        selfConfidenceDelta: -3,
        trustInCarDelta: -5,
        trustInPrincipalDelta: -2,
        teamTrustInDriverDelta: -3,
        frustrationDelta: 4,
        reason: 'Aggressive stint ended in incident',
      });
    }
  } else {
    // Position-based confidence.
    const posRatio = ctx.finishingPosition / Math.max(ctx.totalDrivers, 1);
    if (ctx.win) {
      updates.push({
        driverId: ctx.driverId,
        selfConfidenceDelta: 8,
        trustInPrincipalDelta: 2,
        teamTrustInDriverDelta: 5,
        moraleDelta: 8,
        frustrationDelta: rel.frustration >= 45 ? -12 : -7,
        reason: 'Race win',
      });
    } else if (ctx.podium) {
      updates.push({
        driverId: ctx.driverId,
        selfConfidenceDelta: 5,
        trustInPrincipalDelta: 1,
        teamTrustInDriverDelta: 3,
        moraleDelta: 5,
        frustrationDelta: rel.frustration >= 45 ? -8 : -4,
        reason: 'Podium finish',
      });
    } else if (posRatio <= 0.5) {
      updates.push({
        driverId: ctx.driverId,
        selfConfidenceDelta: 2,
        teamTrustInDriverDelta: 1,
        moraleDelta: 1,
        frustrationDelta: -1,
        reason: 'Top-half finish',
      });
    } else if (posRatio > 0.75) {
      updates.push({
        driverId: ctx.driverId,
        selfConfidenceDelta: -2,
        trustInPrincipalDelta: rel.frustration >= 45 ? -2 : -1,
        teamTrustInDriverDelta: -2,
        frustrationDelta: rel.frustration >= 45 ? 5 : 2,
        moraleDelta: -1,
        reason: rel.frustration >= 45 ? 'Poor finish revived prior frustration' : 'Poor finish',
      });
    }
    if (ctx.finishingPosition <= Math.ceil(ctx.totalDrivers * 0.6)) {
      updates.push({
        driverId: ctx.driverId,
        trustInCarDelta: ctx.podium || ctx.win ? 3 : 2,
        teamTrustInDriverDelta: ctx.podium || ctx.win ? 2 : 1,
        frustrationDelta: rel.trustInCar < 45 ? -2 : -1,
        reason: 'Clean finish rebuilt trust in car',
      });
    }
  }

  // --- Qualifying vs race delta ---
  if (!ctx.dnf && ctx.qualifiedPosition > 0) {
    const qualDelta = ctx.qualifiedPosition - ctx.finishingPosition;
    if (qualDelta >= 3) {
      updates.push({
        driverId: ctx.driverId,
        selfConfidenceDelta: 3,
        trustInCarDelta: 2,
        teamTrustInDriverDelta: 1,
        reason: 'Gained positions in race',
      });
    } else if (qualDelta <= -3) {
      updates.push({
        driverId: ctx.driverId,
        selfConfidenceDelta: -2,
        teamTrustInDriverDelta: -1,
        frustrationDelta: 2,
        reason: 'Lost positions in race',
      });
    }
  }

  // --- Teammate comparison ---
  if (!ctx.dnf && ctx.teammateFinishingPosition !== undefined && !ctx.teammateDNF) {
    const beatTeammate = ctx.finishingPosition < ctx.teammateFinishingPosition;
    if (beatTeammate) {
      const egoBoost = traits.includes('High Ego') ? 4 : 2;
      updates.push({
        driverId: ctx.driverId,
        selfConfidenceDelta: egoBoost,
        teamTrustInDriverDelta: 1,
        moraleDelta: 2,
        reason: 'Beat teammate',
      });
    } else {
      const egoHit = traits.includes('High Ego') ? -5 : -2;
      updates.push({
        driverId: ctx.driverId,
        selfConfidenceDelta: egoHit,
        teamTrustInDriverDelta: -1,
        frustrationDelta: traits.includes('Rivalry Prone') ? 4 : 2,
        reason: 'Finished behind teammate',
      });
    }
  }

  // --- Team orders ---
  if (ctx.teamOrderIssued) {
    if (ctx.wasFavoredInOrders) {
      updates.push({
        driverId: ctx.driverId,
        trustInPrincipalDelta: 3,
        teamTrustInDriverDelta: 1,
        moraleDelta: 2,
        egoDelta: traits.includes('High Ego') ? 3 : 1,
        reason: 'Favored by team orders',
      });
    } else if (ctx.wasDisadvantagedInOrders) {
      const egoHit = rel.numberOneExpectation ? -8 : -4;
      updates.push({
        driverId: ctx.driverId,
        trustInPrincipalDelta: -5,
        teamTrustInDriverDelta: -3,
        moraleDelta: -3,
        frustrationDelta: 4,
        egoDelta: egoHit,
        reason: 'Disadvantaged by team orders',
      });
    }
  }

  // --- Strategy ---
  if (ctx.strategyRiskLevel === 'aggressive' && !ctx.dnf) {
    const nervousInCar = rel.trustInCar < 45 || rel.selfConfidence < 45;
    updates.push({
      driverId: ctx.driverId,
      trustInTeamDelta: ctx.finishingPosition <= 3 ? 3 : -2,
      trustInPrincipalDelta: ctx.finishingPosition <= 3 ? 2 : (nervousInCar ? -3 : -1),
      trustInCarDelta: nervousInCar && ctx.finishingPosition > 6 ? -2 : 0,
      teamTrustInDriverDelta: ctx.finishingPosition <= 3 ? 2 : -1,
      frustrationDelta: nervousInCar && ctx.finishingPosition > 6 ? 3 : 0,
      reason: nervousInCar ? 'Aggressive strategy in low-trust car' : 'Aggressive strategy',
    });
  } else if (ctx.strategyRiskLevel === 'conservative' && traits.includes('Ambitious')) {
    updates.push({
      driverId: ctx.driverId,
      frustrationDelta: 2,
      trustInPrincipalDelta: -1,
      reason: 'Conservative strategy frustrated ambitious driver',
    });
  }

  // --- Points ---
  if (ctx.pointsScored > 0 && !ctx.win && !ctx.podium) {
    updates.push({
      driverId: ctx.driverId,
      selfConfidenceDelta: 1,
      moraleDelta: 1,
      reason: 'Scored points',
    });
  }

  // --- Trait-based reactions ---
  if (traits.includes('Pressure Sensitive') && ctx.finishingPosition > 10 && !ctx.dnf) {
    updates.push({
      driverId: ctx.driverId,
      selfConfidenceDelta: -3,
      frustrationDelta: 3,
      reason: 'Pressure-sensitive driver struggled',
    });
  }
  if (traits.includes('Resilient') && ctx.dnf) {
    updates.push({
      driverId: ctx.driverId,
      selfConfidenceDelta: 2,
      frustrationDelta: -2,
      reason: 'Resilient driver bounced back mentally',
    });
  }
  if (traits.includes('Confidence Driven')) {
    if (ctx.win || ctx.podium) {
      updates.push({
        driverId: ctx.driverId,
        selfConfidenceDelta: 3,
        teamTrustInDriverDelta: 1,
        reason: 'Confidence-driven driver boosted by strong result',
      });
    } else if (ctx.finishingPosition > 12) {
      updates.push({
        driverId: ctx.driverId,
        selfConfidenceDelta: -3,
        teamTrustInDriverDelta: -1,
        reason: 'Confidence-driven driver deflated by poor result',
      });
    }
  }

  return updates;
}

// ---------------------------------------------------------------------------
// Apply updates to relationships
// ---------------------------------------------------------------------------

export function applyConfidenceUpdates(
  relationships: Record<string, DriverRelationship>,
  updates: ConfidenceUpdate[],
): Record<string, DriverRelationship> {
  const result = { ...relationships };
  for (const u of updates) {
    const rel = result[u.driverId];
    if (!rel) continue;
    result[u.driverId] = {
      ...rel,
      selfConfidence: clamp(rel.selfConfidence + (u.selfConfidenceDelta ?? 0)),
      trustInCar: clamp(rel.trustInCar + (u.trustInCarDelta ?? 0)),
      trustInTeam: clamp(rel.trustInTeam + (u.trustInTeamDelta ?? 0)),
      trustInPrincipal: clamp(rel.trustInPrincipal + (u.trustInPrincipalDelta ?? 0)),
      teamTrustInDriver: clamp(rel.teamTrustInDriver + (u.teamTrustInDriverDelta ?? 0)),
      morale: clamp(rel.morale + (u.moraleDelta ?? 0)),
      frustration: clamp(rel.frustration + (u.frustrationDelta ?? 0)),
      ego: clamp(rel.ego + (u.egoDelta ?? 0)),
    };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Promise management
// ---------------------------------------------------------------------------

// Centralized promise ID generation using a monotonic counter from game state.
// This prevents ID collisions when the same driver receives the same promise
// type in the same season/round.
export function createPromiseId(
  driverId: string,
  promiseType: PromiseType,
  season: number,
  round: number,
  counter: number,
): string {
  return `promise-${driverId}-${promiseType}-${season}-${round}-${counter}`;
}

// Check if a driver already has an active promise of the same type.
// Duplicate active promises of the same type for the same driver are blocked.
export function hasActivePromiseOfType(
  promises: DriverPromise[],
  driverId: string,
  promiseType: PromiseType,
): boolean {
  return promises.some(
    (p) => p.driverId === driverId && p.promiseType === promiseType && p.status === 'active',
  );
}

export function makePromise(
  driverId: string,
  promiseType: PromiseType,
  season: number,
  round: number,
  dueSeason?: number,
  dueRound?: number,
  counter: number = 0,
): DriverPromise {
  return {
    id: createPromiseId(driverId, promiseType, season, round, counter),
    driverId,
    promiseType,
    madeRound: round,
    madeSeason: season,
    dueRound,
    dueSeason,
    status: 'active',
    trustImpact: 8,
    moraleImpact: 5,
  };
}

export function resolvePromise(
  promise: DriverPromise,
  fulfilled: boolean,
): DriverPromise {
  return {
    ...promise,
    status: fulfilled ? 'kept' : 'broken',
    trustImpact: fulfilled ? promise.trustImpact : -promise.trustImpact * 2,
    moraleImpact: fulfilled ? promise.moraleImpact : -promise.moraleImpact * 2,
  };
}

export function expirePromise(promise: DriverPromise): DriverPromise {
  return {
    ...promise,
    status: 'expired',
    trustImpact: -promise.trustImpact,
    moraleImpact: -promise.moraleImpact,
  };
}

export function applyPromiseResolution(
  relationships: Record<string, DriverRelationship>,
  promise: DriverPromise,
): Record<string, DriverRelationship> {
  const rel = relationships[promise.driverId];
  if (!rel) return relationships;
  const isPositive = promise.trustImpact > 0;
  return {
    ...relationships,
    [promise.driverId]: {
      ...rel,
      trustInPrincipal: clamp(rel.trustInPrincipal + promise.trustImpact),
      trustInTeam: clamp(rel.trustInTeam + Math.round(promise.trustImpact * 0.6)),
      morale: clamp(rel.morale + promise.moraleImpact),
      teamLoyalty: clamp(rel.teamLoyalty + Math.round(promise.trustImpact * 0.4)),
      frustration: clamp(rel.frustration - Math.round(promise.moraleImpact / 2)),
      selfConfidence: clamp(rel.selfConfidence + (isPositive ? Math.round(promise.trustImpact * 0.3) : -Math.round(promise.trustImpact * 0.2))),
    },
  };
}

export function checkExpiredPromises(
  promises: DriverPromise[],
  currentSeason: number,
  currentRound: number,
): { promises: DriverPromise[]; expired: DriverPromise[] } {
  const result: DriverPromise[] = [];
  const expired: DriverPromise[] = [];
  for (const p of promises) {
    if (p.status !== 'active') {
      result.push(p);
      continue;
    }
    // Case 1: Both dueSeason and dueRound are set — expire when past that round.
    if (p.dueSeason !== undefined && p.dueRound !== undefined) {
      if (currentSeason > p.dueSeason || (currentSeason === p.dueSeason && currentRound > p.dueRound)) {
        const expiredPromise = expirePromise(p);
        expired.push(expiredPromise);
        result.push(expiredPromise);
        continue;
      }
    }
    // Case 2: Only dueSeason is set (no dueRound) — expire when past that season.
    // This handles promises due by end of a specific season.
    if (p.dueSeason !== undefined && p.dueRound === undefined) {
      if (currentSeason > p.dueSeason) {
        const expiredPromise = expirePromise(p);
        expired.push(expiredPromise);
        result.push(expiredPromise);
        continue;
      }
    }
    // Case 3: No dueSeason and no dueRound — default to expiring at end of
    // the current season (when currentRound is 0 and we've moved to a new
    // season, or when the season rollover triggers with nextYear > madeSeason).
    if (p.dueSeason === undefined && p.dueRound === undefined) {
      if (currentSeason > p.madeSeason) {
        const expiredPromise = expirePromise(p);
        expired.push(expiredPromise);
        result.push(expiredPromise);
        continue;
      }
    }
    result.push(p);
  }
  return { promises: result, expired };
}

// ---------------------------------------------------------------------------
// Season rollover: confidence/trust drift
// ---------------------------------------------------------------------------

export function rolloverConfidence(
  rel: DriverRelationship,
): DriverRelationship {
  return {
    ...rel,
    selfConfidence: clamp(Math.round(rel.selfConfidence * 0.7 + 55 * 0.3)),
    trustInCar: clamp(Math.round(rel.trustInCar * 0.8 + 50 * 0.2)),
    trustInTeam: clamp(Math.round(rel.trustInTeam * 0.85 + 55 * 0.15)),
    trustInPrincipal: clamp(Math.round(rel.trustInPrincipal * 0.8 + 58 * 0.2)),
    teamTrustInDriver: clamp(Math.round(rel.teamTrustInDriver * 0.85 + 55 * 0.15)),
    ego: clamp(Math.round(rel.ego * 0.9 + 50 * 0.1)),
  };
}

// ---------------------------------------------------------------------------
// Want satisfaction check
// ---------------------------------------------------------------------------

export function evaluateWants(
  rel: DriverRelationship,
  context: {
    teamReputation: number;
    contractYearsRemaining: number;
    isNumberOne: boolean;
    carReliability: number;
    teamStability: number;
  },
): { satisfied: string[]; unfulfilled: string[] } {
  const satisfied: string[] = [];
  const unfulfilled: string[] = [];
  for (const want of rel.wants) {
    switch (want) {
      case 'number_one_status':
        if (context.isNumberOne) satisfied.push(want);
        else unfulfilled.push(want);
        break;
      case 'equal_treatment':
        if (!context.isNumberOne) satisfied.push(want);
        else unfulfilled.push(want);
        break;
      case 'podium_capable_car':
        if (context.teamReputation >= 50) satisfied.push(want);
        else unfulfilled.push(want);
        break;
      case 'title_contending_car':
        if (context.teamReputation >= 70) satisfied.push(want);
        else unfulfilled.push(want);
        break;
      case 'contract_renewal':
        if (context.contractYearsRemaining > 1) satisfied.push(want);
        else unfulfilled.push(want);
        break;
      case 'better_reliability':
        if (context.carReliability >= 70) satisfied.push(want);
        else unfulfilled.push(want);
        break;
      case 'team_stability':
        if (context.teamStability >= 60) satisfied.push(want);
        else unfulfilled.push(want);
        break;
      case 'development_priority':
        if (context.teamReputation < 60) satisfied.push(want);
        else unfulfilled.push(want);
        break;
      case 'better_salary':
        // A driver with a long contract is satisfied on salary; short = unfulfilled.
        if (context.contractYearsRemaining >= 2) satisfied.push(want);
        else unfulfilled.push(want);
        break;
      default:
        satisfied.push(want);
        break;
    }
  }
  return { satisfied, unfulfilled };
}

// ---------------------------------------------------------------------------
// Contract loyalty effect
// ---------------------------------------------------------------------------

export function contractLoyaltyModifier(rel: DriverRelationship): number {
  const trustAvg = (rel.trustInTeam + rel.trustInPrincipal) / 2;
  const moraleFactor = (rel.morale - 50) / 50;
  const frustrationFactor = -(rel.frustration - 30) / 30;
  const egoFactor = rel.ego > 70 ? -0.1 : 0;
  return Math.round((trustAvg - 50) * 0.1 + moraleFactor * 5 + frustrationFactor * 3 + egoFactor * 10);
}

// ---------------------------------------------------------------------------
// Auto-resolve promises after a race based on what actually happened
// ---------------------------------------------------------------------------

export type PromiseResolution = {
  promise: DriverPromise;
  fulfilled: boolean;
  reason: string;
};

export function evaluatePromisesAfterRace(
  promises: DriverPromise[],
  driverId: string,
  ctx: RaceEventContext,
): PromiseResolution[] {
  const results: PromiseResolution[] = [];
  for (const p of promises) {
    if (p.status !== 'active' || p.driverId !== driverId) continue;

    switch (p.promiseType) {
      case 'equal_treatment': {
        if (ctx.teamOrderIssued && ctx.wasDisadvantagedInOrders) {
          results.push({ promise: p, fulfilled: false, reason: 'Team orders disadvantaged this driver — equal treatment promise broken.' });
        }
        break;
      }
      case 'number_one_status': {
        if (ctx.teamOrderIssued && ctx.wasDisadvantagedInOrders) {
          results.push({ promise: p, fulfilled: false, reason: 'Driver was disadvantaged by team orders despite number-one promise.' });
        } else if (ctx.teamOrderIssued && ctx.wasFavoredInOrders) {
          results.push({ promise: p, fulfilled: true, reason: 'Driver was favoured by team orders — number-one status upheld.' });
        }
        break;
      }
      case 'fight_teammate': {
        if (!ctx.dnf && ctx.teammateFinishingPosition !== undefined && !ctx.teammateDNF) {
          if (ctx.finishingPosition < ctx.teammateFinishingPosition) {
            results.push({ promise: p, fulfilled: true, reason: 'Driver beat teammate — fight promise fulfilled.' });
          } else {
            results.push({ promise: p, fulfilled: false, reason: 'Driver finished behind teammate — fight promise broken.' });
          }
        }
        break;
      }
      case 'better_strategy_support': {
        if (!ctx.dnf && ctx.strategyRiskLevel === 'aggressive') {
          if (ctx.finishingPosition <= 3) {
            results.push({ promise: p, fulfilled: true, reason: 'Aggressive strategy paid off — strategy support promise fulfilled.' });
          }
        }
        break;
      }
      case 'calmer_risk_approach': {
        if (!ctx.dnf && ctx.strategyRiskLevel === 'aggressive') {
          results.push({ promise: p, fulfilled: false, reason: 'Aggressive strategy used despite calmer approach promise.' });
        }
        break;
      }
      case 'improved_reliability': {
        if (ctx.dnf && ctx.carReliabilityDNF) {
          results.push({ promise: p, fulfilled: false, reason: 'Car failure DNF — reliability promise broken.' });
        } else if (!ctx.dnf) {
          // Don't auto-fulfill on a single finish — needs sustained reliability.
          // Only fulfill if the promise has survived past its due round.
        }
        break;
      }
      case 'no_midseason_replacement': {
        // This is evaluated at season rollover, not per-race.
        break;
      }
      default:
        // Other promise types (contract_renewal, promotion, etc.) are
        // evaluated at season rollover, not per-race.
        break;
    }
  }
  return results;
}

export function evaluatePromisesAtSeasonEnd(
  promises: DriverPromise[],
  driverId: string,
  context: {
    contractRenewed: boolean;
    wasReplaced: boolean;
    wasPromoted: boolean;
    gotPracticeTime: boolean;
    carImproved?: boolean;
    reliabilityImproved?: boolean;
    developmentPriorityGiven?: boolean;
  },
): PromiseResolution[] {
  const results: PromiseResolution[] = [];
  for (const p of promises) {
    if (p.status !== 'active' || p.driverId !== driverId) continue;

    switch (p.promiseType) {
      case 'contract_renewal': {
        results.push({
          promise: p,
          fulfilled: context.contractRenewed,
          reason: context.contractRenewed
            ? 'Contract renewed — promise fulfilled.'
            : 'Contract was not renewed — promise broken.',
        });
        break;
      }
      case 'no_midseason_replacement': {
        results.push({
          promise: p,
          fulfilled: !context.wasReplaced,
          reason: context.wasReplaced
            ? 'Driver was replaced midseason — promise broken.'
            : 'Driver kept their seat all season — promise fulfilled.',
        });
        break;
      }
      case 'promotion': {
        results.push({
          promise: p,
          fulfilled: context.wasPromoted,
          reason: context.wasPromoted
            ? 'Driver promoted to race seat — promise fulfilled.'
            : 'Driver was not promoted — promise broken.',
        });
        break;
      }
      case 'reserve_practice_time': {
        results.push({
          promise: p,
          fulfilled: context.gotPracticeTime,
          reason: context.gotPracticeTime
            ? 'Practice time provided — promise fulfilled.'
            : 'Practice time not provided — promise broken.',
        });
        break;
      }
      case 'development_priority': {
        results.push({
          promise: p,
          fulfilled: context.developmentPriorityGiven ?? false,
          reason: context.developmentPriorityGiven
            ? 'Development priority was given — promise fulfilled.'
            : 'Development priority was not given — promise broken.',
        });
        break;
      }
      case 'priority_upgrades': {
        results.push({
          promise: p,
          fulfilled: context.developmentPriorityGiven ?? false,
          reason: context.developmentPriorityGiven
            ? 'Priority upgrades were allocated — promise fulfilled.'
            : 'Priority upgrades were not allocated — promise broken.',
        });
        break;
      }
      case 'improved_reliability': {
        results.push({
          promise: p,
          fulfilled: context.reliabilityImproved ?? false,
          reason: context.reliabilityImproved
            ? 'Reliability improved over the season — promise fulfilled.'
            : 'Reliability did not improve — promise broken.',
        });
        break;
      }
      default:
        break;
    }
  }
  return results;
}
