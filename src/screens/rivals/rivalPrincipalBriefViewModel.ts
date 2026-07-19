import type { GameState } from '../../game/careerState';
import type { CharacterAgenda, CharacterInteractionTarget } from '../../types/characterInteractionTypes';
import type { PrincipalIdentity, RivalRelationship, RivalRelationshipTag } from '../../types/phase18Types';
import { characterOpinionFor } from '../../sim/characterOpinionEngine';
import {
  PRINCIPAL_IDENTITY_DESCRIPTIONS,
  PRINCIPAL_IDENTITY_LABELS,
} from '../../sim/phase18IdentityCultureEngine';

export type RivalPrincipalRisk = 'High' | 'Watch' | 'Routine';
export type RivalPrincipalTrend = 'Improving' | 'Deteriorating' | 'Steady';

export type RivalPrincipalBrief = {
  authorityRank: 7;
  principalName: string;
  identity: PrincipalIdentity;
  identityLabel: string;
  identityDescription: string;
  agenda: CharacterAgenda;
  agendaLabel: string;
  agendaDescription: string;
  risk: RivalPrincipalRisk;
  trend: RivalPrincipalTrend;
  reasons: string[];
  stakes: string[];
  latestChange?: {
    reason: string;
    amount: number;
    seasonYear: number;
    round?: number;
  };
};

const AGENDA: Partial<Record<CharacterAgenda, { label: string; description: string }>> = {
  Cooperation: {
    label: 'Cooperation',
    description: 'Values workable alliances, private dialogue, and mutual restraint across the paddock.',
  },
  PoliticalInfluence: {
    label: 'Political influence',
    description: 'Values voting blocs, regulation leverage, and visible authority in paddock negotiations.',
  },
  TechnicalAdvantage: {
    label: 'Technical advantage',
    description: 'Protects engineering information and reacts strongly to copying, scrutiny, and innovation races.',
  },
  PublicStanding: {
    label: 'Public standing',
    description: 'Values reputation, headlines, commercial credibility, and winning the public narrative.',
  },
};

const TAG_STAKES: Record<RivalRelationshipTag, string> = {
  TechnicalRival: 'Technical rivalry raises copying scrutiny and the chance that development choices become political.',
  PoliticalBlocAlly: 'Political alignment can turn this principal into a useful regulation-vote ally.',
  SupplierPartner: 'Shared supplier interests give both principals a reason to preserve a workable channel.',
  StaffPoachingRival: 'Staff-market competition makes retention, approaches, and compensation more sensitive.',
  DriverMarketRival: 'Driver-market competition makes silly-season moves more likely to affect this relationship.',
  HistoricRival: 'Established rivalry amplifies public disputes, protests, and competitive flashpoints.',
  CommercialAlly: 'Commercial trust creates room for cooperation even when the teams compete on track.',
};

function riskFor(relationship: RivalRelationship): RivalPrincipalRisk {
  if (relationship.score <= -35 || relationship.technicalSuspicion >= 80 || relationship.politicalAlignment <= -60) return 'High';
  if (relationship.score <= -15 || relationship.technicalSuspicion >= 60 || relationship.commercialTrust <= 30
    || relationship.tags.includes('StaffPoachingRival') || relationship.tags.includes('HistoricRival')) return 'Watch';
  return 'Routine';
}

function trendFor(relationship: RivalRelationship): RivalPrincipalTrend {
  const movement = relationship.history.slice(-3).reduce((sum, event) => sum + event.amount, 0);
  if (movement >= 4) return 'Improving';
  if (movement <= -4) return 'Deteriorating';
  return 'Steady';
}

function relationshipReasons(relationship: RivalRelationship): string[] {
  const reasons: string[] = [];
  if (relationship.score <= -35) reasons.push(`Overall relationship is bitter at ${relationship.score}.`);
  else if (relationship.score <= -15) reasons.push(`Overall relationship is hostile at ${relationship.score}.`);
  else if (relationship.score >= 35) reasons.push(`This is a strategic paddock ally at +${relationship.score}.`);
  else if (relationship.score >= 15) reasons.push(`The teams currently cooperate at +${relationship.score}.`);

  if (relationship.technicalSuspicion >= 60) reasons.push(`Technical suspicion is elevated at ${relationship.technicalSuspicion}/100.`);
  if (relationship.politicalAlignment <= -25) reasons.push(`Political positions are opposed at ${relationship.politicalAlignment}.`);
  else if (relationship.politicalAlignment >= 25) reasons.push(`Political alignment is strong at +${relationship.politicalAlignment}.`);
  if (relationship.commercialTrust <= 35) reasons.push(`Commercial trust is weak at ${relationship.commercialTrust}/100.`);
  else if (relationship.commercialTrust >= 65) reasons.push(`Commercial trust is strong at ${relationship.commercialTrust}/100.`);
  if (relationship.sportingRespect >= 70) reasons.push(`High sporting respect (${relationship.sportingRespect}/100) can contain competitive tension.`);
  else if (relationship.sportingRespect <= 30) reasons.push(`Low sporting respect (${relationship.sportingRespect}/100) makes conflict harder to contain.`);

  if (reasons.length === 0) reasons.push('No relationship dimension is currently at a consequential threshold.');
  return reasons.slice(0, 4);
}

export function rivalPrincipalBrief(
  state: GameState,
  relationship: RivalRelationship,
  rivalTeamId: string,
): RivalPrincipalBrief {
  const principal = state.aiPrincipals?.[rivalTeamId];
  const principalName = principal?.name ?? 'Rival Team Principal';
  const identity = state.phase18?.aiPrincipalIdentities[rivalTeamId]?.dominantIdentity ?? 'BalancedLeader';
  const target: CharacterInteractionTarget = {
    type: 'RivalPrincipal',
    id: principal?.principalId ?? `principal-${rivalTeamId}`,
    name: principalName,
    teamId: rivalTeamId,
  };
  const opinion = characterOpinionFor(state, target);
  const agenda = AGENDA[opinion.agenda] ?? {
    label: opinion.agenda.replace(/([a-z])([A-Z])/g, '$1 $2'),
    description: 'Their current agenda shapes which paddock choices build trust or create resistance.',
  };
  const latest = relationship.history.at(-1);

  return {
    authorityRank: 7,
    principalName,
    identity,
    identityLabel: PRINCIPAL_IDENTITY_LABELS[identity],
    identityDescription: PRINCIPAL_IDENTITY_DESCRIPTIONS[identity],
    agenda: opinion.agenda,
    agendaLabel: agenda.label,
    agendaDescription: agenda.description,
    risk: riskFor(relationship),
    trend: trendFor(relationship),
    reasons: relationshipReasons(relationship),
    stakes: relationship.tags.length > 0
      ? relationship.tags.map((tag) => TAG_STAKES[tag]).slice(0, 4)
      : ['This remains a normal competitive relationship until an event, market move, or political disagreement raises the stakes.'],
    latestChange: latest ? {
      reason: latest.reason,
      amount: latest.amount,
      seasonYear: latest.seasonYear,
      round: latest.round,
    } : undefined,
  };
}
