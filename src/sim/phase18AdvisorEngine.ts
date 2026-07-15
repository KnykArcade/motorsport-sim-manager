import type { GameState } from '../game/careerState';
import type { PaddockEvent, PaddockEventOption } from '../types/careerPhaseTypes';
import type { StaffMember, StaffRole } from '../types/staffTypes';
import type {
  AdvisorRecommendation,
  AdvisorRole,
  DepartmentId,
} from '../types/phase18Types';
import { ensurePhase18FoundationState } from './phase18FoundationEngine';
import { staffRatingOutOfTen } from './staffEngine';

export const ADVISOR_ROLE_LABELS: Record<AdvisorRole, string> = {
  TechnicalDirector: 'Technical Director',
  ChiefDesigner: 'Chief Designer',
  RaceEngineer: 'Race Engineer',
  SportingDirector: 'Sporting Director',
  CommercialDirector: 'Commercial Director',
  PoliticalLegalDirector: 'Political & Legal Director',
  OwnerRepresentative: 'Owner Representative',
  DriverRepresentative: 'Driver Representative',
};

type CouncilSeat = {
  role: AdvisorRole;
  departmentId: DepartmentId;
  staffRole?: StaffRole;
  fallbackName: string;
};

const PADDOCK_COUNCIL: CouncilSeat[] = [
  { role: 'TechnicalDirector', departmentId: 'Technical', staffRole: 'Technical Director', fallbackName: 'Technical Department' },
  { role: 'RaceEngineer', departmentId: 'Engineering', staffRole: 'Race Engineer', fallbackName: 'Race Engineering Group' },
  { role: 'SportingDirector', departmentId: 'RaceOperations', staffRole: 'Strategist', fallbackName: 'Sporting Department' },
];

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function staffForSeat(staff: StaffMember[], seat: CouncilSeat): StaffMember | undefined {
  if (!seat.staffRole) return undefined;
  return staff
    .filter((member) => member.role === seat.staffRole)
    .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name))[0];
}

function recommendedOption(event: PaddockEvent, seat: CouncilSeat): PaddockEventOption | undefined {
  const options = event.options ?? [];
  if (options.length === 0) return undefined;
  const byId = (id: string) => options.find((option) => option.id === id);

  if (event.category === 'general_team' && event.title.startsWith('Select race preparation focus')) {
    if (seat.role === 'TechnicalDirector') return byId('reliability') ?? byId('power') ?? byId('balanced') ?? options[0];
    if (seat.role === 'RaceEngineer') return byId('race') ?? byId('balanced') ?? options[0];
    if (seat.role === 'SportingDirector') return byId('qualifying') ?? byId('balanced') ?? options[0];
  }

  const roleIndex = PADDOCK_COUNCIL.findIndex((candidate) => candidate.role === seat.role);
  return options[Math.max(0, roleIndex) % options.length];
}

function rationaleFor(event: PaddockEvent, seat: CouncilSeat, option: PaddockEventOption): string {
  if (event.category === 'general_team' && event.title.startsWith('Select race preparation focus')) {
    if (seat.role === 'TechnicalDirector') {
      return option.id === 'reliability'
        ? 'Protecting reliability gives the factory the clearest operating window and limits avoidable mechanical risk.'
        : 'The technical group believes this creates the strongest engineering return for the weekend.';
    }
    if (seat.role === 'RaceEngineer') {
      return 'Long-run preparation gives both drivers a stable car and more usable setup data across the race distance.';
    }
    return 'Track position offers the cleanest strategic control, so the sporting group wants to maximize qualifying execution.';
  }
  return `${ADVISOR_ROLE_LABELS[seat.role]} recommends ${option.label.toLowerCase()} based on current department priorities.`;
}

function confidenceFor(
  staff: StaffMember | undefined,
  trustInPrincipal: number,
  strategicAlignment: number,
): number {
  const competence = staff ? staffRatingOutOfTen(staff.rating) * 6 : 30;
  return Math.round(clamp(competence + trustInPrincipal * 0.18 + strategicAlignment * 0.12, 35, 95));
}

function urgencyFor(event: PaddockEvent): AdvisorRecommendation['urgency'] {
  if (event.severity === 'critical') return 'Critical';
  if (event.severity === 'major') return 'High';
  if (event.isRequiredDecision) return 'Normal';
  return 'Low';
}

export function generateAdvisorRecommendations(
  state: GameState,
  events: PaddockEvent[],
): GameState {
  const phase18 = ensurePhase18FoundationState(state.phase18, state);
  const decisionEvents = events.filter((event) => event.isRequiredDecision && (event.options?.length ?? 0) > 1);
  const activeDecisionIds = new Set(decisionEvents.map((event) => event.id));
  const existing = phase18.advisorRecommendations.map((recommendation) =>
    recommendation.status === 'Pending'
      && recommendation.decisionId
      && !activeDecisionIds.has(recommendation.decisionId)
      ? { ...recommendation, status: 'Expired' as const }
      : recommendation,
  );
  const existingKeys = new Set(existing.map((recommendation) => `${recommendation.decisionId}:${recommendation.advisorRole}`));
  const departments = phase18.departmentMoods[state.selectedTeamId];
  const generated: AdvisorRecommendation[] = [];
  const round = state.careerPhase?.currentRound ?? state.currentRaceIndex + 1;

  for (const event of decisionEvents) {
    for (const seat of PADDOCK_COUNCIL) {
      if (existingKeys.has(`${event.id}:${seat.role}`)) continue;
      const option = recommendedOption(event, seat);
      if (!option) continue;
      const staff = staffForSeat(state.staff ?? [], seat);
      const mood = departments[seat.departmentId];
      const confidence = confidenceFor(staff, mood.trustInPrincipal, mood.strategicAlignment);
      generated.push({
        id: `advisor-${event.id}-${seat.role}`,
        teamId: state.selectedTeamId,
        advisorRole: seat.role,
        advisorId: staff?.id,
        advisorName: staff?.name ?? seat.fallbackName,
        decisionType: event.category,
        decisionId: event.id,
        recommendedOptionId: option.id,
        recommendation: option.label,
        rationale: rationaleFor(event, seat, option),
        confidence,
        urgency: urgencyFor(event),
        status: 'Pending',
        createdSeasonYear: state.seasonYear,
        createdRound: round,
        expiresSeasonYear: state.seasonYear,
        expiresRound: round + 1,
        departmentId: seat.departmentId,
      });
    }
  }

  return {
    ...state,
    phase18: {
      ...phase18,
      advisorRecommendations: [...existing, ...generated].slice(-180),
    },
  };
}

export function advisorRecommendationsForDecision(
  state: Pick<GameState, 'phase18'>,
  decisionId: string,
): AdvisorRecommendation[] {
  return (state.phase18?.advisorRecommendations ?? [])
    .filter((recommendation) => recommendation.decisionId === decisionId)
    .sort((a, b) => b.confidence - a.confidence || a.advisorRole.localeCompare(b.advisorRole));
}

export function hasAdvisorDisagreement(recommendations: AdvisorRecommendation[]): boolean {
  return new Set(
    recommendations
      .filter((recommendation) => recommendation.status === 'Pending')
      .map((recommendation) => recommendation.recommendedOptionId),
  ).size > 1;
}

export function resolveAdvisorRecommendations(
  state: GameState,
  event: PaddockEvent,
  selectedOption: PaddockEventOption,
): GameState {
  const phase18 = ensurePhase18FoundationState(state.phase18, state);
  const relevant = phase18.advisorRecommendations.filter(
    (recommendation) => recommendation.decisionId === event.id && recommendation.status === 'Pending',
  );
  if (relevant.length === 0) return state;

  const departmentMoods = { ...phase18.departmentMoods };
  const teamDepartments = { ...departmentMoods[state.selectedTeamId] };
  const updated = phase18.advisorRecommendations.map((recommendation) => {
    if (!relevant.some((candidate) => candidate.id === recommendation.id)) return recommendation;
    const accepted = recommendation.recommendedOptionId === selectedOption.id;
    const trustChange = accepted
      ? Math.max(1, Math.round(recommendation.confidence / 35))
      : recommendation.confidence >= 75 ? -2 : -1;
    if (recommendation.departmentId) {
      const mood = teamDepartments[recommendation.departmentId];
      teamDepartments[recommendation.departmentId] = {
        ...mood,
        morale: clamp(mood.morale + (accepted ? 1 : recommendation.confidence >= 75 ? -1 : 0)),
        trustInPrincipal: clamp(mood.trustInPrincipal + trustChange),
        strategicAlignment: clamp(mood.strategicAlignment + (accepted ? 2 : -2)),
        conflictReasons: accepted
          ? mood.conflictReasons
          : [...mood.conflictReasons, `Advice overruled on ${event.title}`].slice(-5),
        lastUpdatedSeasonYear: state.seasonYear,
        lastUpdatedRound: state.careerPhase?.currentRound,
      };
    }
    return {
      ...recommendation,
      status: accepted ? 'Accepted' as const : 'Overruled' as const,
      resolvedOptionId: selectedOption.id,
      resolutionNote: accepted
        ? `Recommendation followed: ${selectedOption.label}`
        : `Recommendation overruled in favor of ${selectedOption.label}`,
      trustChange,
    };
  });
  departmentMoods[state.selectedTeamId] = teamDepartments;

  return {
    ...state,
    phase18: { ...phase18, advisorRecommendations: updated, departmentMoods },
  };
}

export function advisorPreparationEffectMultiplier(
  state: Pick<GameState, 'phase18' | 'careerPhase'>,
): number {
  const racePrepDecision = state.careerPhase?.paddockEvents.find(
    (event) => event.category === 'general_team'
      && event.title.startsWith('Select race preparation focus')
      && !!event.resolvedOptionId,
  );
  if (!racePrepDecision) return 1;
  const accepted = advisorRecommendationsForDecision(state, racePrepDecision.id)
    .filter((recommendation) => recommendation.status === 'Accepted');
  if (accepted.length === 0) return 1;
  const averageConfidence = accepted.reduce((sum, recommendation) => sum + recommendation.confidence, 0) / accepted.length;
  return Math.round((1 + Math.min(0.03, averageConfidence / 5_000)) * 1_000) / 1_000;
}
