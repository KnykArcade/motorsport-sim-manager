import '../testDataSetup';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { approvePreseasonTab } from './careerPhaseEngine';
import { gameReducer, type GameAction } from './gameReducer';
import { createNewGame } from './initialCareer';
import { advanceSeason } from './seasonRollover';
import { latestPartDesign } from '../sim/partsEngine';
import type { GameState } from './careerState';

const preseasonTabs = [
  'teamOverview',
  'budget',
  'driverLineup',
  'carDevelopment',
  'sponsorsEngine',
  'seasonObjectives',
  'roundOnePreview',
] as const;

function dispatch(state: GameState, action: GameAction): GameState {
  return gameReducer(state, action) as GameState;
}

function snapshot(state: GameState) {
  return {
    cars: state.cars.map((car) => ({ id: car.id, teamId: car.teamId, ratings: car.ratings, developmentLevel: car.developmentLevel })),
    driverStandings: state.driverStandings,
    constructorStandings: state.constructorStandings,
    tpp: Object.fromEntries(Object.entries(state.teamTechnical ?? {}).map(([teamId, technical]) => [teamId, technical.tpp])),
    completedNodeIds: Object.fromEntries(Object.entries(state.teamTechnical ?? {}).map(([teamId, technical]) => [teamId, technical.completedPrograms.filter((program) => program.kind === 'research' && program.node).map((program) => program.kind === 'research' ? program.node!.nodeId : '')])),
    parts: latestPartDesign('power_unit', state.teamTechnical?.[state.selectedTeamId]),
  };
}

describe('P4b golden parity', () => {
  it('reproduces the pre-cutover season and rollover fixture byte-for-byte', () => {
    const expected = JSON.parse(readFileSync('src/game/fixtures/p4b-golden-baseline.json', 'utf8')) as {
      races: Array<{ raceId: string } & ReturnType<typeof snapshot>>;
      rollover: ReturnType<typeof snapshot> & { seasonYear: number };
      seed: string;
    };
    let state = createNewGame({
      gameMode: 'Career',
      seasonYear: 1995,
      series: 'F1',
      teamId: 't-benetton',
      seed: expected.seed,
    });
    for (const tab of preseasonTabs) state = approvePreseasonTab(state, tab);
    state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
    state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });

    const actualRaces = [];
    for (let index = 0; index < 3; index += 1) {
      const race = state.calendar[state.currentRaceIndex];
      state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
      state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
      actualRaces.push({ raceId: race.id, ...snapshot(state) });
      if (index < 2) {
        state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
        state = dispatch(state, { type: 'ADVANCE_TO_PRE_RACE_BRIEFING' });
        state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
      }
    }

    const rolled = advanceSeason({ ...state, seasonComplete: true });
    expect(actualRaces).toEqual(expected.races);
    expect({ seasonYear: rolled.seasonYear, ...snapshot(rolled) }).toEqual(expected.rollover);
  });
});
