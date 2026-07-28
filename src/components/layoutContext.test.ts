import { describe, expect, it } from 'vitest';
import { contextualNavigationForRoute, pageIdentityForRoute } from './layoutContext';

describe('contextual shell navigation', () => {
  it('moves page identity into the shell for normal and query-backed pages', () => {
    expect(pageIdentityForRoute('/inbox')).toEqual({ section: 'Management', title: 'Inbox' });
    expect(pageIdentityForRoute('/teams', '?filter=player')).toEqual({ section: 'Team', title: 'Team Info' });
    expect(pageIdentityForRoute('/sponsors', '?tab=owner')).toEqual({ section: 'Team', title: 'Owner Vision' });
    expect(pageIdentityForRoute('/live-race/race-3')).toEqual({ section: 'Race Strategy', title: 'Live Race' });
  });

  it('keeps secondary routes reachable without duplicating primary navigation', () => {
    expect(contextualNavigationForRoute('/inbox', new Set()).map((item) => item.to)).toEqual([
      '/news',
      '/stories',
      '/paddock',
    ]);
    expect(contextualNavigationForRoute('/standings', new Set()).map((item) => item.to)).toContain('/records');
    expect(contextualNavigationForRoute('/technical', new Set()).map((item) => item.to)).toContain('/politics');
  });

  it('removes mode-restricted contextual routes', () => {
    const routes = contextualNavigationForRoute('/market', new Set(['/scouting', '/curves']))
      .map((item) => item.to);
    expect(routes).not.toContain('/scouting');
    expect(routes).not.toContain('/curves');
    expect(routes).toEqual([]);
  });
});
