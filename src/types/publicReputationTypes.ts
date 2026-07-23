export type TeamPublicIdentity =
  | 'Dominant'
  | 'Historic'
  | 'Established'
  | 'Privateer'
  | 'Newcomer'
  | 'Underdog';

export type PublicReactionTrigger =
  | 'RaceResult'
  | 'Reliability'
  | 'TeamOrders'
  | 'DriverSigning'
  | 'DriverRelease'
  | 'SponsorDecision'
  | 'BoardMandate'
  | 'MediaResponse'
  | 'Controversy';

export type PublicReactionSentiment = 'Positive' | 'Mixed' | 'Negative';

export type PublicReaction = {
  id: string;
  seasonYear: number;
  round: number;
  trigger: PublicReactionTrigger;
  sentiment: PublicReactionSentiment;
  headline: string;
  detail: string;
};

export type PublicReputationState = {
  identity: TeamPublicIdentity;
  teamStanding: number;
  principalStanding: number;
  fanConfidence: number;
  fanExpectation: number;
  momentum: number;
  recentReactions: PublicReaction[];
  lastUpdatedRound: number;
};
