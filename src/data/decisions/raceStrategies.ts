import type { RaceStrategy } from '../../types/gameTypes';

// Race strategy is chosen AFTER qualifying, once the grid is known.
export const raceStrategies: RaceStrategy[] = [
  {
    id: 'ConservativeOneStop',
    name: 'Conservative One-Stop',
    description: 'Single stop, manage tyres, prioritise a clean finish.',
    paceModifier: -0.3, tireDegModifier: -0.6, pitRiskModifier: -0.3,
    overtakeModifier: -0.2, trackPositionModifier: 0.2,
  },
  {
    id: 'BalancedOneStop',
    name: 'Balanced One-Stop',
    description: 'Standard one-stop. A solid default plan.',
    paceModifier: 0, tireDegModifier: 0, pitRiskModifier: 0,
    overtakeModifier: 0, trackPositionModifier: 0,
  },
  {
    id: 'AggressiveTwoStop',
    name: 'Aggressive Two-Stop',
    description: 'Two stops, push hard on fresher tyres. Higher pit risk.',
    paceModifier: 0.6, tireDegModifier: 0.3, pitRiskModifier: 0.4,
    overtakeModifier: 0.3, trackPositionModifier: -0.2,
  },
  {
    id: 'UndercutFocused',
    name: 'Undercut-Focused',
    description: 'Stop early to jump rivals with fresh-tyre pace.',
    paceModifier: 0.3, tireDegModifier: 0.2, pitRiskModifier: 0.3,
    overtakeModifier: 0.5, trackPositionModifier: 0.1,
  },
  {
    id: 'OvercutFocused',
    name: 'Overcut-Focused',
    description: 'Extend the stint and gain on clear-air pace.',
    paceModifier: 0.2, tireDegModifier: 0.1, pitRiskModifier: 0.1,
    overtakeModifier: 0.3, trackPositionModifier: 0.2,
  },
  {
    id: 'TrackPositionFocus',
    name: 'Track-Position Focus',
    description: 'Protect position above all. Strong at tracks where passing is hard.',
    paceModifier: -0.1, tireDegModifier: -0.3, pitRiskModifier: -0.2,
    overtakeModifier: -0.1, trackPositionModifier: 0.6,
  },
  {
    id: 'SafetyFirstPoints',
    name: 'Safety-First Points Finish',
    description: 'Maximise reliability and bank points. Minimal risk.',
    paceModifier: -0.5, tireDegModifier: -0.5, pitRiskModifier: -0.4,
    overtakeModifier: -0.3, trackPositionModifier: 0.1,
  },
  {
    id: 'ReactiveStrategy',
    name: 'Reactive Strategy',
    description: 'Adapt to the race as it unfolds. Flexible, slightly variable.',
    paceModifier: 0.1, tireDegModifier: 0, pitRiskModifier: 0,
    overtakeModifier: 0.2, trackPositionModifier: 0.1,
  },
];

export const raceStrategiesById: Record<string, RaceStrategy> =
  Object.fromEntries(raceStrategies.map((s) => [s.id, s]));
