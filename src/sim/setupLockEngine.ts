import type { RaceRuleProfile, SetupLockRuleProfile } from '../types/raceRulesTypes';
import type { CarSetup, SetupParamKey } from '../types/setupTypes';

export type SetupLockPhase = 'BeforeQualifying' | 'AfterQualifying';

export type SetupLockStatus = {
  active: boolean;
  rule: SetupLockRuleProfile;
  label: string;
  description: string;
  allowedParams: readonly SetupParamKey[];
};

export type SetupChangeValidation = {
  allowed: boolean;
  changedParams: SetupParamKey[];
  blockedParams: SetupParamKey[];
  reason?: string;
  consequence?: SetupLockRuleProfile['violationConsequence'];
};

const SETUP_PARAM_KEYS: SetupParamKey[] = [
  'frontWing',
  'rearWing',
  'suspensionStiffness',
  'rideHeight',
  'gearing',
  'brakeBias',
  'brakeCooling',
  'differential',
  'engineCooling',
  'tyreUsage',
];

export function setupLockPhase(hasQualifyingResults: boolean): SetupLockPhase {
  return hasQualifyingResults ? 'AfterQualifying' : 'BeforeQualifying';
}

export function setupLockStatus(profile: RaceRuleProfile, phase: SetupLockPhase): SetupLockStatus {
  const active = profile.setupLock.trigger === 'AfterQualifying' && phase === 'AfterQualifying' && profile.setupLock.mode !== 'Unrestricted';
  return {
    active,
    rule: profile.setupLock,
    label: profile.setupLock.label,
    description: active
      ? profile.setupLock.description
      : 'Setup changes are open for the current weekend phase.',
    allowedParams: profile.setupLock.allowedPostQualifyingChanges,
  };
}

export function changedSetupParams(previous: CarSetup, next: CarSetup): SetupParamKey[] {
  return SETUP_PARAM_KEYS.filter((key) => Math.abs((previous[key] ?? 0) - (next[key] ?? 0)) > 0.001);
}

export function validateSetupChange(
  profile: RaceRuleProfile,
  phase: SetupLockPhase,
  previous: CarSetup | undefined,
  next: CarSetup,
): SetupChangeValidation {
  if (!previous) return { allowed: true, changedParams: [], blockedParams: [] };

  const changedParams = changedSetupParams(previous, next);
  if (changedParams.length === 0) return { allowed: true, changedParams, blockedParams: [] };

  const status = setupLockStatus(profile, phase);
  if (!status.active) return { allowed: true, changedParams, blockedParams: [] };

  const allowed = new Set(status.allowedParams);
  const blockedParams = changedParams.filter((key) => !allowed.has(key));
  const maxDelta = status.rule.maxPostQualifyingDelta;
  const oversizedParams =
    maxDelta == null
      ? []
      : changedParams.filter((key) => Math.abs(previous[key] - next[key]) > maxDelta + 0.001);
  const allBlockedParams = [...new Set([...blockedParams, ...oversizedParams])];

  if (allBlockedParams.length > 0) {
    return {
      allowed: false,
      changedParams,
      blockedParams: allBlockedParams,
      consequence: status.rule.violationConsequence,
      reason:
        status.rule.mode === 'ParcFerme'
          ? 'Parc ferme is active after qualifying; only minor permitted setup changes are allowed.'
          : status.rule.mode === 'Impound'
            ? 'Impound rules are active after qualifying; the race setup is effectively locked.'
            : 'Post-qualifying setup restrictions are active; major setup changes are not allowed.',
    };
  }

  return { allowed: true, changedParams, blockedParams: [] };
}
