import type { GameState } from '../game/careerState';
import type { Car, RaceResult } from '../types/gameTypes';
import type {
  FailureInvestigationCase,
  FailureInvestigationLevel,
  FailureResponse,
  FailureRootCause,
  FailureTrigger,
} from '../types/phase18Types';
import { makeTransaction } from './financeEngine';
import { ensurePhase18FoundationState } from './phase18FoundationEngine';
import { createSeededRandom, deriveSeed } from './random';

export const FAILURE_INVESTIGATION_COST: Record<FailureInvestigationLevel, number> = {
  QuickReview: 100_000,
  StandardInvestigation: 350_000,
  FullTechnicalInvestigation: 800_000,
};

export const FAILURE_RESPONSE_COST: Record<FailureResponse, number> = {
  RepairProperly: 600_000,
  RushRepair: 200_000,
  ReplacePart: 900_000,
  DetunePackage: 0,
  DefendDriver: 0,
  BlameSupplier: 0,
  HideIssue: 0,
};

function clamp(value: number): number { return Math.max(0, Math.min(100, Math.round(value))); }

export function ensureFailureInvestigationState(state: GameState): GameState {
  const phase18 = ensurePhase18FoundationState(state.phase18, state);
  const failureInvestigations = phase18.failureInvestigations ?? { cases: [], repeatedIssueCounters: {}, history: [] };
  return { ...state, phase18: { ...phase18, failureInvestigations } };
}

function classifyIncident(result: RaceResult, seed: string): { trigger: FailureTrigger; cause: FailureRootCause; summary: string } | null {
  const text = result.incidents.join(' · ') || result.gapText || result.status;
  const lower = text.toLowerCase();
  if (result.status === 'DSQ' || /illegal|scrutineer|protest/.test(lower)) return { trigger: 'LegalityConcern', cause: 'LegalityPressure', summary: text };
  if (/tyre|tire|puncture|wheel rim|wheel bearing/.test(lower)) return { trigger: 'TyreFailure', cause: 'PartWear', summary: text };
  if (/pit|wheel not attached|strategy/.test(lower)) return { trigger: 'OperationsError', cause: 'OperationsError', summary: text };
  if (/crash|collision|contact|barrier|spun|spin/.test(lower)) {
    const rng = createSeededRandom(deriveSeed(seed, result.driverId, text, 'failure-cause'));
    return { trigger: 'CrashDamage', cause: rng.chance(0.58) ? 'DriverError' : 'UnluckyIncident', summary: text };
  }
  if (/engine|power unit|fuel pump|electrical|electronics|cooling|oil pressure/.test(lower)) return { trigger: 'MechanicalFailure', cause: /engine|power unit|fuel/.test(lower) ? 'SupplierIssue' : 'DesignWeakness', summary: text };
  if (/gearbox|transmission|brake|suspension|steering|driveshaft|differential|hydraulic/.test(lower)) return { trigger: 'MechanicalFailure', cause: 'PartWear', summary: text };
  if (result.status === 'DNF') return { trigger: 'MechanicalFailure', cause: 'ManufacturingFlaw', summary: text === 'DNF' ? 'The car retired before the finish.' : text };
  return null;
}

function suspectedCause(actual: FailureRootCause, seed: string, caseId: string): FailureRootCause {
  const rng = createSeededRandom(deriveSeed(seed, caseId, 'initial-suspicion'));
  if (rng.chance(0.64)) return actual;
  if (actual === 'DriverError') return 'SetupAggression';
  if (actual === 'SupplierIssue') return 'DesignWeakness';
  if (actual === 'PartWear') return 'ManufacturingFlaw';
  if (actual === 'OperationsError') return 'DriverError';
  return 'Unknown';
}

function investigationResult(state: GameState, item: FailureInvestigationCase, level: FailureInvestigationLevel, aiDecisionReason?: string): FailureInvestigationCase {
  const accuracy = level === 'QuickReview' ? 0.55 : level === 'StandardInvestigation' ? 0.82 : 1;
  const confidence = level === 'QuickReview' ? 56 : level === 'StandardInvestigation' ? 79 : 96;
  const rng = createSeededRandom(deriveSeed(state.randomSeed, item.id, level, 'investigation'));
  const finding = rng.chance(accuracy) ? item.hiddenRootCause : item.suspectedCause;
  return { ...item, investigationLevel: level, finding, confidence, status: 'FindingsReady', aiDecisionReason };
}

function aiLevel(state: GameState, teamId: string): FailureInvestigationLevel {
  const team = state.teams.find((entry) => entry.id === teamId);
  const archetype = state.aiTeamStates?.[teamId]?.archetype;
  if ((team?.budget ?? 0) < 12_000_000 || archetype === 'FinanciallyConservative' || archetype === 'SurvivalMode') return 'QuickReview';
  if (archetype === 'AggressiveSpender' || archetype === 'DevelopmentFocused') return 'FullTechnicalInvestigation';
  return 'StandardInvestigation';
}

function aiResponse(item: FailureInvestigationCase): FailureResponse {
  if (item.finding === 'DriverError') return 'DefendDriver';
  if (item.finding === 'SupplierIssue') return 'BlameSupplier';
  if (item.repeatedIssueCount > 1) return 'ReplacePart';
  return 'RepairProperly';
}

function resolvedCase(item: FailureInvestigationCase, response: FailureResponse): FailureInvestigationCase {
  const resolved = ['RepairProperly', 'ReplacePart', 'DetunePackage', 'DefendDriver', 'BlameSupplier'].includes(response);
  const risk = response === 'ReplacePart' || response === 'DefendDriver' || response === 'BlameSupplier' ? 0 : response === 'RepairProperly' ? Math.max(0, item.unresolvedRisk - 6) : response === 'DetunePackage' ? Math.max(0, item.unresolvedRisk - 4) : response === 'RushRepair' ? Math.max(1, item.unresolvedRisk - 2) : response === 'HideIssue' ? item.unresolvedRisk + 3 : Math.max(0, item.unresolvedRisk - 1);
  const consequenceSummary = response === 'HideIssue' ? 'The issue was minimized publicly, but repeat-failure risk increased.'
    : response === 'RushRepair' ? 'A quick repair limits cost but leaves residual technical risk.'
      : response === 'ReplacePart' ? 'The suspect component was replaced and the technical risk cleared.'
        : response === 'DetunePackage' ? 'Performance was reduced to protect reliability.'
          : response === 'DefendDriver' ? 'Management protected the driver while engineering addressed the finding.'
            : response === 'BlameSupplier' ? 'Supplier accountability was made public; the technical risk was reduced.'
              : 'The team completed a proper repair and reduced repeat-failure risk.';
  return { ...item, response, unresolvedRisk: risk, status: resolved && risk === 0 ? 'Resolved' : response === 'HideIssue' ? 'Minimized' : risk === 0 ? 'Resolved' : 'FindingsReady', consequenceSummary };
}

export function recordFailureInvestigations(state: GameState, raceId: string, round: number, results: RaceResult[]): GameState {
  const ensured = ensureFailureInvestigationState(state);
  const investigation = ensured.phase18!.failureInvestigations!;
  let teams = ensured.teams;
  const cases = [...investigation.cases];
  const counters = { ...investigation.repeatedIssueCounters };
  const history = [...investigation.history];
  for (const result of results) {
    const classified = classifyIncident(result, ensured.randomSeed);
    if (!classified) continue;
    const id = `failure-${ensured.seasonYear}-${raceId}-${result.driverId}`;
    if (cases.some((item) => item.id === id)) continue;
    const counterKey = `${result.teamId}:${classified.cause}`;
    counters[counterKey] = (counters[counterKey] ?? 0) + 1;
    let item: FailureInvestigationCase = {
      id, seasonYear: ensured.seasonYear, round, raceId, teamId: result.teamId, driverId: result.driverId,
      trigger: classified.trigger, incidentSummary: classified.summary, hiddenRootCause: classified.cause,
      suspectedCause: suspectedCause(classified.cause, ensured.randomSeed, id), status: 'AwaitingInvestigation', confidence: 32,
      repeatedIssueCount: counters[counterKey], unresolvedRisk: Math.min(12, 3 + counters[counterKey] * 2),
    };
    if (result.teamId !== ensured.selectedTeamId) {
      const level = aiLevel(ensured, result.teamId);
      item = investigationResult(ensured, item, level, `${level} selected from budget, principal strategy, and team circumstances.`);
      const response = aiResponse(item);
      item = resolvedCase(item, response);
      const cost = FAILURE_INVESTIGATION_COST[level] + FAILURE_RESPONSE_COST[response];
      teams = teams.map((team) => team.id === result.teamId ? { ...team, budget: Math.max(0, team.budget - cost) } : team);
    }
    cases.push(item);
    history.push(`${ensured.seasonYear} R${round}: ${result.teamId} opened ${classified.trigger} review (${item.status}).`);
  }
  return { ...ensured, teams, phase18: { ...ensured.phase18!, failureInvestigations: { cases: cases.slice(-120), repeatedIssueCounters: counters, history: history.slice(-200) } } };
}

export function investigateFailure(state: GameState, caseId: string, level: FailureInvestigationLevel): GameState {
  const ensured = ensureFailureInvestigationState(state);
  const investigation = ensured.phase18!.failureInvestigations!;
  const item = investigation.cases.find((entry) => entry.id === caseId && entry.teamId === ensured.selectedTeamId && entry.status === 'AwaitingInvestigation');
  const cost = FAILURE_INVESTIGATION_COST[level];
  const team = ensured.teams.find((entry) => entry.id === ensured.selectedTeamId);
  if (!item || (team?.budget ?? 0) < cost) return ensured;
  const updated = investigationResult(ensured, item, level);
  return {
    ...ensured,
    teams: ensured.teams.map((entry) => entry.id === ensured.selectedTeamId ? { ...entry, budget: entry.budget - cost } : entry),
    finance: [...(ensured.finance ?? []), makeTransaction(ensured.seasonYear, 'Repairs', `${level.replace(/([A-Z])/g, ' $1').trim()}: ${item.incidentSummary}`, -cost, item.round)],
    phase18: { ...ensured.phase18!, failureInvestigations: { ...investigation, cases: investigation.cases.map((entry) => entry.id === caseId ? updated : entry), history: [...investigation.history, `${item.id}: ${level} completed at ${confidenceLabel(updated.confidence)} confidence.`] } },
  };
}

export function respondToFailure(state: GameState, caseId: string, response: FailureResponse): GameState {
  const ensured = ensureFailureInvestigationState(state);
  const investigation = ensured.phase18!.failureInvestigations!;
  const item = investigation.cases.find((entry) => entry.id === caseId && entry.teamId === ensured.selectedTeamId && entry.status === 'FindingsReady');
  const cost = FAILURE_RESPONSE_COST[response];
  const team = ensured.teams.find((entry) => entry.id === ensured.selectedTeamId);
  if (!item || (team?.budget ?? 0) < cost) return ensured;
  const updated = resolvedCase(item, response);
  const reliabilityGain = response === 'ReplacePart' ? 2 : response === 'RepairProperly' ? 1 : 0;
  const drivers = ensured.drivers.map((driver) => driver.id === item.driverId && response === 'DefendDriver' ? { ...driver, morale: clamp(driver.morale + 4) } : driver);
  const commercial = ensured.commercial && response === 'HideIssue' ? { ...ensured.commercial, sponsors: ensured.commercial.sponsors.map((sponsor) => ({ ...sponsor, confidence: clamp(sponsor.confidence - 3) })) } : ensured.commercial;
  return {
    ...ensured,
    teams: ensured.teams.map((entry) => entry.id === ensured.selectedTeamId ? { ...entry, budget: entry.budget - cost } : entry),
    cars: ensured.cars.map((car) => car.teamId === ensured.selectedTeamId && reliabilityGain ? { ...car, developmentLevel: { ...car.developmentLevel, reliability: (car.developmentLevel.reliability ?? 0) + reliabilityGain } } : car),
    drivers,
    commercial,
    finance: cost ? [...(ensured.finance ?? []), makeTransaction(ensured.seasonYear, 'Repairs', `Failure response: ${response.replace(/([A-Z])/g, ' $1').trim()}`, -cost, item.round)] : ensured.finance,
    phase18: { ...ensured.phase18!, failureInvestigations: { ...investigation, cases: investigation.cases.map((entry) => entry.id === caseId ? updated : entry), history: [...investigation.history, `${item.id}: ${response} — ${updated.consequenceSummary}`] } },
  };
}

export function failureCasesForRace(state: GameState, raceId: string): FailureInvestigationCase[] {
  return (state.phase18?.failureInvestigations?.cases ?? []).filter((item) => item.raceId === raceId);
}

export function applyFailureRiskModifier(state: GameState, car: Car): Car {
  const risk = (state.phase18?.failureInvestigations?.cases ?? []).filter((item) => item.teamId === car.teamId && item.status !== 'Resolved').reduce((sum, item) => sum + item.unresolvedRisk, 0);
  if (!risk) return car;
  return { ...car, ratings: { ...car.ratings, reliability: Math.max(0, car.ratings.reliability - Math.min(10, risk * 0.45)) } };
}

export function confidenceLabel(confidence: number): string { return confidence >= 90 ? 'very high' : confidence >= 72 ? 'high' : confidence >= 50 ? 'medium' : 'low'; }
