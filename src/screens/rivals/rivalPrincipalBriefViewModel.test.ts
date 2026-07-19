import '../../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../../game/initialCareer';
import type { RivalRelationship } from '../../types/phase18Types';
import { rivalPrincipalBrief } from './rivalPrincipalBriefViewModel';

function state() {
  return createNewGame({ gameMode: 'Career', seasonYear: 1998, series: 'F1', teamId: 't-ferrari', seed: 'rival-brief' });
}

function relationship(base: RivalRelationship, overrides: Partial<RivalRelationship>): RivalRelationship {
  return { ...base, ...overrides };
}

describe('rival principal brief view model', () => {
  it('explains the rival principal identity and agenda from live character data', () => {
    const game = state();
    const rival = game.teams.find((team) => team.id !== game.selectedTeamId)!;
    const current = Object.values(game.phase18!.rivalRelationships).find((entry) =>
      (entry.teamAId === game.selectedTeamId && entry.teamBId === rival.id)
      || (entry.teamBId === game.selectedTeamId && entry.teamAId === rival.id))!;

    const brief = rivalPrincipalBrief(game, current, rival.id);

    expect(brief.principalName).toBe(game.aiPrincipals![rival.id].name);
    expect(brief.identityLabel).toBeTruthy();
    expect(['Cooperation', 'Political influence', 'Technical advantage', 'Public standing']).toContain(brief.agendaLabel);
  });

  it('raises risk and explains technical, political, and market stakes', () => {
    const game = state();
    const rival = game.teams.find((team) => team.id !== game.selectedTeamId)!;
    const current = Object.values(game.phase18!.rivalRelationships).find((entry) =>
      (entry.teamAId === game.selectedTeamId && entry.teamBId === rival.id)
      || (entry.teamBId === game.selectedTeamId && entry.teamAId === rival.id))!;
    const tense = relationship(current, {
      score: -38,
      technicalSuspicion: 84,
      politicalAlignment: -40,
      tags: ['TechnicalRival', 'DriverMarketRival'],
    });

    const brief = rivalPrincipalBrief(game, tense, rival.id);

    expect(brief.risk).toBe('High');
    expect(brief.reasons.join(' ')).toContain('Technical suspicion is elevated');
    expect(brief.reasons.join(' ')).toContain('Political positions are opposed');
    expect(brief.stakes.join(' ')).toContain('silly-season');
  });

  it('summarizes recent direction and the latest visible cause', () => {
    const game = state();
    const rival = game.teams.find((team) => team.id !== game.selectedTeamId)!;
    const current = Object.values(game.phase18!.rivalRelationships).find((entry) =>
      (entry.teamAId === game.selectedTeamId && entry.teamBId === rival.id)
      || (entry.teamBId === game.selectedTeamId && entry.teamAId === rival.id))!;
    const deteriorating = relationship(current, {
      history: [
        { id: 'one', seasonYear: 1998, round: 2, amount: -2, reason: 'Positions diverged.', category: 'Political' },
        { id: 'two', seasonYear: 1998, round: 3, amount: -4, reason: 'A public dispute escalated.', category: 'Political' },
      ],
    });

    const brief = rivalPrincipalBrief(game, deteriorating, rival.id);

    expect(brief.trend).toBe('Deteriorating');
    expect(brief.latestChange).toMatchObject({ reason: 'A public dispute escalated.', amount: -4, round: 3 });
  });
});
