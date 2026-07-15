import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import type { GameState } from '../game/careerState';
import { createNewGame } from '../game/initialCareer';
import { rolloverNarratives, syncNarratives } from './phase18NarrativeEngine';

function freshState(seed = 'phase18-narratives'): GameState {
  return createNewGame({ gameMode: 'Career', seasonYear: 1998, series: 'F1', teamId: 't-ferrari', seed });
}

describe('Phase 18 narrative engine', () => {
  it('unifies the major paddock systems into visible story categories', () => {
    const state = freshState();
    const rivalRelation = Object.values(state.phase18!.rivalRelationships).find((entry) => entry.teamAId === state.selectedTeamId || entry.teamBId === state.selectedTeamId)!;
    const driver = state.drivers.find((entry) => entry.teamId === state.selectedTeamId)!;
    const relationship = state.driverRelationships![driver.id];
    const clause = state.phase18!.contractClauses.find((entry) => entry.partyType === 'Driver')!;
    const technicalMood = state.phase18!.departmentMoods[state.selectedTeamId].Technical;
    const prepared: GameState = {
      ...state,
      financialDistress: { ...state.financialDistress, [state.selectedTeamId]: { level: 'Critical', consecutiveNegativeCashRaces: 3, racesUsingEmergencyPackage: 1, ownerPressure: 82 } },
      driverRelationships: { ...state.driverRelationships, [driver.id]: { ...relationship, morale: 20, frustration: 85, trustInPrincipal: 25 } },
      regulationProposals: [{ id: 'proposal-1', seasonYearEffective: 1999, title: 'Budget reform', description: 'A major budget proposal divides the paddock.', category: 'Budget', effects: {}, supportByTeam: Object.fromEntries(state.teams.map((team, index) => [team.id, index % 2 ? -50 : 50])), playerVote: 'Support' }],
      phase18: {
        ...state.phase18!,
        rivalRelationships: { ...state.phase18!.rivalRelationships, [rivalRelation.id]: { ...rivalRelation, score: -40, technicalSuspicion: 80 } },
        contractClauses: state.phase18!.contractClauses.map((entry) => entry.id === clause.id ? { ...entry, status: 'Breached', risk: 'Triggered' } : entry),
        departmentMoods: { ...state.phase18!.departmentMoods, [state.selectedTeamId]: { ...state.phase18!.departmentMoods[state.selectedTeamId], Technical: { ...technicalMood, morale: 18, trustInPrincipal: 25, conflictReasons: ['Leadership ignored repeated warnings.'] } } },
        failureInvestigations: { cases: [{ id: 'failure-1', seasonYear: 1998, round: 2, raceId: 'race-2', teamId: state.selectedTeamId, driverId: driver.id, trigger: 'MechanicalFailure', incidentSummary: 'A repeated gearbox failure stopped the car.', suspectedCause: 'DesignWeakness', hiddenRootCause: 'DesignWeakness', status: 'AwaitingInvestigation', confidence: 60, repeatedIssueCount: 2, unresolvedRisk: 80 }], repeatedIssueCounters: {}, history: [] },
        legacy: { ...state.phase18!.legacy, alternateHistory: [{ id: 'alternate-1998', seasonYear: 1998, category: 'Unexpected Winner', careerOutcome: 'A surprise contender won the title.', significance: 80 }] },
      },
    };
    const updated = syncNarratives(prepared);
    const categories = new Set(updated.phase18!.narratives.map((story) => story.category));

    expect(categories).toEqual(new Set(['Rivalry', 'Technical', 'Driver', 'Staff', 'Financial', 'Political', 'Legacy']));
    expect(updated.phase18!.narratives.find((story) => story.category === 'Rivalry')?.aiReaction).toBeTruthy();
    expect(updated.phase18!.narratives.find((story) => story.category === 'Financial')?.actionRoute).toBe('/finance');
  });

  it('escalates an existing thread without duplicating it', () => {
    const state = freshState('narrative-escalation');
    const relation = Object.values(state.phase18!.rivalRelationships).find((entry) => entry.teamAId === state.selectedTeamId || entry.teamBId === state.selectedTeamId)!;
    const tense = { ...state, phase18: { ...state.phase18!, rivalRelationships: { ...state.phase18!.rivalRelationships, [relation.id]: { ...relation, score: -20 } } } };
    const first = syncNarratives(tense);
    const escalated = syncNarratives({ ...first, phase18: { ...first.phase18!, rivalRelationships: { ...first.phase18!.rivalRelationships, [relation.id]: { ...relation, score: -45, technicalSuspicion: 85 } } } });
    const rivalry = escalated.phase18!.narratives.filter((story) => story.category === 'Rivalry');

    expect(rivalry).toHaveLength(1);
    expect(rivalry[0].urgency).toBe('Critical');
    expect(rivalry[0].stage).toBe('Flashpoint');
    expect(rivalry[0].progress).toBe(90);
  });

  it('resolves cleared conditions and closes active threads at season rollover', () => {
    const state = freshState('narrative-resolution');
    const relation = Object.values(state.phase18!.rivalRelationships).find((entry) => entry.teamAId === state.selectedTeamId || entry.teamBId === state.selectedTeamId)!;
    const active = syncNarratives({ ...state, phase18: { ...state.phase18!, rivalRelationships: { ...state.phase18!.rivalRelationships, [relation.id]: { ...relation, score: -30 } } } });
    const cleared = syncNarratives({ ...active, phase18: { ...active.phase18!, rivalRelationships: { ...active.phase18!.rivalRelationships, [relation.id]: { ...relation, score: 0 } } } });
    expect(cleared.phase18!.narratives[0].status).toBe('Resolved');

    const nextSeason = rolloverNarratives({ ...active, seasonYear: 1999 }, 1998);
    expect(nextSeason.phase18!.narratives.some((story) => story.createdSeasonYear === 1998 && story.status === 'Resolved')).toBe(true);
    expect(nextSeason.phase18!.narratives.some((story) => story.createdSeasonYear === 1999 && story.status === 'Active')).toBe(true);
  });
});
