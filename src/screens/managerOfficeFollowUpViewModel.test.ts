import { describe, expect, it } from 'vitest';
import { buildManagerOfficeFollowUps } from './managerOfficeFollowUpViewModel';

describe('managerOfficeFollowUpViewModel', () => {
  it('groups the latest race changes before actionable follow-ups', () => {
    const followUps = buildManagerOfficeFollowUps({
      raceId: 'race-1',
      raceLabel: 'Brazilian Grand Prix',
      round: 3,
      news: [
        {
          id: 'news-old',
          headline: 'Older story',
          body: 'Older',
          category: 'race_result',
          round: 2,
          timestamp: '2026-01-02T00:00:00.000Z',
        },
        {
          id: 'news-new',
          headline: 'Race result changes the title fight',
          body: 'The paddock reacts.',
          category: 'championship',
          round: 3,
          timestamp: '2026-01-03T00:00:00.000Z',
        },
      ],
      actionMessages: [
        {
          id: 'action-1',
          severity: 'action',
          category: 'technical',
          title: 'Review worn parts',
          body: 'A component needs attention.',
          route: '/technical?section=parts',
          routeLabel: 'Open Parts & Factory',
          actionable: true,
        },
        {
          id: 'news-1',
          severity: 'info',
          category: 'news',
          title: 'Ignored news',
          route: '/news',
          routeLabel: 'Open News Center',
          actionable: false,
        },
      ],
    });

    expect(followUps.changed.map((item) => item.title)).toEqual([
      'Brazilian Grand Prix review is ready',
      'Race result changes the title fight',
    ]);
    expect(followUps.action[0]).toMatchObject({
      title: 'Review worn parts',
      route: '/technical?section=parts',
    });
  });

  it('carries fuzzy relationship advice into office follow-ups', () => {
    const followUps = buildManagerOfficeFollowUps({
      raceId: 'race-2',
      raceLabel: 'Canadian Grand Prix',
      round: 4,
      news: [],
      actionMessages: [
        {
          id: 'inbox-relationship-owner',
          severity: 'critical',
          category: 'people',
          title: 'Relationship priority: Team Owner',
          body: 'Act before advancing: Ownership confidence is critical. Protect the mandate: Likely needs visible attention now.',
          route: '/relationships',
          routeLabel: 'Open Relationships',
          actionable: true,
          source: 'Relationship advisor',
          whyItMatters: 'Backroom read: A heavy-handed response could still unsettle drivers or staff. Watch: Owner confidence and board patience.',
        },
      ],
    });

    expect(followUps.action[0]).toMatchObject({
      title: 'Relationship priority: Team Owner',
      detail: expect.stringContaining('Backroom read'),
      route: '/relationships',
    });
    expect(followUps.action[0].detail).toContain('could');
    expect(followUps.action[0].detail).not.toMatch(/\+\d|-\d|trust \d|morale \d|best answer/i);
  });
});
