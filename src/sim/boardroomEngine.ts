import type { GameState } from '../game/careerState';
import type {
  BoardFundingCategory,
  BoardFundingRequest,
  BoardroomAreaAssessment,
  BoardroomMandateLevel,
  BoardroomReview,
  BoardroomReviewStage,
  BoardroomState,
  OwnerPersonality,
  TeamExpectation,
} from '../types/expectationTypes';
import type { NewsItem } from '../types/gameTypes';
import { createSeededRandom, deriveSeed } from './random';
import { toMoney } from './financeEngine';

const FUNDING_MILLIONS: Record<BoardFundingCategory, number> = {
  TechnicalDevelopment: 3,
  Facilities: 4,
  StaffRecruitment: 2,
  DriverContracts: 3,
  AcademyInvestment: 1.5,
  EmergencySupport: 5,
};

const FUNDING_LABELS: Record<BoardFundingCategory, string> = {
  TechnicalDevelopment: 'technical development',
  Facilities: 'facilities',
  StaffRecruitment: 'staff recruitment',
  DriverContracts: 'driver contracts',
  AcademyInvestment: 'academy investment',
  EmergencySupport: 'emergency financial support',
};

export const MANDATE_OPTIONS: Record<BoardroomMandateLevel, {
  fundingMillions: number;
  jobRisk: BoardroomState['mandateJobRisk'];
  description: string;
}> = {
  Conservative: {
    fundingMillions: 0.5,
    jobRisk: 'Limited',
    description: 'A more forgiving sporting target with limited additional support.',
  },
  Expected: {
    fundingMillions: 1.5,
    jobRisk: 'Standard',
    description: 'The board’s normal target with standard additional support.',
  },
  Ambitious: {
    fundingMillions: 3,
    jobRisk: 'High',
    description: 'A tougher target with greater funding and greater job risk.',
  },
};

export function emptyBoardroom(): BoardroomState {
  return {
    reviews: [],
    fundingRequests: [],
    autonomy: 'Standard',
    contractExtensionYears: 0,
  };
}

export function adjustExpectationForMandate(
  expectation: TeamExpectation,
  mandate: BoardroomMandateLevel,
): TeamExpectation {
  const positionShift = mandate === 'Conservative' ? 1 : mandate === 'Ambitious' ? -1 : 0;
  const pointsMultiplier = mandate === 'Conservative' ? 0.75 : mandate === 'Ambitious' ? 1.25 : 1;
  const winsShift = mandate === 'Conservative' ? -1 : mandate === 'Ambitious' ? 1 : 0;
  return {
    ...expectation,
    primaryObjective: mandate === 'Conservative'
      ? `Stabilize while pursuing: ${expectation.primaryObjective.toLowerCase()}`
      : mandate === 'Ambitious'
        ? `Exceed expectations: ${expectation.primaryObjective.toLowerCase()}`
        : expectation.primaryObjective,
    minimumConstructorPosition: expectation.minimumConstructorPosition === undefined
      ? undefined
      : Math.max(1, expectation.minimumConstructorPosition + positionShift),
    targetPoints: expectation.targetPoints === undefined
      ? undefined
      : Math.max(1, Math.round(expectation.targetPoints * pointsMultiplier)),
    requiredWins: expectation.requiredWins === undefined
      ? undefined
      : Math.max(0, expectation.requiredWins + winsShift),
  };
}

export function chooseMandate(
  state: GameState,
  mandate: BoardroomMandateLevel,
): GameState {
  if (state.currentRaceIndex > 0 || state.boardroom?.mandate) return state;
  const expectation = state.teamExpectations?.[state.selectedTeamId];
  const team = state.teams.find((entry) => entry.id === state.selectedTeamId);
  if (!expectation || !team) return state;
  const option = MANDATE_OPTIONS[mandate];
  const transaction = {
    id: `txn-board-mandate-${state.seasonYear}-${mandate}`,
    season: state.seasonYear,
    category: 'Operations' as const,
    label: `${mandate} board mandate support`,
    amount: toMoney(option.fundingMillions),
  };
  return {
    ...state,
    teams: state.teams.map((entry) => entry.id === team.id
      ? { ...entry, budget: entry.budget + transaction.amount }
      : entry),
    finance: [...(state.finance ?? []), transaction],
    teamExpectations: {
      ...state.teamExpectations,
      [team.id]: adjustExpectationForMandate(expectation, mandate),
    },
    boardroom: {
      ...(state.boardroom ?? emptyBoardroom()),
      mandate,
      mandateFundingMillions: option.fundingMillions,
      mandateJobRisk: option.jobRisk,
    },
  };
}

function personalityPriority(personality: OwnerPersonality | undefined, category: BoardFundingCategory): number {
  if (personality === 'PatientBuilder' && ['Facilities', 'AcademyInvestment', 'TechnicalDevelopment'].includes(category)) return 14;
  if (personality === 'WinNowTycoon' && ['DriverContracts', 'StaffRecruitment', 'TechnicalDevelopment'].includes(category)) return 12;
  if (personality === 'BudgetHawk' && category === 'EmergencySupport') return -16;
  if (personality === 'RacingPurist' && ['AcademyInvestment', 'TechnicalDevelopment'].includes(category)) return 12;
  if (personality === 'Showman' && category === 'DriverContracts') return 16;
  if (personality === 'OldGuard' && category === 'StaffRecruitment') return -10;
  return 0;
}

export function requestBoardFunding(state: GameState, category: BoardFundingCategory): GameState {
  if (state.gameMode === 'SingleSeason' || state.seasonComplete) return state;
  const boardroom = state.boardroom ?? emptyBoardroom();
  if (boardroom.fundingRequests.some((request) =>
    request.category === category && request.requestedRound === state.currentRaceIndex)) return state;
  const active = boardroom.fundingRequests.some((request) =>
    request.category === category && ['Approved', 'Conditional'].includes(request.status));
  if (active) return state;
  const reputation = state.teamReputations?.[state.selectedTeamId];
  const patience = reputation?.ownerPatience ?? 50;
  const recentRequests = boardroom.fundingRequests.filter((request) => request.requestedRound >= state.currentRaceIndex - 4).length;
  const rng = createSeededRandom(deriveSeed(
    state.randomSeed,
    'board-funding',
    state.seasonYear,
    state.currentRaceIndex,
    category,
    boardroom.fundingRequests.length,
  ));
  const score = patience
    + personalityPriority(reputation?.ownerPersonality, category)
    - recentRequests * 12
    + rng.range(-8, 8);
  const requestedMillions = FUNDING_MILLIONS[category];
  const id = `board-funding-${state.seasonYear}-${state.currentRaceIndex}-${category}`;
  let request: BoardFundingRequest;
  if (score >= 68) {
    request = {
      id,
      category,
      requestedMillions,
      approvedMillions: requestedMillions,
      requestedRound: state.currentRaceIndex,
      status: 'Approved',
      response: `The owner approved the full ${FUNDING_LABELS[category]} request.`,
    };
  } else if (score >= 43) {
    request = {
      id,
      category,
      requestedMillions,
      approvedMillions: requestedMillions / 2,
      requestedRound: state.currentRaceIndex,
      status: 'Conditional',
      response: `Half the request is available now. The balance depends on the next board commitment.`,
      condition: category === 'EmergencySupport'
        ? 'Keep the team solvent through the deadline.'
        : 'Match or beat the current constructors position at the deadline.',
      deadlineRound: Math.min(state.calendar.length, state.currentRaceIndex + 4),
    };
  } else {
    request = {
      id,
      category,
      requestedMillions,
      approvedMillions: 0,
      requestedRound: state.currentRaceIndex,
      status: 'Denied',
      response: `The owner declined the ${FUNDING_LABELS[category]} request.`,
    };
  }
  const amount = toMoney(request.approvedMillions);
  const patienceHit = recentRequests >= 2 ? 2 : request.status === 'Denied' ? 1 : 0;
  return {
    ...state,
    teams: state.teams.map((team) => team.id === state.selectedTeamId ? { ...team, budget: team.budget + amount } : team),
    finance: amount > 0 ? [...(state.finance ?? []), {
      id: `txn-${id}`,
      season: state.seasonYear,
      round: state.currentRaceIndex,
      category: 'Operations',
      label: `Owner funding: ${FUNDING_LABELS[category]}`,
      amount,
    }] : state.finance,
    teamReputations: reputation ? {
      ...state.teamReputations,
      [state.selectedTeamId]: { ...reputation, ownerPatience: Math.max(0, patience - patienceHit) },
    } : state.teamReputations,
    boardroom: { ...boardroom, fundingRequests: [...boardroom.fundingRequests, request].slice(-30) },
  };
}

function assessment(area: BoardroomAreaAssessment['area'], score: number, summary: string): BoardroomAreaAssessment {
  return {
    area,
    assessment: score >= 65 ? 'Strong' : score >= 42 ? 'Acceptable' : 'Concern',
    summary,
  };
}

function boardroomStage(round: number, totalRounds: number): BoardroomReviewStage | undefined {
  if (round === Math.max(1, Math.ceil(totalRounds * 0.25))) return 'EarlySeason';
  if (round === Math.max(2, Math.ceil(totalRounds * 0.5))) return 'Midseason';
  if (round === totalRounds) return 'Postseason';
  return undefined;
}

function categoryWeight(personality: OwnerPersonality | undefined, area: BoardroomAreaAssessment['area']): number {
  if (personality === 'BudgetHawk' && area === 'Finances') return 1.8;
  if (personality === 'PatientBuilder' && ['CarDevelopment', 'Academy'].includes(area)) return 1.5;
  if (personality === 'RacingPurist' && ['DriverManagement', 'Academy'].includes(area)) return 1.5;
  if (personality === 'Showman' && ['Sponsors', 'Reputation'].includes(area)) return 1.5;
  if (personality === 'WinNowTycoon' && area === 'Results') return 2;
  if (personality === 'OldGuard' && area === 'DriverManagement') return 1.4;
  return 1;
}

function conductReview(state: GameState, round: number, stage: BoardroomReviewStage): BoardroomReview {
  const expectation = state.teamExpectations?.[state.selectedTeamId];
  const standingIndex = state.constructorStandings.findIndex((entry) => entry.entityId === state.selectedTeamId);
  const target = expectation?.minimumConstructorPosition ?? Math.ceil(state.teams.length / 2);
  const resultsScore = Math.max(0, Math.min(100, 62 + (target - (standingIndex + 1 || state.teams.length)) * 12));
  const team = state.teams.find((entry) => entry.id === state.selectedTeamId);
  const financialScore = team && team.budget >= 0 ? Math.min(100, 55 + team.budget / 5_000_000) : 20;
  const activeProjects = state.teamTechnical?.[state.selectedTeamId]?.activeProjects.length ?? 0;
  const developmentScore = Math.min(100, 45 + activeProjects * 8);
  const relationships = Object.values(state.driverRelationships ?? {}).filter((entry) => entry.teamId === state.selectedTeamId);
  const driverScore = relationships.length
    ? relationships.reduce((sum, entry) => sum + entry.trustInTeam, 0) / relationships.length
    : 50;
  const academyScore = Math.min(100, 40 + (state.academy?.length ?? 0) * 15);
  const sponsorConfidence = state.commercial?.sponsors.length
    ? state.commercial.sponsors.reduce((sum, sponsor) => sum + sponsor.confidence, 0) / state.commercial.sponsors.length
    : 35;
  const reputationScore = state.teamReputations?.[state.selectedTeamId]?.reputation ?? team?.reputation ?? 50;
  const assessments = [
    assessment('Results', resultsScore, `The team is P${standingIndex >= 0 ? standingIndex + 1 : '—'} against the board’s P${target} reference.`),
    assessment('Finances', financialScore, team && team.budget >= 0 ? 'The team remains financially controlled.' : 'The team is operating beyond its available budget.'),
    assessment('CarDevelopment', developmentScore, activeProjects > 0 ? 'The technical programme is visibly active.' : 'The board sees limited evidence of active technical progress.'),
    assessment('DriverManagement', driverScore, driverScore >= 50 ? 'The race-team relationship is broadly stable.' : 'Driver trust is becoming a boardroom concern.'),
    assessment('Academy', academyScore, (state.academy?.length ?? 0) > 0 ? 'The academy has an active development pathway.' : 'There is no visible academy pipeline.'),
    assessment('Sponsors', sponsorConfidence, `Sponsor relationships are ${sponsorConfidence >= 60 ? 'healthy' : sponsorConfidence >= 40 ? 'being monitored' : 'under pressure'}.`),
    assessment('Reputation', reputationScore, `The team’s paddock standing is ${reputationScore >= 65 ? 'strong' : reputationScore >= 40 ? 'stable' : 'fragile'}.`),
  ];
  const personality = state.teamReputations?.[state.selectedTeamId]?.ownerPersonality;
  const weighted = assessments.reduce((sum, item) => {
    const value = item.assessment === 'Strong' ? 80 : item.assessment === 'Acceptable' ? 55 : 25;
    return sum + value * categoryWeight(personality, item.area);
  }, 0);
  const weights = assessments.reduce((sum, item) => sum + categoryWeight(personality, item.area), 0);
  let score = weighted / weights;
  if (state.boardroom?.mandate === 'Ambitious') score -= 7;
  if (state.boardroom?.mandate === 'Conservative') score += 5;
  const verdict = score >= 74 ? 'Impressed' : score >= 53 ? 'Satisfied' : score >= 32 ? 'Concerned' : 'Ultimatum';
  const patienceDelta = verdict === 'Impressed' ? 6 : verdict === 'Satisfied' ? 2 : verdict === 'Concerned' ? -6 : -14;
  return {
    id: `board-review-${state.seasonYear}-${stage}`,
    teamId: state.selectedTeamId,
    seasonYear: state.seasonYear,
    round,
    stage,
    assessments,
    verdict,
    patienceDelta,
    summary: verdict === 'Impressed'
      ? 'Ownership believes the project is outperforming its mandate.'
      : verdict === 'Satisfied'
        ? 'Ownership sees the project as broadly on course.'
        : verdict === 'Concerned'
          ? 'Ownership expects a visible response before the next formal review.'
          : 'Ownership has issued a final performance ultimatum.',
  };
}

function resolveConditions(state: GameState, round: number): {
  boardroom: BoardroomState;
  fundingMillions: number;
  patienceDelta: number;
} {
  const boardroom = state.boardroom ?? emptyBoardroom();
  let fundingMillions = 0;
  let patienceDelta = 0;
  const currentPosition = state.constructorStandings.findIndex((entry) => entry.entityId === state.selectedTeamId) + 1;
  const requests = boardroom.fundingRequests.map((request) => {
    if (request.status !== 'Conditional' || request.deadlineRound !== round) return request;
    const startPosition = state.teamExpectations?.[state.selectedTeamId]?.minimumConstructorPosition ?? currentPosition;
    const team = state.teams.find((entry) => entry.id === state.selectedTeamId);
    const fulfilled = request.category === 'EmergencySupport'
      ? (team?.budget ?? -1) >= 0
      : currentPosition > 0 && currentPosition <= startPosition;
    if (fulfilled) {
      const balance = Math.max(0, request.requestedMillions - request.approvedMillions);
      fundingMillions += balance;
      patienceDelta += 3;
      return { ...request, status: 'Fulfilled' as const, approvedMillions: request.requestedMillions, response: `${request.condition} Commitment fulfilled; the remaining funding was released.` };
    }
    patienceDelta -= 7;
    return { ...request, status: 'Breached' as const, response: `${request.condition} Commitment missed; owner confidence has fallen.` };
  });
  return { boardroom: { ...boardroom, fundingRequests: requests }, fundingMillions, patienceDelta };
}

export function processBoardroomAfterRace(state: GameState, round: number): GameState {
  const stage = boardroomStage(round, state.calendar.length);
  const condition = resolveConditions(state, round);
  let boardroom = condition.boardroom;
  let patienceDelta = condition.patienceDelta;
  let principal = state.principal;
  const news: NewsItem[] = [];
  if (boardroom.ultimatum?.deadlineRound === round) {
    const target = state.teamExpectations?.[state.selectedTeamId]?.minimumConstructorPosition ?? Math.ceil(state.teams.length / 2);
    const position = state.constructorStandings.findIndex((entry) => entry.entityId === state.selectedTeamId) + 1;
    const survived = position > 0 && position <= target;
    patienceDelta += survived ? 5 : -12;
    principal = principal ? {
      ...principal,
      jobSecurity: Math.max(0, Math.min(100, principal.jobSecurity + (survived ? 8 : -15))),
    } : principal;
    news.push({
      id: `board-ultimatum-${state.seasonYear}-${round}`,
      round,
      headline: survived ? 'Owner ultimatum satisfied' : 'Owner ultimatum failed',
      body: survived
        ? 'The required performance response restored some board confidence.'
        : 'The team missed the owner’s deadline. Job security has deteriorated sharply ahead of the next formal decision.',
      timestamp: new Date().toISOString(),
      category: 'career_event',
      priority: survived ? 'normal' : 'critical',
      teamId: state.selectedTeamId,
    });
    boardroom = { ...boardroom, ultimatum: undefined };
  }
  if (stage && !boardroom.reviews.some((review) => review.seasonYear === state.seasonYear && review.stage === stage)) {
    const review = conductReview({ ...state, boardroom }, round, stage);
    boardroom = {
      ...boardroom,
      reviews: [...boardroom.reviews, review].slice(-20),
      autonomy: review.verdict === 'Impressed' ? 'Trusted' : review.verdict === 'Ultimatum' ? 'Restricted' : boardroom.autonomy,
      contractExtensionYears: review.verdict === 'Impressed'
        ? Math.min(3, boardroom.contractExtensionYears + 1)
        : boardroom.contractExtensionYears,
      ultimatum: review.verdict === 'Ultimatum'
        ? {
            issuedRound: round,
            deadlineRound: Math.min(state.calendar.length, round + Math.max(2, Math.ceil(state.calendar.length * 0.15))),
            requirement: 'Reach the board’s minimum constructors position by the deadline.',
          }
        : boardroom.ultimatum,
    };
    patienceDelta += review.patienceDelta;
    if (principal) {
      const securityDelta = review.verdict === 'Impressed' ? 6 : review.verdict === 'Satisfied' ? 2 : review.verdict === 'Concerned' ? -6 : -12;
      const extension = review.verdict === 'Impressed' && stage !== 'EarlySeason' ? 1 : 0;
      principal = {
        ...principal,
        jobSecurity: Math.max(0, Math.min(100, principal.jobSecurity + securityDelta)),
        contractYearsRemaining: Math.min(5, principal.contractYearsRemaining + extension),
      };
    }
    news.push({
      id: review.id,
      round,
      headline: `${stage === 'Midseason' ? 'Midseason' : stage === 'Postseason' ? 'Postseason' : 'Early-season'} owner review: ${review.verdict}`,
      body: review.summary,
      timestamp: new Date().toISOString(),
      category: 'career_event',
      priority: review.verdict === 'Ultimatum' ? 'high' : 'normal',
      teamId: state.selectedTeamId,
    });
  }
  const funding = toMoney(condition.fundingMillions);
  const reputation = state.teamReputations?.[state.selectedTeamId];
  return {
    ...state,
    teams: funding > 0
      ? state.teams.map((team) => team.id === state.selectedTeamId ? { ...team, budget: team.budget + funding } : team)
      : state.teams,
    finance: funding > 0 ? [...(state.finance ?? []), {
      id: `txn-board-condition-${state.seasonYear}-${round}`,
      season: state.seasonYear,
      round,
      category: 'Operations',
      label: 'Conditional owner funding released',
      amount: funding,
    }] : state.finance,
    boardroom,
    principal,
    teamReputations: reputation ? {
      ...state.teamReputations,
      [state.selectedTeamId]: {
        ...reputation,
        ownerPatience: Math.max(0, Math.min(100, reputation.ownerPatience + patienceDelta)),
      },
    } : state.teamReputations,
    news: [...news, ...state.news].slice(0, 80),
  };
}
