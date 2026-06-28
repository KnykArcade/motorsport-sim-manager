// Decision generation for AI-controlled (non-player) teams.

import { setupOptions } from '../data/setupOptions/setupOptions';
import { recommendSetup } from '../sim/recommendation';
import type { Track } from '../types/gameTypes';
import type { QualifyingDecision, RaceDecision } from '../types/simTypes';

// AI qualifies with a sensible setup + standard push.
export function aiQualifyingDecision(driverId: string, track: Track): QualifyingDecision {
  const setup = recommendSetup(track, setupOptions);
  return { driverId, setupId: setup.id, runPlanId: 'StandardPush' };
}

// AI races with a recommended setup, balanced one-stop and balanced driving.
export function aiRaceDecision(driverId: string, track: Track): RaceDecision {
  const setup = recommendSetup(track, setupOptions);
  return {
    driverId,
    setupId: setup.id,
    strategyId: 'BalancedOneStop',
    instructionId: 'Balanced',
  };
}
