import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import { createMediaSession } from '../sim/mediaSessionEngine';
import { inboxMessages } from './inboxViewModel';

describe('media session inbox routing', () => {
  it('routes optional sessions to the Media workspace without blocking phase progression', () => {
    const initial = createNewGame({
      gameMode: 'Career',
      seasonYear: 1995,
      series: 'F1',
      teamId: 't-benetton',
      seed: 'media-inbox',
    });
    const state = createMediaSession(initial, 'PreRace', 1, initial.calendar[0].id);
    const message = inboxMessages(state).find((entry) => entry.id.startsWith('inbox-media-'));

    expect(message).toMatchObject({
      route: '/news?tab=media',
      routeLabel: 'Open Media Session',
      actionable: true,
      blocking: false,
      kind: 'recommended',
      source: 'Communications team',
    });
  });

  it('elevates a crisis session while preserving the optional interview choice', () => {
    const initial = createNewGame({
      gameMode: 'SingleSeason',
      seasonYear: 1995,
      series: 'F1',
      teamId: 't-benetton',
      seed: 'media-inbox-crisis',
    });
    const state = createMediaSession(initial, 'Crisis', 4, initial.calendar[3].id);
    const message = inboxMessages(state).find((entry) => entry.id.startsWith('inbox-media-'));

    expect(message).toMatchObject({
      severity: 'critical',
      kind: 'recommended',
      blocking: false,
      timing: 'due_this_week',
    });
  });
});
