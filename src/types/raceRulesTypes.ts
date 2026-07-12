import type { Series } from './gameTypes';

export type TrackDiscipline = 'Road' | 'Street' | 'ShortOval' | 'IntermediateOval' | 'Superspeedway' | 'Speedway' | 'Mixed';
export type StartProcedure = 'Standing' | 'Rolling' | 'SafetyCarStart';
export type RestartProcedure = 'Standing' | 'RollingSingleFile' | 'RollingDoubleFile' | 'SeriesDefault';
export type RaceControlMode = 'LocalYellow' | 'FullCourseYellow' | 'VirtualSafetyCar' | 'SafetyCar' | 'PaceCar' | 'RedFlag' | 'Overtime';

export type FuelRuleProfile = {
  refuelingAllowed: boolean;
  fuelSavingAllowed: boolean;
  cautionFuelSaving: boolean;
};

export type TyreRuleProfile = {
  compoundModel: 'F1Historical' | 'F1Modern' | 'IndyCarPrimaryAlternate' | 'NASCARSet' | 'GenericDryWet';
  mandatoryCompoundChange: boolean;
};

export type OvertakingAidRuleProfile = {
  drs: boolean;
  pushToPass: boolean;
  drafting: 'Minimal' | 'Moderate' | 'Strong' | 'Pack';
};

export type PitLaneRuleProfile = {
  closesUnderFullCourseCaution: boolean;
  waveArounds: boolean;
  luckyDog: boolean;
  speedLimitSource: 'TrackOverride' | 'SeriesEraFallback' | 'Unknown';
};

export type RaceControlRuleProfile = {
  supportedModes: RaceControlMode[];
  lateRaceCautionsAllowed: boolean;
  cautionFrequencyMultiplier: number;
  minimumGreenLapsBetweenCautions: number;
  instantFieldCompression: false;
  restartProcedure: RestartProcedure;
  overtime: boolean;
  stageRacing: boolean;
};

export type RaceRuleProfile = {
  id: string;
  series: Series;
  startYear: number;
  endYear: number | null;
  trackDisciplines: TrackDiscipline[];
  startProcedure: StartProcedure;
  fuel: FuelRuleProfile;
  tyres: TyreRuleProfile;
  overtakingAids: OvertakingAidRuleProfile;
  pitLane: PitLaneRuleProfile;
  raceControl: RaceControlRuleProfile;
  notes: string[];
};
