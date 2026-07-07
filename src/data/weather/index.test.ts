import { describe, expect, it } from 'vitest';
import {
  getCachedHistoricalWeatherTimeline,
  getHistoricalWeatherRaceMeta,
  getHistoricalWeatherTimeline,
  preloadHistoricalWeatherSeason,
} from './index';

describe('historical weather loader', () => {
  it('loads a fetched race timeline by race id', async () => {
    const raceId = '1990-CART-1';
    const meta = getHistoricalWeatherRaceMeta(raceId);
    expect(meta).toBeDefined();
    expect(meta?.date).toBe('1990-04-08');
    await preloadHistoricalWeatherSeason(meta!.seasonYear, meta!.series);
    expect(getCachedHistoricalWeatherTimeline(raceId)).toBeUndefined();
    const timeline = await getHistoricalWeatherTimeline(raceId);
    expect(timeline).toBeDefined();
    expect(timeline?.anchor.raceId).toBe(raceId);
    expect(timeline?.samples.length).toBe(12);
    expect(timeline?.samples[0]?.time).toBe('1990-04-08T13:00');
  });

  it('returns an empty placeholder timeline for skipped races', async () => {
    const raceId = '2026-F1-18';
    const meta = getHistoricalWeatherRaceMeta(raceId);
    expect(meta).toBeDefined();
    const timeline = await getHistoricalWeatherTimeline(raceId);
    expect(timeline).toBeDefined();
    expect(timeline?.samples).toHaveLength(0);
    expect(timeline?.assumptions.join(' ')).toContain('after archive cutoff');
  });
});
