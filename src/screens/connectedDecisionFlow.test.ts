import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import { buildManagerOfficeFollowUps } from './managerOfficeFollowUpViewModel';
import { inboxMessages } from './inboxViewModel';
import {
  focusedRoute,
  inboxActionNavigationState,
  inboxReturnWithMessage,
} from './decisionActionTarget';

function newState() {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'phase-26-connected-decisions',
  });
}

describe('connected decision targets', () => {
  it('gives every projected Inbox item one stable target and resolution contract', () => {
    const messages = inboxMessages(newState());

    expect(messages.length).toBeGreaterThan(0);
    for (const message of messages) {
      expect(message.actionTarget).toMatchObject({
        actionId: message.id,
        route: message.route,
        routeLabel: message.routeLabel,
      });
      expect(message.actionTarget?.focus.id).toBeTruthy();
      expect(message.actionTarget?.resolutionCondition).toBeTruthy();
      expect(message.actionTarget?.immediateConsequence).toBeTruthy();
      expect(message.actionTarget?.status).toBe(message.actionable ? 'unresolved' : 'informational');
    }
  });

  it('gives every actionable item a precise focus or an exact negotiation path', () => {
    const actionable = inboxMessages(newState()).filter((message) => message.actionable);

    expect(actionable.length).toBeGreaterThan(0);
    for (const message of actionable) {
      expect(
        message.route.includes('focus=')
        || message.route.includes('target=')
        || message.route.includes('/negotiate'),
      ).toBe(true);
    }
  });

  it('keeps exact focus while adding a tab or section to an owning route', () => {
    expect(focusedRoute('/technical?section=parts', { id: 'part/a' }))
      .toBe('/technical?section=parts&focus=part%2Fa');
    expect(focusedRoute('/news', { tab: 'media', id: 'session-1' }))
      .toBe('/news?tab=media&focus=session-1');
  });

  it('carries a complete return and follow-through snapshot without save-state changes', () => {
    const message = inboxMessages(newState()).find((entry) => entry.actionable);
    if (!message?.actionTarget) throw new Error('Expected an actionable message target');

    expect(inboxActionNavigationState('/inbox?category=technical&message=old', message.title, message.actionTarget))
      .toEqual({
        inboxReturn: '/inbox?category=technical&message=old',
        inboxAction: {
          actionId: message.id,
          title: message.title,
          target: message.actionTarget,
        },
      });
  });

  it('advances a resolved return journey to the next item without trapping it in the old folder', () => {
    expect(inboxReturnWithMessage(
      '/inbox?category=technical&section=recommended&message=resolved',
      'next-action',
      'must_respond',
    )).toBe('/inbox?section=must_respond&message=next-action');
  });

  it('opens the exact race-news story from Manager Office follow-through', () => {
    const state = newState();
    const story = {
      id: 'race-story-1',
      headline: 'Race result changes the title picture',
      body: 'The championship lead changed hands.',
      timestamp: '1995-03-26T18:00:00.000Z',
      category: 'race_result' as const,
      priority: 'high' as const,
      round: 1,
    };
    const followUps = buildManagerOfficeFollowUps({
      raceId: state.calendar[0].id,
      raceLabel: state.calendar[0].gpName,
      round: 1,
      news: [story],
      actionMessages: [],
    });

    expect(followUps.changed).toContainEqual(expect.objectContaining({
      id: 'follow-up-news-race-story-1',
      route: '/news?tab=feed&focus=race-story-1',
      routeLabel: 'Open Relevant Story',
    }));
  });
});
