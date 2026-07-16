import { describe, expect, it } from 'vitest';
import type { NewsItem } from '../types/gameTypes';
import { buildNewsStorylines, storylineChapterCounts } from './newsCenterViewModel';

const item = (overrides: Partial<NewsItem> & Pick<NewsItem, 'id' | 'headline'>): NewsItem => ({
  timestamp: '1995-01-01T00:00:00.000Z',
  priority: 'normal',
  ...overrides,
});

describe('News Center storylines', () => {
  it('groups repeated driver and team developments into continuing stories', () => {
    const stories = buildNewsStorylines([
      item({ id: 'd1', headline: 'Driver takes pole', driverId: 'driver-1', round: 1, category: 'qualifying' }),
      item({ id: 'd2', headline: 'Driver wins', driverId: 'driver-1', round: 2, category: 'race_result', priority: 'high' }),
      item({ id: 't1', headline: 'Team warns on cash', teamId: 'team-1', round: 1, category: 'financial' }),
      item({ id: 't2', headline: 'Team delays upgrade', teamId: 'team-1', round: 2, category: 'development' }),
      item({ id: 'single', headline: 'Isolated item', driverId: 'driver-2' }),
    ], { 'team-1': 'Lotus' }, { 'driver-1': 'Alex Driver' });

    expect(stories).toHaveLength(2);
    expect(stories.find((story) => story.subjectId === 'driver-1')?.title).toContain('Alex Driver');
    expect(stories.find((story) => story.subjectId === 'team-1')?.summary).toContain('financial');
    expect(stories.some((story) => story.subjectId === 'driver-2')).toBe(false);
  });

  it('marks urgent recent chapters as escalating and numbers chapters chronologically', () => {
    const stories = buildNewsStorylines([
      item({ id: 'old', headline: 'Pressure begins', teamId: 'team-1', round: 3 }),
      item({ id: 'new', headline: 'Closure risk', teamId: 'team-1', round: 4, priority: 'critical' }),
    ], { 'team-1': 'Pacific' }, {});
    expect(stories[0].status).toBe('Escalating');
    expect(stories[0].chapters[0].id).toBe('new');
    expect(storylineChapterCounts(stories).get('old')).toEqual({ chapter: 1, total: 2 });
    expect(storylineChapterCounts(stories).get('new')).toEqual({ chapter: 2, total: 2 });
  });

  it('is deterministic for the same news history', () => {
    const history = [
      item({ id: '1', headline: 'First', driverId: 'driver-1', round: 1 }),
      item({ id: '2', headline: 'Second', driverId: 'driver-1', round: 2 }),
    ];
    expect(buildNewsStorylines(history, {}, { 'driver-1': 'Driver' })).toEqual(
      buildNewsStorylines(history, {}, { 'driver-1': 'Driver' }),
    );
  });

  it('does not create false chapters when the archive and current feed overlap', () => {
    const duplicate = item({ id: 'same', headline: 'Repeated storage entry', teamId: 'team-1' });
    expect(buildNewsStorylines([duplicate, duplicate], { 'team-1': 'Team' }, {})).toEqual([]);
  });
});
