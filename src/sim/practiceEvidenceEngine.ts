import type {
  PracticeCondition,
  PracticeSetupRevision,
  WeekendKnowledge,
} from '../types/practiceTypes';
import type { CarSetup, SetupParamKey } from '../types/setupTypes';

const SETUP_KEYS = [
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
] as const satisfies readonly SetupParamKey[];

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function r2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function setupChangeMagnitude(previous: CarSetup, current: CarSetup): number {
  const total = SETUP_KEYS.reduce(
    (sum, key) => sum + Math.abs(previous[key] - current[key]) / 9,
    0,
  );
  return r2(clamp01(total / SETUP_KEYS.length));
}

export function setupsMatch(previous: CarSetup, current: CarSetup): boolean {
  return setupChangeMagnitude(previous, current) < 0.01;
}

// Small changes preserve most evidence; major changes deliberately make prior
// practice only a partial guide instead of granting perfect transferable data.
export function setupEvidenceRelevance(changeMagnitude: number): number {
  const change = clamp01(changeMagnitude);
  if (change < 0.01) return 1;
  if (change <= 0.08) return 0.9;
  if (change <= 0.2) return 0.7;
  if (change <= 0.35) return 0.48;
  return r2(Math.max(0.2, 1 - change * 1.65));
}

export function conditionEvidenceRelevance(
  previous: PracticeCondition | undefined,
  current: PracticeCondition,
): number {
  if (!previous) return 1;
  if (previous.wet !== current.wet) return 0.45;
  const gripShift = Math.abs(previous.gripLevel - current.gripLevel);
  if (gripShift >= 0.2) return 0.62;
  if (previous.label !== current.label || gripShift >= 0.08) return 0.82;
  return 1;
}

export function evidenceConfidence(quality: number): 'Low' | 'Medium' | 'High' {
  if (quality >= 0.72) return 'High';
  if (quality >= 0.42) return 'Medium';
  return 'Low';
}

// Evidence decay is driver-specific. Setup changes hit setup knowledge hardest,
// tyre knowledge partially, and reliability knowledge only lightly. A weather
// shift weakens all three comparisons.
export function applyEvidenceRelevance(
  prior: WeekendKnowledge,
  driverId: string,
  setupRelevance: number,
  conditionRelevance: number,
): WeekendKnowledge {
  const next: WeekendKnowledge = {
    raceId: prior.raceId,
    setupKnowledge: { ...prior.setupKnowledge },
    tireKnowledge: { ...prior.tireKnowledge },
    reliabilityKnowledge: { ...prior.reliabilityKnowledge },
    confidenceDelta: { ...prior.confidenceDelta },
  };
  const setupFactor = clamp01(setupRelevance);
  const conditionFactor = clamp01(conditionRelevance);
  next.setupKnowledge[driverId] = r2((prior.setupKnowledge[driverId] ?? 0) * setupFactor * conditionFactor);
  next.tireKnowledge[driverId] = r2((prior.tireKnowledge[driverId] ?? 0) * (0.72 + setupFactor * 0.28) * conditionFactor);
  next.reliabilityKnowledge[driverId] = r2((prior.reliabilityKnowledge[driverId] ?? 0) * (0.88 + setupFactor * 0.12) * (0.82 + conditionFactor * 0.18));
  return next;
}

export function resolvePracticeRevision(input: {
  driverId: string;
  sessionId: string;
  setup: CarSetup;
  revisions: PracticeSetupRevision[] | undefined;
}): { revision: PracticeSetupRevision; created: boolean; previous?: PracticeSetupRevision } {
  const revisions = input.revisions ?? [];
  const previous = revisions.at(-1);
  if (previous && setupsMatch(previous.setup, input.setup)) {
    return { revision: previous, created: false, previous };
  }
  const changeMagnitude = previous ? setupChangeMagnitude(previous.setup, input.setup) : 0;
  const sequence = (previous?.sequence ?? 0) + 1;
  return {
    revision: {
      id: `${input.driverId}-setup-r${sequence}`,
      driverId: input.driverId,
      sequence,
      setup: { ...input.setup },
      firstTestedSessionId: input.sessionId,
      changeMagnitude,
      evidenceRelevance: previous ? setupEvidenceRelevance(changeMagnitude) : 1,
    },
    created: true,
    previous,
  };
}

export function setupVerificationStatus(
  current: CarSetup,
  revisions: PracticeSetupRevision[] | undefined,
): 'Untested' | 'Verified' | 'No evidence' {
  const latest = revisions?.at(-1);
  if (!latest) return 'No evidence';
  return setupsMatch(latest.setup, current) ? 'Verified' : 'Untested';
}
