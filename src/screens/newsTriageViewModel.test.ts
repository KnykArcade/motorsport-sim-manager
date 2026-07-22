import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import { newsTriage } from './newsTriageViewModel';

describe('newsTriage', () => {
  it('routes high-priority technical news to the owning technical screen', () => {
    const state = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'news-triage' });
    const triage = newsTriage(state, {
      id: 'news-tech',
      headline: 'Development report',
      category: 'development',
      priority: 'high',
      timestamp: '1995-01-01T00:00:00.000Z',
    });

    expect(triage?.route).toBe('/technical');
    expect(triage?.routeLabel).toBe('Open Technical Center');
    expect(triage?.recommendation).toContain('technical update');
  });

  it('leaves normal news in the world feed', () => {
    const state = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'news-triage-normal' });
    expect(newsTriage(state, {
      id: 'news-normal',
      headline: 'A paddock story',
      category: 'paddock',
      priority: 'normal',
      timestamp: '1995-01-01T00:00:00.000Z',
    })).toBeUndefined();
  });

  it('routes academy news to the owning driver market screen', () => {
    const state = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'news-triage-academy' });
    expect(newsTriage(state, {
      id: 'news-academy',
      headline: 'Academy report',
      category: 'youth_academy',
      priority: 'high',
      timestamp: '1995-01-01T00:00:00.000Z',
    })).toMatchObject({
      route: '/market',
      routeLabel: 'Open Driver Market',
    });
  });
});
