import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import type { GameState } from '../game/careerState';
import { createNewGame } from '../game/initialCareer';
import { migrateGameState } from '../game/saveSystem';
import type { CharacterInteractionTarget } from '../types/characterInteractionTypes';
import {
  applyCharacterInfluenceEffects,
  characterRolePower,
  ensureCharacterInfluence,
  generateCharacterInfluenceEvents,
  influenceForTarget,
  internalCharacterInfluence,
  refreshCharacterInfluence,
} from './characterInfluenceEngine';
import { characterOpinionKey, currentCharacterTargets } from './characterOpinionEngine';

function freshState(): GameState {
  return createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'character-influence-test' });
}

function withOpinion(state: GameState, target: CharacterInteractionTarget, score: number): GameState {
  const key = characterOpinionKey(target);
  return {
    ...state,
    characterInteractions: {
      ...state.characterInteractions!,
      opinions: {
        ...state.characterInteractions!.opinions,
        [key]: { ...state.characterInteractions!.opinions[key], score, trust: Math.max(0, Math.min(100, score + 50)) },
      },
    },
  };
}

describe('character influence engine', () => {
  it('seeds a visible power and support profile for every current character', () => {
    const state = ensureCharacterInfluence(freshState());
    expect(state.characterInteractions!.influence).toHaveLength(currentCharacterTargets(state).length);
    const internal = internalCharacterInfluence(state);
    expect(internal.find((profile) => profile.target.type === 'Owner')?.power).toBe(95);
    expect(internal.every((profile) => profile.power <= 100)).toBe(true);
    expect(internal.every((profile) => profile.effectLabel.length > 0 && profile.basis.length > 0)).toBe(true);
  });

  it('keeps an ordinary driver below ownership authority on the shared 1-100 rating scale', () => {
    const base = freshState();
    const target = currentCharacterTargets(base).find((entry) => entry.type === 'Driver')!;
    const relationship = base.driverRelationships![target.id];
    const ordinary: GameState = {
      ...base,
      drivers: base.drivers.map((driver) => driver.id === target.id
        ? { ...driver, ratings: { ...driver.ratings, overall: 70 } }
        : driver),
      driverRelationships: {
        ...base.driverRelationships!,
        [target.id]: {
          ...relationship,
          numberOneExpectation: false,
          personalityTraits: relationship.personalityTraits.filter((trait) => trait !== 'Team Leader'),
        },
      },
      commercial: undefined,
      driverStandings: [],
    };
    const owner = currentCharacterTargets(ordinary).find((entry) => entry.type === 'Owner')!;

    expect(characterRolePower(ordinary, target)).toBe(80);
    expect(characterRolePower(ordinary, target)).toBeLessThan(characterRolePower(ordinary, owner));
  });

  it('allows an exceptional team-leading superstar to exceed the owner power baseline', () => {
    const base = freshState();
    const target = currentCharacterTargets(base).find((entry) => entry.type === 'Driver')!;
    const relationship = base.driverRelationships![target.id];
    const superstar: GameState = {
      ...base,
      drivers: base.drivers.map((driver) => driver.id === target.id
        ? { ...driver, ratings: { ...driver.ratings, overall: 100 } }
        : driver),
      driverRelationships: {
        ...base.driverRelationships!,
        [target.id]: {
          ...relationship,
          numberOneExpectation: true,
          personalityTraits: [...new Set([...relationship.personalityTraits, 'Team Leader' as const])],
        },
      },
      driverStandings: [{ entityId: target.id, points: 100, wins: 3, podiums: 5, dnfs: 0 }],
    };
    const owner = currentCharacterTargets(superstar).find((entry) => entry.type === 'Owner')!;

    expect(characterRolePower(superstar, target)).toBe(100);
    expect(characterRolePower(superstar, target)).toBeGreaterThan(characterRolePower(superstar, owner));
  });

  it('turns strong driver backing into a bounded weekly trust effect applied only once', () => {
    const base = freshState();
    const target = currentCharacterTargets(base).find((entry) => entry.type === 'Driver')!;
    const supportive = refreshCharacterInfluence(withOpinion(base, target, 80));
    expect(influenceForTarget(supportive, target)?.stance).toBe('Champion');
    const before = supportive.driverRelationships![target.id].trustInPrincipal;
    const applied = applyCharacterInfluenceEffects(supportive);
    expect(applied.driverRelationships![target.id].trustInPrincipal).toBe(before + 1);
    expect(applyCharacterInfluenceEffects(applied).driverRelationships![target.id].trustInPrincipal).toBe(before + 1);
  });

  it('lets an obstructive owner reduce existing board backing without exceeding the weekly cap', () => {
    const base = freshState();
    const target = currentCharacterTargets(base).find((entry) => entry.type === 'Owner')!;
    const resistant = refreshCharacterInfluence(withOpinion(base, target, -90));
    expect(influenceForTarget(resistant, target)?.stance).toBe('Obstructive');
    const patience = resistant.teamReputations![resistant.selectedTeamId].ownerPatience;
    const security = resistant.principal!.jobSecurity;
    const applied = applyCharacterInfluenceEffects(resistant);
    expect(applied.teamReputations![applied.selectedTeamId].ownerPatience).toBe(patience - 2);
    expect(applied.principal!.jobSecurity).toBe(security - 2);
  });

  it('includes broken promises and escalating disputes in the support calculation', () => {
    const base = freshState();
    const target = currentCharacterTargets(base).find((entry) => entry.type === 'Driver')!;
    const connected = base.characterInteractions!.connections.find((entry) => entry.characterA.id === target.id || entry.characterB.id === target.id)!;
    const pressured: GameState = {
      ...withOpinion(base, target, 30),
      characterInteractions: {
        ...withOpinion(base, target, 30).characterInteractions!,
        commitments: [{
          id: 'broken-test', sourceEventId: 'event-test', target, kind: 'DriverPromise', title: 'Broken test promise',
          description: 'Test', measureLabel: 'Delivery', currentValue: 0, targetValue: 100, direction: 'AtLeast',
          createdSeason: base.seasonYear, createdRound: 0, dueSeason: base.seasonYear, dueRound: 0,
          status: 'Broken', resolvedSeason: base.seasonYear, resolvedRound: 0,
        }],
        disputes: [{
          id: 'dispute-test', connectionId: connected.id, characterA: connected.characterA, characterB: connected.characterB,
          issue: 'test conflict', status: 'Escalating', intensity: 80, startedSeason: base.seasonYear, startedRound: 0,
        }],
      },
    };
    const refreshed = refreshCharacterInfluence(pressured);
    const profile = influenceForTarget(refreshed, target)!;
    expect(profile.support).toBeLessThan(30);
    expect(profile.basis.some((entry) => entry.includes('broken'))).toBe(true);
    expect(profile.basis.some((entry) => entry.includes('conflict'))).toBe(true);
  });

  it('reports a stance transition once and backfills older saves', () => {
    const base = freshState();
    const target = currentCharacterTargets(base).find((entry) => entry.type === 'Owner')!;
    const changed = refreshCharacterInfluence(withOpinion(base, target, -90));
    expect(generateCharacterInfluenceEvents(changed).some((event) => event.title.includes(target.name))).toBe(true);
    expect(generateCharacterInfluenceEvents(refreshCharacterInfluence(changed))).toHaveLength(0);

    const legacy = structuredClone(base);
    delete (legacy.characterInteractions as Partial<typeof legacy.characterInteractions>)?.influence;
    const migrated = migrateGameState(legacy);
    expect(migrated.characterInteractions!.version).toBe(13);
    expect(migrated.characterInteractions!.influence.length).toBeGreaterThan(0);
  });
});
