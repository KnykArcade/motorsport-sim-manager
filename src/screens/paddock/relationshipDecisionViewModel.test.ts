import '../../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../../game/initialCareer';
import type { GameState } from '../../game/careerState';
import { defaultCareerPhaseState } from '../../game/careerPhaseEngine';
import type { PaddockEvent } from '../../types/careerPhaseTypes';
import type { AdvisorRecommendation } from '../../types/phase18Types';
import {
  advisorCouncilReadForOption,
  advisorOptionImpactPreview,
  relationshipStakeholdersForDecision,
} from './relationshipDecisionViewModel';

function advisor(
  id: string,
  recommendedOptionId: string,
  confidence: number,
): AdvisorRecommendation {
  return {
    id,
    teamId: 'team',
    advisorRole: 'TechnicalDirector',
    decisionType: 'general_team',
    decisionId: 'decision',
    recommendedOptionId,
    recommendation: recommendedOptionId,
    rationale: 'Test recommendation.',
    confidence,
    urgency: 'Normal',
    status: 'Pending',
    createdSeasonYear: 1995,
  };
}

function stateWithDriverDecision(): { state: GameState; event: PaddockEvent; driverId: string } {
  const base = createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'relationship-decision-preview',
  });
  const driver = base.drivers.find((entry) => entry.teamId === base.selectedTeamId)!;
  const event: PaddockEvent = {
    id: 'driver-decision',
    weekId: 'pw-1995-1',
    season: 1995,
    series: 'F1',
    round: 1,
    category: 'driver_morale',
    title: 'Driver response required',
    description: 'The driver needs a decision.',
    severity: 'major',
    isRequiredDecision: true,
    options: [
      { id: 'listen', label: 'Listen', description: 'Hear the driver out.' },
      { id: 'refuse', label: 'Refuse', description: 'Hold the line.' },
    ],
    effectsApplied: false,
    createdAt: '1995-01-01T00:00:00.000Z',
    characterRequest: {
      requestKind: 'DriverConcern',
      targetType: 'Driver',
      targetId: driver.id,
      targetName: driver.name,
      teamId: driver.teamId,
    },
  };
  return {
    state: {
      ...base,
      careerPhase: {
        ...defaultCareerPhaseState(),
        currentPhase: 'paddock_week',
        currentRound: 1,
        paddockEvents: [event],
      },
    },
    event,
    driverId: driver.id,
  };
}

describe('relationship decision view model', () => {
  it('turns the targeted relationship into a readable must-act decision stake', () => {
    const { state, event, driverId } = stateWithDriverDecision();
    const profiles = relationshipStakeholdersForDecision(state, event);

    expect(profiles).toHaveLength(1);
    expect(profiles[0].target.id).toBe(driverId);
    expect(profiles[0].authorityRank).toBe(2);
    expect(profiles[0].status).toBe('MustActNow');
    expect(profiles[0].reasons[0]).toContain('Driver response required');
  });

  it('keeps internal advisor impact available for resolving department trust', () => {
    const recommendations = [
      advisor('strong-a', 'a', 80),
      advisor('normal-b', 'b', 60),
      advisor('normal-a', 'a', 40),
    ];

    expect(advisorOptionImpactPreview(recommendations, 'a')).toEqual({
      supporting: 2,
      overruled: 1,
      netTrustChange: 2,
      highConfidenceObjections: 0,
    });
    expect(advisorOptionImpactPreview(recommendations, 'b')).toEqual({
      supporting: 1,
      overruled: 2,
      netTrustChange: -1,
      highConfidenceObjections: 1,
    });
  });

  it('turns advisor impact into fuzzy council reads without exact effect hints', () => {
    const recommendations = [
      advisor('strong-a', 'a', 80),
      advisor('normal-b', 'b', 60),
      advisor('normal-a', 'a', 40),
    ];

    const supportedRead = advisorCouncilReadForOption(recommendations, 'a');
    expect(supportedRead.label).toBe('Council split');
    expect(supportedRead.tone).toBe('caution');
    expect(`${supportedRead.label} ${supportedRead.read} ${supportedRead.watch}`).not.toMatch(/[+-]\d|trust \d|confidence \d/i);
    expect(supportedRead.read).toMatch(/enough support|not enough/i);

    const resistedRead = advisorCouncilReadForOption(recommendations, 'b');
    expect(resistedRead.label).toBe('Strong objection possible');
    expect(resistedRead.tone).toBe('warning');
    expect(`${resistedRead.label} ${resistedRead.read} ${resistedRead.watch}`).toMatch(/may|watch/i);
    expect(`${resistedRead.label} ${resistedRead.read} ${resistedRead.watch}`).not.toMatch(/[+-]\d|trust \d|confidence \d/i);
  });
});
