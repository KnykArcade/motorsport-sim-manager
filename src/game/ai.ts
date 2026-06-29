// Decision generation for AI-controlled (non-player) teams.

import { autoSetupsForTrack } from '../sim/autoSetup';
import type { Track } from '../types/gameTypes';
import type { QualifyingDecision, RaceDecision } from '../types/simTypes';

// AI qualifies with the auto qualifying trim + standard push.
export function aiQualifyingDecision(driverId: string, track: Track): QualifyingDecision {
  const setup = autoSetupsForTrack(track).qualifying;
  return { driverId, setupId: setup.id, runPlanId: 'StandardPush' };
}

// AI races with the auto race trim, balanced one-stop and balanced driving.
export function aiRaceDecision(driverId: string, track: Track): RaceDecision {
  const setup = autoSetupsForTrack(track).race;
  return {
    driverId,
    setupId: setup.id,
    strategyId: 'BalancedOneStop',
    instructionId: 'Balanced',
  };
}
