import type { QualifyingResult } from '../types/gameTypes';
import type { RaceRuleProfile, SetupPenaltyConsequence } from '../types/raceRulesTypes';
import type {
  SetupPenaltyRecord,
  SetupRestrictionWeekendState,
} from '../types/setupRestrictionTypes';
import type { CarSetup, SetupParamKey } from '../types/setupTypes';

function appendPhase(
  phases: SetupRestrictionWeekendState['phaseHistory'],
  phase: SetupRestrictionWeekendState['phase'],
): SetupRestrictionWeekendState['phaseHistory'] {
  return phases.at(-1) === phase ? phases : [...phases, phase];
}

export function beginSetupRestrictionWeekend(input: {
  raceId: string;
  profile: RaceRuleProfile;
  qualifyingConfigurationByDriver: Record<string, CarSetup>;
  existing?: SetupRestrictionWeekendState;
}): SetupRestrictionWeekendState {
  const locked = input.profile.setupLock.mode !== 'Unrestricted';
  const phase = !locked
    ? 'QualifyingConfigurationSubmitted'
    : input.profile.setupLock.authorizedWorkWindow === 'FullSetup'
      ? 'AuthorizedWorkWindow'
      : 'QualifyingImpoundActive';
  const initialHistory: SetupRestrictionWeekendState['phaseHistory'] = ['OpenPractice'];
  const submitted = appendPhase(input.existing?.phaseHistory ?? initialHistory, 'QualifyingConfigurationSubmitted');
  return {
    raceId: input.raceId,
    profileId: input.profile.id,
    phase,
    phaseHistory: appendPhase(submitted, phase),
    qualifyingConfigurationByDriver: input.qualifyingConfigurationByDriver,
    finalRaceConfigurationByDriver: input.existing?.finalRaceConfigurationByDriver ?? {},
    penaltiesByDriver: input.existing?.penaltiesByDriver ?? {},
  };
}

export function finalizeSetupRestrictionWeekend(
  weekend: SetupRestrictionWeekendState,
  finalRaceConfigurationByDriver: Record<string, CarSetup>,
): SetupRestrictionWeekendState {
  const gridHistory = appendPhase(weekend.phaseHistory, 'PreRaceGridRestrictions');
  return {
    ...weekend,
    phase: 'RaceConfigurationFinalized',
    phaseHistory: appendPhase(gridHistory, 'RaceConfigurationFinalized'),
    finalRaceConfigurationByDriver,
  };
}

export function recordSetupPenalty(
  weekend: SetupRestrictionWeekendState,
  input: {
    driverId: string;
    consequence: SetupPenaltyConsequence;
    changedParams: SetupParamKey[];
    authorized: boolean;
    reason: string;
    profile: RaceRuleProfile;
  },
): SetupRestrictionWeekendState {
  if (input.consequence === 'None' || input.consequence === 'Blocked') return weekend;
  const record: SetupPenaltyRecord = {
    raceId: weekend.raceId,
    driverId: input.driverId,
    consequence: input.consequence,
    changedParams: input.changedParams,
    authorized: input.authorized,
    reason: input.reason,
    source: input.profile.setupLock.source,
  };
  return {
    ...weekend,
    penaltiesByDriver: { ...weekend.penaltiesByDriver, [input.driverId]: record },
  };
}

export function applySetupPenaltiesToGrid(
  qualifying: QualifyingResult[],
  penaltiesByDriver: Record<string, SetupPenaltyRecord | undefined>,
): QualifyingResult[] {
  const starters = qualifying.filter((result) => !result.dnq);
  const nonStarters = qualifying.filter((result) => result.dnq);
  const penalized = (result: QualifyingResult) => {
    const consequence = penaltiesByDriver[result.driverId]?.consequence;
    return consequence != null && consequence !== 'None' && consequence !== 'Blocked';
  };
  const ordered = [
    ...starters.filter((result) => !penalized(result)),
    ...starters.filter(penalized),
  ].map((result, index) => ({ ...result, position: index + 1 }));
  return [...ordered, ...nonStarters];
}

export function setupPenaltyDelaySeconds(
  consequence: SetupPenaltyConsequence | undefined,
): number {
  return consequence === 'RearOfFieldAndDriveThrough' ? 24 : 0;
}
