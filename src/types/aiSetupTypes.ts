import type { CarSetup } from './setupTypes';
import type { PracticeProgram } from './practiceTypes';
import type { SetupLockMode } from './raceRulesTypes';

export type AIEngineeringPhilosophy =
  | 'QualifyingAttack'
  | 'BalancedWeekend'
  | 'LongRunPreservation'
  | 'ReliabilityProtection'
  | 'WetWeatherPreparation'
  | 'StraightLineEfficiency'
  | 'TrafficOvertaking'
  | 'ExperimentalDevelopment';

export type AIEngineeringDriverPlan = {
  driverId: string;
  practicedSetup: CarSetup;
  qualifyingSetup: CarSetup;
  raceSetup: CarSetup;
  practiceLaps: number;
  setupKnowledge: number;
  ranQualifyingSimulation: boolean;
  ranRacePace: boolean;
  ranWetPreparation: boolean;
};

// A bounded, active-weekend record. It stores only the AI's engineering
// decisions and knowledge; the authoritative performance profiles are rebuilt
// from these physical setups at the qualifying/race boundary.
export type AIEngineeringWeekendPlan = {
  raceId: string;
  teamId: string;
  philosophy: AIEngineeringPhilosophy;
  preparationScore: number;
  sharedKnowledge: number;
  uncertainty: number;
  practicePrograms: PracticeProgram[];
  setupLockMode: SetupLockMode;
  drivers: Record<string, AIEngineeringDriverPlan>;
};

export type AIEngineeringWeekendPlans = Record<string, AIEngineeringWeekendPlan>;
