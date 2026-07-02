import { describe, expect, it } from 'vitest';
import { tracks1995 } from '../data';
import { initialWeather, weekendForecast } from './weatherEngine';
import {
  recommendedQualiRunPlan,
  recommendedRaceStrategy,
  recommendedInstruction,
} from './weekendAdvisorEngine';
import { makeWeatherState } from './weatherEngine';
import type { Track } from '../types/gameTypes';

const track = tracks1995[0];

describe('weekendForecast', () => {
  it('is deterministic for the same seed', () => {
    const a = weekendForecast(track, 'seed-r1');
    const b = weekendForecast(track, 'seed-r1');
    expect(a).toEqual(b);
  });

  it('covers all three sessions', () => {
    const f = weekendForecast(track, 'seed-r1');
    expect(f.Practice).toBeDefined();
    expect(f.Qualifying).toBeDefined();
    expect(f.Race).toBeDefined();
  });

  it('keeps the race forecast in sync with the live-race starting weather', () => {
    const f = weekendForecast(track, 'seed-r3');
    expect(f.Race).toEqual(initialWeather(track, 'seed-r3'));
  });
});

describe('weekendAdvisor', () => {
  const wet = makeWeatherState('HeavyRain');
  const dry = makeWeatherState('Dry');

  it('recommends conservative wet-weather choices when it rains', () => {
    expect(recommendedQualiRunPlan(track, wet).optionId).toBe('ConservativeCleanLap');
    expect(recommendedRaceStrategy(track, wet).optionId).toBe('ReactiveStrategy');
    expect(recommendedInstruction(track, wet).optionId).toBe('ProtectCar');
  });

  it('protects track position at hard-to-pass circuits in the dry', () => {
    const street: Track = { ...track, archetype: 'Street Circuit' };
    expect(recommendedRaceStrategy(street, dry).optionId).toBe('TrackPositionFocus');
    expect(recommendedQualiRunPlan(street, dry).optionId).toBe('LateTrackEvolution');
  });

  it('plays it safe on high-risk circuits', () => {
    const risky: Track = { ...track, archetype: 'High-Risk Circuit' };
    expect(recommendedInstruction(risky, dry).optionId).toBe('Conservative');
  });

  it('always returns a reason', () => {
    expect(recommendedRaceStrategy(track, dry).reason.length).toBeGreaterThan(0);
    expect(recommendedQualiRunPlan(track, undefined).reason.length).toBeGreaterThan(0);
  });
});
