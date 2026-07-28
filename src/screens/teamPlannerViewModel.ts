import {
  activeDriversForTeam,
  maxRaceDriversForSeries,
  minRaceDriversForSeries,
  reserveDriversForTeam,
  teamById,
  type GameState,
} from '../game/careerState';
import { youthYearlyAcademyCost } from '../data/market';
import { careerMarketBundle } from '../sim/careerMarketEngine';
import { driverSalary, toMoney } from '../sim/financeEngine';
import { effectiveAccuracy } from '../sim/scoutingEngine';
import type { Driver } from '../types/gameTypes';
import type { SeatSigning } from '../types/marketTypes';

export type PlannerHorizonId = 'current' | 'next' | 'future';
export type PlannerSeatKind = 'race' | 'reserve';
export type PlannerCandidateSource = 'academy' | 'shortlist';

export type PlannerOccupant = {
  id: string;
  name: string;
  source: 'contract' | 'pending';
  overall?: number;
  contractLabel: string;
  annualCost: number;
};

export type PlannerSeat = {
  id: string;
  kind: PlannerSeatKind;
  label: string;
  required: boolean;
  occupant?: PlannerOccupant;
  status: 'secure' | 'expiring' | 'weak' | 'vacant' | 'optional';
  detail: string;
};

export type PlannerCandidate = {
  id: string;
  entityId: string;
  name: string;
  source: PlannerCandidateSource;
  overall: number;
  potential: number;
  knowledge: number;
  readyYear: number;
  annualCost: number;
  actionRoute: string;
};

export type PlannerCommitment = {
  id: string;
  category: 'Staff' | 'Engine' | 'Sponsor' | 'Technical';
  name: string;
  detail: string;
  annualAmount: number;
  tone: 'positive' | 'neutral' | 'warning';
  actionRoute: string;
};

export type PlannerGap = {
  id: string;
  severity: 'required' | 'warning';
  label: string;
  detail: string;
  actionLabel: string;
  actionRoute: string;
};

export type TeamPlannerHorizon = {
  id: PlannerHorizonId;
  year: number;
  label: string;
  seats: PlannerSeat[];
  candidates: PlannerCandidate[];
  commitments: PlannerCommitment[];
  gaps: PlannerGap[];
  committedCosts: number;
  committedIncome: number;
  projectedHeadroom: number;
};

export type TeamPlanner = {
  teamId: string;
  teamName: string;
  baseBudget: number;
  horizons: TeamPlannerHorizon[];
};

const HORIZONS: ReadonlyArray<{ id: PlannerHorizonId; offset: number; label: string }> = [
  { id: 'current', offset: 0, label: 'Current season' },
  { id: 'next', offset: 1, label: 'Next season' },
  { id: 'future', offset: 2, label: 'Season after next' },
];

function contractYears(driver: Driver): number {
  return Math.max(1, driver.contractYearsRemaining ?? 1);
}

function currentOccupant(driver: Driver, offset: number): PlannerOccupant | undefined {
  const years = contractYears(driver);
  if (years <= offset) return undefined;
  return {
    id: driver.id,
    name: driver.name,
    source: 'contract',
    overall: driver.ratings.overall,
    contractLabel: years - offset === 1 ? 'Final contracted season' : `${years - offset} seasons secured`,
    annualCost: driverSalary(driver),
  };
}

function signingOccupant(signing: SeatSigning, offset: number): PlannerOccupant | undefined {
  if (offset === 0) return undefined;
  const years = Math.max(1, signing.contractYears ?? 1);
  if (years < offset) return undefined;
  return {
    id: signing.sourceId,
    name: signing.name,
    source: 'pending',
    contractLabel: offset === 1 ? 'Pending move' : `${years - offset + 1} seasons secured`,
    annualCost: toMoney(signing.offeredSalary ?? 0),
  };
}

function seatStatus(
  occupant: PlannerOccupant | undefined,
  required: boolean,
  weakThreshold: number,
): PlannerSeat['status'] {
  if (!occupant) return required ? 'vacant' : 'optional';
  if (occupant.overall !== undefined && occupant.overall < weakThreshold) return 'weak';
  if (occupant.contractLabel === 'Final contracted season') return 'expiring';
  return 'secure';
}

function seatDetail(status: PlannerSeat['status'], occupant: PlannerOccupant | undefined): string {
  if (status === 'vacant') return 'Required seat has no committed driver.';
  if (status === 'optional') return 'Optional capacity is available.';
  if (status === 'weak') return `${occupant?.name ?? 'Driver'} is below the team planning benchmark.`;
  if (status === 'expiring') return 'Contract expires at the end of this horizon.';
  return occupant?.contractLabel ?? 'Committed';
}

function plannerSeats(state: GameState, offset: number): PlannerSeat[] {
  const active = activeDriversForTeam(state, state.selectedTeamId);
  const reserves = reserveDriversForTeam(state, state.selectedTeamId);
  const signings = state.pendingSignings ?? [];
  const maxRaceSeats = maxRaceDriversForSeries(state.series);
  const requiredRaceSeats = minRaceDriversForSeries(state.series);
  const team = teamById(state, state.selectedTeamId);
  const weakThreshold = Math.max(60, Math.round((team?.reputation ?? 70) - 10));

  const raceSeats = Array.from({ length: maxRaceSeats }, (_, index): PlannerSeat => {
    const incumbent = active[index];
    const pending = incumbent
      ? signings.find((signing) => signing.seatDriverId === incumbent.id)
      : undefined;
    const occupant = pending
      ? signingOccupant(pending, offset) ?? currentOccupant(incumbent, offset)
      : incumbent
        ? currentOccupant(incumbent, offset)
        : undefined;
    const required = index < requiredRaceSeats;
    const status = seatStatus(occupant, required, weakThreshold);
    return {
      id: `race-${index + 1}`,
      kind: 'race',
      label: `Race seat ${index + 1}`,
      required,
      occupant,
      status,
      detail: seatDetail(status, occupant),
    };
  });

  const reserveOccupant = reserves
    .map((driver) => currentOccupant(driver, offset))
    .find((driver): driver is PlannerOccupant => Boolean(driver));
  const reserveStatus = reserveOccupant ? seatStatus(reserveOccupant, false, weakThreshold) : 'vacant';
  const reserveSeat: PlannerSeat = {
    id: 'reserve-1',
    kind: 'reserve',
    label: 'Reserve seat',
    required: false,
    occupant: reserveOccupant,
    status: reserveStatus,
    detail: reserveOccupant
      ? seatDetail(reserveStatus, reserveOccupant)
      : 'No reserve option is committed for this horizon.',
  };

  return [...raceSeats, reserveSeat];
}

function plannerCandidates(state: GameState, year: number): PlannerCandidate[] {
  const market = careerMarketBundle(state);
  const marketById = new Map(market.drivers.map((driver) => [driver.id, driver]));
  const networkAccuracy = state.scouting?.networkAccuracy ?? 0;
  const candidates: PlannerCandidate[] = [];

  for (const member of state.academy ?? []) {
    const readyYear = member.birthYear + 18;
    candidates.push({
      id: `academy:${member.id}`,
      entityId: member.id,
      name: member.name,
      source: 'academy',
      overall: member.overall,
      potential: member.potential,
      knowledge: 100,
      readyYear,
      annualCost: toMoney(youthYearlyAcademyCost(member.potential)),
      actionRoute: '/market?tab=youth',
    });
  }

  for (const target of state.scouting?.shortlist ?? []) {
    if (target.entityType !== 'Driver') continue;
    const driver = marketById.get(target.entityId);
    if (!driver) continue;
    const report = state.scouting?.reports[target.entityId];
    candidates.push({
      id: `shortlist:${driver.id}`,
      entityId: driver.id,
      name: driver.name,
      source: 'shortlist',
      overall: driver.overall,
      potential: driver.potential,
      knowledge: report
        ? Math.round(effectiveAccuracy(report.scoutingLevel, networkAccuracy) * 100)
        : 0,
      readyYear: year,
      annualCost: toMoney(driver.salary),
      actionRoute: report?.scoutingLevel === 100
        ? `/market?target=${encodeURIComponent(driver.id)}`
        : `/scouting?tab=senior&target=${encodeURIComponent(driver.id)}`,
    });
  }

  return candidates.sort((left, right) =>
    right.potential - left.potential
    || right.overall - left.overall
    || left.name.localeCompare(right.name));
}

function staffCommitments(state: GameState, offset: number): PlannerCommitment[] {
  return (state.staff ?? [])
    .filter((member) => Math.max(1, member.contractYearsRemaining ?? 2) > offset)
    .map((member) => {
      const remaining = Math.max(1, member.contractYearsRemaining ?? 2) - offset;
      return {
        id: `staff:${member.id}`,
        category: 'Staff' as const,
        name: `${member.role}: ${member.name}`,
        detail: remaining === 1 ? 'Final contracted season' : `${remaining} seasons remaining`,
        annualAmount: -toMoney(member.salary),
        tone: remaining === 1 ? 'warning' as const : 'neutral' as const,
        actionRoute: `/staff?view=departments&role=${encodeURIComponent(member.role)}`,
      };
    });
}

function engineCommitment(state: GameState, offset: number): PlannerCommitment[] {
  const pending = state.engine?.pendingDeal;
  const current = state.engine?.currentDeal;
  const deal = offset > 0 && pending && pending.contractYearsRemaining >= offset
    ? pending
    : current && current.contractYearsRemaining > offset
      ? current
      : undefined;
  if (!deal) return [];
  const remaining = offset > 0 && deal === pending
    ? deal.contractYearsRemaining - offset + 1
    : deal.contractYearsRemaining - offset;
  return [{
    id: `engine:${deal.id}`,
    category: 'Engine',
    name: `${deal.supplierName} · ${deal.dealType}`,
    detail: remaining === 1 ? 'Final committed season' : `${remaining} seasons remaining`,
    annualAmount: -toMoney(deal.annualCost),
    tone: remaining === 1 ? 'warning' : 'neutral',
    actionRoute: '/technical?section=engine',
  }];
}

function sponsorCommitments(state: GameState, offset: number): PlannerCommitment[] {
  return (state.commercial?.sponsors ?? [])
    .filter((sponsor) => sponsor.contractYearsRemaining > offset)
    .map((sponsor) => {
      const remaining = sponsor.contractYearsRemaining - offset;
      return {
        id: `sponsor:${sponsor.id}`,
        category: 'Sponsor' as const,
        name: `${sponsor.name} · ${sponsor.type}`,
        detail: remaining === 1 ? 'Final committed season' : `${remaining} seasons remaining`,
        annualAmount: toMoney(sponsor.annualValue),
        tone: remaining === 1 ? 'warning' as const : 'positive' as const,
        actionRoute: '/sponsors',
      };
    });
}

function technicalCommitments(state: GameState, offset: number): PlannerCommitment[] {
  const technical = state.teamTechnical?.[state.selectedTeamId];
  if (!technical) return [];
  const racesRemaining = Math.max(0, state.calendar.length - state.currentRaceIndex);
  const targetYear = state.seasonYear + offset;
  const projects = technical.activeProjects.filter((project) => {
    if (offset === 0) return true;
    const remaining = Math.max(0, project.durationTicks - project.progressTicks);
    if (offset === 1) {
      return remaining > racesRemaining
        || (project.kind === 'upgrade'
          && (project.horizon === 'NextSeasonResearch' || project.horizon === 'LongTermInfrastructure'));
    }
    return project.kind === 'upgrade' && project.horizon === 'LongTermInfrastructure';
  }).map((project): PlannerCommitment => ({
    id: `technical:${project.id}`,
    category: 'Technical',
    name: project.kind === 'upgrade' ? project.name : project.nodeName ?? project.sourceId ?? 'Research programme',
    detail: project.kind === 'upgrade'
      ? `${project.horizon} · ${project.progressTicks}/${project.durationTicks} rounds`
      : `Research · ${project.progressTicks}/${project.durationTicks} rounds`,
    annualAmount: 0,
    tone: 'neutral',
    actionRoute: '/technical',
  }));

  if (technical.focus && technical.focus.lockedThroughSeasonYear >= targetYear) {
    projects.push({
      id: `technical-focus:${technical.focus.branchId}`,
      category: 'Technical',
      name: `${technical.focus.branchId.replaceAll('_', ' ')} research focus`,
      detail: `Locked through ${technical.focus.lockedThroughSeasonYear}`,
      annualAmount: 0,
      tone: 'neutral',
      actionRoute: '/technical',
    });
  }
  return projects;
}

function plannerGaps(
  year: number,
  seats: PlannerSeat[],
  commitments: PlannerCommitment[],
  projectedHeadroom: number,
): PlannerGap[] {
  const gaps: PlannerGap[] = [];
  for (const seat of seats) {
    if (seat.status === 'vacant' && seat.kind === 'race' && seat.required) {
      gaps.push({
        id: `gap:${seat.id}`,
        severity: 'required',
        label: `${seat.label} is unfilled`,
        detail: `${year} has no committed race driver in this required position.`,
        actionLabel: 'Open scouting',
        actionRoute: '/scouting?tab=senior',
      });
    } else if (seat.status === 'vacant' && seat.kind === 'reserve') {
      gaps.push({
        id: 'gap:reserve',
        severity: 'warning',
        label: 'No reserve driver committed',
        detail: 'The team has no planned reserve option for this horizon.',
        actionLabel: 'Review market',
        actionRoute: '/market',
      });
    } else if (seat.status === 'weak') {
      gaps.push({
        id: `gap:weak:${seat.id}`,
        severity: 'warning',
        label: `${seat.label} is below benchmark`,
        detail: seat.detail,
        actionLabel: 'Compare candidates',
        actionRoute: '/scouting?tab=senior',
      });
    } else if (seat.status === 'expiring') {
      gaps.push({
        id: `gap:expiring:${seat.id}`,
        severity: 'warning',
        label: `${seat.label} contract expires`,
        detail: seat.detail,
        actionLabel: 'Review contracts',
        actionRoute: '/drivers?tab=contracts',
      });
    }
  }

  const staffRoles = new Set(
    commitments.filter((entry) => entry.category === 'Staff').map((entry) => entry.name.split(':')[0]),
  );
  for (const role of ['Technical Director', 'Race Engineer', 'Pit Crew Chief', 'Strategist']) {
    if (!staffRoles.has(role)) gaps.push({
      id: `gap:staff:${role}`,
      severity: 'warning',
      label: `${role} is unfilled`,
      detail: `${year} has no staff contract covering this department.`,
      actionLabel: 'Open staff recruitment',
      actionRoute: `/staff?view=recruitment&role=${encodeURIComponent(role)}`,
    });
  }
  if (!commitments.some((entry) => entry.category === 'Engine')) gaps.push({
    id: 'gap:engine',
    severity: 'required',
    label: 'No engine commitment',
    detail: `${year} has no active or pending supplier agreement.`,
    actionLabel: 'Review suppliers',
    actionRoute: '/technical?section=engine',
  });
  if (projectedHeadroom < 0) gaps.push({
    id: 'gap:budget',
    severity: 'required',
    label: 'Committed budget is over capacity',
    detail: `Known recurring commitments exceed the current available balance by ${Math.abs(projectedHeadroom).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}.`,
    actionLabel: 'Review finance',
    actionRoute: '/finance',
  });
  return gaps;
}

export function buildTeamPlanner(state: GameState): TeamPlanner {
  const team = teamById(state, state.selectedTeamId);
  const baseBudget = team?.budget ?? 0;
  return {
    teamId: state.selectedTeamId,
    teamName: team?.name ?? 'Your team',
    baseBudget,
    horizons: HORIZONS.map(({ id, offset, label }) => {
      const year = state.seasonYear + offset;
      const seats = plannerSeats(state, offset);
      const candidates = plannerCandidates(state, year);
      const commitments = [
        ...staffCommitments(state, offset),
        ...engineCommitment(state, offset),
        ...sponsorCommitments(state, offset),
        ...technicalCommitments(state, offset),
      ];
      const driverCosts = seats.reduce((sum, seat) => sum + (seat.occupant?.annualCost ?? 0), 0);
      const academyCosts = (state.academy ?? []).reduce(
        (sum, member) => sum + toMoney(youthYearlyAcademyCost(member.potential)),
        0,
      );
      const committedCosts = driverCosts + academyCosts + commitments.reduce(
        (sum, entry) => sum + Math.max(0, -entry.annualAmount),
        0,
      );
      const committedIncome = commitments.reduce(
        (sum, entry) => sum + Math.max(0, entry.annualAmount),
        0,
      );
      const projectedHeadroom = baseBudget + committedIncome - committedCosts;
      return {
        id,
        year,
        label,
        seats,
        candidates,
        commitments,
        gaps: plannerGaps(year, seats, commitments, projectedHeadroom),
        committedCosts,
        committedIncome,
        projectedHeadroom,
      };
    }),
  };
}

export function plannerHorizon(
  planner: TeamPlanner,
  requested: string | null | undefined,
): TeamPlannerHorizon {
  return planner.horizons.find((horizon) => horizon.id === requested) ?? planner.horizons[0];
}
