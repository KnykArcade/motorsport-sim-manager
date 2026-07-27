import { activeDriversForTeam, currentRace, type GameState } from '../game/careerState';
import type { Driver, RaceResult } from '../types/gameTypes';
import type { DriverRelationship } from '../types/relationshipTypes';
import type {
  ConfirmedWeekendPlan,
  GarageAddressDriverReaction,
  GarageAddressRecord,
  GarageAddressTone,
  GarageFollowUpType,
  GarageReactionLabel,
  WeekendPlanDriver,
} from '../types/weekendLeadershipTypes';

export type GarageAddressOption = {
  id: GarageAddressTone;
  label: string;
  message: string;
  bestUse: string;
  risk: string;
};

export const GARAGE_ADDRESS_OPTIONS: readonly GarageAddressOption[] = [
  {
    id: 'CalmExecute',
    label: 'Calm and execute',
    message: 'Trust the preparation, stay composed, and execute the plan.',
    bestUse: 'A balanced default for a stable garage.',
    risk: 'Can feel passive to drivers expecting a forceful competitive message.',
  },
  {
    id: 'EncourageTrust',
    label: 'Encourage and trust the drivers',
    message: 'You have the ability and the team trusts you to deliver.',
    bestUse: 'Drivers carrying doubt or pressure.',
    risk: 'High-ego drivers may hear reassurance as a lack of urgency.',
  },
  {
    id: 'DemandResult',
    label: 'Demand a result',
    message: 'The opportunity is here. The team expects a result today.',
    bestUse: 'Confident, ambitious drivers in a competitive position.',
    risk: 'Adds pressure for fragile or low-trust drivers.',
  },
  {
    id: 'AttackOpportunity',
    label: 'Attack the opportunity',
    message: 'Be decisive at the start and take the opportunity in front of us.',
    bestUse: 'Strong grid positions and aggressive personalities.',
    risk: 'Raises tension when reliability or driver confidence is weak.',
  },
  {
    id: 'ProtectFinish',
    label: 'Protect the finish',
    message: 'Bring the cars home, manage the risk, and bank the result.',
    bestUse: 'Fragile cars, difficult weather, or a valuable points position.',
    risk: 'Ambitious drivers can view it as surrendering competitive intent.',
  },
  {
    id: 'ProvePoint',
    label: 'Prove a point',
    message: 'Use the setback and the noise around us. Show what this team can do.',
    bestUse: 'A frustrated or resilient garage responding to adversity.',
    risk: 'Can confuse drivers when there is no clear grievance or setback.',
  },
];

type ReactionContext = {
  driver: Driver;
  relationship?: DriverRelationship;
  plan: WeekendPlanDriver;
  tone: GarageAddressTone;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 3): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function activePlan(state: GameState, raceId: string): ConfirmedWeekendPlan | undefined {
  return (state.weekendPlans ?? []).find((plan) =>
    plan.raceId === raceId && plan.teamId === state.selectedTeamId);
}

function relationshipFor(state: GameState, driverId: string): DriverRelationship | undefined {
  return state.driverRelationships?.[driverId];
}

function reactionFit(context: ReactionContext): { fit: number; reason: string } {
  const { driver, relationship, plan, tone } = context;
  const traits = relationship?.personalityTraits ?? [];
  const selfConfidence = relationship?.selfConfidence ?? driver.confidence;
  const trust = relationship?.trustInPrincipal ?? 50;
  const frustration = relationship?.frustration ?? 0;
  const aggressivePlan =
    plan.raceStrategyId === 'AggressiveTwoStop'
    || plan.instructionId === 'Aggressive'
    || plan.instructionId === 'MaximumAttack';
  const protectivePlan =
    plan.raceStrategyId === 'SafetyFirstPoints'
    || plan.raceStrategyId === 'ConservativeOneStop'
    || plan.instructionId === 'ProtectCar'
    || plan.instructionId === 'Conservative';
  let fit = 0;
  const reasons: string[] = [];

  if (tone === 'CalmExecute') {
    if (traits.includes('Calm Under Pressure') || traits.includes('Veteran Professional')) {
      fit += 2;
      reasons.push('the driver responds well to composed, professional direction');
    }
    if (selfConfidence < 45) {
      fit += 1;
      reasons.push('a low-pressure message reduces unnecessary tension');
    }
    if (traits.includes('Risk Taker') && aggressivePlan) {
      fit -= 1;
      reasons.push('the driver expected a more forceful attacking cue');
    }
  }

  if (tone === 'EncourageTrust') {
    if (
      traits.includes('Pressure Sensitive')
      || traits.includes('Confidence Driven')
      || selfConfidence < 50
    ) {
      fit += 2;
      reasons.push('reassurance directly addresses current confidence pressure');
    }
    if (trust >= 65) {
      fit += 1;
      reasons.push('strong principal trust makes the reassurance credible');
    }
    if (traits.includes('High Ego') && selfConfidence >= 70) {
      fit -= 1;
      reasons.push('the driver wanted a competitive demand rather than reassurance');
    }
  }

  if (tone === 'DemandResult') {
    if (
      traits.includes('Ambitious')
      || traits.includes('High Ego')
      || traits.includes('Team Leader')
    ) {
      fit += 2;
      reasons.push('the driver embraces explicit competitive expectations');
    }
    if (selfConfidence >= 65 && plan.gridPosition > 0 && plan.gridPosition <= 8) {
      fit += 1;
      reasons.push('confidence and grid position support a demanding message');
    }
    if (traits.includes('Pressure Sensitive') || selfConfidence < 40 || trust < 40) {
      fit -= 2;
      reasons.push('current pressure or low trust makes the demand counterproductive');
    }
  }

  if (tone === 'AttackOpportunity') {
    if (traits.includes('Risk Taker') || traits.includes('Ambitious')) {
      fit += 2;
      reasons.push('the driver naturally responds to an attacking opportunity');
    }
    if (plan.gridPosition > 0 && plan.gridPosition <= 6 && aggressivePlan) {
      fit += 1;
      reasons.push('the grid position and working plan support an assertive start');
    }
    if (
      traits.includes('Pressure Sensitive')
      || (relationship?.trustInCar ?? 50) < 42
      || protectivePlan
    ) {
      fit -= 2;
      reasons.push('the driver or car is not aligned with an attacking message');
    }
  }

  if (tone === 'ProtectFinish') {
    if (
      traits.includes('Calm Under Pressure')
      || traits.includes('Veteran Professional')
      || protectivePlan
    ) {
      fit += 2;
      reasons.push('the driver and race plan already value measured execution');
    }
    if ((relationship?.trustInCar ?? 50) < 48) {
      fit += 1;
      reasons.push('car confidence makes risk control credible');
    }
    if (
      traits.includes('Ambitious')
      || traits.includes('High Ego')
      || (aggressivePlan && selfConfidence >= 65)
    ) {
      fit -= 2;
      reasons.push('the driver believes the message gives away a competitive opportunity');
    }
  }

  if (tone === 'ProvePoint') {
    if (
      traits.includes('Resilient')
      || traits.includes('Rivalry Prone')
      || frustration >= 55
    ) {
      fit += 2;
      reasons.push('the driver can channel adversity into focus');
    }
    if (traits.includes('Team Leader') || trust >= 70) {
      fit += 1;
      reasons.push('the driver identifies strongly with the team message');
    }
    if (traits.includes('Pressure Sensitive') && frustration < 40) {
      fit -= 1;
      reasons.push('there is no clear grievance for the driver to channel');
    }
  }

  return {
    fit: clamp(fit, -3, 3),
    reason: reasons[0] ?? 'The message is broadly neutral for this driver and the current plan.',
  };
}

function reactionLabel(fit: number, tone: GarageAddressTone): GarageReactionLabel {
  if (fit >= 3) return tone === 'EncourageTrust' ? 'Reassured' : 'Confident';
  if (fit >= 1) return tone === 'EncourageTrust' ? 'Reassured' : 'Focused';
  if (fit === 0) return 'Focused';
  if (fit === -1) return 'Concerned';
  return tone === 'ProvePoint' ? 'Confused' : 'Frustrated';
}

function reactionFor(context: ReactionContext): GarageAddressDriverReaction {
  const result = reactionFit(context);
  return {
    driverId: context.driver.id,
    reaction: reactionLabel(result.fit, context.tone),
    reason: result.reason,
    fit: result.fit,
    performanceModifier: round(clamp(result.fit * 0.005, -0.015, 0.015)),
    mistakeRiskMultiplier: round(clamp(1 - result.fit * 0.01, 0.97, 1.03)),
    trustDelta: result.fit >= 2 ? 1 : result.fit <= -2 ? -1 : 0,
  };
}

export function previewGarageAddress(
  state: GameState,
  raceId: string,
  tone: GarageAddressTone,
): GarageAddressDriverReaction[] {
  const plan = activePlan(state, raceId);
  if (!plan) return [];
  const planByDriver = new Map(plan.drivers.map((driver) => [driver.driverId, driver]));
  return activeDriversForTeam(state, state.selectedTeamId)
    .filter((driver) => planByDriver.has(driver.id))
    .map((driver) => reactionFor({
      driver,
      relationship: relationshipFor(state, driver.id),
      plan: planByDriver.get(driver.id)!,
      tone,
    }));
}

export function recommendedGarageAddress(
  state: GameState,
  raceId: string,
): { tone: GarageAddressTone; reason: string } {
  const plan = activePlan(state, raceId);
  if (!plan) {
    return {
      tone: 'CalmExecute',
      reason: 'No confirmed plan is available, so the assistant defaults to a neutral execution message.',
    };
  }
  const scores = GARAGE_ADDRESS_OPTIONS.map((option) => {
    const reactions = previewGarageAddress(state, raceId, option.id);
    let score = reactions.reduce((sum, reaction) => sum + reaction.fit, 0);
    if (plan.practiceKnowledge.reliability < 45 && option.id === 'ProtectFinish') score += 2;
    if (plan.drivers.some((driver) => driver.gridPosition > 0 && driver.gridPosition <= 3)
      && option.id === 'AttackOpportunity') score += 1;
    if (plan.drivers.some((driver) => driver.setupConfidence < 45)
      && option.id === 'CalmExecute') score += 1;
    return { option, score };
  }).sort((a, b) => b.score - a.score || GARAGE_ADDRESS_OPTIONS.indexOf(a.option) - GARAGE_ADDRESS_OPTIONS.indexOf(b.option));
  const selected = scores[0];
  return {
    tone: selected.option.id,
    reason: `${selected.option.label} has the strongest combined fit with the drivers, grid, confidence, and confirmed race plan.`,
  };
}

function applyTrustDelta(
  state: GameState,
  deltas: Array<{ driverId: string; trustDelta: number }>,
): GameState {
  if (!state.driverRelationships) return state;
  const driverRelationships = { ...state.driverRelationships };
  for (const delta of deltas) {
    const relationship = driverRelationships[delta.driverId];
    if (!relationship || delta.trustDelta === 0) continue;
    driverRelationships[delta.driverId] = {
      ...relationship,
      trustInPrincipal: clamp(
        relationship.trustInPrincipal + delta.trustDelta,
        0,
        100,
      ),
    };
  }
  return { ...state, driverRelationships };
}

export function deliverGarageAddress(
  state: GameState,
  raceId: string,
  tone: GarageAddressTone,
  delegated = false,
): GameState {
  const race = currentRace(state);
  const plan = activePlan(state, raceId);
  const option = GARAGE_ADDRESS_OPTIONS.find((candidate) => candidate.id === tone);
  if (
    !race
    || race.id !== raceId
    || !plan
    || !option
    || (state.garageAddresses ?? []).some((record) => record.raceId === raceId)
  ) {
    return state;
  }
  const recommendation = recommendedGarageAddress(state, raceId);
  const reactions = previewGarageAddress(state, raceId, tone);
  const record: GarageAddressRecord = {
    raceId,
    teamId: state.selectedTeamId,
    seasonYear: state.seasonYear,
    round: race.round,
    tone,
    messageLabel: option.label,
    delegated,
    recommendedTone: recommendation.tone,
    recommendationReason: recommendation.reason,
    reactions,
  };
  const withRecord = {
    ...state,
    garageAddresses: [...(state.garageAddresses ?? []), record].slice(-80),
  };
  return applyTrustDelta(withRecord, reactions);
}

function followUpAdjustment(
  state: GameState,
  reaction: GarageAddressDriverReaction,
  type: GarageFollowUpType,
): { fitDelta: number; trustDelta: number; label: string; reason: string } {
  const relationship = relationshipFor(state, reaction.driverId);
  const traits = relationship?.personalityTraits ?? [];
  if (type === 'Reassure') {
    const helpful = reaction.fit < 1 || traits.includes('Pressure Sensitive') || traits.includes('Confidence Driven');
    return {
      fitDelta: helpful ? 1 : 0,
      trustDelta: helpful ? 1 : 0,
      label: 'Reassure privately',
      reason: helpful
        ? 'The private reassurance addressed the driver’s visible concern.'
        : 'The driver accepted the reassurance but did not need it.',
    };
  }
  if (type === 'Challenge') {
    const helpful = traits.includes('Ambitious') || traits.includes('High Ego') || traits.includes('Risk Taker');
    return {
      fitDelta: helpful ? 1 : -1,
      trustDelta: helpful ? 1 : -1,
      label: 'Set a private challenge',
      reason: helpful
        ? 'The driver responded to a direct personal challenge.'
        : 'The private challenge added pressure without matching the driver’s personality.',
    };
  }
  const helpful = reaction.reaction === 'Confused' || reaction.reaction === 'Concerned' || reaction.fit < 0;
  return {
    fitDelta: helpful ? 2 : 0,
    trustDelta: helpful ? 1 : 0,
    label: 'Clarify the plan',
    reason: helpful
      ? 'Clarifying the driver’s role removed uncertainty about the working plan.'
      : 'The driver already understood the plan, so clarification had no additional effect.',
  };
}

export function addGarageFollowUp(
  state: GameState,
  raceId: string,
  driverId: string,
  type: GarageFollowUpType,
): GameState {
  const record = (state.garageAddresses ?? []).find((candidate) => candidate.raceId === raceId);
  const reaction = record?.reactions.find((candidate) => candidate.driverId === driverId);
  if (!record || record.followUp || !reaction) return state;
  const adjustment = followUpAdjustment(state, reaction, type);
  const fit = clamp(reaction.fit + adjustment.fitDelta, -3, 3);
  const updatedReaction: GarageAddressDriverReaction = {
    ...reaction,
    reaction: reactionLabel(fit, record.tone),
    reason: `${reaction.reason} ${adjustment.reason}`,
    fit,
    performanceModifier: round(clamp(reaction.performanceModifier + adjustment.fitDelta * 0.003, -0.018, 0.018)),
    mistakeRiskMultiplier: round(clamp(reaction.mistakeRiskMultiplier - adjustment.fitDelta * 0.006, 0.964, 1.036)),
    trustDelta: clamp(reaction.trustDelta + adjustment.trustDelta, -2, 2),
  };
  const garageAddresses = (state.garageAddresses ?? []).map((candidate) =>
    candidate.raceId === raceId
      ? {
          ...candidate,
          reactions: candidate.reactions.map((item) =>
            item.driverId === driverId ? updatedReaction : item),
          followUp: {
            driverId,
            type,
            label: adjustment.label,
            reason: adjustment.reason,
            trustDelta: adjustment.trustDelta,
          },
        }
      : candidate);
  return applyTrustDelta(
    { ...state, garageAddresses },
    [{ driverId, trustDelta: adjustment.trustDelta }],
  );
}

export function garageAddressForRace(
  state: Pick<GameState, 'garageAddresses'>,
  raceId: string,
): GarageAddressRecord | undefined {
  return (state.garageAddresses ?? []).find((record) => record.raceId === raceId);
}

export function garageAddressRaceEffects(
  state: Pick<GameState, 'garageAddresses'>,
  raceId: string,
): Record<string, { performanceModifier: number; mistakeRiskMultiplier: number }> {
  const record = garageAddressForRace(state, raceId);
  return Object.fromEntries((record?.reactions ?? []).map((reaction) => [
    reaction.driverId,
    {
      performanceModifier: reaction.performanceModifier,
      mistakeRiskMultiplier: reaction.mistakeRiskMultiplier,
    },
  ]));
}

export function evaluateGarageAddressAfterRace(
  state: GameState,
  raceId: string,
  results: RaceResult[],
): GameState {
  const record = garageAddressForRace(state, raceId);
  const plan = activePlan(state, raceId);
  if (!record || !plan || record.accountability) return state;
  const planByDriver = new Map(plan.drivers.map((driver) => [driver.driverId, driver]));
  const playerResults = results.filter((result) => planByDriver.has(result.driverId));
  const classified = playerResults.filter((result) => result.position !== null);
  const netPlaces = classified.reduce(
    (sum, result) => sum + (result.gridPosition - (result.position ?? result.gridPosition)),
    0,
  );
  const finishers = playerResults.filter((result) => result.status === 'Finished').length;
  const points = playerResults.reduce((sum, result) => sum + result.points, 0);
  const reactionTrust = record.reactions.reduce((sum, reaction) => sum + reaction.trustDelta, 0);
  const aligned =
    (record.tone === 'ProtectFinish' && finishers === playerResults.length)
    || ((record.tone === 'AttackOpportunity' || record.tone === 'DemandResult') && netPlaces > 0)
    || (record.tone === 'CalmExecute' && finishers > 0)
    || points > 0;
  const trustScore = reactionTrust + (aligned ? 1 : netPlaces < 0 && finishers < playerResults.length ? -1 : 0);
  const accountability: GarageAddressRecord['accountability'] = {
    resultSummary: `${finishers}/${playerResults.length} cars finished · ${points} points · ${netPlaces >= 0 ? '+' : ''}${netPlaces} net places`,
    planComparison: aligned
      ? 'The result supported the leadership message and the confirmed plan.'
      : 'The race outcome did not clearly validate the leadership message.',
    trustOutcome: trustScore > 0 ? 'BuiltTrust' : trustScore < 0 ? 'DamagedTrust' : 'Neutral',
    supportingEvidence: [
      `${record.reactions.filter((reaction) => reaction.fit > 0).length}/${record.reactions.length} drivers reacted positively before the start`,
      `${finishers}/${playerResults.length} player cars reached the finish`,
      `${netPlaces >= 0 ? '+' : ''}${netPlaces} net positions from grid to flag`,
    ],
  };
  return {
    ...state,
    garageAddresses: (state.garageAddresses ?? []).map((candidate) =>
      candidate.raceId === raceId ? { ...candidate, accountability } : candidate),
  };
}
