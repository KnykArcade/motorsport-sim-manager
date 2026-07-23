import type { GameState } from '../game/careerState';
import type { RaceResult, Team } from '../types/gameTypes';
import type { BoardroomMandateLevel } from '../types/expectationTypes';
import type {
  PublicReaction,
  PublicReactionSentiment,
  PublicReactionTrigger,
  PublicReputationState,
  TeamPublicIdentity,
} from '../types/publicReputationTypes';
import type { TeamOrganizationRatings } from '../types/teamRatingsTypes';
import { calculateOverallTeamRating } from './teamRatingsEngine';
import { classifyDnfCause } from './dnfModel';

function clamp(value: number, low = 0, high = 100): number {
  return Math.max(low, Math.min(high, Math.round(value)));
}

function publicIdentity(
  team: Team | undefined,
  organization: TeamOrganizationRatings | undefined,
  historicalPrestige: number,
): TeamPublicIdentity {
  const reputation = team?.reputation ?? historicalPrestige;
  if (historicalPrestige >= 78 && reputation >= 70) return 'Historic';
  if (reputation >= 78 && (organization?.carPerformance ?? reputation) >= 72) return 'Dominant';
  if (historicalPrestige <= 28 && reputation <= 35) return 'Newcomer';
  if ((organization?.financialStability ?? 55) < 42) return 'Privateer';
  if (reputation < 48) return 'Underdog';
  return 'Established';
}

export function buildInitialPublicReputation(
  team: Team | undefined,
  principalStanding: number,
  organization: TeamOrganizationRatings | undefined,
  fanExpectation: number,
  historicalPrestige: number,
): PublicReputationState {
  const teamStanding = clamp(team?.reputation ?? 50);
  return {
    identity: publicIdentity(team, organization, historicalPrestige),
    teamStanding,
    principalStanding: clamp(principalStanding),
    fanConfidence: clamp(organization?.fanSupport ?? teamStanding),
    fanExpectation: clamp(fanExpectation),
    momentum: 0,
    recentReactions: [],
    lastUpdatedRound: 0,
  };
}

export function publicReputationFor(state: GameState): PublicReputationState {
  if (state.publicReputation) return state.publicReputation;
  const team = state.teams.find((candidate) => candidate.id === state.selectedTeamId);
  const reputation = state.teamReputations?.[state.selectedTeamId];
  return buildInitialPublicReputation(
    team,
    state.principal?.reputation ?? state.teamPrincipal?.reputation ?? team?.reputation ?? 50,
    state.teamOrgRatings?.[state.selectedTeamId],
    reputation?.fanExpectation ?? team?.reputation ?? 50,
    reputation?.historicalPrestige ?? team?.reputation ?? 50,
  );
}

function identityMultiplier(identity: TeamPublicIdentity, delta: number): number {
  if (delta > 0 && (identity === 'Underdog' || identity === 'Privateer' || identity === 'Newcomer')) return 1.35;
  if (delta < 0 && (identity === 'Dominant' || identity === 'Historic')) return 1.3;
  return 1;
}

export type PublicReactionInput = {
  trigger: PublicReactionTrigger;
  delta: number;
  headline: string;
  detail: string;
  round?: number;
  sentiment?: PublicReactionSentiment;
  idSuffix?: string;
};

export function applyPublicReaction(state: GameState, input: PublicReactionInput): GameState {
  const current = publicReputationFor(state);
  const adjustedDelta = Math.round(input.delta * identityMultiplier(current.identity, input.delta));
  const round = input.round ?? state.currentRaceIndex;
  const sentiment = input.sentiment
    ?? (adjustedDelta >= 2 ? 'Positive' : adjustedDelta <= -2 ? 'Negative' : 'Mixed');
  const reaction: PublicReaction = {
    id: `public-${state.seasonYear}-${round}-${input.trigger}-${input.idSuffix ?? current.recentReactions.length}`,
    seasonYear: state.seasonYear,
    round,
    trigger: input.trigger,
    sentiment,
    headline: input.headline,
    detail: input.detail,
  };
  if (current.recentReactions.some((item) => item.id === reaction.id)) return state;

  const momentum = clamp(Math.round(current.momentum * 0.7 + adjustedDelta * 6), -100, 100);
  const fanConfidence = clamp(current.fanConfidence + adjustedDelta);
  const teamStanding = clamp(current.teamStanding + Math.sign(adjustedDelta) * Math.min(2, Math.ceil(Math.abs(adjustedDelta) / 4)));
  const principalStanding = clamp(current.principalStanding + Math.sign(adjustedDelta) * Math.min(2, Math.ceil(Math.abs(adjustedDelta) / 3)));
  const expectationDrift = Math.abs(momentum) >= 45 ? Math.sign(momentum) : 0;
  const fanExpectation = clamp(current.fanExpectation + expectationDrift);
  const publicReputation: PublicReputationState = {
    ...current,
    teamStanding,
    principalStanding,
    fanConfidence,
    fanExpectation,
    momentum,
    recentReactions: [reaction, ...current.recentReactions].slice(0, 30),
    lastUpdatedRound: round,
  };

  const organization = state.teamOrgRatings?.[state.selectedTeamId];
  const nextOrganization = organization ? {
    ...organization,
    fanSupport: fanConfidence,
    marketing: clamp(organization.marketing + Math.sign(adjustedDelta)),
    sponsorAppeal: clamp(organization.sponsorAppeal + (momentum >= 30 ? 1 : momentum <= -30 ? -1 : 0)),
  } : undefined;
  if (nextOrganization) nextOrganization.overallTeamRating = calculateOverallTeamRating(nextOrganization);

  const teamReputation = state.teamReputations?.[state.selectedTeamId];
  const commercialShift = momentum >= 35 ? 1 : momentum <= -35 ? -1 : 0;
  const sponsorShift = adjustedDelta >= 4 ? 1 : adjustedDelta <= -4 ? -1 : 0;

  return {
    ...state,
    publicReputation,
    teams: state.teams.map((team) => team.id === state.selectedTeamId
      ? { ...team, reputation: teamStanding }
      : team),
    principal: state.principal ? { ...state.principal, reputation: principalStanding } : state.principal,
    teamOrgRatings: nextOrganization ? {
      ...state.teamOrgRatings,
      [state.selectedTeamId]: nextOrganization,
    } : state.teamOrgRatings,
    teamReputations: teamReputation ? {
      ...state.teamReputations,
      [state.selectedTeamId]: {
        ...teamReputation,
        reputation: teamStanding,
        fanExpectation,
        sponsorConfidence: clamp(teamReputation.sponsorConfidence + sponsorShift),
      },
    } : state.teamReputations,
    commercial: state.commercial ? {
      ...state.commercial,
      commercialReputation: clamp(state.commercial.commercialReputation + commercialShift),
    } : state.commercial,
  };
}

function resultDelta(
  state: GameState,
  results: RaceResult[],
): { delta: number; headline: string; detail: string; trigger: PublicReactionTrigger } {
  const team = state.teams.find((candidate) => candidate.id === state.selectedTeamId);
  const expected = team?.expectedStanding
    ?? state.teamExpectations?.[state.selectedTeamId]?.minimumConstructorPosition
    ?? Math.max(1, Math.ceil(state.teams.length / 2));
  const constructorPosition = state.constructorStandings.findIndex((entry) => entry.entityId === state.selectedTeamId) + 1;
  const classified = results.filter((result) => result.position !== null);
  const best = classified.sort((a, b) => (a.position ?? 999) - (b.position ?? 999))[0];
  const mechanicalDnfs = results.filter((result) =>
    result.status === 'DNF' && classifyDnfCause(result.incidents.join(' ')) === 'Mechanical');
  let delta = constructorPosition > 0 && constructorPosition <= expected ? 2 : -2;
  if (best?.position === 1) delta += 6;
  else if (best?.position !== null && best !== undefined && best.position <= 3) delta += 4;
  else if (best && best.points > 0) delta += 2;
  if (results.length > 0 && results.every((result) => result.status !== 'Finished')) delta -= 5;
  else delta -= mechanicalDnfs.length * 2;

  if (mechanicalDnfs.length > 0) {
    return {
      delta,
      trigger: 'Reliability',
      headline: mechanicalDnfs.length === results.length
        ? 'Reliability failure tests supporter patience'
        : 'Mechanical trouble tempers the weekend',
      detail: `${mechanicalDnfs.length} team car${mechanicalDnfs.length === 1 ? '' : 's'} retired mechanically. Supporters judge the setback against the team’s season expectations.`,
    };
  }
  return {
    delta,
    trigger: 'RaceResult',
    headline: best?.position === 1
      ? 'Victory sends supporter confidence surging'
      : best?.position !== null && best !== undefined && best.position <= 3
        ? 'Podium lifts the public mood'
        : constructorPosition > 0 && constructorPosition <= expected
          ? 'Team continues to meet public expectations'
          : 'Results fall short of supporter expectations',
    detail: best
      ? `The team’s best car finished P${best.position}. Its championship position is being judged against an expected level around P${expected}.`
      : 'Neither team car recorded a classified result.',
  };
}

export function processRacePublicReaction(
  state: GameState,
  results: RaceResult[],
  teamOrderCount: number,
  round: number,
  raceId: string,
): GameState {
  const raceReaction = resultDelta(state, results);
  let next = applyPublicReaction(state, { ...raceReaction, round, idSuffix: raceId });
  if (teamOrderCount > 0) {
    const won = results.some((result) => result.position === 1);
    next = applyPublicReaction(next, {
      trigger: 'TeamOrders',
      delta: won ? 0 : -2,
      sentiment: 'Mixed',
      headline: won ? 'Team orders divide opinion despite victory' : 'Team orders draw scrutiny',
      detail: `${teamOrderCount} team-order decision${teamOrderCount === 1 ? ' was' : 's were'} visible during the race. Supporters are weighing competitive necessity against sporting fairness.`,
      round,
      idSuffix: raceId,
    });
  }
  return next;
}

export function recordMandateReaction(state: GameState, mandate: BoardroomMandateLevel): GameState {
  const delta = mandate === 'Ambitious' ? 3 : mandate === 'Conservative' ? -2 : 0;
  return applyPublicReaction(state, {
    trigger: 'BoardMandate',
    delta,
    sentiment: mandate === 'Ambitious' ? 'Positive' : mandate === 'Conservative' ? 'Mixed' : 'Mixed',
    headline: `${mandate} season mandate shapes supporter expectations`,
    detail: mandate === 'Ambitious'
      ? 'Supporters welcome the public ambition, but expectations will rise with it.'
      : mandate === 'Conservative'
        ? 'Some supporters accept the rebuild while others want a bolder sporting target.'
        : 'The agreed target broadly matches what supporters already expect.',
    round: 0,
    idSuffix: mandate,
  });
}

export function publicMomentumLabel(momentum: number): string {
  if (momentum >= 55) return 'Surging';
  if (momentum >= 20) return 'Building';
  if (momentum <= -55) return 'Collapsing';
  if (momentum <= -20) return 'Fading';
  return 'Steady';
}

export function publicConfidenceLabel(confidence: number): string {
  if (confidence >= 75) return 'United behind the team';
  if (confidence >= 58) return 'Generally supportive';
  if (confidence >= 42) return 'Divided';
  if (confidence >= 25) return 'Restless';
  return 'Openly hostile';
}

export function publicExpectationLabel(expectation: number): string {
  if (expectation >= 80) return 'Championship standard';
  if (expectation >= 65) return 'Wins and podiums';
  if (expectation >= 48) return 'Regular points progress';
  if (expectation >= 30) return 'Visible improvement';
  return 'Survival and stability';
}

export function publicStandingLabel(standing: number): string {
  if (standing >= 80) return 'Elite public standing';
  if (standing >= 65) return 'Highly regarded';
  if (standing >= 48) return 'Established';
  if (standing >= 30) return 'Still proving itself';
  return 'Public credibility at risk';
}
