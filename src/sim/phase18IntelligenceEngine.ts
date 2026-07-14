import type { GameState } from '../game/careerState';
import type { NewsItem } from '../types/gameTypes';
import type { IntelligenceAction, IntelligenceReport } from '../types/phase18Types';
import { createSeededRandom, deriveSeed } from './random';
import { ensurePhase18FoundationState } from './phase18FoundationEngine';
import { makeTransaction } from './financeEngine';

export const INTELLIGENCE_INVESTIGATION_COST = 350_000;

function clamp(value: number): number { return Math.max(0, Math.min(100, Math.round(value))); }

function currentRound(state: GameState): number {
  return state.calendar[state.currentRaceIndex]?.round ?? state.careerPhase?.currentRound ?? 0;
}

function reached(state: GameState, season?: number, round?: number): boolean {
  if (season == null) return false;
  return state.seasonYear > season || state.seasonYear === season && currentRound(state) >= (round ?? 0);
}

function assessment(confidence: number): IntelligenceReport['assessment'] {
  if (confidence >= 78) return 'Likely';
  if (confidence >= 48) return 'Plausible';
  return 'Unverified';
}

export function intelligenceConfidenceLabel(confidence: number): string {
  if (confidence >= 85) return 'Very High';
  if (confidence >= 68) return 'High';
  if (confidence >= 45) return 'Medium';
  if (confidence >= 25) return 'Low';
  return 'Very Low';
}

function reveal(report: IntelligenceReport, status: 'Resolved' | 'Expired' = 'Resolved'): IntelligenceReport {
  const truth = report.hiddenTruth ?? 'Mixed';
  const assessmentValue = truth === 'True' ? 'Confirmed' : truth === 'False' ? 'Disproven' : 'Plausible';
  const outcome = truth === 'True'
    ? 'Subsequent evidence confirmed the central claim.'
    : truth === 'False'
      ? 'The report did not hold up; the original claim was false or paddock noise.'
      : 'The report contained a real signal, but important details were incomplete or misleading.';
  return { ...report, status, assessment: assessmentValue, confidence: truth === 'Mixed' ? Math.max(report.confidence, 72) : 100, revealedOutcome: outcome };
}

function expireReports(state: GameState, reports: IntelligenceReport[]): IntelligenceReport[] {
  return reports.map((report) => (report.status ?? 'Active') !== 'Active' || !reached(state, report.expiresSeasonYear, report.expiresRound)
    ? report
    : reveal(report, 'Expired'));
}

function capability(state: GameState): number {
  const org = state.teamOrgRatings?.[state.selectedTeamId];
  const network = (state.scouting?.networkAccuracy ?? 0.15) * 100;
  return clamp(network * 0.5 + (org?.operations ?? 50) * 0.2 + (org?.staffQuality ?? 50) * 0.15 + (org?.mediaReach ?? 50) * 0.15);
}

function rivalTeams(state: GameState) { return state.teams.filter((team) => team.id !== state.selectedTeamId); }

function aiResponses(state: GameState, report: IntelligenceReport): NonNullable<IntelligenceReport['aiResponses']> {
  const candidates = rivalTeams(state).filter((team) => team.id !== report.targetTeamId).slice(0, 2);
  return candidates.map((team) => {
    const identity = state.phase18?.aiPrincipalIdentities[team.id]?.dominantIdentity;
    const action = report.category === 'Politics' || identity === 'PoliticalOperator'
      ? 'Requested a private rules briefing'
      : report.category === 'Development' || report.category === 'Performance'
        ? 'Assigned analysts to benchmark the claim'
        : report.category === 'DriverMarket'
          ? 'Asked its driver-management group to monitor availability'
          : 'Added the rumor to its monitoring file';
    return { teamId: team.id, action, reason: `${identity ?? 'Balanced leadership'} and ${report.gameplayRelevance?.toLowerCase() ?? 'medium'} relevance.` };
  });
}

function baseReport(state: GameState, index: number): IntelligenceReport {
  const round = currentRound(state);
  const rng = createSeededRandom(deriveSeed(state.randomSeed, state.seasonYear, round, 'intelligence', index));
  const rivals = rivalTeams(state);
  const target = rivals.length > 0 ? rivals[rng.int(0, rivals.length - 1)] : state.teams[0];
  const cap = capability(state);
  const noise = rng.int(-18, 12);
  const confidence = clamp(24 + cap * 0.55 + noise);
  const reliability = clamp(30 + cap * 0.48 + rng.int(-12, 15));
  const misleading = rng.chance(Math.max(0.08, 0.34 - cap / 300));
  const mixed = !misleading && rng.chance(0.25);
  let truth: IntelligenceReport['hiddenTruth'] = misleading ? 'False' : mixed ? 'Mixed' : 'True';
  const expiresThisSeason = round + 3 <= state.calendar.length;
  const expiryRound = expiresThisSeason ? round + 3 : 1;
  const common = {
    id: `intel-${state.seasonYear}-${round}-${index}`,
    targetTeamId: target?.id,
    source: rng.pick(['Scouting', 'StaffContact', 'Media', 'PaddockRumor', 'Supplier', 'PoliticalContact'] as const),
    confidence, reliability, assessment: assessment(confidence), status: 'Active' as const,
    hiddenTruth: truth, detailLevel: confidence >= 70 ? 'Detailed' as const : confidence >= 42 ? 'Briefing' as const : 'Headline' as const,
    visibility: rng.chance(0.18) ? 'Leaked' as const : rng.chance(0.25) ? 'Public' as const : 'Private' as const,
    possibleActions: ['Investigate', 'AskAdvisor', 'Monitor', 'Ignore'] as IntelligenceAction[],
    actionHistory: [], discoveredSeasonYear: state.seasonYear, discoveredRound: round,
    expiresSeasonYear: expiresThisSeason ? state.seasonYear : state.seasonYear + 1, expiresRound: expiryRound, aiRelevant: true,
  };
  const mode = (round + index) % 5;
  let report: IntelligenceReport;
  if (mode === 0) {
    const research = target ? state.teamResearch?.[target.id] : undefined;
    const branch = research?.activeProjects[0]?.branchId ?? research?.focus?.branchId ?? rng.pick(['aero', 'engine', 'reliability', 'operations']);
    report = { ...common, subjectType: 'Research', subjectId: research?.activeProjects[0]?.id ?? `${target?.id}-research`, category: 'Development', gameplayRelevance: 'High', title: `${target?.name ?? 'Rival'} development direction`, summary: `Paddock sources believe ${target?.name ?? 'the rival'} is concentrating resources on ${branch}. The timing and scale remain uncertain.` };
  } else if (mode === 1) {
    const car = state.cars.find((entry) => entry.teamId === target?.id);
    report = { ...common, subjectType: 'Part', subjectId: car?.id ?? `${target?.id}-car`, category: 'Reliability', gameplayRelevance: 'High', title: `${target?.name ?? 'Rival'} reliability concern`, summary: `${target?.name ?? 'The rival'} may be carrying a hidden reliability weakness despite its public confidence.` };
  } else if (mode === 2) {
    const driver = state.drivers.find((entry) => entry.teamId === target?.id);
    report = { ...common, subjectType: 'Driver', subjectId: driver?.id ?? `${target?.id}-driver`, category: 'DriverMarket', gameplayRelevance: 'Medium', title: `${driver?.name ?? 'Rival driver'} market watch`, summary: `An agent contact suggests ${driver?.name ?? 'a rival driver'} may listen to approaches if their current situation deteriorates.` };
  } else if (mode === 3) {
    const financial = target ? state.aiTeamStates?.[target.id]?.financialHealth : undefined;
    report = { ...common, subjectType: 'Team', subjectId: target?.id ?? 'rival-team', category: 'Finance', gameplayRelevance: financial === 'AtRisk' || financial === 'Critical' ? 'Critical' : 'Medium', title: `${target?.name ?? 'Rival'} financial pressure`, summary: `Commercial contacts report that ${target?.name ?? 'the rival'} may be reviewing spending and supplier commitments.` };
  } else {
    const proposal = state.regulationProposals?.[0];
    report = { ...common, subjectType: 'Politics', subjectId: proposal?.id ?? `politics-${state.seasonYear}`, category: 'Politics', gameplayRelevance: 'High', title: proposal ? `Vote momentum: ${proposal.title}` : 'Rules committee movement', summary: proposal ? `Series contacts believe support around “${proposal.title}” is shifting, but several teams remain uncommitted.` : 'Series contacts suggest a future technical discussion is gathering momentum behind closed doors.' };
  }
  if (!misleading && !mixed) {
    if (mode === 0) {
      const research = target ? state.teamResearch?.[target.id] : undefined;
      truth = research?.activeProjects.length || research?.focus ? 'True' : 'False';
    } else if (mode === 1) {
      const reliability = state.cars.find((entry) => entry.teamId === target?.id)?.ratings.reliability ?? 65;
      truth = reliability < 58 ? 'True' : reliability > 74 ? 'False' : 'Mixed';
    } else if (mode === 2) {
      const driver = state.drivers.find((entry) => entry.teamId === target?.id);
      const rel = driver ? state.driverRelationships?.[driver.id] : undefined;
      truth = (driver?.contractYearsRemaining ?? 2) <= 1 || (rel?.frustration ?? 0) >= 60 ? 'True' : 'False';
    } else if (mode === 3) {
      const financial = target ? state.aiTeamStates?.[target.id]?.financialHealth : undefined;
      truth = financial === 'AtRisk' || financial === 'Critical' ? 'True' : financial === 'Tight' ? 'Mixed' : 'False';
    } else {
      truth = state.regulationProposals?.length ? 'Mixed' : 'False';
    }
  }
  report = { ...report, hiddenTruth: truth };
  return { ...report, aiKnownTeamIds: report.visibility === 'Private' ? [] : rivalTeams(state).slice(0, 2).map((team) => team.id), aiResponses: report.visibility === 'Private' ? [] : aiResponses(state, report) };
}

export function generatePaddockIntelligence(state: GameState): GameState {
  const phase18 = ensurePhase18FoundationState(state.phase18, state);
  const expired = expireReports(state, phase18.intelligenceReports);
  const round = currentRound(state);
  const prefix = `intel-${state.seasonYear}-${round}-`;
  if (expired.some((report) => report.id.startsWith(prefix))) return { ...state, phase18: { ...phase18, intelligenceReports: expired } };
  const fresh = [baseReport(state, 0), baseReport(state, 1)];
  return { ...state, phase18: { ...phase18, intelligenceReports: [...expired, ...fresh] } };
}

export function resolveIntelligenceAction(state: GameState, reportId: string, action: IntelligenceAction): GameState {
  const phase18 = ensurePhase18FoundationState(state.phase18, state);
  const report = phase18.intelligenceReports.find((entry) => entry.id === reportId);
  if (!report || (report.status ?? 'Active') !== 'Active') return state;
  const round = currentRound(state);
  const team = state.teams.find((entry) => entry.id === state.selectedTeamId);
  if (action === 'Investigate' && (team?.budget ?? 0) < INTELLIGENCE_INVESTIGATION_COST) return state;
  let outcome: string;
  let updated: IntelligenceReport;
  if (action === 'Investigate') {
    const nextConfidence = clamp(report.confidence + 24 + capability(state) * 0.08);
    updated = { ...report, confidence: nextConfidence, reliability: clamp(report.reliability + 12), detailLevel: 'Detailed', assessment: assessment(nextConfidence) };
    if (nextConfidence >= 88) updated = reveal(updated);
    outcome = updated.status === 'Resolved' ? updated.revealedOutcome! : 'The investigation improved confidence, but the claim is not yet proven.';
  } else if (action === 'AskAdvisor') {
    const nextConfidence = clamp(report.confidence + 8);
    updated = { ...report, confidence: nextConfidence, assessment: assessment(nextConfidence) };
    outcome = `The advisor council recommends treating this as ${updated.assessment.toLowerCase()} intelligence and limiting irreversible action.`;
  } else if (action === 'Monitor') {
    updated = { ...report, confidence: clamp(report.confidence + 3) };
    outcome = 'The report remains active and will be checked against future paddock evidence.';
  } else {
    updated = { ...report, status: 'Dismissed', assessment: 'Unverified' };
    outcome = 'The report was dismissed without committing team resources.';
  }
  updated = { ...updated, actionTaken: action, actionHistory: [...(updated.actionHistory ?? []), { seasonYear: state.seasonYear, round, action, outcome }] };
  const reports = phase18.intelligenceReports.map((entry) => entry.id === reportId ? updated : entry);
  const teams = action === 'Investigate' ? state.teams.map((entry) => entry.id === state.selectedTeamId ? { ...entry, budget: entry.budget - INTELLIGENCE_INVESTIGATION_COST } : entry) : state.teams;
  const finance = action === 'Investigate' ? [...(state.finance ?? []), makeTransaction(state.seasonYear, 'Scouting', `Investigated intelligence: ${report.title}`, -INTELLIGENCE_INVESTIGATION_COST)] : state.finance;
  const newsItem: NewsItem = { id: `news-intelligence-${report.id}-${action}`, round, headline: `Intelligence update: ${report.title}`, body: outcome, timestamp: new Date().toISOString(), category: 'general', priority: updated.status === 'Resolved' ? 'high' : 'normal', careerPhase: state.careerPhase?.currentPhase, teamId: state.selectedTeamId };
  return { ...state, teams, finance, news: [newsItem, ...state.news].slice(0, 80), phase18: { ...phase18, intelligenceReports: reports } };
}

export function rolloverIntelligenceReports(state: GameState): GameState {
  if (!state.phase18) return state;
  return { ...state, phase18: { ...state.phase18, intelligenceReports: state.phase18.intelligenceReports.map((report) => (report.status ?? 'Active') === 'Active' ? reveal(report, 'Expired') : report) } };
}
