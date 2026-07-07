import { describe, expect, it } from 'vitest';

import { createHistoricalWeatherTimeline, defaultLocalStartTime, mapWmoCodeToWeatherCondition } from './historicalWeather';

describe('historicalWeather', () => {
  it('maps WMO codes into the existing weather model', () => {
    expect(mapWmoCodeToWeatherCondition(0)).toBe('Dry');
    expect(mapWmoCodeToWeatherCondition(2)).toBe('Cloudy');
    expect(mapWmoCodeToWeatherCondition(53)).toBe('LightRain');
    expect(mapWmoCodeToWeatherCondition(82)).toBe('HeavyRain');
    expect(mapWmoCodeToWeatherCondition(999)).toBe('Cloudy');
  });

  it('builds a 15-minute race window from hourly data', () => {
    const timeline = createHistoricalWeatherTimeline(
      {
        raceId: 'race-1',
        raceName: 'Test Race',
        trackId: 'track-1',
        trackName: 'Test Track',
        year: 2025,
        series: 'F1',
        date: '2025-06-01',
        localStartTime: '14:00',
      },
      [
        { time: '2025-06-01T14:00', weatherCode: 0 },
        { time: '2025-06-01T15:00', weatherCode: 53 },
      ],
      { raceWindowMinutes: 90, resolutionMinutes: 15 },
    );

    expect(timeline.resolutionMinutes).toBe(15);
    expect(timeline.samples).toHaveLength(6);
    expect(timeline.samples[0]?.state.condition).toBe('Dry');
    expect(timeline.samples[5]?.state.condition).toBe('LightRain');
  });

  it('provides explicit series defaults for missing start times', () => {
    expect(defaultLocalStartTime('F1', 2025)).toBe('14:00');
    expect(defaultLocalStartTime('IndyCar', 2005)).toBe('13:00');
  });
});
