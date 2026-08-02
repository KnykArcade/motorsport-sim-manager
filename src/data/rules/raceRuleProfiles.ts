import type { RaceRuleProfile, SetupEventFormatOverride, TrackDiscipline } from '../../types/raceRulesTypes';
import type { Series, Track } from '../../types/gameTypes';

const UNRESTRICTED_SETUP = {
  mode: 'Unrestricted',
  trigger: 'None',
  allowedPostQualifyingChanges: [],
  allowedPreRaceGridChanges: [],
  approvalRequiredChanges: [],
  weatherExceptionChanges: [],
  maxPostQualifyingDelta: null,
  violationConsequence: 'Blocked',
  authorizedChangeConsequence: 'None',
  authorizedWorkWindow: 'FullSetup',
  qualifiesOnRaceSetup: false,
  retainsQualifyingTyres: false,
  eventSpecific: false,
  label: 'Open setup rules',
  description: 'Setup changes are unrestricted through the race weekend.',
  source: {
    title: 'Series-era historical regulations archive',
    url: 'https://www.fia.com/regulation/category/110',
    confidence: 'GameplayFallback',
    note: 'Open setup is the conservative fallback where no reliable qualifying-to-race lock is documented.',
  },
} as const;

const F1_HISTORICAL_OPEN_SETUP = {
  ...UNRESTRICTED_SETUP,
  source: {
    title: 'FIA Formula 1 regulations archive',
    url: 'https://www.fia.com/regulation/category/110',
    confidence: 'High',
    note: 'No qualifying-to-race parc fermé lock is modeled before its documented 2003 introduction.',
  },
} as const;

const AMERICAN_OPEN_SETUP_FALLBACK = {
  ...UNRESTRICTED_SETUP,
  source: {
    title: 'INDYCAR rules and regulations archive',
    url: 'https://epaddock.indycar.com/docs/default-source/rules-regulations-and-policies/indycar-rulebook.pdf',
    confidence: 'GameplayFallback',
    note: 'The historical event rule could not be verified reliably; the game deliberately leaves setup open instead of inventing a restriction.',
  },
} as const;

const NASCAR_OPEN_SETUP_FALLBACK = {
  ...UNRESTRICTED_SETUP,
  source: {
    title: 'NASCAR public competition procedures',
    url: 'https://www.nascar.com/news-media/category/nascar-competition/',
    confidence: 'GameplayFallback',
    note: 'A public source for a qualifying-to-race setup lock in this era was not verified, so no restriction is invented.',
  },
} as const;

const F1_2003_PARC_FERME_SETUP = {
  mode: 'ParcFerme',
  trigger: 'FirstQualifyingRun',
  allowedPostQualifyingChanges: ['frontWing', 'brakeBias', 'brakeCooling', 'engineCooling'],
  allowedPreRaceGridChanges: ['frontWing', 'brakeBias', 'brakeCooling', 'engineCooling'],
  approvalRequiredChanges: ['rearWing', 'suspensionStiffness', 'rideHeight', 'gearing', 'differential'],
  weatherExceptionChanges: ['frontWing', 'rearWing', 'rideHeight', 'brakeCooling', 'engineCooling', 'tyreUsage'],
  maxPostQualifyingDelta: 1,
  violationConsequence: 'PitLaneStart',
  authorizedChangeConsequence: 'PitLaneStart',
  authorizedWorkWindow: 'Limited',
  qualifiesOnRaceSetup: true,
  retainsQualifyingTyres: false,
  eventSpecific: false,
  label: 'F1 parc fermé',
  description: 'The qualifying configuration is locked from the car’s first qualifying run. Minor controls and cooling work remain legal; performance-changing work requires approval or a pit-lane start.',
  source: {
    title: 'FIA Formula 1 regulations archive',
    url: 'https://www.fia.com/regulation/category/110',
    section: 'Parc fermé regulations introduced for the 2003 season',
    confidence: 'High',
  },
} as const;

const F1_MODERN_PARC_FERME_SETUP = {
  ...F1_2003_PARC_FERME_SETUP,
  allowedPostQualifyingChanges: ['frontWing', 'brakeBias', 'brakeCooling', 'engineCooling'],
  label: 'F1 parc fermé active',
  source: {
    title: 'FIA 2026 Formula 1 Sporting Regulations',
    url: 'https://api.fia.com/system/files/documents/fia_2026_f1_regulations_-_section_b_sporting_-_iss_06_-_2026-04-28.pdf',
    section: 'B3.5 Pre-Sprint & Pre-Race Parc Fermé',
    confidence: 'Official',
  },
} as const;

const F1_2010_2025_PARC_FERME_SETUP = {
  ...F1_MODERN_PARC_FERME_SETUP,
  source: {
    title: 'FIA 2025 Formula One Sporting Regulations',
    url: 'https://api.fia.com/system/files/documents/fia_2025_formula_1_sporting_regulations_-_issue_5_-_2025-04-30.pdf',
    section: 'Article 40 Parc Fermé',
    confidence: 'Official',
  },
} as const;

const NASCAR_IMPOUND_SETUP = {
  mode: 'Impound',
  trigger: 'AfterQualifying',
  allowedPostQualifyingChanges: ['brakeCooling', 'engineCooling'],
  allowedPreRaceGridChanges: ['brakeCooling', 'engineCooling'],
  approvalRequiredChanges: ['frontWing', 'rearWing', 'suspensionStiffness', 'rideHeight', 'gearing', 'brakeBias', 'differential', 'tyreUsage'],
  weatherExceptionChanges: ['brakeCooling', 'engineCooling', 'tyreUsage'],
  maxPostQualifyingDelta: 0.5,
  violationConsequence: 'RearOfField',
  authorizedChangeConsequence: 'RearOfField',
  authorizedWorkWindow: 'Limited',
  qualifiesOnRaceSetup: true,
  retainsQualifyingTyres: true,
  eventSpecific: true,
  label: 'Impound-style post-qualifying rules',
  description: 'The race setup is effectively locked after qualifying. Only tiny cooling/tape-style adjustments are allowed.',
  source: {
    title: 'NASCAR competition: impound procedures remain in effect',
    url: 'https://www.nascar.com/news-media/2026/07/22/nascar-to-implement-50-minute-cup-practices-beginning-at-new-hampshire/',
    confidence: 'Official',
    note: 'Public NASCAR material confirms impound and restricted post-qualifying adjustments; event bulletins control exact permitted work.',
  },
} as const;

const STOCK_CAR_LIMITED_SETUP = {
  mode: 'PostQualifyingLimited',
  trigger: 'AfterQualifying',
  allowedPostQualifyingChanges: ['frontWing', 'rearWing', 'brakeBias', 'brakeCooling', 'engineCooling', 'tyreUsage'],
  allowedPreRaceGridChanges: ['frontWing', 'rearWing', 'brakeBias', 'brakeCooling', 'engineCooling', 'tyreUsage'],
  approvalRequiredChanges: ['suspensionStiffness', 'rideHeight', 'gearing', 'differential'],
  weatherExceptionChanges: ['frontWing', 'rearWing', 'brakeCooling', 'engineCooling', 'tyreUsage'],
  maxPostQualifyingDelta: 1,
  violationConsequence: 'RearOfField',
  authorizedChangeConsequence: 'RearOfField',
  authorizedWorkWindow: 'Limited',
  qualifiesOnRaceSetup: true,
  retainsQualifyingTyres: true,
  eventSpecific: true,
  label: 'Limited post-qualifying adjustments',
  description: 'Major mechanical, ride-height, gearing, and differential changes are locked after qualifying. Minor race-prep changes remain available.',
  source: {
    title: 'NASCAR Cup Series impound competition update',
    url: 'https://www.nascar.com/news-media/2026/07/22/nascar-to-implement-50-minute-cup-practices-beginning-at-new-hampshire/',
    confidence: 'Official',
  },
} as const;

const INDYCAR_OVAL_IMPOUND_SETUP = {
  mode: 'Impound',
  trigger: 'QualifyingTechnicalInspection',
  allowedPostQualifyingChanges: ['frontWing', 'brakeCooling', 'engineCooling', 'tyreUsage'],
  allowedPreRaceGridChanges: ['frontWing', 'tyreUsage'],
  approvalRequiredChanges: ['rearWing', 'suspensionStiffness', 'rideHeight', 'gearing', 'brakeBias', 'differential'],
  weatherExceptionChanges: ['frontWing', 'rearWing', 'brakeCooling', 'engineCooling', 'tyreUsage'],
  maxPostQualifyingDelta: 1,
  violationConsequence: 'RearOfFieldAndDriveThrough',
  authorizedChangeConsequence: 'RearOfField',
  authorizedWorkWindow: 'Limited',
  qualifiesOnRaceSetup: true,
  retainsQualifyingTyres: true,
  eventSpecific: true,
  label: 'INDYCAR oval qualifying impound',
  description: 'Aerodynamic and mechanical configuration is retained for the race. Only the announced impound work list is legal; unapproved changes bring a rear-of-field start and drive-through.',
  source: {
    title: '2026 NTT INDYCAR SERIES Rulebook',
    url: 'https://epaddock.indycar.com/docs/default-source/rules-regulations-and-policies/indycar-rulebook.pdf',
    section: '8.4.1–8.4.2 Qualifications Impound – Oval Events',
    confidence: 'Official',
  },
} as const;

const INDYCAR_ROAD_WORK_WINDOW_SETUP = {
  ...INDYCAR_OVAL_IMPOUND_SETUP,
  mode: 'PostQualifyingLimited',
  allowedPostQualifyingChanges: ['frontWing', 'rearWing', 'suspensionStiffness', 'rideHeight', 'gearing', 'brakeBias', 'brakeCooling', 'differential', 'engineCooling', 'tyreUsage'],
  allowedPreRaceGridChanges: ['frontWing', 'tyreUsage'],
  approvalRequiredChanges: [],
  maxPostQualifyingDelta: null,
  violationConsequence: 'RearOfFieldAndDriveThrough',
  authorizedChangeConsequence: 'None',
  authorizedWorkWindow: 'FullSetup',
  qualifiesOnRaceSetup: false,
  retainsQualifyingTyres: false,
  label: 'INDYCAR authorized race-preparation window',
  description: 'Cars enter impound after qualifying, then receive an allotted work period before the final pre-race impound. Once the window closes, only front-wing, tyre-pressure and radio work remains legal.',
  source: {
    title: '2026 NTT INDYCAR SERIES Rulebook',
    url: 'https://epaddock.indycar.com/docs/default-source/rules-regulations-and-policies/indycar-rulebook.pdf',
    section: '8.4.3–8.4.4 Road/Street Course Qualifications Impound',
    confidence: 'Official',
    note: 'The rulebook makes impound event-specific; the game uses the allotted-work profile as the documented standard and supports track overrides.',
  },
} as const;

export const RACE_RULE_PROFILES: readonly RaceRuleProfile[] = [
  {
    id: 'f1-1990-1993',
    series: 'F1',
    startYear: 1990,
    endYear: 1993,
    trackDisciplines: ['Road', 'Street'],
    startProcedure: 'Standing',
    fuel: { refuelingAllowed: false, fuelSavingAllowed: true, cautionFuelSaving: true },
    tyres: { compoundModel: 'F1Historical', mandatoryCompoundChange: false },
    overtakingAids: { drs: false, pushToPass: false, drafting: 'Minimal' },
    pitLane: { closesUnderFullCourseCaution: false, waveArounds: false, luckyDog: false, speedLimitSource: 'Unknown' },
    raceControl: { supportedModes: ['LocalYellow', 'SafetyCar', 'RedFlag'], lateRaceCautionsAllowed: true, cautionFrequencyMultiplier: 0.65, minimumGreenLapsBetweenCautions: 5, instantFieldCompression: false, restartProcedure: 'RollingSingleFile', overtime: false, stageRacing: false },
    setupLock: F1_HISTORICAL_OPEN_SETUP,
    notes: ['Historical F1 standing starts, no DRS, no race refueling.'],
  },
  {
    id: 'f1-1994-2002',
    series: 'F1',
    startYear: 1994,
    endYear: 2002,
    trackDisciplines: ['Road', 'Street'],
    startProcedure: 'Standing',
    fuel: { refuelingAllowed: true, fuelSavingAllowed: true, cautionFuelSaving: true },
    tyres: { compoundModel: 'F1Historical', mandatoryCompoundChange: false },
    overtakingAids: { drs: false, pushToPass: false, drafting: 'Minimal' },
    pitLane: { closesUnderFullCourseCaution: false, waveArounds: false, luckyDog: false, speedLimitSource: 'SeriesEraFallback' },
    raceControl: { supportedModes: ['LocalYellow', 'SafetyCar', 'RedFlag'], lateRaceCautionsAllowed: true, cautionFrequencyMultiplier: 0.65, minimumGreenLapsBetweenCautions: 5, instantFieldCompression: false, restartProcedure: 'RollingSingleFile', overtime: false, stageRacing: false },
    setupLock: F1_HISTORICAL_OPEN_SETUP,
    notes: ['Early F1 refueling era before parc ferme became part of the weekend setup model.'],
  },
  {
    id: 'f1-2003-2009',
    series: 'F1',
    startYear: 2003,
    endYear: 2009,
    trackDisciplines: ['Road', 'Street'],
    startProcedure: 'Standing',
    fuel: { refuelingAllowed: true, fuelSavingAllowed: true, cautionFuelSaving: true },
    tyres: { compoundModel: 'F1Historical', mandatoryCompoundChange: false },
    overtakingAids: { drs: false, pushToPass: false, drafting: 'Minimal' },
    pitLane: { closesUnderFullCourseCaution: false, waveArounds: false, luckyDog: false, speedLimitSource: 'SeriesEraFallback' },
    raceControl: { supportedModes: ['LocalYellow', 'SafetyCar', 'RedFlag'], lateRaceCautionsAllowed: true, cautionFrequencyMultiplier: 0.65, minimumGreenLapsBetweenCautions: 5, instantFieldCompression: false, restartProcedure: 'RollingSingleFile', overtime: false, stageRacing: false },
    setupLock: F1_2003_PARC_FERME_SETUP,
    notes: ['F1 refueling era with parc ferme setup restrictions after qualifying.'],
  },
  {
    id: 'f1-2010-2025',
    series: 'F1',
    startYear: 2010,
    endYear: 2025,
    trackDisciplines: ['Road', 'Street'],
    startProcedure: 'Standing',
    fuel: { refuelingAllowed: false, fuelSavingAllowed: true, cautionFuelSaving: true },
    tyres: { compoundModel: 'F1Modern', mandatoryCompoundChange: true },
    overtakingAids: { drs: true, pushToPass: false, drafting: 'Moderate' },
    pitLane: { closesUnderFullCourseCaution: false, waveArounds: false, luckyDog: false, speedLimitSource: 'SeriesEraFallback' },
    raceControl: { supportedModes: ['LocalYellow', 'VirtualSafetyCar', 'SafetyCar', 'RedFlag'], lateRaceCautionsAllowed: true, cautionFrequencyMultiplier: 0.65, minimumGreenLapsBetweenCautions: 5, instantFieldCompression: false, restartProcedure: 'SeriesDefault', overtime: false, stageRacing: false },
    setupLock: F1_2010_2025_PARC_FERME_SETUP,
    notes: ['Modern F1 no-refueling era with DRS/VSC only in supported years.'],
  },
  {
    id: 'f1-2026-present',
    series: 'F1',
    startYear: 2026,
    endYear: null,
    trackDisciplines: ['Road', 'Street'],
    startProcedure: 'Standing',
    fuel: { refuelingAllowed: false, fuelSavingAllowed: true, cautionFuelSaving: true },
    tyres: { compoundModel: 'F1Modern', mandatoryCompoundChange: true },
    overtakingAids: { drs: true, pushToPass: false, drafting: 'Moderate' },
    pitLane: { closesUnderFullCourseCaution: false, waveArounds: false, luckyDog: false, speedLimitSource: 'SeriesEraFallback' },
    raceControl: { supportedModes: ['LocalYellow', 'VirtualSafetyCar', 'SafetyCar', 'RedFlag'], lateRaceCautionsAllowed: true, cautionFrequencyMultiplier: 0.65, minimumGreenLapsBetweenCautions: 5, instantFieldCompression: false, restartProcedure: 'SeriesDefault', overtime: false, stageRacing: false },
    setupLock: F1_MODERN_PARC_FERME_SETUP,
    notes: ['2026 F1 setup restrictions are sourced from Section B3.5, with Sprint-capable data retained for future format support.'],
  },
  {
    id: 'cart-1990-2003',
    series: 'CART',
    startYear: 1990,
    endYear: 2003,
    trackDisciplines: ['Road', 'Street', 'ShortOval', 'IntermediateOval', 'Superspeedway'],
    startProcedure: 'Rolling',
    fuel: { refuelingAllowed: true, fuelSavingAllowed: true, cautionFuelSaving: true },
    tyres: { compoundModel: 'GenericDryWet', mandatoryCompoundChange: false },
    overtakingAids: { drs: false, pushToPass: false, drafting: 'Strong' },
    pitLane: { closesUnderFullCourseCaution: true, waveArounds: true, luckyDog: false, speedLimitSource: 'SeriesEraFallback' },
    raceControl: { supportedModes: ['LocalYellow', 'FullCourseYellow', 'PaceCar', 'RedFlag'], lateRaceCautionsAllowed: true, cautionFrequencyMultiplier: 0.75, minimumGreenLapsBetweenCautions: 4, instantFieldCompression: false, restartProcedure: 'RollingSingleFile', overtime: false, stageRacing: false },
    setupLock: AMERICAN_OPEN_SETUP_FALLBACK,
    notes: ['CART rules vary by event; profile captures top-level live simulation behavior.'],
  },
  {
    id: 'champcar-2004-2007',
    series: 'Champ Car',
    startYear: 2004,
    endYear: 2007,
    trackDisciplines: ['Road', 'Street'],
    startProcedure: 'Rolling',
    fuel: { refuelingAllowed: true, fuelSavingAllowed: true, cautionFuelSaving: true },
    tyres: { compoundModel: 'GenericDryWet', mandatoryCompoundChange: false },
    overtakingAids: { drs: false, pushToPass: true, drafting: 'Moderate' },
    pitLane: { closesUnderFullCourseCaution: true, waveArounds: true, luckyDog: false, speedLimitSource: 'SeriesEraFallback' },
    raceControl: { supportedModes: ['LocalYellow', 'FullCourseYellow', 'PaceCar', 'RedFlag'], lateRaceCautionsAllowed: true, cautionFrequencyMultiplier: 0.75, minimumGreenLapsBetweenCautions: 4, instantFieldCompression: false, restartProcedure: 'RollingSingleFile', overtime: false, stageRacing: false },
    setupLock: AMERICAN_OPEN_SETUP_FALLBACK,
    notes: ['Champ Car profile normalizes ChampCar/Champ Car naming at lookup boundaries.'],
  },
  {
    id: 'indycar-1996-2023',
    series: 'IndyCar',
    startYear: 1996,
    endYear: 2023,
    trackDisciplines: ['Road', 'Street', 'ShortOval', 'IntermediateOval', 'Superspeedway'],
    startProcedure: 'Rolling',
    fuel: { refuelingAllowed: true, fuelSavingAllowed: true, cautionFuelSaving: true },
    tyres: { compoundModel: 'IndyCarPrimaryAlternate', mandatoryCompoundChange: false },
    overtakingAids: { drs: false, pushToPass: true, drafting: 'Strong' },
    pitLane: { closesUnderFullCourseCaution: true, waveArounds: true, luckyDog: false, speedLimitSource: 'SeriesEraFallback' },
    raceControl: { supportedModes: ['LocalYellow', 'FullCourseYellow', 'PaceCar', 'RedFlag'], lateRaceCautionsAllowed: true, cautionFrequencyMultiplier: 0.75, minimumGreenLapsBetweenCautions: 4, instantFieldCompression: false, restartProcedure: 'RollingSingleFile', overtime: false, stageRacing: false },
    setupLock: AMERICAN_OPEN_SETUP_FALLBACK,
    notes: ['Historical IndyCar event procedures varied. Open setup is retained as the explicit fallback where event bulletins have not been verified.'],
  },
  {
    id: 'indycar-2024-present-road-street',
    series: 'IndyCar',
    startYear: 2024,
    endYear: null,
    trackDisciplines: ['Road', 'Street'],
    startProcedure: 'Rolling',
    fuel: { refuelingAllowed: true, fuelSavingAllowed: true, cautionFuelSaving: true },
    tyres: { compoundModel: 'IndyCarPrimaryAlternate', mandatoryCompoundChange: false },
    overtakingAids: { drs: false, pushToPass: true, drafting: 'Moderate' },
    pitLane: { closesUnderFullCourseCaution: true, waveArounds: true, luckyDog: false, speedLimitSource: 'SeriesEraFallback' },
    raceControl: { supportedModes: ['LocalYellow', 'FullCourseYellow', 'PaceCar', 'RedFlag'], lateRaceCautionsAllowed: true, cautionFrequencyMultiplier: 0.75, minimumGreenLapsBetweenCautions: 4, instantFieldCompression: false, restartProcedure: 'RollingSingleFile', overtime: false, stageRacing: false },
    setupLock: INDYCAR_ROAD_WORK_WINDOW_SETUP,
    notes: ['Modern road/street profile models the rulebook’s allotted work period and final impound. Event-specific no-work bulletins can override this profile.'],
  },
  {
    id: 'indycar-2024-present-oval',
    series: 'IndyCar',
    startYear: 2024,
    endYear: null,
    trackDisciplines: ['ShortOval', 'IntermediateOval', 'Superspeedway', 'Speedway'],
    startProcedure: 'Rolling',
    fuel: { refuelingAllowed: true, fuelSavingAllowed: true, cautionFuelSaving: true },
    tyres: { compoundModel: 'IndyCarPrimaryAlternate', mandatoryCompoundChange: false },
    overtakingAids: { drs: false, pushToPass: true, drafting: 'Strong' },
    pitLane: { closesUnderFullCourseCaution: true, waveArounds: true, luckyDog: false, speedLimitSource: 'SeriesEraFallback' },
    raceControl: { supportedModes: ['LocalYellow', 'FullCourseYellow', 'PaceCar', 'RedFlag'], lateRaceCautionsAllowed: true, cautionFrequencyMultiplier: 0.75, minimumGreenLapsBetweenCautions: 4, instantFieldCompression: false, restartProcedure: 'RollingSingleFile', overtime: false, stageRacing: false },
    setupLock: INDYCAR_OVAL_IMPOUND_SETUP,
    notes: ['Modern oval configuration and qualifying-tyre retention are governed by the official qualifications-impound rules. Indianapolis-specific qualifying remains identified as an event override.'],
  },
  {
    id: 'nascar-1990-2002',
    series: 'NASCAR',
    startYear: 1990,
    endYear: 2002,
    trackDisciplines: ['Road', 'ShortOval', 'IntermediateOval', 'Superspeedway', 'Speedway'],
    startProcedure: 'Rolling',
    fuel: { refuelingAllowed: true, fuelSavingAllowed: true, cautionFuelSaving: true },
    tyres: { compoundModel: 'NASCARSet', mandatoryCompoundChange: false },
    overtakingAids: { drs: false, pushToPass: false, drafting: 'Pack' },
    pitLane: { closesUnderFullCourseCaution: true, waveArounds: true, luckyDog: false, speedLimitSource: 'SeriesEraFallback' },
    raceControl: { supportedModes: ['LocalYellow', 'FullCourseYellow', 'PaceCar', 'RedFlag', 'Overtime'], lateRaceCautionsAllowed: true, cautionFrequencyMultiplier: 1, minimumGreenLapsBetweenCautions: 3, instantFieldCompression: false, restartProcedure: 'RollingDoubleFile', overtime: true, stageRacing: false },
    setupLock: NASCAR_OPEN_SETUP_FALLBACK,
    notes: ['NASCAR pre-free-pass era profile.'],
  },
  {
    id: 'nascar-2003-2004',
    series: 'NASCAR',
    startYear: 2003,
    endYear: 2004,
    trackDisciplines: ['Road', 'ShortOval', 'IntermediateOval', 'Superspeedway', 'Speedway'],
    startProcedure: 'Rolling',
    fuel: { refuelingAllowed: true, fuelSavingAllowed: true, cautionFuelSaving: true },
    tyres: { compoundModel: 'NASCARSet', mandatoryCompoundChange: false },
    overtakingAids: { drs: false, pushToPass: false, drafting: 'Pack' },
    pitLane: { closesUnderFullCourseCaution: true, waveArounds: true, luckyDog: true, speedLimitSource: 'SeriesEraFallback' },
    raceControl: { supportedModes: ['LocalYellow', 'FullCourseYellow', 'PaceCar', 'RedFlag', 'Overtime'], lateRaceCautionsAllowed: true, cautionFrequencyMultiplier: 1, minimumGreenLapsBetweenCautions: 3, instantFieldCompression: false, restartProcedure: 'RollingDoubleFile', overtime: true, stageRacing: false },
    setupLock: NASCAR_OPEN_SETUP_FALLBACK,
    notes: ['NASCAR free-pass era before impound-style setup restrictions are modelled.'],
  },
  {
    id: 'nascar-2005-2006',
    series: 'NASCAR',
    startYear: 2005,
    endYear: 2006,
    trackDisciplines: ['Road', 'ShortOval', 'IntermediateOval', 'Superspeedway', 'Speedway'],
    startProcedure: 'Rolling',
    fuel: { refuelingAllowed: true, fuelSavingAllowed: true, cautionFuelSaving: true },
    tyres: { compoundModel: 'NASCARSet', mandatoryCompoundChange: false },
    overtakingAids: { drs: false, pushToPass: false, drafting: 'Pack' },
    pitLane: { closesUnderFullCourseCaution: true, waveArounds: true, luckyDog: true, speedLimitSource: 'SeriesEraFallback' },
    raceControl: { supportedModes: ['LocalYellow', 'FullCourseYellow', 'PaceCar', 'RedFlag', 'Overtime'], lateRaceCautionsAllowed: true, cautionFrequencyMultiplier: 1, minimumGreenLapsBetweenCautions: 3, instantFieldCompression: false, restartProcedure: 'RollingDoubleFile', overtime: true, stageRacing: false },
    setupLock: NASCAR_IMPOUND_SETUP,
    notes: ['NASCAR impound-style era modelled as a strict post-qualifying setup lock.'],
  },
  {
    id: 'nascar-2007-2016',
    series: 'NASCAR',
    startYear: 2007,
    endYear: 2016,
    trackDisciplines: ['Road', 'ShortOval', 'IntermediateOval', 'Superspeedway', 'Speedway'],
    startProcedure: 'Rolling',
    fuel: { refuelingAllowed: true, fuelSavingAllowed: true, cautionFuelSaving: true },
    tyres: { compoundModel: 'NASCARSet', mandatoryCompoundChange: false },
    overtakingAids: { drs: false, pushToPass: false, drafting: 'Pack' },
    pitLane: { closesUnderFullCourseCaution: true, waveArounds: true, luckyDog: true, speedLimitSource: 'SeriesEraFallback' },
    raceControl: { supportedModes: ['LocalYellow', 'FullCourseYellow', 'PaceCar', 'RedFlag', 'Overtime'], lateRaceCautionsAllowed: true, cautionFrequencyMultiplier: 1, minimumGreenLapsBetweenCautions: 3, instantFieldCompression: false, restartProcedure: 'RollingDoubleFile', overtime: true, stageRacing: false },
    setupLock: STOCK_CAR_LIMITED_SETUP,
    notes: ['NASCAR free-pass era before stage racing.'],
  },
  {
    id: 'nascar-2017-present',
    series: 'NASCAR',
    startYear: 2017,
    endYear: null,
    trackDisciplines: ['Road', 'ShortOval', 'IntermediateOval', 'Superspeedway', 'Speedway', 'Street'],
    startProcedure: 'Rolling',
    fuel: { refuelingAllowed: true, fuelSavingAllowed: true, cautionFuelSaving: true },
    tyres: { compoundModel: 'NASCARSet', mandatoryCompoundChange: false },
    overtakingAids: { drs: false, pushToPass: false, drafting: 'Pack' },
    pitLane: { closesUnderFullCourseCaution: true, waveArounds: true, luckyDog: true, speedLimitSource: 'SeriesEraFallback' },
    raceControl: { supportedModes: ['LocalYellow', 'FullCourseYellow', 'PaceCar', 'RedFlag', 'Overtime'], lateRaceCautionsAllowed: true, cautionFrequencyMultiplier: 1, minimumGreenLapsBetweenCautions: 3, instantFieldCompression: false, restartProcedure: 'RollingDoubleFile', overtime: true, stageRacing: true },
    setupLock: STOCK_CAR_LIMITED_SETUP,
    notes: ['NASCAR stage-era profile with stage cautions/overtime enabled only for applicable years.'],
  },
];

export function selectRaceRuleProfile(
  series: Series,
  year: number,
  track?: Track,
  setupEventOverride: SetupEventFormatOverride = 'Default',
): RaceRuleProfile {
  const discipline = track ? inferTrackDiscipline(track) : undefined;
  const matches = RACE_RULE_PROFILES.filter((profile) => {
    if (profile.series !== series) return false;
    if (year < profile.startYear) return false;
    if (profile.endYear != null && year > profile.endYear) return false;
    if (discipline && !profile.trackDisciplines.includes(discipline)) return false;
    return true;
  });
  const selected = matches[0] ?? RACE_RULE_PROFILES.find((profile) => profile.series === series)!;
  const eventProfile = track ? applySetupEventOverride(selected, year, track, discipline) : selected;
  if (setupEventOverride === 'Default') return eventProfile;
  if (setupEventOverride === 'OpenSetup') {
    return { ...eventProfile, id: `${eventProfile.id}-open-override`, setupLock: AMERICAN_OPEN_SETUP_FALLBACK };
  }
  if (series !== 'IndyCar') return eventProfile;
  if (setupEventOverride === 'IndyCarRoadWorkWindow') {
    return { ...eventProfile, id: `${eventProfile.id}-work-window`, setupLock: INDYCAR_ROAD_WORK_WINDOW_SETUP };
  }
  return {
    ...eventProfile,
    id: `${eventProfile.id}-no-work-impound`,
    setupLock: {
      ...INDYCAR_OVAL_IMPOUND_SETUP,
      allowedPostQualifyingChanges: ['frontWing', 'tyreUsage'],
      allowedPreRaceGridChanges: ['frontWing', 'tyreUsage'],
      label: 'INDYCAR road/street impound without work time',
      description: 'The event bulletin provides no post-qualifying work period. Only the final grid protocol adjustments remain legal.',
      source: INDYCAR_ROAD_WORK_WINDOW_SETUP.source,
    },
  };
}

function applySetupEventOverride(
  profile: RaceRuleProfile,
  year: number,
  track: Track,
  discipline: TrackDiscipline | undefined,
): RaceRuleProfile {
  const eventText = `${track.name} ${track.gpName}`.toLowerCase();
  const isIndianapolis500 = profile.series === 'IndyCar'
    && eventText.includes('indianapolis')
    && !eventText.includes('road course');
  const isDocumentedIowaImpound = profile.series === 'IndyCar'
    && year >= 2022
    && eventText.includes('iowa');
  if (year >= 2008 && (isIndianapolis500 || isDocumentedIowaImpound)) {
    return {
      ...profile,
      id: `${profile.id}-${isIndianapolis500 ? 'indy500' : 'iowa-impound'}`,
      setupLock: {
        ...INDYCAR_OVAL_IMPOUND_SETUP,
        label: isIndianapolis500 ? 'Indianapolis qualifying configuration control' : 'Iowa qualifying impound',
        source: isDocumentedIowaImpound
          ? {
              title: 'INDYCAR: The Setup — Iowa with Luke Mason',
              url: 'https://www.indycar.com/news/2023/07/07-18-setup-mason-iowa',
              confidence: 'High',
              note: 'INDYCAR’s engineering feature explicitly describes Iowa qualifying as an impound compromise.',
            }
          : {
              ...INDYCAR_OVAL_IMPOUND_SETUP.source,
              section: '8.5 Indianapolis 500 qualifying plus 8.4 oval impound',
              confidence: year >= 2024 ? 'Official' : 'Medium',
              note: year >= 2024
                ? 'Indianapolis-specific qualifying rules supersede the general oval procedure where they conflict.'
                : 'The current official framework is used as a conservative historical event fallback; no undocumented detail is added.',
            },
      },
    };
  }

  const singleCarImpoundEvent = profile.series === 'NASCAR'
    && year >= 2015
    && year <= 2016
    && ['daytona', 'talladega', 'indianapolis', 'michigan'].some((name) => eventText.includes(name));
  if (singleCarImpoundEvent) {
    return {
      ...profile,
      id: `${profile.id}-single-car-impound`,
      setupLock: {
        ...NASCAR_IMPOUND_SETUP,
        label: 'NASCAR single-car qualifying impound',
        source: {
          title: 'NASCAR single-car qualifying impound procedure',
          url: 'https://www.nascar.com/news-media/2015/07/15/indy-michigan-to-use-one-timed-lap-qualifying/',
          confidence: 'Official',
          note: 'The published procedure permits only tape adjustment and cooling during the break between rounds.',
        },
      },
    };
  }

  if (profile.series === 'IndyCar' && year >= 2024 && discipline === 'Road') {
    return { ...profile, setupLock: { ...profile.setupLock, eventSpecific: true } };
  }
  return profile;
}

export function inferTrackDiscipline(track: Track): TrackDiscipline {
  const text = `${track.name} ${track.gpName} ${track.archetype}`.toLowerCase();
  if (text.includes('street')) return 'Street';
  if (text.includes('superspeedway') || text.includes('daytona') || text.includes('talladega')) return 'Superspeedway';
  if (text.includes('short') || text.includes('martinsville') || text.includes('bristol')) return 'ShortOval';
  if (text.includes('speedway') || text.includes('oval')) return 'IntermediateOval';
  return 'Road';
}
