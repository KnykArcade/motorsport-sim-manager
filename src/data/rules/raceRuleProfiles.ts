import type { RaceRuleProfile, TrackDiscipline } from '../../types/raceRulesTypes';
import type { Series, Track } from '../../types/gameTypes';

const UNRESTRICTED_SETUP = {
  mode: 'Unrestricted',
  trigger: 'None',
  allowedPostQualifyingChanges: [],
  maxPostQualifyingDelta: null,
  violationConsequence: 'Blocked',
  label: 'Open setup rules',
  description: 'Setup changes are unrestricted through the race weekend.',
} as const;

const F1_PARC_FERME_SETUP = {
  mode: 'ParcFerme',
  trigger: 'AfterQualifying',
  allowedPostQualifyingChanges: ['frontWing', 'brakeBias', 'brakeCooling', 'engineCooling'],
  maxPostQualifyingDelta: 1,
  violationConsequence: 'PitLaneStart',
  label: 'Parc ferme after qualifying',
  description: 'Major setup work is locked after qualifying. Only minor wing, brake-balance, and cooling changes are allowed before the race.',
} as const;

const NASCAR_IMPOUND_SETUP = {
  mode: 'Impound',
  trigger: 'AfterQualifying',
  allowedPostQualifyingChanges: ['brakeCooling', 'engineCooling'],
  maxPostQualifyingDelta: 0.5,
  violationConsequence: 'RearOfField',
  label: 'Impound-style post-qualifying rules',
  description: 'The race setup is effectively locked after qualifying. Only tiny cooling/tape-style adjustments are allowed.',
} as const;

const STOCK_CAR_LIMITED_SETUP = {
  mode: 'PostQualifyingLimited',
  trigger: 'AfterQualifying',
  allowedPostQualifyingChanges: ['frontWing', 'rearWing', 'brakeBias', 'brakeCooling', 'engineCooling', 'tyreUsage'],
  maxPostQualifyingDelta: 1,
  violationConsequence: 'RearOfField',
  label: 'Limited post-qualifying adjustments',
  description: 'Major mechanical, ride-height, gearing, and differential changes are locked after qualifying. Minor race-prep changes remain available.',
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
    setupLock: UNRESTRICTED_SETUP,
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
    setupLock: UNRESTRICTED_SETUP,
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
    setupLock: F1_PARC_FERME_SETUP,
    notes: ['F1 refueling era with parc ferme setup restrictions after qualifying.'],
  },
  {
    id: 'f1-2010-present',
    series: 'F1',
    startYear: 2010,
    endYear: null,
    trackDisciplines: ['Road', 'Street'],
    startProcedure: 'Standing',
    fuel: { refuelingAllowed: false, fuelSavingAllowed: true, cautionFuelSaving: true },
    tyres: { compoundModel: 'F1Modern', mandatoryCompoundChange: true },
    overtakingAids: { drs: true, pushToPass: false, drafting: 'Moderate' },
    pitLane: { closesUnderFullCourseCaution: false, waveArounds: false, luckyDog: false, speedLimitSource: 'SeriesEraFallback' },
    raceControl: { supportedModes: ['LocalYellow', 'VirtualSafetyCar', 'SafetyCar', 'RedFlag'], lateRaceCautionsAllowed: true, cautionFrequencyMultiplier: 0.65, minimumGreenLapsBetweenCautions: 5, instantFieldCompression: false, restartProcedure: 'SeriesDefault', overtime: false, stageRacing: false },
    setupLock: F1_PARC_FERME_SETUP,
    notes: ['Modern F1 no-refueling era with DRS/VSC only in supported years.'],
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
    setupLock: UNRESTRICTED_SETUP,
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
    setupLock: UNRESTRICTED_SETUP,
    notes: ['Champ Car profile normalizes ChampCar/Champ Car naming at lookup boundaries.'],
  },
  {
    id: 'indycar-1996-present',
    series: 'IndyCar',
    startYear: 1996,
    endYear: null,
    trackDisciplines: ['Road', 'Street', 'ShortOval', 'IntermediateOval', 'Superspeedway'],
    startProcedure: 'Rolling',
    fuel: { refuelingAllowed: true, fuelSavingAllowed: true, cautionFuelSaving: true },
    tyres: { compoundModel: 'IndyCarPrimaryAlternate', mandatoryCompoundChange: false },
    overtakingAids: { drs: false, pushToPass: true, drafting: 'Strong' },
    pitLane: { closesUnderFullCourseCaution: true, waveArounds: true, luckyDog: false, speedLimitSource: 'SeriesEraFallback' },
    raceControl: { supportedModes: ['LocalYellow', 'FullCourseYellow', 'PaceCar', 'RedFlag'], lateRaceCautionsAllowed: true, cautionFrequencyMultiplier: 0.75, minimumGreenLapsBetweenCautions: 4, instantFieldCompression: false, restartProcedure: 'RollingSingleFile', overtime: false, stageRacing: false },
    setupLock: UNRESTRICTED_SETUP,
    notes: ['IndyCar road/street/oval procedure varies by event and is refined by track discipline.'],
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
    setupLock: UNRESTRICTED_SETUP,
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
    setupLock: UNRESTRICTED_SETUP,
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

export function selectRaceRuleProfile(series: Series, year: number, track?: Track): RaceRuleProfile {
  const discipline = track ? inferTrackDiscipline(track) : undefined;
  const matches = RACE_RULE_PROFILES.filter((profile) => {
    if (profile.series !== series) return false;
    if (year < profile.startYear) return false;
    if (profile.endYear != null && year > profile.endYear) return false;
    if (discipline && !profile.trackDisciplines.includes(discipline)) return false;
    return true;
  });
  return matches[0] ?? RACE_RULE_PROFILES.find((profile) => profile.series === series)!;
}

export function inferTrackDiscipline(track: Track): TrackDiscipline {
  const text = `${track.name} ${track.gpName} ${track.archetype}`.toLowerCase();
  if (text.includes('street')) return 'Street';
  if (text.includes('superspeedway') || text.includes('daytona') || text.includes('talladega')) return 'Superspeedway';
  if (text.includes('short') || text.includes('martinsville') || text.includes('bristol')) return 'ShortOval';
  if (text.includes('speedway') || text.includes('oval')) return 'IntermediateOval';
  return 'Road';
}
