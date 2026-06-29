import type { RegulationChangeEvent, RegulationSet } from '../../types/gameTypes';

// Regulations mostly matter in Career Mode (offseason). Single Season Mode
// simply uses the historical season's known ruleset.
export const regulationSets: Record<string, RegulationSet> = {
  'reg-1995': {
    id: 'reg-1995',
    seasonYear: 1995,
    series: 'F1',
    pointsSystemId: 'pts-1995',
    qualifyingFormat: 'Single-lap aggregate (classic)',
    raceWeekendFormat: 'Practice / Qualifying / Race',
    testingLimit: undefined,
    budgetCap: undefined,
    designRules: {
      enginePowerWeight: 1,
      aeroEfficiencyWeight: 1,
      mechanicalGripWeight: 1,
      reliabilityWeight: 1,
      minimumReliability: 0,
    },
    carryoverModifiers: {
      enginePower: 1,
      aeroEfficiency: 1,
      mechanicalGrip: 1,
      reliability: 1,
      pitCrewOperations: 1,
    },
    notes: ['Historical 1995 ruleset. 3.0L V10/V8/V12 era, no budget cap.'],
  },
};

export function getRegulationSet(id: string): RegulationSet {
  return regulationSets[id] ?? regulationSets['reg-1995'];
}

// Pool of regulation change events the offseason can draw from.
export const regulationChangeEvents: RegulationChangeEvent[] = [
  {
    id: 'reg-stable',
    name: 'Stable Regulations',
    description: 'No major rule changes. Development carries over normally.',
    severity: 'Stable',
    affectedAreas: [],
    effects: {},
  },
  {
    id: 'reg-minor-aero',
    name: 'Minor Aero Rule Clarification',
    description: 'Small aero clarification slightly reduces aero carryover.',
    severity: 'Minor',
    affectedAreas: ['Aero'],
    effects: { carryoverModifiers: { aeroEfficiency: 0.9 } },
  },
  {
    id: 'reg-major-aero',
    name: 'Major Aero Rule Change',
    description: 'Sweeping aero regulations reset much of the aero order. Teams that invested in research are rewarded.',
    severity: 'Major',
    affectedAreas: ['Aero'],
    effects: { carryoverModifiers: { aeroEfficiency: 0.6 } },
  },
  {
    id: 'reg-engine-freeze',
    name: 'Engine Development Freeze',
    description: 'Engine development is frozen, reducing engine carryover gains.',
    severity: 'Moderate',
    affectedAreas: ['Engine'],
    effects: { carryoverModifiers: { enginePower: 0.7 } },
  },
  {
    id: 'reg-safety',
    name: 'New Safety Requirements',
    description: 'New safety requirements raise the minimum reliability bar.',
    severity: 'Moderate',
    affectedAreas: ['Reliability'],
    effects: { reliabilityRequirementChange: 1 },
  },
  {
    id: 'reg-testing',
    name: 'Testing Restrictions',
    description: 'Testing limits slow development; facilities/simulators matter more.',
    severity: 'Moderate',
    affectedAreas: ['Testing'],
    effects: { developmentCostModifiers: { all: 1.2 } },
  },
];
