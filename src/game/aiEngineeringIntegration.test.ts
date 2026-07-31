import '../testDataSetup';
import { describe, expect, it } from 'vitest';

import { getTrackById } from '../data';
import { createNewGame } from './initialCareer';
import { activeDriversForTeam, currentRace } from './careerState';
import {
  buildRaceContext,
  resolveAIEngineeringPlans,
  weekendSessionSetups,
} from './raceSetup';

function state() {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'ai-engineering-integration',
  });
}

describe('AI engineering simulation integration', () => {
  it('gives every rival entrant an engineered physical profile instead of a generic auto trim', () => {
    const initial = state();
    const race = currentRace(initial)!;
    const track = getTrackById(race.trackId)!;
    const plans = resolveAIEngineeringPlans(initial, track);
    const qualifying = weekendSessionSetups(initial, track, 'qualifying', plans);
    for (const team of initial.teams) {
      if (team.id === initial.selectedTeamId) continue;
      for (const driver of activeDriversForTeam(initial, team.id)) {
        expect(plans[team.id]?.drivers[driver.id]).toBeDefined();
        expect(qualifying.setupIdByDriver[driver.id]).toBe(`ai-engineered-qualifying-${driver.id}`);
        expect(qualifying.profilesByDriver[driver.id]?.source).toBe('tuned');
      }
    }
  });

  it('rebuilds missing legacy-save plans deterministically and reuses persisted plans', () => {
    const initial = state();
    const race = currentRace(initial)!;
    const track = getTrackById(race.trackId)!;
    const generated = resolveAIEngineeringPlans(initial, track);
    expect(resolveAIEngineeringPlans(initial, track)).toEqual(generated);
    const persisted = resolveAIEngineeringPlans({ ...initial, aiEngineeringPlans: generated }, track);
    expect(persisted).toEqual(generated);
  });

  it('feeds Quick Sim and Live Race the same persisted AI race profiles', () => {
    const initial = state();
    const race = currentRace(initial)!;
    const track = getTrackById(race.trackId)!;
    const plans = resolveAIEngineeringPlans(initial, track);
    const withWeekend = {
      ...initial,
      aiEngineeringPlans: plans,
      qualifyingResults: { ...initial.qualifyingResults, [race.id]: [] },
    };
    const expected = weekendSessionSetups(withWeekend, track, 'race', plans);
    const built = buildRaceContext(withWeekend, [])!;
    for (const [driverId, profile] of Object.entries(expected.profilesByDriver)) {
      expect(built.context.setupProfilesByDriver?.[driverId]).toEqual(profile);
      expect(built.context.decisions[driverId].setupId).toBe(expected.setupIdByDriver[driverId]);
    }
  });
});
