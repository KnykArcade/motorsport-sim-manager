// Unique race event engine.
//
// Each track draws on a pool of event themes derived from its archetype and the
// weather, so a race at Monaco feels different from Monza. Events emit flavour
// for the log and small nudges to the simulated systems (tyres, reliability,
// safety-car likelihood), affecting the whole field — player and AI alike.

import type { Track } from '../types/gameTypes';
import type { WeatherState } from '../types/liveTypes';
import { createSeededRandom, deriveSeed } from './random';

export type RaceEventSystem =
  | 'Weather'
  | 'SafetyCar'
  | 'Reliability'
  | 'Tires'
  | 'Strategy'
  | 'Crash'
  | 'PitStops'
  | 'DriverMorale'
  | 'TeamOrders';

export type RaceEventTemplate = {
  id: string;
  title: string;
  description: string;
  probability: number; // per-race chance the theme produces an event
  affectedSystems: RaceEventSystem[];
};

export type RaceEventTheme = {
  id: string;
  name: string;
  trackArchetypes: string[];
  templates: RaceEventTemplate[];
};

// A compact library keyed loosely by archetype keywords. Themes whose keyword
// appears in the track archetype are eligible.
const THEMES: RaceEventTheme[] = [
  {
    id: 'street-chaos',
    name: 'Street Circuit Chaos',
    trackArchetypes: ['Street', 'High-Risk'],
    templates: [
      {
        id: 'wall-tap',
        title: 'Wall proximity bites',
        description: 'A midfield car brushes the barriers and brings out the marshals.',
        probability: 0.35,
        affectedSystems: ['Crash', 'SafetyCar'],
      },
      {
        id: 'track-position',
        title: 'Track position is king',
        description: 'With overtaking near impossible, the pit wall fixates on undercuts.',
        probability: 0.4,
        affectedSystems: ['Strategy', 'PitStops'],
      },
    ],
  },
  {
    id: 'power-stress',
    name: 'Power Circuit Engine Stress',
    trackArchetypes: ['Power', 'High-Speed'],
    templates: [
      {
        id: 'engine-stress',
        title: 'Engines under strain',
        description: 'Sustained full throttle pushes coolant temperatures up across the field.',
        probability: 0.4,
        affectedSystems: ['Reliability'],
      },
      {
        id: 'slipstream',
        title: 'Slipstream battles',
        description: 'Cars tow each other down the straights, swapping places repeatedly.',
        probability: 0.35,
        affectedSystems: ['Strategy', 'DriverMorale'],
      },
    ],
  },
  {
    id: 'downforce-tyres',
    name: 'High Downforce Tyre Management',
    trackArchetypes: ['High Downforce', 'Technical', 'Low-Speed'],
    templates: [
      {
        id: 'tyre-overheat',
        title: 'Tyres overheating',
        description: 'High-load corners cook the rears; degradation is worse than expected.',
        probability: 0.4,
        affectedSystems: ['Tires', 'Strategy'],
      },
    ],
  },
  {
    id: 'weather-swing',
    name: 'Weather Uncertainty',
    trackArchetypes: ['Endurance', 'Balanced', 'High-Speed'],
    templates: [
      {
        id: 'changeable',
        title: 'Skies look unsettled',
        description: 'Strategists watch the radar — a shower could reshuffle the order.',
        probability: 0.3,
        affectedSystems: ['Weather', 'Strategy'],
      },
    ],
  },
  {
    id: 'brake-stress',
    name: 'Stop-Start Brake Stress',
    trackArchetypes: ['Stop-Start', 'Street'],
    templates: [
      {
        id: 'brake-temps',
        title: 'Brake temperatures climbing',
        description: 'Heavy braking zones push brake wear up for everyone.',
        probability: 0.3,
        affectedSystems: ['Reliability', 'Tires'],
      },
    ],
  },
];

export function generateRaceEventPool(track: Track, weather: WeatherState): RaceEventTemplate[] {
  const archetype = track.archetype;
  const pool: RaceEventTemplate[] = [];
  for (const theme of THEMES) {
    if (theme.trackArchetypes.some((k) => archetype.includes(k))) {
      pool.push(...theme.templates);
    }
  }
  // Always allow a weather theme if it is already damp/changeable.
  if (weather.wet || weather.changingSoon) {
    const wt = THEMES.find((t) => t.id === 'weather-swing');
    if (wt) pool.push(...wt.templates.filter((tpl) => !pool.some((p) => p.id === tpl.id)));
  }
  // Fallback so every race has at least one possible event.
  if (pool.length === 0) {
    pool.push({
      id: 'generic-tyre',
      title: 'Tyre wear higher than expected',
      description: 'Teams report graining and reassess their stop windows.',
      probability: 0.25,
      affectedSystems: ['Tires', 'Strategy'],
    });
  }
  return pool;
}

export type ResolvedRaceEvent = {
  template: RaceEventTemplate;
  lap: number;
};

// Once per race, around the first third, fire one themed event from the pool.
// Pure: derives its own RNG from seed + lap so it is replayable.
export function resolveRaceEventTrigger(
  pool: RaceEventTemplate[],
  seed: string,
  trackId: string,
  lap: number,
  totalLaps: number,
): ResolvedRaceEvent | null {
  if (pool.length === 0) return null;
  // Only consider a window early-to-mid race.
  if (lap < 3 || lap > Math.round(totalLaps * 0.6)) return null;

  const rng = createSeededRandom(deriveSeed(seed, 'race-event', trackId, lap));
  const template = rng.pick(pool);
  // Scale the per-race probability down to a per-lap chance over the window.
  const window = Math.max(1, Math.round(totalLaps * 0.6) - 3);
  if (rng.chance(template.probability / window)) {
    return { template, lap };
  }
  return null;
}
