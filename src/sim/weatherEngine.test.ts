import { describe, expect, it } from 'vitest';
import type { Track } from '../types/gameTypes';
import { makeWeatherState, stepWeather } from './weatherEngine';

const track = {
  id: 'weather-hysteresis-test',
  attributes: { riskWallProximity: 0, enduranceConsistency: 0 },
} as unknown as Track;

describe('weather condition persistence', () => {
  it('counts consecutive laps in an unchanged condition', () => {
    const initial = makeWeatherState('Dry');
    const result = stepWeather(initial, track, 'stable-weather', 18, 20);
    expect(result.changed).toBe(false);
    expect(result.weather.condition).toBe('Dry');
    expect(result.weather.lapsInCondition).toBe(2);
  });

  it('starts a new condition at one lap', () => {
    for (let index = 0; index < 500; index += 1) {
      const result = stepWeather(makeWeatherState('Cloudy'), track, `weather-change-${index}`, 5, 20);
      if (result.changed) {
        expect(result.weather.lapsInCondition).toBe(1);
        return;
      }
    }
    throw new Error('Expected at least one deterministic weather transition');
  });
});
