// Weather engine for the live race.
//
// Weather is generated deterministically per lap from the race seed, so a race
// replays identically. A starting condition is chosen at creation; each lap a
// seeded roll may transition to an adjacent condition. Wet conditions cut grip
// (slowing dry-shod cars) and raise the chance of safety cars and mistakes.

import type { Track } from '../types/gameTypes';
import type { WeatherCondition, WeatherState } from '../types/liveTypes';
import { createSeededRandom, deriveSeed } from './random';

const LABELS: Record<WeatherCondition, string> = {
  Dry: 'Dry',
  Cloudy: 'Cloudy',
  LightRain: 'Light Rain',
  HeavyRain: 'Heavy Rain',
  Drying: 'Drying',
  Changeable: 'Changeable',
};

const GRIP: Record<WeatherCondition, number> = {
  Dry: 1,
  Cloudy: 0.97,
  Drying: 0.85,
  Changeable: 0.8,
  LightRain: 0.72,
  HeavyRain: 0.5,
};

function isWet(c: WeatherCondition): boolean {
  return c === 'LightRain' || c === 'HeavyRain';
}

export function makeWeatherState(condition: WeatherCondition, changingSoon = false): WeatherState {
  return {
    condition,
    gripLevel: GRIP[condition],
    wet: isWet(condition),
    changingSoon,
    label: LABELS[condition],
  };
}

// Choose the weather at the start of the race. Most races start dry; tracks with
// a wet/changeable reputation (high risk + endurance demand) lean damper.
export function initialWeather(track: Track, seed: string): WeatherState {
  const rng = createSeededRandom(deriveSeed(seed, 'weather-start', track.id));
  const rainProneness =
    (track.attributes.riskWallProximity + track.attributes.enduranceConsistency) / 20; // 0..1
  const roll = rng.next();
  if (roll < 0.06 + rainProneness * 0.1) return makeWeatherState('LightRain', true);
  if (roll < 0.12 + rainProneness * 0.12) return makeWeatherState('Cloudy', true);
  if (roll < 0.2) return makeWeatherState('Cloudy');
  return makeWeatherState('Dry');
}

// Adjacent transitions, so weather drifts realistically rather than teleporting.
const NEXT: Record<WeatherCondition, WeatherCondition[]> = {
  Dry: ['Dry', 'Dry', 'Cloudy'],
  Cloudy: ['Cloudy', 'Dry', 'LightRain'],
  LightRain: ['LightRain', 'HeavyRain', 'Drying'],
  HeavyRain: ['HeavyRain', 'LightRain'],
  Drying: ['Drying', 'Dry', 'LightRain'],
  Changeable: ['Changeable', 'LightRain', 'Drying'],
};

// Advance the weather one lap. Pure: derives its own RNG from the seed + lap.
export function stepWeather(
  weather: WeatherState,
  track: Track,
  seed: string,
  lap: number,
  totalLaps: number,
): { weather: WeatherState; changed: boolean } {
  const rng = createSeededRandom(deriveSeed(seed, 'weather', track.id, lap));

  // Base chance of a change per lap; higher on rain-prone tracks and never on
  // the final couple of laps (keeps endgames stable).
  if (lap >= totalLaps - 2) return { weather: { ...weather, changingSoon: false }, changed: false };

  const rainProneness =
    (track.attributes.riskWallProximity + track.attributes.enduranceConsistency) / 20;
  const changeChance = 0.04 + rainProneness * 0.05;

  if (!rng.chance(changeChance)) {
    // Occasionally flag an upcoming change to telegraph gambles.
    const soon = rng.chance(0.08) && (weather.condition === 'Cloudy' || weather.condition === 'Drying');
    return { weather: { ...weather, changingSoon: soon }, changed: false };
  }

  const options = NEXT[weather.condition];
  const next = rng.pick(options);
  if (next === weather.condition) {
    return { weather: { ...weather, changingSoon: false }, changed: false };
  }
  return { weather: makeWeatherState(next, true), changed: true };
}
