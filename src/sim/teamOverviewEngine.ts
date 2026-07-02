// Team Overview / Rankings — Career Mode Phase B.
//
// Aggregates every team in the universe into a single comparable profile: a set
// of 1-10 ratings (car, development, facilities, staff, engine, drivers,
// academy, race ops, pit crew, reliability, reputation, finance), a financial
// health grade, championship position and a form/trend badge. Pure &
// deterministic — reads the existing org ratings, cars, drivers, standings and
// AI brains without mutating state. Powers the Team Overview screen.

import type { Car, Driver, Team } from '../types/gameTypes';
import type { TeamOrganizationRatings } from '../types/teamRatingsTypes';
import type { AIFinancialHealth } from '../types/aiTeamTypes';
import type { GameState } from '../game/careerState';
import { activeDriversForTeam } from '../game/careerState';
import { effectiveCarRatings, carPerformanceRating } from './trackFitEngine';
import { buildTeamOrganizationRatings } from './teamRatingsEngine';
import { ARCHETYPE_SPECS, GOAL_LABELS } from './aiTeamEngine';

export type TeamTrend =
  | 'TitlePush'
  | 'Rising'
  | 'Stable'
  | 'Falling'
  | 'Rebuilding'
  | 'FinancialTrouble';

export const TREND_LABELS: Record<TeamTrend, string> = {
  TitlePush: 'Title Push',
  Rising: 'Rising',
  Stable: 'Stable',
  Falling: 'Falling',
  Rebuilding: 'Rebuilding',
  FinancialTrouble: 'Financial Trouble',
};

export const HEALTH_LABELS: Record<AIFinancialHealth, string> = {
  Excellent: 'Excellent',
  Stable: 'Stable',
  Tight: 'Tight',
  AtRisk: 'At Risk',
  Critical: 'Critical',
};

// Ordered worst→best so a smaller index is worse (used for sorting).
export const HEALTH_ORDER: AIFinancialHealth[] = ['Critical', 'AtRisk', 'Tight', 'Stable', 'Excellent'];

export type TeamOverviewRow = {
  teamId: string;
  name: string;
  shortName: string;
  color: string;
  isPlayer: boolean;
  series: string;
  championshipPosition?: number; // 1-based; undefined before any race
  points: number;
  wins: number;
  // Financials
  financialHealth: AIFinancialHealth;
  budget: number; // raw dollars
  sponsorIncome: number; // raw dollars (estimate for AI)
  // 1-10 ratings
  financeRating: number;
  carRating: number;
  developmentRating: number;
  facilitiesRating: number;
  staffRating: number;
  engineRating: number;
  driverRating: number;
  academyRating: number;
  raceOpsRating: number;
  pitCrewRating: number;
  reliabilityRating: number;
  reputationRating: number;
  sponsorRating: number;
  overallRating: number; // headline 1-10
  archetypeLabel?: string; // AI only
  goalLabel?: string; // AI only
  trend: TeamTrend;
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp10 = (n: number) => Math.max(1, Math.min(10, n));

// Weighted average driver rating for a team's race drivers (lead weighted).
function driverLineupRating(drivers: Driver[]): number {
  const race = drivers.slice(0, 2);
  if (race.length === 0) return 1;
  if (race.length === 1) return clamp10(race[0].ratings.overall);
  const [lead, second] = race.sort((a, b) => b.ratings.overall - a.ratings.overall);
  return clamp10(lead.ratings.overall * 0.6 + second.ratings.overall * 0.4);
}

// Map a raw dollar budget to a 1-10 strength score (~$5M shoestring → ~$150M works).
function budgetToRating(budget: number): number {
  const m = budget / 1_000_000;
  return clamp10(2 + m * 0.055);
}

// Financial-health grade for a team: the AI brain's grade when present,
// otherwise (the player team) derived from cash and financial stability.
function healthForTeam(state: GameState, team: Team, org: TeamOrganizationRatings): AIFinancialHealth {
  const ai = state.aiTeamStates?.[team.id];
  if (ai) return ai.financialHealth;
  const m = team.budget / 1_000_000;
  const stability = org.financialStability;
  if (m <= 0) return 'Critical';
  if (m < 8 && stability < 45) return 'AtRisk';
  if (m < 20) return 'Tight';
  if (m < 60 || stability < 60) return 'Stable';
  return 'Excellent';
}

function trendForTeam(
  state: GameState,
  team: Team,
  health: AIFinancialHealth,
  position: number | undefined,
): TeamTrend {
  if (health === 'Critical' || health === 'AtRisk') return 'FinancialTrouble';
  const ai = state.aiTeamStates?.[team.id];
  if (ai) {
    if (ai.goal === 'TitleChallenge' && (position ?? 99) <= 2) return 'TitlePush';
    const last = ai.lastConstructorPosition;
    if (last != null && position != null) {
      if (position <= last - 2) return 'Rising';
      if (position >= last + 2) return 'Falling';
    }
    if (ai.archetype === 'YouthFocused' || ai.archetype === 'DevelopmentFocused') return 'Rebuilding';
    return 'Stable';
  }
  // Player team: lean on championship position.
  if (position === 1) return 'TitlePush';
  return 'Stable';
}

// Resolve org ratings for a team, preferring the persisted (possibly
// AI-adjusted) values and falling back to a freshly derived profile.
function orgFor(state: GameState, team: Team, car: Car | undefined): TeamOrganizationRatings {
  const stored = state.teamOrgRatings?.[team.id];
  if (stored) return stored;
  return buildTeamOrganizationRatings(team, car, state.seasonYear, state.randomSeed, state.series);
}

export function buildTeamOverviewRow(state: GameState, team: Team): TeamOverviewRow {
  const car = state.cars.find((c) => c.teamId === team.id);
  const org = orgFor(state, team, car);
  const drivers = activeDriversForTeam(state, team.id);
  const eff = car ? effectiveCarRatings(car) : undefined;

  const standingIdx = state.constructorStandings.findIndex((s) => s.entityId === team.id);
  const standing = standingIdx >= 0 ? state.constructorStandings[standingIdx] : undefined;
  const position = standingIdx >= 0 ? standingIdx + 1 : undefined;

  const carRating = car ? clamp10(carPerformanceRating(car)) : 1;
  const engineRating = eff ? clamp10(eff.enginePower) : clamp10(org.carPerformance / 10);
  const reliabilityRating = eff
    ? clamp10(eff.reliability * 0.7 + (org.reliabilityDepartment / 10) * 0.3)
    : clamp10(org.reliabilityDepartment / 10);
  const facilitiesRating = clamp10(org.facilities / 10);
  const staffRating = clamp10(org.staffQuality / 10);
  const developmentRating = clamp10(
    (org.research / 10) * 0.55 + facilitiesRating * 0.25 + staffRating * 0.2,
  );
  const driverRating = driverLineupRating(drivers);
  const academyRating = clamp10(org.youthAcademy / 10);
  const raceOpsRating = clamp10(
    team.raceOperations * 0.6 + (org.operations / 10) * 0.25 + (org.pitCrew / 10) * 0.15,
  );
  const pitCrewRating = eff
    ? clamp10(eff.pitCrewOperations * 0.6 + (org.pitCrew / 10) * 0.4)
    : clamp10(org.pitCrew / 10);
  const reputationRating = clamp10(team.reputation / 10);
  const sponsorRating = clamp10(org.sponsorAppeal / 10);

  const health = healthForTeam(state, team, org);
  const financeRating = clamp10((org.financialStability / 10) * 0.6 + budgetToRating(team.budget) * 0.4);

  const ai = state.aiTeamStates?.[team.id];
  const sponsorIncome = ai?.budget.sponsorIncome ?? Math.round((org.sponsorAppeal / 100) * 45_000_000);

  const overallRating = clamp10(
    carRating * 0.28 +
      driverRating * 0.16 +
      developmentRating * 0.12 +
      facilitiesRating * 0.1 +
      staffRating * 0.1 +
      financeRating * 0.09 +
      raceOpsRating * 0.08 +
      reliabilityRating * 0.07,
  );

  return {
    teamId: team.id,
    name: team.name,
    shortName: team.shortName,
    color: team.color,
    isPlayer: team.id === state.selectedTeamId,
    series: state.series,
    championshipPosition: position,
    points: standing?.points ?? 0,
    wins: standing?.wins ?? 0,
    financialHealth: health,
    budget: team.budget,
    sponsorIncome,
    financeRating: round1(financeRating),
    carRating: round1(carRating),
    developmentRating: round1(developmentRating),
    facilitiesRating: round1(facilitiesRating),
    staffRating: round1(staffRating),
    engineRating: round1(engineRating),
    driverRating: round1(driverRating),
    academyRating: round1(academyRating),
    raceOpsRating: round1(raceOpsRating),
    pitCrewRating: round1(pitCrewRating),
    reliabilityRating: round1(reliabilityRating),
    reputationRating: round1(reputationRating),
    sponsorRating: round1(sponsorRating),
    overallRating: round1(overallRating),
    archetypeLabel: ai ? ARCHETYPE_SPECS[ai.archetype].label : undefined,
    goalLabel: ai ? GOAL_LABELS[ai.goal] : undefined,
    trend: trendForTeam(state, team, health, position),
  };
}

export function buildTeamOverview(state: GameState): TeamOverviewRow[] {
  const rows = state.teams.map((t) => buildTeamOverviewRow(state, t));
  // Default order: championship position (raced teams first), then overall.
  rows.sort((a, b) => {
    const pa = a.championshipPosition ?? Number.MAX_SAFE_INTEGER;
    const pb = b.championshipPosition ?? Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;
    if (b.overallRating !== a.overallRating) return b.overallRating - a.overallRating;
    return a.name.localeCompare(b.name);
  });
  return rows;
}

// --- Team detail -------------------------------------------------------------

export type TeamOverviewDetail = {
  row: TeamOverviewRow;
  raceDrivers: Driver[];
  reserveDrivers: Driver[];
  academyProspectNames: string[];
  engineSupplier?: string;
  engineDealType?: string;
  strengths: { label: string; value: number }[];
  weaknesses: { label: string; value: number }[];
  recentMoves: string[];
};

const RATING_FIELDS: { key: keyof TeamOverviewRow; label: string }[] = [
  { key: 'carRating', label: 'Car' },
  { key: 'driverRating', label: 'Drivers' },
  { key: 'developmentRating', label: 'Development' },
  { key: 'facilitiesRating', label: 'Facilities' },
  { key: 'staffRating', label: 'Staff' },
  { key: 'engineRating', label: 'Engine' },
  { key: 'academyRating', label: 'Academy' },
  { key: 'raceOpsRating', label: 'Race Ops' },
  { key: 'pitCrewRating', label: 'Pit Crew' },
  { key: 'reliabilityRating', label: 'Reliability' },
  { key: 'financeRating', label: 'Finance' },
  { key: 'reputationRating', label: 'Reputation' },
];

export function buildTeamOverviewDetail(state: GameState, teamId: string): TeamOverviewDetail | undefined {
  const team = state.teams.find((t) => t.id === teamId);
  if (!team) return undefined;
  const row = buildTeamOverviewRow(state, team);
  const race = activeDriversForTeam(state, teamId);
  const reserves = state.drivers.filter(
    (d) => d.teamId === teamId && !race.some((r) => r.id === d.id),
  );

  const academy =
    teamId === state.selectedTeamId
      ? state.academy ?? []
      : state.aiAcademies?.[teamId] ?? [];

  const deal = state.engine?.deals?.[teamId] ?? (row.isPlayer ? state.engine?.currentDeal : undefined);

  const ranked = RATING_FIELDS.map((f) => ({ label: f.label, value: row[f.key] as number })).sort(
    (a, b) => b.value - a.value,
  );
  const strengths = ranked.slice(0, 3);
  const weaknesses = ranked.slice(-3).reverse();

  const lastSummary = state.offseasonHistory[state.offseasonHistory.length - 1];
  const recentMoves = (lastSummary?.notes ?? []).filter((n) => n.includes(team.name)).slice(0, 6);

  return {
    row,
    raceDrivers: race,
    reserveDrivers: reserves,
    academyProspectNames: academy.map((a) => a.name),
    engineSupplier: deal?.supplierName,
    engineDealType: deal?.dealType,
    strengths,
    weaknesses,
    recentMoves,
  };
}
