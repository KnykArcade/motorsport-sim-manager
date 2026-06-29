import { describe, expect, it } from 'vitest';
import {
  generateRaceEventPool,
  resolveRaceEventTrigger,
} from './raceEventEngine';
import type { Track } from '../types/gameTypes';
import type { WeatherState } from '../types/liveTypes';

const track = (archetype: string): Track =>
  ({
    id: 't1',
    name: 'Test',
    gpName: 'Test GP',
    archetype,
    attributes: {} as Track['attributes'],
    setupProfile: {} as Track['setupProfile'],
    ratingNotes: '',
  }) as Track;

const dryWeather: WeatherState = {
  condition: 'Dry',
  gripLevel: 1,
  wet: false,
  changingSoon: false,
  label: 'Dry',
};

describe('generateRaceEventPool', () => {
  it('always includes the universal events', () => {
    const pool = generateRaceEventPool(track('Unfamiliar'), dryWeather);
    const ids = pool.map((t) => t.id);
    expect(ids).toContain('first-lap-scramble');
    expect(ids).toContain('backmarker-spin');
  });

  it('adds archetype-specific themes', () => {
    const ids = generateRaceEventPool(track('Street'), dryWeather).map((t) => t.id);
    expect(ids).toContain('wall-tap');
  });

  it('does not duplicate templates', () => {
    const ids = generateRaceEventPool(track('Street'), dryWeather).map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('resolveRaceEventTrigger', () => {
  const pool = generateRaceEventPool(track('Street'), dryWeather);

  it('is deterministic for the same seed/lap', () => {
    const a = resolveRaceEventTrigger(pool, 'seed', 't1', 5, 60);
    const b = resolveRaceEventTrigger(pool, 'seed', 't1', 5, 60);
    expect(a).toEqual(b);
  });

  it('fires events across a race and never repeats a template', () => {
    let racesWithEvents = 0;
    let maxFired = 0;
    for (let s = 0; s < 60; s++) {
      const fired: string[] = [];
      for (let lap = 1; lap <= 60; lap++) {
        const ev = resolveRaceEventTrigger(pool, `seed-${s}`, 't1', lap, 60, fired);
        if (ev) fired.push(ev.template.id);
      }
      expect(new Set(fired).size).toBe(fired.length); // no repeats within a race
      if (fired.length > 0) racesWithEvents++;
      maxFired = Math.max(maxFired, fired.length);
    }
    expect(racesWithEvents).toBeGreaterThan(0); // events do fire
    expect(maxFired).toBeGreaterThan(1); // multiple can fire in a race
  });

  it('never returns an excluded template', () => {
    const excluded = pool.map((t) => t.id);
    for (let lap = 1; lap <= 60; lap++) {
      expect(resolveRaceEventTrigger(pool, 's', 't1', lap, 60, excluded)).toBeNull();
    }
  });
});
