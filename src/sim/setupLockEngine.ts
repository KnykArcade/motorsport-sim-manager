import type {
  RaceRuleProfile,
  SetupLockRuleProfile,
  SetupPenaltyConsequence,
  SetupWeekendLockState,
} from '../types/raceRulesTypes';
import type { SetupRestrictionDecision } from '../types/setupRestrictionTypes';
import type { CarSetup, SetupParamKey } from '../types/setupTypes';

// The two legacy aliases remain accepted at module boundaries so older callers
// and saves can be interpreted deterministically while the persisted state uses
// the expanded weekend lifecycle.
export type SetupLockPhase = SetupWeekendLockState | 'BeforeQualifying' | 'AfterQualifying';

export type SetupParameterRuleStatus = 'Legal' | 'ApprovalRequired' | 'PenaltyRequired';

export type SetupLockStatus = {
  active: boolean;
  phase: SetupWeekendLockState;
  rule: SetupLockRuleProfile;
  label: string;
  description: string;
  allowedParams: readonly SetupParamKey[];
  approvalRequiredParams: readonly SetupParamKey[];
  violationConsequence: SetupPenaltyConsequence;
  sourceLabel: string;
  sourceUrl: string;
  sourceConfidence: SetupLockRuleProfile['source']['confidence'];
  triggerLabel: string;
};

export type SetupChangeValidation = {
  allowed: boolean;
  classification: SetupParameterRuleStatus;
  changedParams: SetupParamKey[];
  blockedParams: SetupParamKey[];
  approvalParams: SetupParamKey[];
  legalSetup?: CarSetup;
  reason?: string;
  consequence?: SetupPenaltyConsequence;
  authorized?: boolean;
};

export type SetupValidationOptions = {
  decision?: SetupRestrictionDecision;
  authorizationAvailable?: boolean;
  weatherChanged?: boolean;
};

export const SETUP_PARAM_KEYS: SetupParamKey[] = [
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

function normalizedPhase(phase: SetupLockPhase, profile?: RaceRuleProfile): SetupWeekendLockState {
  if (phase === 'BeforeQualifying') return 'OpenPractice';
  if (phase === 'AfterQualifying') {
    return profile?.setupLock.authorizedWorkWindow === 'FullSetup'
      ? 'AuthorizedWorkWindow'
      : 'QualifyingImpoundActive';
  }
  return phase;
}

export function setupLockPhase(
  hasQualifyingResults: boolean,
  profile?: RaceRuleProfile,
): SetupWeekendLockState {
  if (!hasQualifyingResults) return 'OpenPractice';
  if (profile?.setupLock.authorizedWorkWindow === 'FullSetup') return 'AuthorizedWorkWindow';
  return 'QualifyingImpoundActive';
}

export function setupLockStatus(profile: RaceRuleProfile, phase: SetupLockPhase): SetupLockStatus {
  const resolvedPhase = normalizedPhase(phase, profile);
  const unrestricted = profile.setupLock.mode === 'Unrestricted' || profile.setupLock.trigger === 'None';
  const fullWorkWindow = resolvedPhase === 'AuthorizedWorkWindow'
    && profile.setupLock.authorizedWorkWindow === 'FullSetup';
  const active = !unrestricted
    && !fullWorkWindow
    && resolvedPhase !== 'OpenPractice'
    && resolvedPhase !== 'QualifyingConfigurationSubmitted';
  const allowedParams = resolvedPhase === 'PreRaceGridRestrictions'
    || resolvedPhase === 'RaceConfigurationFinalized'
    ? profile.setupLock.allowedPreRaceGridChanges
    : profile.setupLock.allowedPostQualifyingChanges;
  return {
    active,
    phase: resolvedPhase,
    rule: profile.setupLock,
    label: profile.setupLock.label,
    description: fullWorkWindow
      ? `${profile.setupLock.description} The authorized work window is currently open.`
      : active
        ? profile.setupLock.description
        : 'Setup changes are open for the current weekend phase.',
    allowedParams: fullWorkWindow ? SETUP_PARAM_KEYS : allowedParams,
    approvalRequiredParams: profile.setupLock.approvalRequiredChanges,
    violationConsequence: profile.setupLock.violationConsequence,
    sourceLabel: profile.setupLock.source.title,
    sourceUrl: profile.setupLock.source.url,
    sourceConfidence: profile.setupLock.source.confidence,
    triggerLabel: profile.setupLock.trigger === 'FirstQualifyingRun'
      ? 'First pit-lane exit in qualifying'
      : profile.setupLock.trigger === 'QualifyingTechnicalInspection'
        ? 'Qualifying technical-inspection line'
        : profile.setupLock.trigger === 'AfterQualifying'
          ? 'Qualifying completion'
          : 'No setup lock',
  };
}

export function changedSetupParams(previous: CarSetup, next: CarSetup): SetupParamKey[] {
  return SETUP_PARAM_KEYS.filter((key) => Math.abs((previous[key] ?? 0) - (next[key] ?? 0)) > 0.001);
}

export function setupParameterRuleStatus(
  status: SetupLockStatus,
  key: SetupParamKey,
  weatherChanged = false,
): SetupParameterRuleStatus {
  if (!status.active || status.allowedParams.includes(key)) return 'Legal';
  if (weatherChanged && status.rule.weatherExceptionChanges.includes(key)) return 'Legal';
  if (status.approvalRequiredParams.includes(key)) return 'ApprovalRequired';
  return 'PenaltyRequired';
}

function legalSubset(
  previous: CarSetup,
  next: CarSetup,
  legalParams: ReadonlySet<SetupParamKey>,
  maxDelta: number | null,
): CarSetup {
  const setup = { ...previous };
  for (const key of legalParams) {
    const requested = next[key];
    setup[key] = maxDelta == null
      ? requested
      : Math.max(previous[key] - maxDelta, Math.min(previous[key] + maxDelta, requested));
  }
  return setup;
}

export function validateSetupChange(
  profile: RaceRuleProfile,
  phase: SetupLockPhase,
  previous: CarSetup | undefined,
  next: CarSetup,
  options: SetupValidationOptions = {},
): SetupChangeValidation {
  if (!previous) {
    return { allowed: true, classification: 'Legal', changedParams: [], blockedParams: [], approvalParams: [] };
  }

  const changedParams = changedSetupParams(previous, next);
  if (changedParams.length === 0) {
    return { allowed: true, classification: 'Legal', changedParams, blockedParams: [], approvalParams: [] };
  }

  const status = setupLockStatus(profile, phase);
  if (!status.active) {
    return { allowed: true, classification: 'Legal', changedParams, blockedParams: [], approvalParams: [] };
  }

  const legalParams = new Set(status.allowedParams);
  if (options.weatherChanged) {
    status.rule.weatherExceptionChanges.forEach((key) => legalParams.add(key));
  }
  const maxDelta = status.rule.maxPostQualifyingDelta;
  const oversized = maxDelta == null
    ? []
    : changedParams.filter((key) => Math.abs(previous[key] - next[key]) > maxDelta + 0.001);
  const approvalParams = changedParams.filter((key) =>
    !legalParams.has(key) && status.approvalRequiredParams.includes(key),
  );
  const blockedParams = [...new Set(changedParams.filter((key) => !legalParams.has(key)).concat(oversized))];
  const legalSetup = legalSubset(previous, next, legalParams, maxDelta);

  if (blockedParams.length === 0) {
    return {
      allowed: true,
      classification: 'Legal',
      changedParams,
      blockedParams: [],
      approvalParams: [],
      legalSetup: next,
    };
  }

  if (options.decision === 'RequestAuthorizedChange'
    && options.authorizationAvailable
    && blockedParams.every((key) => approvalParams.includes(key))) {
    return {
      allowed: true,
      classification: 'ApprovalRequired',
      changedParams,
      blockedParams,
      approvalParams,
      legalSetup: next,
      authorized: true,
      consequence: status.rule.authorizedChangeConsequence,
      reason: 'Officials authorized the safety or damaged-part change under the applicable event procedure.',
    };
  }

  if (options.decision === 'AcceptPenalty') {
    return {
      allowed: true,
      classification: approvalParams.length === blockedParams.length ? 'ApprovalRequired' : 'PenaltyRequired',
      changedParams,
      blockedParams,
      approvalParams,
      legalSetup: next,
      authorized: false,
      consequence: status.rule.violationConsequence,
      reason: 'The requested restricted configuration will be used and the stated sporting penalty accepted.',
    };
  }

  return {
    allowed: false,
    classification: approvalParams.length === blockedParams.length ? 'ApprovalRequired' : 'PenaltyRequired',
    changedParams,
    blockedParams,
    approvalParams,
    legalSetup,
    consequence: status.rule.violationConsequence,
    reason: approvalParams.length === blockedParams.length
      ? 'These changes require official approval for a safety or damaged-part exception.'
      : `${status.label} restricts the requested parameters. Continue legally, request an eligible exception, or accept the stated penalty.`,
  };
}
