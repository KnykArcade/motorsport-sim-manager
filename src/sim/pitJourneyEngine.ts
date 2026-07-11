import type { PitJourneyPhase, PitJourneyState, PitVisitBreakdown } from '../types/pitTypes';
import { allocateTransitLoss, reconcilePitVisitBreakdown } from './pitVisitEngine';

export type BeginPitJourneyInput = Omit<PitVisitBreakdown, 'totalPitVisitLossSeconds'>;

export type PitJourneyStep = {
  journey: PitJourneyState;
  appliedThisStepSeconds: number;
  serviceCompletedThisStep: boolean;
  rejoinedThisStep: boolean;
};

export function beginPitJourney(input: BeginPitJourneyInput): PitJourneyState {
  const breakdown = reconcilePitVisitBreakdown(input);
  return {
    phase: 'Requested',
    allocation: allocateTransitLoss(breakdown.transitLossSeconds),
    breakdown,
    appliedLossSeconds: 0,
    serviceCompleted: false,
  };
}

export function advancePitJourney(journey: PitJourneyState, teammateOccupyingBox = false): PitJourneyStep {
  const nextPhase = phaseAfter(journey, teammateOccupyingBox);
  const appliedThisStepSeconds = lossForTransition(journey, nextPhase);
  const serviceCompletedThisStep = nextPhase === 'Released' && !journey.serviceCompleted;
  const rejoinedThisStep = nextPhase === 'Rejoined';
  return {
    journey: {
      ...journey,
      phase: nextPhase,
      appliedLossSeconds: round3(journey.appliedLossSeconds + appliedThisStepSeconds),
      serviceCompleted: journey.serviceCompleted || serviceCompletedThisStep,
    },
    appliedThisStepSeconds,
    serviceCompletedThisStep,
    rejoinedThisStep,
  };
}

export function pitJourneyComplete(journey: PitJourneyState): boolean {
  return journey.phase === 'Rejoined';
}

function phaseAfter(journey: PitJourneyState, teammateOccupyingBox: boolean): PitJourneyPhase {
  switch (journey.phase) {
    case 'Requested': return 'Committed';
    case 'Committed': return 'PitEntry';
    case 'PitEntry': return 'Decelerating';
    case 'Decelerating': return 'PitTransitToBox';
    case 'PitTransitToBox':
      if (teammateOccupyingBox) return 'QueuedBehindTeammate';
      return stationaryLoss(journey) > 0 ? 'StationaryService' : 'Released';
    case 'QueuedBehindTeammate': return teammateOccupyingBox ? 'QueuedBehindTeammate' : 'StationaryService';
    case 'StationaryService': return 'Released';
    case 'Released': return 'PitTransitFromBox';
    case 'PitTransitFromBox': return 'PitExit';
    case 'PitExit': return 'Rejoined';
    default: return journey.phase;
  }
}

function stationaryLoss(journey: PitJourneyState): number {
  return round3(
    journey.breakdown.individualPitStopSeconds
    + journey.breakdown.queueDelaySeconds
    + journey.breakdown.penaltyDelaySeconds
    + journey.breakdown.repairDelaySeconds,
  );
}

function lossForTransition(journey: PitJourneyState, next: PitJourneyPhase): number {
  switch (next) {
    case 'PitEntry': return journey.allocation.entrySeconds;
    case 'PitTransitToBox': return journey.allocation.toBoxSeconds;
    case 'StationaryService':
      return stationaryLoss(journey);
    case 'PitTransitFromBox': return journey.allocation.fromBoxSeconds;
    case 'PitExit':
      return round3(
        journey.allocation.exitSeconds
        + journey.breakdown.entryExitErrorSeconds
        + journey.breakdown.cautionAdjustmentSeconds,
      );
    default: return 0;
  }
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
