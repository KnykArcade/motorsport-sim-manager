import type { PitJourneyPhase, PitJourneyState, PitVisitBreakdown } from '../types/pitTypes';
import { allocateTransitLoss, reconcilePitVisitBreakdown } from './pitVisitEngine';

export type BeginPitJourneyInput = Omit<PitVisitBreakdown, 'totalPitVisitLossSeconds'>;

export type PitJourneyStep = {
  journey: PitJourneyState;
  appliedThisStepSeconds: number;
  serviceCompletedThisStep: boolean;
  rejoinedThisStep: boolean;
};

export type TimedPitJourneyStep = PitJourneyStep & {
  consumedElapsedSeconds: number;
};

export function beginPitJourney(input: BeginPitJourneyInput): PitJourneyState {
  const breakdown = reconcilePitVisitBreakdown(input);
  return {
    phase: 'Requested',
    allocation: allocateTransitLoss(breakdown.transitLossSeconds),
    breakdown,
    appliedLossSeconds: 0,
    serviceCompleted: false,
    phaseElapsedSeconds: 0,
  };
}

export function advancePitJourney(journey: PitJourneyState, teammateOccupyingBox = false): PitJourneyStep {
  if (journey.phase === 'QueuedBehindTeammate' && teammateOccupyingBox) {
    return { journey, appliedThisStepSeconds: 0, serviceCompletedThisStep: false, rejoinedThisStep: false };
  }
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
      phaseElapsedSeconds: 0,
    },
    appliedThisStepSeconds,
    serviceCompletedThisStep,
    rejoinedThisStep,
  };
}

export function advancePitJourneyForElapsedSeconds(
  journey: PitJourneyState,
  elapsedSeconds: number,
  teammateOccupyingBox = false,
): TimedPitJourneyStep {
  let current = { ...journey };
  let remaining = Math.max(0, elapsedSeconds);
  let appliedThisStepSeconds = 0;
  let serviceCompletedThisStep = false;
  let rejoinedThisStep = false;
  let guard = 0;

  while (remaining > 1e-9 && current.phase !== 'Rejoined' && guard++ < 20) {
    const duration = durationForPhase(current, current.phase);
    if (duration <= 1e-9) {
      const nextPhase = phaseAfter(current, teammateOccupyingBox);
      serviceCompletedThisStep ||= nextPhase === 'Released' && !current.serviceCompleted;
      rejoinedThisStep ||= nextPhase === 'Rejoined';
      current = {
        ...current,
        phase: nextPhase,
        phaseElapsedSeconds: 0,
        serviceCompleted: current.serviceCompleted || nextPhase === 'Released',
      };
      continue;
    }

    const phaseElapsedSeconds = current.phaseElapsedSeconds ?? 0;
    const available = Math.max(0, duration - phaseElapsedSeconds);
    const consumed = Math.min(remaining, available);
    const totalLoss = lossForPhase(current, current.phase);
    const proportionalLoss = totalLoss * (consumed / duration);
    current = {
      ...current,
      phaseElapsedSeconds: round3(phaseElapsedSeconds + consumed),
      appliedLossSeconds: round3(current.appliedLossSeconds + proportionalLoss),
    };
    appliedThisStepSeconds += proportionalLoss;
    remaining -= consumed;

    if ((current.phaseElapsedSeconds ?? 0) + 1e-9 >= duration) {
      const completedPhase = current.phase;
      const nextPhase = phaseAfter(current, teammateOccupyingBox);
      serviceCompletedThisStep ||= completedPhase === 'StationaryService';
      rejoinedThisStep ||= nextPhase === 'Rejoined';
      current = {
        ...current,
        phase: nextPhase,
        phaseElapsedSeconds: 0,
        serviceCompleted: current.serviceCompleted || completedPhase === 'StationaryService' || nextPhase === 'Released',
      };
    }
  }

  if (current.phase === 'Rejoined') {
    appliedThisStepSeconds += current.breakdown.totalPitVisitLossSeconds - current.appliedLossSeconds;
    current.appliedLossSeconds = current.breakdown.totalPitVisitLossSeconds;
  }
  return {
    journey: current,
    appliedThisStepSeconds: round3(appliedThisStepSeconds),
    consumedElapsedSeconds: round3(elapsedSeconds - remaining),
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
      if (teammateOccupyingBox || journey.breakdown.queueDelaySeconds > 0) return 'QueuedBehindTeammate';
      return stationaryLoss(journey) > 0 ? 'StationaryService' : 'Released';
    case 'QueuedBehindTeammate': return 'StationaryService';
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
    + journey.breakdown.penaltyDelaySeconds
    + journey.breakdown.repairDelaySeconds,
  );
}

function durationForPhase(journey: PitJourneyState, phase: PitJourneyPhase): number {
  switch (phase) {
    case 'PitEntry': return Math.max(0, journey.allocation.entrySeconds);
    case 'PitTransitToBox': return Math.max(0, journey.allocation.toBoxSeconds);
    case 'StationaryService': return Math.max(0, stationaryLoss(journey));
    case 'QueuedBehindTeammate': return Math.max(0, journey.breakdown.queueDelaySeconds);
    case 'PitTransitFromBox': return Math.max(0, journey.allocation.fromBoxSeconds);
    case 'PitExit':
      return Math.max(0, journey.allocation.exitSeconds + Math.max(0, journey.breakdown.entryExitErrorSeconds));
    default: return 0;
  }
}

function lossForPhase(journey: PitJourneyState, phase: PitJourneyPhase): number {
  switch (phase) {
    case 'PitEntry': return journey.allocation.entrySeconds;
    case 'PitTransitToBox': return journey.allocation.toBoxSeconds;
    case 'StationaryService': return stationaryLoss(journey);
    case 'QueuedBehindTeammate': return journey.breakdown.queueDelaySeconds;
    case 'PitTransitFromBox': return journey.allocation.fromBoxSeconds;
    case 'PitExit':
      return round3(journey.allocation.exitSeconds + journey.breakdown.entryExitErrorSeconds + journey.breakdown.cautionAdjustmentSeconds);
    default: return 0;
  }
}

function lossForTransition(journey: PitJourneyState, next: PitJourneyPhase): number {
  switch (next) {
    case 'PitEntry': return journey.allocation.entrySeconds;
    case 'PitTransitToBox': return journey.allocation.toBoxSeconds;
    case 'StationaryService':
      return round3(stationaryLoss(journey) + (journey.phase === 'QueuedBehindTeammate' ? journey.breakdown.queueDelaySeconds : 0));
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
