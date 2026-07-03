import type { RegulationChangeEvent, RegulationSet } from '../../types/gameTypes';

// ---------------------------------------------------------------------------
// F1 & IndyCar Regulation Sets by Era
// ---------------------------------------------------------------------------
// Each era reflects the major technical and sporting regulations of the period.
// The regulationSetId in each season file points to one of these entries.

const BASE_DESIGN = {
  enginePowerWeight: 1,
  aeroEfficiencyWeight: 1,
  mechanicalGripWeight: 1,
  reliabilityWeight: 1,
  minimumReliability: 0,
};

const BASE_CARRYOVER = {
  enginePower: 1,
  aeroEfficiency: 1,
  mechanicalGrip: 1,
  reliability: 1,
  pitCrewOperations: 1,
};

export const regulationSets: Record<string, RegulationSet> = {
  // --- F1 1990–1993: Traditional qualifying, no refueling, no DRS ---
  'reg-f1-1990-1993': {
    id: 'reg-f1-1990-1993',
    seasonYear: 1990,
    series: 'F1',
    pointsSystemId: 'pts-1990',
    qualifyingFormat: 'Traditional (timed session)',
    raceWeekendFormat: 'Practice / Qualifying / Race',
    testingLimit: undefined,
    budgetCap: undefined,
    designRules: { ...BASE_DESIGN },
    carryoverModifiers: { ...BASE_CARRYOVER },
    refuelingAllowed: false,
    drsEnabled: false,
    sprintSupport: false,
    pushToPass: false,
    tireChangeRules: 'Unrestricted tire changes',
    eraLabel: 'Naturally Aspirated V8/V10/V12 Era',
    notes: [
      '3.5L naturally aspirated engines. No refueling during races.',
      'Traditional timed qualifying session. No DRS, no sprint weekends.',
      'No budget cap. Unlimited testing.',
    ],
  },

  // --- F1 1994–1995: Refueling returns, traditional qualifying ---
  'reg-f1-1994-1995': {
    id: 'reg-f1-1994-1995',
    seasonYear: 1994,
    series: 'F1',
    pointsSystemId: 'pts-1995',
    qualifyingFormat: 'Traditional (timed session)',
    raceWeekendFormat: 'Practice / Qualifying / Race',
    testingLimit: undefined,
    budgetCap: undefined,
    designRules: { ...BASE_DESIGN },
    carryoverModifiers: { ...BASE_CARRYOVER },
    refuelingAllowed: true,
    drsEnabled: false,
    sprintSupport: false,
    pushToPass: false,
    tireChangeRules: 'Unrestricted tire changes',
    eraLabel: 'Refueling Era Begins (3.0L)',
    notes: [
      '3.0L engine formula. Refueling allowed during races from 1994.',
      'Traditional timed qualifying. No DRS, no sprint weekends.',
      'No budget cap. Unlimited testing.',
    ],
  },

  // --- F1 1996–2002: Traditional qualifying, refueling, no DRS ---
  'reg-f1-1996-2002': {
    id: 'reg-f1-1996-2002',
    seasonYear: 1996,
    series: 'F1',
    pointsSystemId: 'pts-1995',
    qualifyingFormat: 'Traditional (timed session)',
    raceWeekendFormat: 'Practice / Qualifying / Race',
    testingLimit: undefined,
    budgetCap: undefined,
    designRules: { ...BASE_DESIGN },
    carryoverModifiers: { ...BASE_CARRYOVER },
    refuelingAllowed: true,
    drsEnabled: false,
    sprintSupport: false,
    pushToPass: false,
    tireChangeRules: 'Unrestricted tire changes',
    eraLabel: 'V10 Era',
    notes: [
      '3.0L V10 dominant formula. Refueling allowed.',
      'Traditional timed qualifying. No DRS, no sprint weekends.',
      'No budget cap. Testing increasingly restricted late in era.',
    ],
  },

  // --- F1 2003–2004: One-shot qualifying, refueling ---
  'reg-f1-2003-2004': {
    id: 'reg-f1-2003-2004',
    seasonYear: 2003,
    series: 'F1',
    pointsSystemId: 'pts-2003',
    qualifyingFormat: 'One-shot (single-lap)',
    raceWeekendFormat: 'Practice / Qualifying / Race',
    testingLimit: undefined,
    budgetCap: undefined,
    designRules: { ...BASE_DESIGN },
    carryoverModifiers: { ...BASE_CARRYOVER },
    refuelingAllowed: true,
    drsEnabled: false,
    sprintSupport: false,
    pushToPass: false,
    tireChangeRules: 'Unrestricted tire changes',
    eraLabel: 'One-Shot Qualifying Era',
    notes: [
      'One-shot single-lap qualifying format introduced in 2003.',
      'Refueling allowed. No DRS, no sprint weekends.',
      '3.0L V10 formula. No budget cap.',
    ],
  },

  // --- F1 2005: Aggregate qualifying, tire changes restricted ---
  'reg-f1-2005': {
    id: 'reg-f1-2005',
    seasonYear: 2005,
    series: 'F1',
    pointsSystemId: 'pts-2003',
    qualifyingFormat: 'Aggregate (two-session combined)',
    raceWeekendFormat: 'Practice / Qualifying / Race',
    testingLimit: undefined,
    budgetCap: undefined,
    designRules: { ...BASE_DESIGN },
    carryoverModifiers: { ...BASE_CARRYOVER },
    refuelingAllowed: true,
    drsEnabled: false,
    sprintSupport: false,
    pushToPass: false,
    tireChangeRules: 'No tire changes during dry race (one set per race)',
    eraLabel: 'Single-Tire Race Era',
    notes: [
      '2005 aggregate qualifying format (combined times from two sessions).',
      'Tire changes banned during dry races — one set must last the race.',
      'Refueling allowed. No DRS, no sprint weekends.',
      '3.0L V10 formula. No budget cap.',
    ],
  },

  // --- F1 2006–2009: Knockout qualifying, refueling, no DRS ---
  'reg-f1-2006-2009': {
    id: 'reg-f1-2006-2009',
    seasonYear: 2006,
    series: 'F1',
    pointsSystemId: 'pts-2003',
    qualifyingFormat: 'Knockout (three-part elimination)',
    raceWeekendFormat: 'Practice / Qualifying / Race',
    testingLimit: undefined,
    budgetCap: undefined,
    designRules: { ...BASE_DESIGN },
    carryoverModifiers: { ...BASE_CARRYOVER },
    refuelingAllowed: true,
    drsEnabled: false,
    sprintSupport: false,
    pushToPass: false,
    tireChangeRules: 'Unrestricted tire changes',
    eraLabel: 'Knockout Qualifying & Refueling Era',
    notes: [
      'Knockout (three-part elimination) qualifying introduced in 2006.',
      '2.4L V8 from 2006. Refueling allowed. No DRS, no sprint weekends.',
      'Engine development frozen from 2007. Testing restrictions increasing.',
    ],
  },

  // --- F1 2010: Knockout qualifying, refueling banned, no DRS ---
  'reg-f1-2010': {
    id: 'reg-f1-2010',
    seasonYear: 2010,
    series: 'F1',
    pointsSystemId: 'pts-modern',
    qualifyingFormat: 'Knockout (three-part elimination)',
    raceWeekendFormat: 'Practice / Qualifying / Race',
    testingLimit: undefined,
    budgetCap: undefined,
    designRules: { ...BASE_DESIGN },
    carryoverModifiers: { ...BASE_CARRYOVER },
    refuelingAllowed: false,
    drsEnabled: false,
    sprintSupport: false,
    pushToPass: false,
    tireChangeRules: 'Unrestricted tire changes',
    eraLabel: 'Refueling Ban',
    notes: [
      'Refueling banned from 2010. Cars must carry full race fuel load.',
      'Knockout qualifying. No DRS, no sprint weekends.',
      '2.4L V8 formula. No budget cap.',
    ],
  },

  // --- F1 2011–2013: Knockout qualifying, no refueling, DRS ---
  'reg-f1-2011-2013': {
    id: 'reg-f1-2011-2013',
    seasonYear: 2011,
    series: 'F1',
    pointsSystemId: 'pts-modern',
    qualifyingFormat: 'Knockout (three-part elimination)',
    raceWeekendFormat: 'Practice / Qualifying / Race',
    testingLimit: undefined,
    budgetCap: undefined,
    designRules: { ...BASE_DESIGN },
    carryoverModifiers: { ...BASE_CARRYOVER },
    refuelingAllowed: false,
    drsEnabled: true,
    sprintSupport: false,
    pushToPass: false,
    tireChangeRules: 'Unrestricted tire changes',
    eraLabel: 'DRS Era',
    notes: [
      'DRS (Drag Reduction System) introduced in 2011.',
      'Refueling banned. Knockout qualifying. No sprint weekends.',
      '2.4L V8 formula. Pirelli control tyre from 2011.',
    ],
  },

  // --- F1 2014–2020: Hybrid era, knockout qualifying, no refueling, DRS ---
  'reg-f1-2014-2020': {
    id: 'reg-f1-2014-2020',
    seasonYear: 2014,
    series: 'F1',
    pointsSystemId: 'pts-modern',
    qualifyingFormat: 'Knockout (three-part elimination)',
    raceWeekendFormat: 'Practice / Qualifying / Race',
    testingLimit: undefined,
    budgetCap: undefined,
    designRules: { ...BASE_DESIGN },
    carryoverModifiers: { ...BASE_CARRYOVER },
    refuelingAllowed: false,
    drsEnabled: true,
    sprintSupport: false,
    pushToPass: false,
    tireChangeRules: 'Unrestricted tire changes',
    eraLabel: 'Hybrid Power Unit Era',
    notes: [
      '1.6L turbo-hybrid V6 power units introduced in 2014.',
      'Refueling banned. DRS enabled. Knockout qualifying.',
      'No sprint weekends for 2014–2020.',
      'Engine component penalty system in effect.',
    ],
  },

  // --- F1 2021: Sprint weekend support, DRS, no refueling ---
  'reg-f1-2021': {
    id: 'reg-f1-2021',
    seasonYear: 2021,
    series: 'F1',
    pointsSystemId: 'pts-modern',
    qualifyingFormat: 'Knockout (three-part elimination)',
    raceWeekendFormat: 'Practice / Qualifying / Sprint / Race (selected rounds)',
    testingLimit: undefined,
    budgetCap: 145,
    designRules: { ...BASE_DESIGN },
    carryoverModifiers: { ...BASE_CARRYOVER },
    refuelingAllowed: false,
    drsEnabled: true,
    sprintSupport: true,
    pushToPass: false,
    tireChangeRules: 'Unrestricted tire changes',
    eraLabel: 'Sprint Qualifying Trial',
    notes: [
      'Sprint qualifying trialled at selected rounds in 2021.',
      'Budget cap introduced at $145M. Refueling banned. DRS enabled.',
      '1.6L turbo-hybrid V6 power units.',
    ],
  },

  // --- F1 2022–2025: Ground-effect era, sprint support, DRS ---
  'reg-f1-2022-2025': {
    id: 'reg-f1-2022-2025',
    seasonYear: 2022,
    series: 'F1',
    pointsSystemId: 'pts-modern',
    qualifyingFormat: 'Knockout (three-part elimination)',
    raceWeekendFormat: 'Practice / Qualifying / Sprint / Race (selected rounds)',
    testingLimit: undefined,
    budgetCap: 140,
    designRules: { ...BASE_DESIGN },
    carryoverModifiers: { ...BASE_CARRYOVER },
    refuelingAllowed: false,
    drsEnabled: true,
    sprintSupport: true,
    pushToPass: false,
    tireChangeRules: 'Unrestricted tire changes',
    eraLabel: 'Ground-Effect Regulations',
    notes: [
      'Major aerodynamic regulation change — ground-effect cars return.',
      'Sprint weekends at selected rounds. Budget cap ~$140M.',
      'Refueling banned. DRS enabled. 1.6L turbo-hybrid V6.',
    ],
  },

  // --- F1 2026: New 2026 regulations ---
  'reg-f1-2026': {
    id: 'reg-f1-2026',
    seasonYear: 2026,
    series: 'F1',
    pointsSystemId: 'pts-modern',
    qualifyingFormat: 'Knockout (three-part elimination)',
    raceWeekendFormat: 'Practice / Qualifying / Sprint / Race (selected rounds)',
    testingLimit: undefined,
    budgetCap: 135,
    designRules: { ...BASE_DESIGN },
    carryoverModifiers: { ...BASE_CARRYOVER },
    refuelingAllowed: false,
    drsEnabled: true,
    sprintSupport: true,
    pushToPass: false,
    tireChangeRules: 'Unrestricted tire changes',
    eraLabel: '2026 Regulation Era',
    notes: [
      'New 2026 power unit regulations — increased electrical deployment.',
      'Active aero concepts replace traditional DRS.',
      'Refueling banned. Sprint weekends at selected rounds.',
      'Budget cap ~$135M.',
    ],
  },

  // ---------------------------------------------------------------------------
  // IndyCar Regulation Sets by Era
  // ---------------------------------------------------------------------------

  // --- IndyCar 2008–2011: Post-merger era ---
  'reg-indycar-2008-2011': {
    id: 'reg-indycar-2008-2011',
    seasonYear: 2008,
    series: 'IndyCar',
    pointsSystemId: 'pts-indycar-2008',
    qualifyingFormat: 'IndyCar (group/oval format by track type)',
    raceWeekendFormat: 'Practice / Qualifying / Race',
    testingLimit: undefined,
    budgetCap: undefined,
    designRules: { ...BASE_DESIGN },
    carryoverModifiers: { ...BASE_CARRYOVER },
    refuelingAllowed: true,
    drsEnabled: false,
    sprintSupport: false,
    pushToPass: true,
    tireChangeRules: 'Unrestricted tire changes',
    eraLabel: 'Post-Merger IndyCar',
    notes: [
      'Post-merger (IRL/Champ Car) unified IndyCar Series.',
      'No DRS. Push-to-pass available on road/street courses.',
      'Oval and road/street course variety. No F1-style refueling rules.',
    ],
  },

  // --- IndyCar 2012–2017: DW12 era ---
  'reg-indycar-2012-2017': {
    id: 'reg-indycar-2012-2017',
    seasonYear: 2012,
    series: 'IndyCar',
    pointsSystemId: 'pts-indycar-2012',
    qualifyingFormat: 'IndyCar (group/oval format by track type)',
    raceWeekendFormat: 'Practice / Qualifying / Race',
    testingLimit: undefined,
    budgetCap: undefined,
    designRules: { ...BASE_DESIGN },
    carryoverModifiers: { ...BASE_CARRYOVER },
    refuelingAllowed: true,
    drsEnabled: false,
    sprintSupport: false,
    pushToPass: true,
    tireChangeRules: 'Unrestricted tire changes',
    eraLabel: 'DW12 Manufacturer Era',
    notes: [
      'Dallara DW12 chassis introduced. Manufacturer competition (Honda/Chevrolet).',
      'No DRS. Push-to-pass on road/street courses.',
      'Aero kit competition era (2015–2017).',
    ],
  },

  // --- IndyCar 2018–2023: Universal aero kit ---
  'reg-indycar-2018-2023': {
    id: 'reg-indycar-2018-2023',
    seasonYear: 2018,
    series: 'IndyCar',
    pointsSystemId: 'pts-indycar-2018',
    qualifyingFormat: 'IndyCar (group/oval format by track type)',
    raceWeekendFormat: 'Practice / Qualifying / Race',
    testingLimit: undefined,
    budgetCap: undefined,
    designRules: { ...BASE_DESIGN },
    carryoverModifiers: { ...BASE_CARRYOVER },
    refuelingAllowed: true,
    drsEnabled: false,
    sprintSupport: false,
    pushToPass: true,
    tireChangeRules: 'Unrestricted tire changes',
    eraLabel: 'Universal Aero Kit Era',
    notes: [
      'Universal aero kit — no manufacturer-specific aero kits.',
      'No DRS. Push-to-pass on road/street courses.',
      'Screen/canopy safety device introduced (2020).',
    ],
  },

  // --- IndyCar 2024–2026: Modern era ---
  'reg-indycar-2024-2026': {
    id: 'reg-indycar-2024-2026',
    seasonYear: 2024,
    series: 'IndyCar',
    pointsSystemId: 'pts-indycar-2024',
    qualifyingFormat: 'IndyCar (group/oval format by track type)',
    raceWeekendFormat: 'Practice / Qualifying / Race',
    testingLimit: undefined,
    budgetCap: undefined,
    designRules: { ...BASE_DESIGN },
    carryoverModifiers: { ...BASE_CARRYOVER },
    refuelingAllowed: true,
    drsEnabled: false,
    sprintSupport: false,
    pushToPass: true,
    tireChangeRules: 'Unrestricted tire changes',
    eraLabel: 'Hybrid IndyCar Era',
    notes: [
      'Hybrid power unit introduced (2024).',
      'No DRS. Push-to-pass on road/street courses.',
      'Modern IndyCar regulations with safety improvements.',
    ],
  },
};

export function getRegulationSet(id: string): RegulationSet | undefined {
  return regulationSets[id];
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
