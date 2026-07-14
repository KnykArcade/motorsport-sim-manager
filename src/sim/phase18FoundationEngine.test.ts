import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import { advanceSeason } from '../game/seasonRollover';
import type { GameState } from '../game/careerState';
import { DEPARTMENT_IDS, PHASE_18_FOUNDATION_VERSION, TEAM_CULTURE_AXES } from '../types/phase18Types';
import {
  createInitialPhase18FoundationState,
  ensurePhase18FoundationState,
  rivalRelationshipId,
} from './phase18FoundationEngine';

function freshState(seed = 'phase18-foundation'): GameState {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed,
  });
}

describe('Phase 18 foundation state', () => {
  it('seeds every team and principal with complete neutral persistence models', () => {
    const state = freshState();
    const foundation = state.phase18!;

    expect(foundation.version).toBe(PHASE_18_FOUNDATION_VERSION);
    expect(foundation.principalIdentity.principalId).toBe(state.principal?.id);
    expect(Object.keys(foundation.aiPrincipalIdentities)).toHaveLength(state.teams.length - 1);
    expect(Object.keys(foundation.departmentMoods)).toHaveLength(state.teams.length);
    expect(Object.keys(foundation.teamCultures)).toHaveLength(state.teams.length);
    for (const team of state.teams) {
      expect(Object.keys(foundation.departmentMoods[team.id])).toEqual([...DEPARTMENT_IDS]);
      expect(Object.keys(foundation.teamCultures[team.id].axes)).toEqual([...TEAM_CULTURE_AXES]);
    }
    expect(foundation.advisorRecommendations).toEqual([]);
    expect(foundation.intelligenceReports).toEqual([]);
    expect(foundation.contractClauses).toEqual([]);
    expect(foundation.rivalRelationships).toEqual({});
    expect(foundation.legacy.score).toBe(0);
    expect(foundation.narratives).toEqual([]);
  });

  it('is deterministic and uses order-independent rivalry ids', () => {
    const first = freshState('deterministic-phase18');
    const second = freshState('deterministic-phase18');
    expect(first.phase18).toEqual(second.phase18);
    expect(rivalRelationshipId('team-b', 'team-a')).toBe(rivalRelationshipId('team-a', 'team-b'));
  });

  it('backfills missing fields while preserving existing living-paddock history', () => {
    const state = freshState();
    const foundation = createInitialPhase18FoundationState(state);
    foundation.legacy.score = 42;
    foundation.legacy.milestones.push({
      id: 'milestone-1',
      category: 'ResearchBreakthrough',
      seasonYear: 1995,
      teamId: state.selectedTeamId,
      title: 'Breakthrough',
      description: 'A test milestone.',
      legacyPoints: 42,
    });
    delete foundation.departmentMoods[state.teams[0].id];

    const ensured = ensurePhase18FoundationState(foundation, state);
    expect(ensured.legacy.score).toBe(42);
    expect(ensured.legacy.milestones).toHaveLength(1);
    expect(Object.keys(ensured.departmentMoods[state.teams[0].id])).toEqual([...DEPARTMENT_IDS]);
  });

  it('keeps player identity through a team move but resets a replaced AI principal', () => {
    const state = freshState('phase18-principal-ownership');
    const rival = state.teams.find((team) => team.id !== state.selectedTeamId)!;
    const withPrincipals: GameState = {
      ...state,
      aiPrincipals: {
        [rival.id]: {
          principalId: 'ai-old',
          name: 'Old Principal',
          pressure: 20,
          contractYearsRemaining: 2,
          seasonsAtTeam: 1,
          fired: false,
        },
      },
    };
    const first = ensurePhase18FoundationState(state.phase18, withPrincipals);
    first.principalIdentity.scores.TechnicalVisionary = 12;
    first.principalIdentity.totalIdentityXp = 12;
    first.aiPrincipalIdentities[rival.id].scores.PoliticalOperator = 9;

    const moved = ensurePhase18FoundationState(first, { ...withPrincipals, selectedTeamId: rival.id });
    expect(moved.principalIdentity.scores.TechnicalVisionary).toBe(12);
    expect(moved.aiPrincipalIdentities[rival.id]).toBeUndefined();

    const replacement = ensurePhase18FoundationState(first, {
      ...withPrincipals,
      aiPrincipals: {
        [rival.id]: {
          ...withPrincipals.aiPrincipals![rival.id],
          principalId: 'ai-new',
          name: 'New Principal',
        },
      },
    });
    expect(replacement.aiPrincipalIdentities[rival.id].principalId).toBe('ai-new');
    expect(replacement.aiPrincipalIdentities[rival.id].scores.PoliticalOperator).toBe(0);
  });

  it('survives season rollover with team-owned culture and career legacy intact', () => {
    const state = freshState('phase18-rollover');
    const playerCulture = state.phase18!.teamCultures[state.selectedTeamId];
    const prepared: GameState = {
      ...state,
      seasonComplete: true,
      phase18: {
        ...state.phase18!,
        teamCultures: {
          ...state.phase18!.teamCultures,
          [state.selectedTeamId]: { ...playerCulture, tags: ['DevelopmentFactory'] },
        },
        legacy: { ...state.phase18!.legacy, score: 75 },
      },
    };

    const next = advanceSeason(prepared);
    expect(next.phase18?.teamCultures[state.selectedTeamId].tags).toContain('DevelopmentFactory');
    expect(next.phase18?.legacy.score).toBe(75);
  });
});
