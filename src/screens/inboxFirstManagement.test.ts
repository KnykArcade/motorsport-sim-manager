import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import type { GameState } from '../game/careerState';
import type { InboxMessage } from './inboxViewModel';
import {
  inboxInlineActions,
  nextInboxMessageId,
} from './inboxActionViewModel';
import {
  readInboxWorkspaceState,
  writeInboxWorkspaceState,
} from './inboxWorkspaceStorage';
import { prepareAcceptedWeekendRecommendations } from './inboxWeekendAction';
import { readRaceWeekendUiDraft } from './raceWeekendDraftStorage';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
}

function careerState(): GameState {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'phase17-inbox-first',
  });
}

function message(overrides: Partial<InboxMessage> = {}): InboxMessage {
  return {
    id: 'message-1',
    severity: 'info',
    category: 'news',
    title: 'Routine update',
    route: '/news',
    routeLabel: 'Open News',
    actionable: false,
    kind: 'news',
    ...overrides,
  };
}

describe('Phase 17 Inbox-first management', () => {
  it('offers only inline-safe actions and explains their exact consequence', () => {
    const state = careerState();
    const actions = inboxInlineActions(state, message());
    expect(actions).toEqual([expect.objectContaining({
      kind: 'acknowledge',
      label: 'Acknowledge',
    })]);
    expect(actions[0].consequence).toContain('No gameplay value');

    expect(inboxInlineActions(state, message({
      id: 'contract',
      actionable: true,
      kind: 'must_respond',
      blocking: true,
      category: 'people',
    }))).toEqual([]);
  });

  it('selects the next unresolved item after an inline resolution', () => {
    const items = [
      message({ id: 'resolved' }),
      message({ id: 'news' }),
      message({ id: 'decision', actionable: true, category: 'technical', kind: 'recommended' }),
    ];
    expect(nextInboxMessageId(items, 'resolved')).toBe('decision');
    expect(nextInboxMessageId([message({ id: 'only' })], 'only')).toBeUndefined();
  });

  it('restores message, filters, and pane scroll positions for the same career', () => {
    const storage = memoryStorage();
    writeInboxWorkspaceState(storage, {
      teamId: 'team-1',
      seasonYear: 1995,
      category: 'technical',
      section: 'recommended',
      selectedMessageId: 'message-technical',
      listScrollTop: 420,
      contextScrollTop: 85,
    });

    expect(readInboxWorkspaceState(storage, 'team-1', 1995)).toMatchObject({
      category: 'technical',
      section: 'recommended',
      selectedMessageId: 'message-technical',
      listScrollTop: 420,
      contextScrollTop: 85,
    });
    expect(readInboxWorkspaceState(storage, 'team-2', 1995)).toBeUndefined();
  });

  it('copies accepted staff strategy into the resumable weekend draft', () => {
    const base = careerState();
    const state: GameState = {
      ...base,
      careerPhase: {
        ...base.careerPhase!,
        currentPhase: 'race_weekend',
      },
    };
    const storage = memoryStorage();
    const ids = prepareAcceptedWeekendRecommendations(state, storage);
    const race = state.calendar[state.currentRaceIndex];
    const draft = readRaceWeekendUiDraft(storage, race.id);
    const playerDriverIds = state.drivers
      .filter((driver) => driver.teamId === state.selectedTeamId)
      .map((driver) => driver.id);

    expect(ids.length).toBeGreaterThan(0);
    expect(draft).toBeDefined();
    for (const driverId of playerDriverIds) {
      expect(draft?.raceOverrides[driverId]?.strategyId).toBeDefined();
      expect(draft?.raceOverrides[driverId]?.instructionId).toBeDefined();
    }
  });
});
