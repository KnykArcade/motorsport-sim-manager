import type { GameState } from '../game/careerState';
import type { Driver, NewsItem } from '../types/gameTypes';
import type { DriverPromise, PromiseType } from '../types/relationshipTypes';
import type {
  ContractBreachResponse,
  ContractClause,
  ContractClauseType,
  ContractPartyType,
} from '../types/phase18Types';
import { ensurePhase18FoundationState } from './phase18FoundationEngine';
import { makeTransaction } from './financeEngine';
import { applyPromiseResolution, makePromise } from './driverConfidenceEngine';

export const DRIVER_NEGOTIATION_CLAUSES: readonly ContractClauseType[] = [
  'EqualTreatment',
  'NumberOneStatus',
  'SeatGuarantee',
  'PerformanceExit',
];

const LABELS: Record<ContractClauseType, string> = {
  NumberOneStatus: 'Number-One Status', EqualTreatment: 'Equal Treatment',
  PerformanceExit: 'Performance Exit', ChampionshipExit: 'Championship Release',
  SeatGuarantee: 'Seat Guarantee', FacilityInvestment: 'Facility Investment',
  ResearchDirection: 'Development Direction', ResearchSuccessBonus: 'R&D Success Bonus',
  SalaryEscalator: 'Salary Escalator', ReleaseFee: 'Release Fee',
  SponsorObligation: 'Sponsor Obligation', MediaObligation: 'Media Obligation',
};

export function contractClauseLabel(type: ContractClauseType): string { return LABELS[type]; }

function clamp(n: number): number { return Math.max(0, Math.min(100, Math.round(n))); }

function specification(type: ContractClauseType, driver?: Driver) {
  const name = driver?.name ?? 'The contract holder';
  switch (type) {
    case 'NumberOneStatus': return { description: `${name} must receive priority when the team chooses between its drivers.`, trigger: 'Breaches when a team order disadvantages this driver.', consequence: 'Major trust and morale loss; renewal and exit risk rise.', cost: 1_500_000, media: 'High' as const };
    case 'EqualTreatment': return { description: `${name} must receive fair treatment alongside their teammate.`, trigger: 'Breaches when a team order explicitly disadvantages this driver.', consequence: 'Trust falls and frustration rises.', cost: 900_000, media: 'Medium' as const };
    case 'SeatGuarantee': return { description: `${name} is guaranteed their current race or reserve role.`, trigger: 'Breaches if the driver is replaced or released before the due season.', consequence: 'Severe trust loss and compensation exposure.', cost: 1_250_000, media: 'High' as const };
    case 'PerformanceExit': return { description: `${name} may leave if the team does not meet its performance target.`, trigger: 'Triggers at season end if the team misses the constructors target.', consequence: 'Driver can seek an exit without being treated as disloyal.', cost: 2_000_000, media: 'Medium' as const };
    case 'FacilityInvestment': return { description: 'The team commits to maintaining a competitive technical facility programme.', trigger: 'Reviewed at season end against the agreed facility target.', consequence: 'Staff trust and technical department morale fall.', cost: 750_000, media: 'Low' as const };
    case 'ResearchDirection': return { description: 'The staff member is promised influence over the development direction.', trigger: 'Reviewed through the team research programme.', consequence: 'Staff confidence in management falls.', cost: 500_000, media: 'Low' as const };
    case 'ResearchSuccessBonus': return { description: 'A bonus is due when the team completes a successful development project.', trigger: 'Satisfied by a completed development project.', consequence: 'Unpaid success damages staff trust.', cost: 600_000, media: 'Low' as const };
    default: return { description: `${LABELS[type]} forms part of this contract.`, trigger: 'Reviewed when the relevant contract condition occurs.', consequence: 'Trust and future negotiation leverage are affected.', cost: 500_000, media: 'Medium' as const };
  }
}

function clauseId(teamId: string, partyId: string, type: ContractClauseType, season: number): string {
  return `clause-${teamId}-${partyId}-${type}-${season}`;
}

function buildClause(state: GameState, partyType: ContractPartyType, partyId: string, type: ContractClauseType): ContractClause {
  const driver = partyType === 'Driver' ? state.drivers.find((d) => d.id === partyId) : undefined;
  const spec = specification(type, driver);
  const teamId = partyType === 'Driver' ? driver?.teamId ?? state.selectedTeamId : state.selectedTeamId;
  return {
    id: clauseId(teamId, partyId, type, state.seasonYear),
    contractId: `contract-${partyId}`,
    teamId,
    partyType, partyId, clauseType: type, title: LABELS[type], description: spec.description,
    status: 'Active', risk: 'Secure', triggerDescription: spec.trigger,
    breachConsequence: spec.consequence, renegotiationCost: spec.cost,
    mediaRisk: spec.media, visibleToPlayer: true, aiRelevant: true,
    startSeasonYear: state.seasonYear, dueSeasonYear: state.seasonYear,
  };
}

function defaultDriverClause(state: GameState, driver: Driver): ContractClauseType {
  const rel = state.driverRelationships?.[driver.id];
  if (rel?.numberOneExpectation || rel?.wants.includes('number_one_status')) return 'NumberOneStatus';
  if (driver.contractType === 'third' || driver.contractType === 'reserve' || driver.contractType === 'test') return 'SeatGuarantee';
  return 'EqualTreatment';
}

export function ensureContractClauses(state: GameState): GameState {
  const phase18 = ensurePhase18FoundationState(state.phase18, state);
  const clauses = phase18.contractClauses.map((clause) =>
    clause.status === 'Active' && clause.startSeasonYear < state.seasonYear
      ? { ...clause, status: 'Expired' as const, resolutionNote: clause.resolutionNote ?? 'Contract clause term concluded at season rollover.' }
      : clause,
  );
  const hasCurrent = (partyId: string) => clauses.some((c) =>
    c.partyId === partyId && c.startSeasonYear === state.seasonYear && c.status !== 'Expired',
  );
  for (const driver of state.drivers) {
    if (!hasCurrent(driver.id)) clauses.push(buildClause(state, 'Driver', driver.id, defaultDriverClause(state, driver)));
  }
  for (const staff of state.staff ?? []) {
    if (!hasCurrent(staff.id)) {
      const type: ContractClauseType = staff.role === 'Technical Director' ? 'FacilityInvestment' : 'ResearchDirection';
      clauses.push(buildClause(state, 'Staff', staff.id, type));
    }
  }
  return { ...state, phase18: { ...phase18, contractClauses: clauses } };
}

export function negotiationClauseScore(state: GameState, driver: Driver, type?: ContractClauseType): number {
  if (!type) return 0;
  const rel = state.driverRelationships?.[driver.id];
  if (type === 'NumberOneStatus') return rel?.wants.includes('number_one_status') || rel?.numberOneExpectation ? 16 : 5;
  if (type === 'EqualTreatment') return rel?.wants.includes('equal_treatment') ? 14 : 7;
  if (type === 'SeatGuarantee') return rel?.wants.includes('race_seat_security') || driver.contractType !== 'seat' ? 15 : 6;
  if (type === 'PerformanceExit') return rel?.personalityTraits.includes('Ambitious') || driver.ratings.overall >= 82 ? 13 : 4;
  return 0;
}

export function applyNegotiatedDriverClause(state: GameState, driverId: string, type?: ContractClauseType): GameState {
  if (!type) return ensureContractClauses(state);
  const ensured = ensureContractClauses(state);
  const phase18 = ensured.phase18!;
  const clauses = phase18.contractClauses.map((c) =>
    c.partyId === driverId && c.status === 'Active' && DRIVER_NEGOTIATION_CLAUSES.includes(c.clauseType)
      ? { ...c, status: 'Expired' as const, resolutionNote: 'Replaced during contract renegotiation.' }
      : c,
  );
  const negotiated = buildClause(ensured, 'Driver', driverId, type);
  clauses.push({ ...negotiated, id: `${negotiated.id}-renegotiated-${clauses.length}` });
  return { ...ensured, phase18: { ...phase18, contractClauses: clauses } };
}

const PROMISE_CLAUSE: Partial<Record<PromiseType, ContractClauseType>> = {
  number_one_status: 'NumberOneStatus', equal_treatment: 'EqualTreatment',
  development_priority: 'ResearchDirection', priority_upgrades: 'ResearchDirection',
  reserve_practice_time: 'SeatGuarantee', no_midseason_replacement: 'SeatGuarantee',
  improved_reliability: 'ResearchDirection', promotion: 'SeatGuarantee',
};

export function linkPromiseToClause(state: GameState, promise: DriverPromise): GameState {
  const type = PROMISE_CLAUSE[promise.promiseType];
  if (!type) return state;
  const ensured = ensureContractClauses(state);
  const phase18 = ensured.phase18!;
  let linked = false;
  let clauses = phase18.contractClauses.map((c) => {
    if (!linked && c.partyId === promise.driverId && c.clauseType === type && c.status === 'Active') {
      linked = true; return { ...c, linkedPromiseId: promise.id, dueSeasonYear: promise.dueSeason, dueRound: promise.dueRound };
    }
    return c;
  });
  if (!linked) {
    const promised = buildClause(ensured, 'Driver', promise.driverId, type);
    clauses = [...clauses, { ...promised, id: `${promised.id}-promise-${promise.id}`, linkedPromiseId: promise.id, dueSeasonYear: promise.dueSeason, dueRound: promise.dueRound }];
  }
  return { ...ensured, phase18: { ...phase18, contractClauses: clauses } };
}

export function syncClausePromiseResolution(state: GameState, promise: DriverPromise): GameState {
  if (!state.phase18) return state;
  const status = promise.status === 'kept' ? 'Satisfied' : promise.status === 'broken' || promise.status === 'expired' ? 'Breached' : undefined;
  if (!status) return state;
  return {
    ...state,
    phase18: { ...state.phase18, contractClauses: state.phase18.contractClauses.map((c) => c.linkedPromiseId === promise.id && c.status === 'Active' ? {
      ...c, status, risk: status === 'Breached' ? 'Triggered' : 'Secure',
      fulfilledSeasonYear: status === 'Satisfied' ? state.seasonYear : c.fulfilledSeasonYear,
      breachedSeasonYear: status === 'Breached' ? state.seasonYear : c.breachedSeasonYear,
      resolutionNote: status === 'Satisfied' ? 'Linked promise fulfilled.' : 'Linked promise was not fulfilled.',
    } : c) },
  };
}

export function evaluateContractClauses(state: GameState): GameState {
  const ensured = ensureContractClauses(state);
  const phase18 = ensured.phase18!;
  const round = ensured.calendar[ensured.currentRaceIndex]?.round ?? 0;
  let relationships = ensured.driverRelationships;
  let drivers = ensured.drivers;
  const news: NewsItem[] = [];
  const clauses = phase18.contractClauses.map((clause) => {
    if (clause.status !== 'Active' || clause.lastEvaluatedSeasonYear === ensured.seasonYear && clause.lastEvaluatedRound === round) return clause;
    let breached = false;
    if (clause.partyType === 'Driver' && (clause.clauseType === 'NumberOneStatus' || clause.clauseType === 'EqualTreatment')) {
      breached = (ensured.teamOrderHistory ?? []).some((o) => o.raceId === ensured.calendar[ensured.currentRaceIndex - 1]?.id && o.disadvantagedDriverId === clause.partyId);
    }
    const next = { ...clause, lastEvaluatedSeasonYear: ensured.seasonYear, lastEvaluatedRound: round };
    if (!breached) return next;
    const rel = relationships?.[clause.partyId];
    if (rel && relationships) relationships = { ...relationships, [clause.partyId]: { ...rel, trustInPrincipal: clamp(rel.trustInPrincipal - 14), trustInTeam: clamp(rel.trustInTeam - 10), morale: clamp(rel.morale - 9), frustration: clamp(rel.frustration + 14) } };
    drivers = drivers.map((d) => d.id === clause.partyId ? { ...d, morale: clamp(d.morale - 7), confidence: clamp(d.confidence - 4) } : d);
    const holder = drivers.find((d) => d.id === clause.partyId)?.name ?? clause.partyId;
    news.push({ id: `news-clause-breach-${clause.id}`, round, headline: `${holder}: contract clause breached`, body: `${LABELS[clause.clauseType]} was breached. ${clause.breachConsequence}`, timestamp: new Date().toISOString(), category: 'driver_market', priority: 'high', careerPhase: ensured.careerPhase?.currentPhase, teamId: clause.teamId, driverId: clause.partyId });
    return { ...next, status: 'Breached' as const, risk: 'Triggered' as const, breachedSeasonYear: ensured.seasonYear, resolutionNote: 'Triggered by a team management decision.' };
  });
  return { ...ensured, drivers, driverRelationships: relationships, news: [...news, ...ensured.news].slice(0, 80), phase18: { ...phase18, contractClauses: clauses } };
}

export function respondToContractBreach(state: GameState, clauseIdValue: string, response: ContractBreachResponse): GameState {
  const clause = state.phase18?.contractClauses.find((c) => c.id === clauseIdValue && c.status === 'Breached');
  if (!clause || clause.status !== 'Breached' || clause.resolutionNote?.startsWith('Management response:')) return state;
  const cost = response === 'Compensate' ? clause.renegotiationCost ?? 0 : 0;
  const team = state.teams.find((t) => t.id === state.selectedTeamId);
  if (cost > (team?.budget ?? 0)) return state;
  const trust = response === 'Compensate' ? 10 : response === 'Apologize' ? 5 : response === 'PromiseCorrection' ? 3 : 0;
  const relationships = state.driverRelationships && state.driverRelationships[clause.partyId] ? { ...state.driverRelationships, [clause.partyId]: { ...state.driverRelationships[clause.partyId], trustInPrincipal: clamp(state.driverRelationships[clause.partyId].trustInPrincipal + trust), frustration: clamp(state.driverRelationships[clause.partyId].frustration - Math.ceil(trust / 2)) } } : state.driverRelationships;
  const teams = cost ? state.teams.map((t) => t.id === state.selectedTeamId ? { ...t, budget: t.budget - cost } : t) : state.teams;
  const finance = cost ? [...(state.finance ?? []), makeTransaction(state.seasonYear, 'Driver Signing', `Clause compensation: ${LABELS[clause.clauseType]}`, -cost)] : state.finance;
  const responded = { ...state, teams, finance, driverRelationships: relationships, phase18: { ...state.phase18!, contractClauses: state.phase18!.contractClauses.map((c) => c.id === clause.id ? { ...c, status: response === 'Compensate' ? 'Waived' as const : c.status, resolutionNote: `Management response: ${response}.` } : c) } };
  if (response !== 'PromiseCorrection' || !responded.driverRelationships?.[clause.partyId]) return responded;
  const correctionType: PromiseType = clause.clauseType === 'NumberOneStatus' ? 'number_one_status' : clause.clauseType === 'EqualTreatment' ? 'equal_treatment' : clause.clauseType === 'SeatGuarantee' ? 'no_midseason_replacement' : 'development_priority';
  const round = responded.calendar[responded.currentRaceIndex]?.round ?? 0;
  const promise = makePromise(clause.partyId, correctionType, responded.seasonYear, round, responded.seasonYear, round + 3, responded.promiseCounter ?? 0);
  return linkPromiseToClause({
    ...responded,
    driverPromises: [...(responded.driverPromises ?? []), promise],
    driverRelationships: applyPromiseResolution(responded.driverRelationships, promise),
    promiseCounter: (responded.promiseCounter ?? 0) + 1,
  }, promise);
}
