import type { CarSetup, SetupParamKey } from './setupTypes';
import type {
  SetupPenaltyConsequence,
  SetupRuleSource,
  SetupWeekendLockState,
} from './raceRulesTypes';

export type SetupRestrictionDecision =
  | 'ContinueWithLegalConfiguration'
  | 'RequestAuthorizedChange'
  | 'AcceptPenalty';

export type SetupPenaltyRecord = {
  raceId: string;
  driverId: string;
  consequence: SetupPenaltyConsequence;
  changedParams: SetupParamKey[];
  authorized: boolean;
  reason: string;
  source: SetupRuleSource;
};

export type SetupRestrictionWeekendState = {
  raceId: string;
  profileId: string;
  phase: SetupWeekendLockState;
  phaseHistory: SetupWeekendLockState[];
  qualifyingConfigurationByDriver: Record<string, CarSetup>;
  finalRaceConfigurationByDriver: Record<string, CarSetup>;
  penaltiesByDriver: Record<string, SetupPenaltyRecord>;
};

export type SetupRestrictionState = Record<string, SetupRestrictionWeekendState>;
