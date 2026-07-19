import type { GameState } from '../../game/careerState';
import type { OwnerPersonality } from '../../types/expectationTypes';
import {
  OWNER_PERSONALITY_DESCRIPTIONS,
  OWNER_PERSONALITY_LABELS,
} from '../../types/expectationTypes';
import type { JobOffer } from '../../types/principalTypes';
import type { RelationshipAttentionStatus } from '../../sim/relationshipAttentionEngine';

export type PotentialEmployerOpportunity = {
  offer: JobOffer;
  teamName: string;
  ownerPersonality?: OwnerPersonality;
  ownerLabel: string;
  ownerMotivation: string;
  interestReason: string;
  accepted: boolean;
};

export type PotentialEmployerStanding = {
  authorityRank: 6;
  authorityLabel: string;
  status: RelationshipAttentionStatus;
  marketStanding: number;
  firmOffers: number;
  rumors: number;
  reasons: string[];
  opportunities: PotentialEmployerOpportunity[];
};

type EmployerState = Pick<
  GameState,
  'principal' | 'jobOffers' | 'acceptedJobOfferId' | 'teams' | 'teamReputations'
>;

function ownerProfile(personality: OwnerPersonality | undefined): {
  label: string;
  motivation: string;
} {
  if (!personality) {
    return {
      label: 'Owner profile developing',
      motivation: 'This owner’s priorities are not yet established in the paddock intelligence available to you.',
    };
  }
  return {
    label: OWNER_PERSONALITY_LABELS[personality],
    motivation: OWNER_PERSONALITY_DESCRIPTIONS[personality],
  };
}

function interestReason(offer: JobOffer, standing: number): string {
  const gap = standing - offer.prestige;
  if (offer.kind === 'Offer') {
    return gap >= 0
      ? `Firm offer: your market standing ${standing} meets this team’s prestige bar of ${offer.prestige}.`
      : `Firm offer remains active from the last owner review; current standing ${standing}, team prestige ${offer.prestige}.`;
  }
  return gap < 0
    ? `Informal interest: your standing is ${Math.abs(gap)} point${Math.abs(gap) === 1 ? '' : 's'} below this team’s prestige, but still close enough to be monitored.`
    : `Informal interest only, despite current standing ${standing} against team prestige ${offer.prestige}.`;
}

export function currentPotentialEmployerStanding(
  state: EmployerState,
): PotentialEmployerStanding | undefined {
  const principal = state.principal;
  if (!principal) return undefined;

  const marketStanding = Math.round(principal.reputation * 0.7 + principal.jobSecurity * 0.3);
  const offers = (state.jobOffers ?? []).slice().sort((a, b) =>
    Number(b.id === state.acceptedJobOfferId) - Number(a.id === state.acceptedJobOfferId)
    || Number(b.kind === 'Offer') - Number(a.kind === 'Offer')
    || b.prestige - a.prestige);
  const firmOffers = offers.filter((offer) => offer.kind === 'Offer').length;
  const rumors = offers.length - firmOffers;
  const acceptedOffer = offers.find((offer) => offer.id === state.acceptedJobOfferId);

  const opportunities = offers.map((offer) => {
    const team = state.teams.find((entry) => entry.id === offer.teamId);
    const personality = state.teamReputations?.[offer.teamId]?.ownerPersonality;
    const owner = ownerProfile(personality);
    return {
      offer,
      teamName: team?.name ?? offer.teamId,
      ownerPersonality: personality,
      ownerLabel: owner.label,
      ownerMotivation: owner.motivation,
      interestReason: interestReason(offer, marketStanding),
      accepted: offer.id === state.acceptedJobOfferId,
    };
  });

  const reasons: string[] = [];
  if (acceptedOffer) {
    const teamName = opportunities.find((entry) => entry.offer.id === acceptedOffer.id)?.teamName ?? acceptedOffer.teamId;
    reasons.push(`A next-season move to ${teamName} is accepted; the transition is now an active career relationship.`);
  }
  if (firmOffers > 0) reasons.push(`${firmOffers} rival owner${firmOffers === 1 ? ' has' : 's have'} made a firm offer.`);
  if (rumors > 0) reasons.push(`${rumors} rival owner${rumors === 1 ? ' is' : 's are'} monitoring you informally.`);
  if (offers.length === 0) {
    reasons.push('No rival owner is actively approaching you. Rank #6 remains a background priority until your results, reputation, or ambition changes.');
  }
  reasons.push(`Market standing is ${marketStanding}/100: 70% reputation (${principal.reputation}) and 30% current job security (${principal.jobSecurity}).`);

  return {
    authorityRank: 6,
    authorityLabel: 'Potential employers — career leverage, not current-team authority',
    status: offers.length > 0 ? 'WatchClosely' : 'Stable',
    marketStanding,
    firmOffers,
    rumors,
    reasons,
    opportunities,
  };
}
