// Deterministic weather forecast for the bottom Weather Forecast panel. Projects
// the same per-lap weather model forward from the current lap so the forecast
// never disagrees with what the race will actually do. Temperature is not part
// of the sim's weather model, so an approximate ambient temp is derived from the
// condition (Dry warmest, Heavy Rain coolest).

import { stepWeather } from '../../sim/weatherEngine';
import type { Track } from '../../types/gameTypes';
import type { LiveRaceState, WeatherCondition } from '../../types/liveTypes';

const TEMP: Record<WeatherCondition, number> = {
  Dry: 26,
  Cloudy: 21,
  Drying: 20,
  Changeable: 19,
  LightRain: 17,
  HeavyRain: 14,
};

export type ForecastEntry = { label: string; condition: string; temp: number; wet: boolean };

// ~5 laps ≈ 15 minutes of racing for the forecast horizon labels.
const OFFSETS = [0, 5, 10, 15, 20];
const LABELS = ['Now', '+15m', '+30m', '+45m', '+60m'];

export function buildForecast(live: LiveRaceState, track: Track): ForecastEntry[] {
  const out: ForecastEntry[] = [];
  let weather = live.weather;
  let lap = live.currentLap;
  for (let i = 0; i < OFFSETS.length; i++) {
    const target = Math.min(live.currentLap + OFFSETS[i], live.totalLaps);
    while (lap < target) {
      weather = stepWeather(weather, track, live.seed, lap + 1, live.totalLaps).weather;
      lap++;
    }
    out.push({
      label: LABELS[i],
      condition: weather.label,
      temp: TEMP[weather.condition],
      wet: weather.wet,
    });
  }
  return out;
}
