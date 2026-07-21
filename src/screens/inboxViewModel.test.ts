import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import type { GameState } from '../game/careerState';
import type { StaffMember } from '../types/staffTypes';
import { gameReducer } from '../game/gameReducer';
import {
  actionableInboxCount,
  inboxMessages,
  mustRespondInboxCount,
  recommendedInboxCount,
  unreadInboxCount,
} from './inboxViewModel';

function newState(): GameState {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'inbox-test',
  });
}

describe('inboxViewModel', () => {
  it('pins actionable items ahead of news, criticals first', () => {
    const state = newState();
    const messages = inboxMessages(state);
    const firstNews = messages.findIndex((message) => message.category === 'news');
    if (firstNews >= 0) {
      expect(messages.slice(firstNews).every((message) => message.category === 'news')).toBe(true);
    }
    const actionables = messages.filter((message) => message.actionable);
    const severities = actionables.map((message) => message.severity);
    const sorted = [...severities].sort((a, b) => ({ critical: 0, action: 1, info: 2 }[a] - { critical: 0, action: 1, info: 2 }[b]));
    expect(severities).toEqual(sorted);
  });

  it('classifies required paddock decisions as blockers and other actions as recommendations', () => {
    const base = newState();
    const state: GameState = {
      ...base,
      careerPhase: {
        ...base.careerPhase!,
        currentPhase: 'paddock_week',
        paddockEvents: [{
          id: 'event-required',
          weekId: 'week-1',
          season: base.seasonYear,
          series: base.series,
          round: 1,
          category: 'general_team',
          title: 'Required team decision',
          description: 'A decision must be made.',
          severity: 'critical',
          isRequiredDecision: true,
          options: [{ id: 'option-a', label: 'Approve', description: 'Approve the plan.' }],
          effectsApplied: false,
          createdAt: '2026-01-01T00:00:00.000Z',
        }],
      },
    };
    const messages = inboxMessages(state);
    const blocker = messages.find((message) => message.id === 'inbox-paddock-event-required');
    expect(blocker?.kind).toBe('must_respond');
    expect(blocker?.blocking).toBe(true);
    expect(blocker?.source).toBe('Paddock');
    expect(blocker?.whyItMatters).toContain('morale');
    expect(mustRespondInboxCount(state)).toBe(1);
    expect(recommendedInboxCount(state)).toBe(messages.filter((message) => message.kind === 'recommended').length);
  });

  it('surfaces expiring driver contracts as an action item', () => {
    const base = newState();
    const state: GameState = {
      ...base,
      drivers: base.drivers.map((driver) =>
        driver.teamId === base.selectedTeamId ? { ...driver, contractYearsRemaining: 1 } : driver),
    };
    const item = inboxMessages(state).find((message) => message.id === 'inbox-contracts-expiring');
    expect(item).toBeDefined();
    expect(item?.actionable).toBe(true);
    expect(item?.route).toBe('/drivers');
  });

  it('surfaces vacant and expiring staff roles as people actions', () => {
    const base = newState();
    const vacant = inboxMessages({ ...base, staff: [] }).find((message) => message.id === 'inbox-staff-vacancies');
    expect(vacant).toMatchObject({
      actionable: true,
      route: '/staff?tab=market',
      body: expect.stringContaining('Technical Director'),
    });

    const staffMember: StaffMember = {
      id: 'staff-td',
      name: 'Test Director',
      role: 'Technical Director',
      nationality: 'GBR',
      rating: 8,
      salary: 1,
      signingFee: 1,
      contractYearsRemaining: 1,
      bio: 'Test staff member',
    };
    const expiring = inboxMessages({
      ...base,
      staff: [staffMember],
    }).find((message) => message.id === 'inbox-staff-contracts-expiring');
    expect(expiring).toMatchObject({
      actionable: true,
      route: '/staff?tab=contracts',
    });
    expect(expiring?.body).toContain(staffMember?.name);
  });

  it('surfaces open regulation votes and low budget', () => {
    const base = newState();
    const state: GameState = {
      ...base,
      regulationProposals: [{
        id: 'prop-1',
        seasonYearEffective: base.seasonYear + 1,
        title: 'Ban active suspension',
        description: 'Test proposal',
        category: 'Aero',
        effects: {},
        supportByTeam: {},
      }],
      teams: base.teams.map((team) =>
        team.id === base.selectedTeamId ? { ...team, budget: 1_000_000 } : team),
    };
    const messages = inboxMessages(state);
    expect(messages.some((message) => message.id === 'inbox-regulation-votes')).toBe(true);
    const budget = messages.find((message) => message.id === 'inbox-low-budget');
    expect(budget?.severity).toBe('critical');
  });

  it('deep-links technical alerts to their owning section', () => {
    const base = newState();
    const teamParts = base.teamParts![base.selectedTeamId];
    const fitted = teamParts.inventory.find((part) => part.status === 'fitted');
    expect(fitted).toBeDefined();
    const state: GameState = {
      ...base,
      teamParts: {
        ...base.teamParts,
        [base.selectedTeamId]: {
          ...teamParts,
          inventory: teamParts.inventory.map((part) =>
            part.id === fitted?.id ? { ...part, condition: 20 } : part),
        },
      },
    };
    expect(inboxMessages(state).find((message) => message.id === 'inbox-critical-parts')?.route)
      .toBe('/technical?section=parts');
  });

  it('maps news priority to inbox severity', () => {
    const base = newState();
    const state: GameState = {
      ...base,
      news: [
        { id: 'n1', headline: 'Critical story', timestamp: '2026-01-01', priority: 'critical' },
        { id: 'n2', headline: 'Normal story', timestamp: '2026-01-01', priority: 'normal' },
      ],
    };
    const messages = inboxMessages(state).filter((message) => message.category === 'news');
    expect(messages.find((message) => message.id === 'inbox-news-n1')?.severity).toBe('critical');
    expect(messages.find((message) => message.id === 'inbox-news-n2')?.severity).toBe('info');
    expect(messages.every((message) => !message.actionable)).toBe(true);
  });

  it('tracks read state through MARK_INBOX_READ', () => {
    const state = newState();
    const before = unreadInboxCount(state);
    expect(before).toBe(inboxMessages(state).length);

    const ids = inboxMessages(state).slice(0, 2).map((message) => message.id);
    const next = gameReducer(state, { type: 'MARK_INBOX_READ', messageIds: ids });
    expect(next).not.toBeNull();
    expect(unreadInboxCount(next as GameState)).toBe(before - ids.length);
  });

  it('applies technical management presets to factory automation', () => {
    const state = newState();
    const assisted = gameReducer(state, { type: 'SET_TECHNICAL_MANAGEMENT_MODE', mode: 'assisted' }) as GameState;
    expect(assisted.technicalManagementMode).toBe('assisted');
    expect(assisted.partsAutomation).toEqual({ autoRepair: true, autoRestock: true, autoFit: true });

    const playerLed = gameReducer(assisted, { type: 'SET_TECHNICAL_MANAGEMENT_MODE', mode: 'player_led' }) as GameState;
    expect(playerLed.technicalManagementMode).toBe('player_led');
    expect(playerLed.partsAutomation).toEqual({ autoRepair: false, autoRestock: false, autoFit: false });
  });

  it('counts actionable items', () => {
    const state = newState();
    const messages = inboxMessages(state);
    expect(actionableInboxCount(state)).toBe(messages.filter((message) => message.actionable).length);
  });
});
