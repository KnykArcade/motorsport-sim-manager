import { describe, expect, it } from 'vitest';
import { trafficStatus } from './liveRacePace';

describe('distance-based traffic status', () => {
  it('uses authoritative distance when it is available', () => {
    expect(trafficStatus({
      mode: 'Balanced',
      intervalAhead: 12,
      underPressure: false,
      distanceAheadMeters: 70,
      distanceBehindMeters: null,
    })).toBe('InTraffic');
  });

  it('uses distance behind to detect defensive pressure', () => {
    expect(trafficStatus({
      mode: 'Defend',
      intervalAhead: 4,
      underPressure: false,
      distanceAheadMeters: 200,
      distanceBehindMeters: 40,
    })).toBe('Defending');
  });

  it('falls back to timing gaps for legacy saves without position distance', () => {
    expect(trafficStatus({
      mode: 'Attack',
      intervalAhead: 0.5,
      underPressure: false,
    })).toBe('Attacking');
  });
});
