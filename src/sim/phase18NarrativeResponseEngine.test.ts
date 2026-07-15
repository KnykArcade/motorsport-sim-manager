import { describe, expect, it } from 'vitest';
import type { GameState } from '../game/careerState';
import { createNewGame } from '../game/initialCareer';
import { syncNarratives } from './phase18NarrativeEngine';
import { applyNarrativeAIReactions, narrativeResponseEvents, resolveNarrativeResponse } from './phase18NarrativeResponseEngine';

function freshState(seed = 'phase18-narrative-responses'): GameState {
  return createNewGame({ gameMode: 'Career', seasonYear: 1998, series: 'F1', teamId: 't-ferrari', seed });
}

describe('Phase 18 narrative response engine', () => {
  it('turns the highest-priority unresolved stories into bounded Paddock Week decisions', () => {
    const state = freshState();
    const driver = state.drivers.find((entry) => entry.teamId === state.selectedTeamId)!;
    const relationship = state.driverRelationships![driver.id];
    const prepared = syncNarratives({
      ...state,
      careerPhase: { ...state.careerPhase!, currentPhase: 'paddock_week', currentRound: 4, paddockWeekId: 'pw-1998-4' },
      driverRelationships: { ...state.driverRelationships, [driver.id]: { ...relationship, morale: 18, frustration: 88 } },
      financialDistress: { ...state.financialDistress, [state.selectedTeamId]: { level: 'Critical', consecutiveNegativeCashRaces: 3, racesUsingEmergencyPackage: 1, ownerPressure: 80 } },
      phase18: {
        ...state.phase18!,
        departmentMoods: { ...state.phase18!.departmentMoods, [state.selectedTeamId]: { ...state.phase18!.departmentMoods[state.selectedTeamId], Technical: { ...state.phase18!.departmentMoods[state.selectedTeamId].Technical, morale: 15 } } },
      },
    });
    const events = narrativeResponseEvents(prepared);

    expect(events.length).toBeGreaterThan(0);
    expect(events.length).toBeLessThanOrEqual(3);
    expect(events.every((event) => !event.isRequiredDecision && !!event.narrativeStoryId)).toBe(true);
    expect(new Set(events.map((event) => event.narrativeStoryId)).size).toBe(events.length);
  });

  it('applies a driver response once and records the persistent consequence', () => {
    const state = freshState('driver-story-response');
    const driver = state.drivers.find((entry) => entry.teamId === state.selectedTeamId)!;
    const relationship = state.driverRelationships![driver.id];
    const prepared = syncNarratives({ ...state, driverRelationships: { ...state.driverRelationships, [driver.id]: { ...relationship, morale: 20, frustration: 85, trustInPrincipal: 25 } } });
    const story = prepared.phase18!.narratives.find((entry) => entry.threadId === `driver-${driver.id}`)!;
    const responded = resolveNarrativeResponse(prepared, story.id, 'private-meeting');
    const after = responded.driverRelationships![driver.id];

    expect(after.trustInPrincipal).toBeGreaterThan(25);
    expect(after.frustration).toBeLessThan(85);
    expect(responded.phase18!.narratives.find((entry) => entry.id === story.id)?.responseStatus).toBe('Responded');
    expect(responded.phase18!.narratives.find((entry) => entry.id === story.id)?.responseHistory).toHaveLength(1);

    const duplicate = resolveNarrativeResponse(responded, story.id, 'firm-line');
    expect(duplicate.driverRelationships![driver.id]).toEqual(after);
    expect(duplicate.phase18!.narratives.find((entry) => entry.id === story.id)?.responseHistory).toHaveLength(1);
  });

  it('routes technical story responses through the real failure investigation engine', () => {
    const state = freshState('technical-story-response');
    const driver = state.drivers.find((entry) => entry.teamId === state.selectedTeamId)!;
    const prepared = syncNarratives({
      ...state,
      phase18: {
        ...state.phase18!,
        failureInvestigations: {
          cases: [{ id: 'failure-response-1', seasonYear: 1998, round: 3, raceId: 'race-3', teamId: state.selectedTeamId, driverId: driver.id, trigger: 'MechanicalFailure', incidentSummary: 'A gearbox failure stopped the car.', suspectedCause: 'PartWear', hiddenRootCause: 'ManufacturingFlaw', status: 'AwaitingInvestigation', confidence: 30, repeatedIssueCount: 2, unresolvedRisk: 75 }],
          repeatedIssueCounters: {},
          history: [],
        },
      },
    });
    const story = prepared.phase18!.narratives.find((entry) => entry.threadId === 'failure-failure-response-1')!;
    const responded = resolveNarrativeResponse(prepared, story.id, 'standard-investigation');
    const failure = responded.phase18!.failureInvestigations!.cases[0];

    expect(failure.status).toBe('FindingsReady');
    expect(failure.investigationLevel).toBe('StandardInvestigation');
    expect(responded.teams.find((entry) => entry.id === state.selectedTeamId)!.budget).toBeLessThan(state.teams.find((entry) => entry.id === state.selectedTeamId)!.budget);
    expect(responded.phase18!.narratives.find((entry) => entry.id === story.id)?.responseHistory?.[0].responseId).toBe('standard-investigation');
  });

  it('makes a financial story response reduce real owner pressure', () => {
    const state = freshState('financial-story-response');
    const prepared = syncNarratives({ ...state, financialDistress: { ...state.financialDistress, [state.selectedTeamId]: { level: 'Critical', consecutiveNegativeCashRaces: 4, racesUsingEmergencyPackage: 1, ownerPressure: 84 } } });
    const story = prepared.phase18!.narratives.find((entry) => entry.threadId === 'financial-distress')!;
    const responded = resolveNarrativeResponse(prepared, story.id, 'cost-controls');

    expect(responded.financialDistress![state.selectedTeamId].ownerPressure).toBeLessThan(84);
    expect(responded.financialDistress![state.selectedTeamId].consecutiveNegativeCashRaces).toBe(3);
    expect(responded.teams.find((entry) => entry.id === state.selectedTeamId)!.morale).toBeLessThan(state.teams.find((entry) => entry.id === state.selectedTeamId)!.morale);
  });

  it('makes rival AI pressure mechanical and idempotent within a round', () => {
    const state = freshState('rival-ai-response');
    const relation = Object.values(state.phase18!.rivalRelationships).find((entry) => entry.teamAId === state.selectedTeamId || entry.teamBId === state.selectedTeamId)!;
    const relationships = Object.fromEntries(Object.entries(state.phase18!.rivalRelationships).map(([id, entry]) => [id, { ...entry, score: id === relation.id ? -40 : 0, technicalSuspicion: id === relation.id ? 80 : 30 }]));
    const prepared = syncNarratives({ ...state, careerPhase: { ...state.careerPhase!, currentRound: 5 }, phase18: { ...state.phase18!, narratives: [], rivalRelationships: relationships } });
    const story = prepared.phase18!.narratives.find((entry) => entry.threadId?.startsWith('rivalry-'))!;
    const before = prepared.phase18!.rivalRelationships[relation.id];
    const once = applyNarrativeAIReactions(prepared);
    const twice = applyNarrativeAIReactions(once);

    expect(once.phase18!.rivalRelationships[relation.id].score).toBeLessThan(before.score);
    expect(once.phase18!.rivalRelationships[relation.id].technicalSuspicion).toBeGreaterThan(before.technicalSuspicion);
    expect(twice.phase18!.rivalRelationships[relation.id]).toEqual(once.phase18!.rivalRelationships[relation.id]);
    expect(twice.phase18!.narratives.find((entry) => entry.id === story.id)?.lastAIReactionRound).toBe(5);
  });

  it('reopens a responded thread when its urgency escalates', () => {
    const state = freshState('story-reopen');
    const driver = state.drivers.find((entry) => entry.teamId === state.selectedTeamId)!;
    const relationship = state.driverRelationships![driver.id];
    const important = syncNarratives({ ...state, driverRelationships: { ...state.driverRelationships, [driver.id]: { ...relationship, frustration: 70 } } });
    const story = important.phase18!.narratives.find((entry) => entry.threadId === `driver-${driver.id}`)!;
    const responded = resolveNarrativeResponse(important, story.id, 'private-meeting');
    const escalated = syncNarratives({ ...responded, driverRelationships: { ...responded.driverRelationships, [driver.id]: { ...responded.driverRelationships![driver.id], frustration: 90 } } });

    expect(escalated.phase18!.narratives.find((entry) => entry.id === story.id)?.urgency).toBe('Critical');
    expect(escalated.phase18!.narratives.find((entry) => entry.id === story.id)?.responseStatus).toBe('AwaitingResponse');
  });
});
