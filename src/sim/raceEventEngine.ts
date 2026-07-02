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

// Concrete, bounded effects a unique event applies to the live race when it
// fires. All optional; omitted fields mean "no effect on that system".
export type RaceEventEffect = {
  tyreWear?: number; // extra wear points added to every running car
  reliabilityRisk?: number; // extra per-lap failure probability (field-wide)
  paceDelta?: number; // seconds added to this lap for every running car
  triggerSafetyCar?: boolean; // forces an incident likely to deploy the SC
  retireRandomCar?: boolean; // a random running non-player car crashes out
};

export type RaceEventTemplate = {
  id: string;
  title: string;
  description: string;
  probability: number; // per-race chance the theme produces an event
  affectedSystems: RaceEventSystem[];
  effect?: RaceEventEffect;
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
        effect: { retireRandomCar: true, triggerSafetyCar: true },
      },
      {
        id: 'track-position',
        title: 'Track position is king',
        description: 'With overtaking near impossible, the pit wall fixates on undercuts.',
        probability: 0.4,
        affectedSystems: ['Strategy', 'PitStops'],
      },
      {
        id: 'manhole-cover',
        title: 'Debris on the racing line',
        description: 'A loose drain cover litters the track; cars scatter to avoid it.',
        probability: 0.18,
        affectedSystems: ['SafetyCar', 'Crash'],
        effect: { triggerSafetyCar: true, paceDelta: 1.5 },
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
        effect: { reliabilityRisk: 0.004 },
      },
      {
        id: 'slipstream',
        title: 'Slipstream battles',
        description: 'Cars tow each other down the straights, swapping places repeatedly.',
        probability: 0.35,
        affectedSystems: ['Strategy', 'DriverMorale'],
      },
      {
        id: 'blown-engine',
        title: 'An engine lets go in a cloud of smoke',
        description: 'A frontrunner grinds to a halt, oil down on the straight.',
        probability: 0.16,
        affectedSystems: ['Reliability', 'SafetyCar'],
        effect: { retireRandomCar: true, reliabilityRisk: 0.003 },
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
        effect: { tyreWear: 7 },
      },
      {
        id: 'graining',
        title: 'Front-left graining',
        description: 'The long-radius corners grain the fronts; lap times tumble away.',
        probability: 0.3,
        affectedSystems: ['Tires'],
        effect: { tyreWear: 5, paceDelta: 0.6 },
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
      {
        id: 'gust',
        title: 'A gust of wind unsettles the cars',
        description: 'A sudden crosswind pitches a car wide and scatters confidence.',
        probability: 0.22,
        affectedSystems: ['DriverMorale', 'Crash'],
        effect: { paceDelta: 0.8 },
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
        effect: { reliabilityRisk: 0.003, tyreWear: 3 },
      },
      {
        id: 'lockup-flatspot',
        title: 'Lock-ups into the hairpin',
        description: 'Drivers flat-spot tyres under braking, triggering early stops.',
        probability: 0.25,
        affectedSystems: ['Tires', 'PitStops'],
        effect: { tyreWear: 6 },
      },
    ],
  },
];

// Universal events eligible at any circuit, so every race can throw a curveball.
const UNIVERSAL: RaceEventTemplate[] = [
  {
    id: 'first-lap-scramble',
    title: 'First-corner scramble',
    description: 'Cars go three-wide into turn one and contact is unavoidable.',
    probability: 0.22,
    affectedSystems: ['Crash', 'SafetyCar'],
    effect: { retireRandomCar: true, triggerSafetyCar: true },
  },
  {
    id: 'backmarker-spin',
    title: 'A backmarker spins',
    description: 'A lapped car loses it and beaches in the gravel.',
    probability: 0.2,
    affectedSystems: ['SafetyCar'],
    effect: { triggerSafetyCar: true },
  },
  {
    id: 'oil-leak',
    title: 'Oil on the track',
    description: 'A leaking car lays a slippery line through the quick corners.',
    probability: 0.18,
    affectedSystems: ['Crash', 'Tires'],
    effect: { paceDelta: 1, tyreWear: 2 },
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
  // Universal events are eligible everywhere.
  for (const tpl of UNIVERSAL) {
    if (!pool.some((p) => p.id === tpl.id)) pool.push(tpl);
  }
  return pool;
}

export type ResolvedRaceEvent = {
  template: RaceEventTemplate;
  lap: number;
};

// Pure: derives its own RNG from seed + lap so it is replayable. Never repeats a
// template listed in `excludeIds`, so multiple distinct events can fire per race.
export function resolveRaceEventTrigger(
  pool: RaceEventTemplate[],
  seed: string,
  trackId: string,
  lap: number,
  totalLaps: number,
  excludeIds: string[] = [],
): ResolvedRaceEvent | null {
  const available = pool.filter((t) => !excludeIds.includes(t.id));
  if (available.length === 0) return null;
  // Events can strike across most of the race, not just the opening laps.
  const lastLap = Math.max(4, Math.round(totalLaps * 0.85));
  if (lap < 2 || lap > lastLap) return null;

  const rng = createSeededRandom(deriveSeed(seed, 'race-event', trackId, lap));
  const template = rng.pick(available);
  // Scale the per-race probability down to a per-lap chance over the window.
  const window = Math.max(1, lastLap - 2);
  if (rng.chance(template.probability / window)) {
    return { template, lap };
  }
  return null;
}
