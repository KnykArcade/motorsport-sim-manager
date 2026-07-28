import { activeDriversForTeam, currentRace, type GameState } from '../game/careerState';
import { weekendCommandRecommendations } from '../sim/weekendCommandEngine';
import type { QualifyingDecision, RaceDecision } from '../types/simTypes';
import {
  readRaceWeekendUiDraft,
  writeRaceWeekendUiDraft,
  type RaceWeekendUiDraft,
} from './raceWeekendDraftStorage';

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function prepareAcceptedWeekendRecommendations(
  state: GameState,
  storage: DraftStorage | undefined,
): string[] {
  const race = currentRace(state);
  if (!race) return [];
  const pending = weekendCommandRecommendations(state).filter(
    (recommendation) => recommendation.status === 'Pending',
  );
  if (pending.length === 0) return [];

  const prior = readRaceWeekendUiDraft(storage, race.id);
  const draft: RaceWeekendUiDraft = prior ?? {
    raceId: race.id,
    phase: 'hub',
    furthestPhase: 'hub',
    setupDraft: {},
    qualifyingOverrides: {},
    raceOverrides: {},
  };
  const qualifyingOverrides = { ...draft.qualifyingOverrides };
  const raceOverrides = { ...draft.raceOverrides };

  for (const recommendation of pending) {
    if (!recommendation.recommendedOptionId) continue;
    for (const driver of activeDriversForTeam(state, state.selectedTeamId)) {
      if (recommendation.targetPhase === 'quali-run') {
        qualifyingOverrides[driver.id] = {
          ...qualifyingOverrides[driver.id],
          runPlanId: recommendation.recommendedOptionId as QualifyingDecision['runPlanId'],
        };
      }
      if (recommendation.targetPhase === 'race-strategy') {
        raceOverrides[driver.id] = {
          ...raceOverrides[driver.id],
          strategyId: recommendation.recommendedOptionId as RaceDecision['strategyId'],
        };
      }
      if (recommendation.targetPhase === 'race-instructions') {
        raceOverrides[driver.id] = {
          ...raceOverrides[driver.id],
          instructionId: recommendation.recommendedOptionId as RaceDecision['instructionId'],
        };
      }
    }
  }

  writeRaceWeekendUiDraft(storage, {
    ...draft,
    qualifyingOverrides,
    raceOverrides,
  });
  return pending.map((recommendation) => recommendation.id);
}
