import { describe, it, expect } from 'vitest';
import {
  deduplicateNews,
  sortNewsByPriority,
  filterNewsByCategory,
  filterNewsByPhase,
  priorityColor,
  categoryLabel,
  generatePreseasonNews,
  mergeNewsWithSpamControl,
  capNewsPerRound,
  type CareerNewsContext,
} from './careerNewsEngine';
import type { NewsItem } from '../types/gameTypes';
import type { GameState } from '../game/careerState';

function makeMinimalState(): GameState {
  return {
    id: 'test-game',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    gameMode: 'Career',
    series: 'F1',
    seasonYear: 2024,
    selectedTeamId: 'ferrari',
    randomSeed: 'test-seed',
    teams: [{
      id: 'ferrari',
      name: 'Ferrari',
      shortName: 'FER',
      carId: 'ferrari-car',
      driverIds: ['d1', 'd2'],
      budget: 50_000_000,
      reputation: 90,
      raceOperations: 8,
      morale: 70,
      color: '#ff0000',
    }],
    drivers: [
      { id: 'd1', name: 'Driver One', teamId: 'ferrari', morale: 70, number: 16 } as never,
      { id: 'd2', name: 'Driver Two', teamId: 'ferrari', morale: 65, number: 44 } as never,
    ],
    cars: [],
    calendar: [],
    currentRaceIndex: 0,
    news: [],
  } as unknown as GameState;
}

function makeCtx(state: GameState): CareerNewsContext {
  return {
    state,
    phase: 'pre_season_setup',
    round: 0,
    gpName: '',
    seed: 'test-seed',
  };
}

describe('careerNewsEngine', () => {
  describe('deduplicateNews', () => {
    it('filters out items with existing ids', () => {
      const existing: NewsItem[] = [
        { id: 'a', headline: 'A', timestamp: '' },
        { id: 'b', headline: 'B', timestamp: '' },
      ];
      const newItems: NewsItem[] = [
        { id: 'b', headline: 'B duplicate', timestamp: '' },
        { id: 'c', headline: 'C new', timestamp: '' },
      ];
      const result = deduplicateNews(existing, newItems);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('c');
    });

    it('returns all new items when no overlap', () => {
      const existing: NewsItem[] = [{ id: 'a', headline: 'A', timestamp: '' }];
      const newItems: NewsItem[] = [
        { id: 'b', headline: 'B', timestamp: '' },
        { id: 'c', headline: 'C', timestamp: '' },
      ];
      const result = deduplicateNews(existing, newItems);
      expect(result).toHaveLength(2);
    });
  });

  describe('sortNewsByPriority', () => {
    it('sorts critical before high before normal', () => {
      const items: NewsItem[] = [
        { id: '1', headline: 'Normal', timestamp: '2024-01-03', priority: 'normal' },
        { id: '2', headline: 'Critical', timestamp: '2024-01-01', priority: 'critical' },
        { id: '3', headline: 'High', timestamp: '2024-01-02', priority: 'high' },
      ];
      const sorted = sortNewsByPriority(items);
      expect(sorted[0].headline).toBe('Critical');
      expect(sorted[1].headline).toBe('High');
      expect(sorted[2].headline).toBe('Normal');
    });

    it('falls back to timestamp for same priority', () => {
      const items: NewsItem[] = [
        { id: '1', headline: 'Older', timestamp: '2024-01-01', priority: 'normal' },
        { id: '2', headline: 'Newer', timestamp: '2024-01-02', priority: 'normal' },
      ];
      const sorted = sortNewsByPriority(items);
      expect(sorted[0].headline).toBe('Newer');
    });
  });

  describe('filterNewsByCategory', () => {
    it('filters by category', () => {
      const items: NewsItem[] = [
        { id: '1', headline: 'A', timestamp: '', category: 'race_result' },
        { id: '2', headline: 'B', timestamp: '', category: 'financial' },
        { id: '3', headline: 'C', timestamp: '', category: 'race_result' },
      ];
      const result = filterNewsByCategory(items, 'race_result');
      expect(result).toHaveLength(2);
    });
  });

  describe('filterNewsByPhase', () => {
    it('filters by career phase', () => {
      const items: NewsItem[] = [
        { id: '1', headline: 'A', timestamp: '', careerPhase: 'pre_season_setup' },
        { id: '2', headline: 'B', timestamp: '', careerPhase: 'paddock_week' },
      ];
      const result = filterNewsByPhase(items, 'pre_season_setup');
      expect(result).toHaveLength(1);
      expect(result[0].headline).toBe('A');
    });
  });

  describe('priorityColor', () => {
    it('returns correct colors', () => {
      expect(priorityColor('critical')).toBe('text-red-400');
      expect(priorityColor('high')).toBe('text-amber-400');
      expect(priorityColor('normal')).toBe('text-neutral-200');
      expect(priorityColor('low')).toBe('text-neutral-500');
      expect(priorityColor(undefined)).toBe('text-neutral-200');
    });
  });

  describe('categoryLabel', () => {
    it('returns correct labels', () => {
      expect(categoryLabel('race_result')).toBe('Race Result');
      expect(categoryLabel('qualifying')).toBe('Qualifying');
      expect(categoryLabel('financial')).toBe('Financial');
      expect(categoryLabel('youth_academy')).toBe('Youth Academy');
      expect(categoryLabel(undefined)).toBe('General');
    });
  });

  describe('generatePreseasonNews', () => {
    it('generates kickoff news for the player team', () => {
      const ctx = makeCtx(makeMinimalState());
      const news = generatePreseasonNews(ctx);
      expect(news.length).toBeGreaterThan(0);
      const kickoff = news.find((n) => n.category === 'preseason');
      expect(kickoff).toBeDefined();
      expect(kickoff!.headline).toContain('2024');
      expect(kickoff!.headline).toContain('Ferrari');
    });

    it('generates budget warning when budget is low', () => {
      const state = makeMinimalState();
      state.teams[0].budget = 2_000_000;
      const ctx = makeCtx(state);
      const news = generatePreseasonNews(ctx);
      const budgetWarning = news.find((n) => n.category === 'financial');
      expect(budgetWarning).toBeDefined();
      expect(budgetWarning!.priority).toBe('high');
    });

    it('generates driver lineup news', () => {
      const ctx = makeCtx(makeMinimalState());
      const news = generatePreseasonNews(ctx);
      const lineup = news.find((n) => n.category === 'driver_market');
      expect(lineup).toBeDefined();
      expect(lineup!.headline).toContain('2-driver lineup');
    });
  });

  describe('mergeNewsWithSpamControl', () => {
    it('deduplicates by ID', () => {
      const existing: NewsItem[] = [{ id: 'a', headline: 'A', timestamp: '' }];
      const batch: NewsItem[] = [{ id: 'a', headline: 'A', timestamp: '' }];
      const result = mergeNewsWithSpamControl(existing, batch);
      expect(result).toHaveLength(0);
    });

    it('deduplicates by headline similarity (case-insensitive)', () => {
      const batch1: NewsItem[] = [
        { id: 'a', headline: 'Driver Wins Race', timestamp: '', priority: 'high' },
      ];
      const batch2: NewsItem[] = [
        { id: 'b', headline: 'driver wins race', timestamp: '', priority: 'normal' },
      ];
      const result = mergeNewsWithSpamControl([], batch1, batch2);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('a');
    });

    it('keeps highest-priority item when headlines match', () => {
      const batch1: NewsItem[] = [
        { id: 'low', headline: 'Big Crash', timestamp: '', priority: 'low' },
      ];
      const batch2: NewsItem[] = [
        { id: 'high', headline: 'Big Crash', timestamp: '', priority: 'high' },
      ];
      const result = mergeNewsWithSpamControl([], batch1, batch2);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('high');
    });

    it('preserves items with different headlines', () => {
      const batch: NewsItem[] = [
        { id: 'a', headline: 'Driver A wins', timestamp: '', priority: 'high' },
        { id: 'b', headline: 'Driver B retires', timestamp: '', priority: 'normal' },
      ];
      const result = mergeNewsWithSpamControl([], batch);
      expect(result).toHaveLength(2);
    });
  });

  describe('capNewsPerRound', () => {
    it('caps items per round, keeping highest priority', () => {
      const items: NewsItem[] = [];
      for (let i = 0; i < 15; i++) {
        items.push({
          id: `item-${i}`,
          headline: `Item ${i}`,
          timestamp: '',
          round: 5,
          priority: i < 5 ? 'critical' : i < 10 ? 'normal' : 'low',
        });
      }
      const result = capNewsPerRound(items, 10);
      const round5 = result.filter((n) => n.round === 5);
      expect(round5).toHaveLength(10);
      expect(round5.every((n) => n.priority === 'critical' || n.priority === 'normal')).toBe(true);
    });

    it('always keeps items without a round', () => {
      const items: NewsItem[] = [
        { id: 'no-round', headline: 'No round', timestamp: '' },
      ];
      for (let i = 0; i < 15; i++) {
        items.push({
          id: `item-${i}`,
          headline: `Item ${i}`,
          timestamp: '',
          round: 3,
          priority: 'normal',
        });
      }
      const result = capNewsPerRound(items, 10);
      expect(result.some((n) => n.id === 'no-round')).toBe(true);
    });

    it('does not cap when under the limit', () => {
      const items: NewsItem[] = [
        { id: 'a', headline: 'A', timestamp: '', round: 1, priority: 'normal' },
        { id: 'b', headline: 'B', timestamp: '', round: 1, priority: 'normal' },
      ];
      const result = capNewsPerRound(items, 10);
      expect(result).toHaveLength(2);
    });
  });
});
