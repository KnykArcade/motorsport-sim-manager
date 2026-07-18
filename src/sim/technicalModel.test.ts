import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { loadSeasonBundle } from '../data/seasonLoader';
import { approvePreseasonTab } from '../game/careerPhaseEngine';
import { currentRace, type GameState } from '../game/careerState';
import { gameReducer, type GameAction } from '../game/gameReducer';
import { createNewGame } from '../game/initialCareer';
import { migrateGameState } from '../game/saveSystem';
import { advanceSeason } from '../game/seasonRollover';
import { createInitialTeamResearch } from './rdEngine';
import { latestPartDesign } from './partsEngine';
import { toUnifiedTechnical } from './technicalModel';
import type { DevelopmentProject } from '../types/gameTypes';

const preseasonTabs = [
  'teamOverview',
  'budget',
  'driverLineup',
  'carDevelopment',
  'sponsorsEngine',
  'seasonObjectives',
  'roundOnePreview',
] as const;

function career(seed: string): GameState {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed,
  });
}

function dispatch(state: GameState, action: GameAction): GameState {
  return gameReducer(state, action) as GameState;
}

function upgrade(id: string): DevelopmentProject {
  return {
    id,
    name: 'Aero package',
    category: 'Aero',
    horizon: 'CurrentSeason',
    cost: 250,
    durationRaces: 3,
    progressRaces: 1,
    successChance: 0.8,
    currentSeasonEffects: { aeroEfficiency: 0.2 },
    nextSeasonEffects: { aeroEfficiency: 0.1 },
    facilityEffects: { aero: 1 },
    carryoverRate: 0.5,
    regulationSensitivity: 0.2,
    risk: 'Wind-tunnel correlation risk',
    riskLevel: 'Standard',
    projectSize: 'Medium',
    relevantFacilityTypes: ['WindTunnel'],
    rushed: true,
    facilityLevelAtStart: 3,
    adjustedDurationRaces: 2,
  };
}

describe('unified technical projection', () => {
  it('maps active and completed upgrades plus research without losing technical history', () => {
    const state = career('technical-projection');
    const teamId = state.selectedTeamId;
    const activeUpgrade = upgrade('upgrade-active');
    const completedUpgrade = {
      ...upgrade('upgrade-complete'),
      progressRaces: 2,
      outcomeResult: {
        outcome: 'FullSuccess' as const,
        expectedGain: { aeroEfficiency: 0.2 },
        actualGain: { aeroEfficiency: 0.2 },
        label: 'Full success',
        description: 'The package delivered as expected.',
      },
    };
    const research = createInitialTeamResearch(teamId, state.seasonYear);
    research.focus = {
      branchId: 'aero',
      selectedSeasonYear: 1995,
      lockedThroughSeasonYear: 1997,
    };
    research.tpp.balance = 18;
    research.tpp.ledger.push({
      id: 'tpp-1',
      seasonYear: 1995,
      round: 2,
      amount: -12,
      balanceAfter: 18,
      reason: 'research_project',
      description: 'Aero node',
      nodeId: 'aero:E2',
    });
    research.activeProjects.push({
      id: 'rd-active',
      nodeId: 'aero:E2',
      teamId,
      startedSeasonYear: 1995,
      startedRound: 2,
      progressRounds: 1,
      durationRounds: 4,
      cashCost: 400,
      tppCost: 12,
      nodeName: 'Aero efficiency',
      sourceId: 'aero-source',
      branchId: 'aero',
      tier: 2,
      path: 'efficiency',
      riskLevel: 'Aggressive',
      seriesWeight: 1.1,
      modifierTemplates: [{
        scope: 'car',
        target: 'aeroEfficiency',
        value: 0.2,
        description: 'Improved aero',
      }],
    });
    research.completedNodes.push({
      nodeId: 'aero:E1',
      teamId,
      completedSeasonYear: 1995,
      completedRound: 1,
      sourceId: 'aero-source',
      branchId: 'aero',
      tier: 1,
    });
    research.projectHistory.push({
      projectId: 'rd-complete',
      nodeId: 'aero:E1',
      nodeName: 'Aero foundation',
      seasonYear: 1995,
      round: 1,
      outcomeResult: {
        outcome: 'FullSuccess',
        multiplier: 1,
        label: 'Full success',
        description: 'Completed cleanly.',
        appliedModifiers: [],
      },
      completed: true,
    });
    research.modifiers.push({
      id: 'modifier-1',
      sourceNodeId: 'aero:E1',
      scope: 'car',
      target: 'aeroEfficiency',
      value: 0.1,
      description: 'Aero foundation',
      appliedSeasonYear: 1995,
    });

    const projected = toUnifiedTechnical({
      ...state,
      activeDevelopmentProjects: [activeUpgrade],
      completedDevelopmentProjects: [completedUpgrade],
      teamResearch: { ...state.teamResearch, [teamId]: research },
    });
    const team = projected[teamId];

    expect(team.activeProjects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'upgrade',
        id: activeUpgrade.id,
        progressTicks: 1,
        durationTicks: 2,
        tppCost: 0,
        carryoverRate: 0.5,
      }),
      expect.objectContaining({
        kind: 'research',
        id: 'rd-active',
        nodeId: 'aero:E2',
        progressTicks: 1,
        durationTicks: 4,
        tppCost: 12,
      }),
    ]));
    expect(team.focus).toEqual(research.focus);
    expect(team.tpp).toEqual(research.tpp);
    expect(team.modifiers).toEqual(research.modifiers);
    expect(team.completedPrograms).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'upgrade', id: completedUpgrade.id }),
      expect.objectContaining({ kind: 'research', node: research.completedNodes[0] }),
      expect.objectContaining({ kind: 'research', historyEntry: research.projectHistory[0] }),
    ]));
    const otherTeam = projected[state.teams.find((teamEntry) => teamEntry.id !== teamId)!.id];
    expect(otherTeam.activeProjects.every((project) => project.kind === 'research')).toBe(true);
  });

  it('migrates a pre-v2 state into an equivalent projection without changing authoritative outputs', () => {
    const state = career('technical-migration');
    const legacy = structuredClone(state);
    delete legacy.saveSchemaVersion;
    delete legacy.teamTechnical;
    const migrated = migrateGameState(legacy);

    expect(migrated.teamTechnical).toEqual(toUnifiedTechnical(legacy));
    expect(migrated.cars).toEqual(state.cars);
    expect(migrated.teamResearch).toEqual(state.teamResearch);
    expect(migrated.teamTechnical?.[state.selectedTeamId].tpp).toEqual(
      state.teamResearch?.[state.selectedTeamId].tpp,
    );
  });

  it('keeps a deterministic race result and part design unchanged when projection persistence is absent', async () => {
    const bundle = await loadSeasonBundle(1995, 'F1');
    const initial = createNewGame({
      gameMode: 'SingleSeason',
      seasonYear: 1995,
      series: 'F1',
      teamId: 't-benetton',
      seed: 'technical-parity',
      bundle,
    });
    let withProjection = initial;
    let withoutProjection: GameState = { ...initial, teamTechnical: undefined };
    for (const tab of preseasonTabs) {
      withProjection = approvePreseasonTab(withProjection, tab);
      withoutProjection = approvePreseasonTab(withoutProjection, tab);
    }
    const setupActions: GameAction[] = [
      { type: 'COMPLETE_PRESEASON_SETUP' },
      { type: 'ADVANCE_TO_RACE_WEEKEND' },
      { type: 'RUN_QUALIFYING', decisions: [] },
      { type: 'RUN_RACE', decisions: [] },
    ];
    for (const action of setupActions) {
      withProjection = dispatch(withProjection, action);
      withoutProjection = dispatch({ ...withoutProjection, teamTechnical: undefined }, action);
    }

    const race = currentRace(withProjection);
    expect(withProjection.completedRaceResults).toEqual(withoutProjection.completedRaceResults);
    expect(withProjection.driverStandings).toEqual(withoutProjection.driverStandings);
    expect(withProjection.constructorStandings).toEqual(withoutProjection.constructorStandings);
    expect(withProjection.cars).toEqual(withoutProjection.cars);
    expect(withProjection.teamResearch).toEqual(withoutProjection.teamResearch);
    expect(withProjection.teamParts).toEqual(withoutProjection.teamParts);
    expect(latestPartDesign('power_unit', withProjection.teamResearch![withProjection.selectedTeamId]))
      .toEqual(latestPartDesign('power_unit', withoutProjection.teamResearch![withoutProjection.selectedTeamId]));
    expect(race).toBeDefined();
    expect(withProjection.teamTechnical).toEqual(toUnifiedTechnical(withProjection));
    expect(withoutProjection.teamTechnical).toEqual(toUnifiedTechnical(withoutProjection));
  });

  it('refreshes the projection after season rollover', () => {
    const rolled = advanceSeason(career('technical-rollover'));
    expect(rolled.seasonYear).toBe(1996);
    expect(rolled.teamTechnical).toEqual(toUnifiedTechnical(rolled));
  });
});
