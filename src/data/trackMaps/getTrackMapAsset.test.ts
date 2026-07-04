import { describe, expect, it } from 'vitest';
import { getTrackMapAsset, normalizeTrackKey } from './getTrackMapAsset';

describe('getTrackMapAsset', () => {
  it('resolves a 1990s F1 track to a same-circuit asset by exact id key', () => {
    const match = getTrackMapAsset({
      series: 'F1',
      year: 1995,
      trackId: 'circuit-de-spa-francorchamps',
      trackName: 'Circuit de Spa-Francorchamps',
    });

    expect(match?.geometry.name).toBe('Circuit de Spa-Francorchamps');
    expect(match?.geometry.series).toBe('F1');
    expect(match?.matchType).toBe('exact-id');
  });

  it('resolves 1992 Kyalami through the historical F1 fallback assets', () => {
    const match = getTrackMapAsset({
      series: 'F1',
      year: 1992,
      trackId: 'kyalami-grand-prix-circuit-1992',
      trackName: 'Kyalami Grand Prix Circuit',
    });

    expect(match?.geometry.id).toBe('kyalami-grand-prix-circuit-historic');
    expect(match?.geometry.name).toBe('Kyalami Grand Prix Circuit');
    expect(match?.geometry.points.length).toBeGreaterThan(20);
  });

  it('falls back to the nearest same-circuit asset when the exact year is missing', () => {
    const match = getTrackMapAsset({
      series: 'F1',
      year: 1995,
      trackId: 'autodromo-jose-carlos-pace',
      trackName: 'Autodromo Jose Carlos Pace',
    });

    expect(match?.geometry.name).toBe('Autodromo Jose Carlos Pace');
    expect(match?.geometry.year).toBeGreaterThan(1995);
  });

  it('matches historical shorthand names without crossing series', () => {
    const match = getTrackMapAsset({
      series: 'F1',
      year: 1995,
      trackId: 'monza-1995',
      trackName: 'Monza',
    });

    expect(match?.geometry.name).toMatch(/Monza/i);
    expect(match?.geometry.series).toBe('F1');
  });

  it('does not return an F1 map for an IndyCar request with no matching track', () => {
    const match = getTrackMapAsset({
      series: 'IndyCar',
      year: 2008,
      trackId: 'circuit-de-spa-francorchamps',
      trackName: 'Circuit de Spa-Francorchamps',
    });

    expect(match).toBeNull();
  });

  it('falls back safely for missing year or unknown track data', () => {
    expect(getTrackMapAsset({ series: 'F1', trackId: 'spa' })).toBeNull();
    expect(getTrackMapAsset({ series: 'F1', year: 1995, trackId: 'not-a-real-track' })).toBeNull();
  });

  it('normalizes track ids by removing year suffixes', () => {
    expect(normalizeTrackKey('circuit-de-spa-francorchamps-1995')).toBe('circuit-de-spa-francorchamps');
  });
});
