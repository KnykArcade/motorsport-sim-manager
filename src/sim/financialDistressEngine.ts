// Financial Distress Consequence Engine
//
// Applies real gameplay consequences when financial distress escalates beyond
// Stable. Consequences include owner intervention news, morale hits, sponsor
// confidence hits, development restrictions, and closure/replacement hooks
// stored in state for future expansion.
//
// This engine is intentionally lightweight — it does not delete teams or end
// saves. It creates pressure and narrative without breaking the game.

import type { NewsItem, NewsCategory, NewsPriority } from '../types/gameTypes';
import type { FinancialDistressState, FinancialDistressLevel } from '../types/raceWeekendPackageTypes';

// Consequence result — applied by the reducer to update game state.
export type DistressConsequence = {
  news: NewsItem[];
  // Morale delta to apply to team (0 = no change).
  teamMoraleDelta: number;
  // Sponsor confidence delta (0 = no change).
  sponsorConfidenceDelta: number;
  // Development capacity multiplier (1.0 = normal, <1 = restricted).
  developmentCapacityMultiplier: number;
  // Whether owner intervention is triggered.
  ownerIntervention: boolean;
  // Whether a future closure/replacement hook should be stored.
  closureHook: boolean;
  // Principal pressure delta (0 = no change).
  principalPressureDelta: number;
};

// Check if a distress level change is an escalation (new level is worse than old).
export function isEscalation(
  oldLevel: FinancialDistressLevel | undefined,
  newLevel: FinancialDistressLevel,
): boolean {
  const order: FinancialDistressLevel[] = ['Stable', 'Tight', 'AtRisk', 'Critical', 'Administration', 'ClosureRisk'];
  const oldIdx = oldLevel ? order.indexOf(oldLevel) : 0;
  const newIdx = order.indexOf(newLevel);
  return newIdx > oldIdx;
}

// Generate consequences for a team based on their financial distress state.
// Only generates consequences when the level has escalated or is at a
// non-Stable level during periodic checks.
export function applyDistressConsequences(
  teamId: string,
  teamName: string,
  distress: FinancialDistressState,
  prevDistress: FinancialDistressState | undefined,
  seasonYear: number,
  round: number | undefined,
): DistressConsequence {
  const escalated = isEscalation(prevDistress?.level, distress.level);
  const deEscalated = prevDistress && prevDistress.level !== 'Stable' && distress.level === 'Stable';
  const news: NewsItem[] = [];
  let teamMoraleDelta = 0;
  let sponsorConfidenceDelta = 0;
  let developmentCapacityMultiplier = 1.0;
  let ownerIntervention = false;
  let closureHook = false;
  let principalPressureDelta = 0;

  // Recovery from distress — good news!
  if (deEscalated) {
    const phase = 'paddock_week';
    const baseId = `news-distress-consequence-${seasonYear}-${round ?? 0}-${teamId}`;
    news.push(makeNews(
      `${baseId}-recovery`,
      round,
      `${teamName} finances stabilize`,
      'financial',
      'normal',
      phase,
      'The team has returned to financial stability after a period of difficulty.',
      teamId,
    ));
    teamMoraleDelta = 3;
    sponsorConfidenceDelta = 5;
    principalPressureDelta = -10;
    return {
      news,
      teamMoraleDelta,
      sponsorConfidenceDelta,
      developmentCapacityMultiplier,
      ownerIntervention,
      closureHook,
      principalPressureDelta,
    };
  }

  // Only apply consequences on escalation or when at a severe level.
  if (!escalated && distress.level === 'Stable') {
    return {
      news: [],
      teamMoraleDelta: 0,
      sponsorConfidenceDelta: 0,
      developmentCapacityMultiplier: 1.0,
      ownerIntervention: false,
      closureHook: false,
      principalPressureDelta: 0,
    };
  }

  const phase = 'paddock_week';
  const baseId = `news-distress-consequence-${seasonYear}-${round ?? 0}-${teamId}`;

  switch (distress.level) {
    case 'Tight':
      if (escalated) {
        news.push(makeNews(
          `${baseId}-tight`,
          round,
          `${teamName} finances tighten as budget runs thin`,
          'financial',
          'normal',
          phase,
          'The team is operating with a thin margin and must manage costs carefully.',
          teamId,
        ));
      }
      sponsorConfidenceDelta = -2;
      principalPressureDelta = 5;
      break;

    case 'AtRisk':
      if (escalated) {
        news.push(makeNews(
          `${baseId}-atrisk`,
          round,
          `Financial pressure mounts at ${teamName}`,
          'financial',
          'high',
          phase,
          `${distress.consecutiveNegativeCashRaces} consecutive races in the red. Owner pressure is rising.`,
          teamId,
        ));
      }
      teamMoraleDelta = -2;
      sponsorConfidenceDelta = -5;
      principalPressureDelta = 10;
      break;

    case 'Critical':
      if (escalated) {
        news.push(makeNews(
          `${baseId}-critical`,
          round,
          `${teamName} in critical financial state`,
          'financial',
          'high',
          phase,
          'Prolonged financial distress has reached critical levels. The team faces owner intervention if the situation does not improve.',
          teamId,
        ));
      }
      teamMoraleDelta = -5;
      sponsorConfidenceDelta = -10;
      developmentCapacityMultiplier = 0.75;
      principalPressureDelta = 15;
      ownerIntervention = escalated;
      break;

    case 'Administration':
      if (escalated) {
        news.push(makeNews(
          `${baseId}-admin`,
          round,
          `Owner intervention at ${teamName}`,
          'financial',
          'critical',
          phase,
          'The team owner has intervened directly. Budget controls are imposed, development is restricted, and the principal is on notice.',
          teamId,
        ));
      }
      teamMoraleDelta = -8;
      sponsorConfidenceDelta = -15;
      developmentCapacityMultiplier = 0.5;
      principalPressureDelta = 25;
      ownerIntervention = true;
      break;

    case 'ClosureRisk':
      if (escalated) {
        news.push(makeNews(
          `${baseId}-closure`,
          round,
          `${teamName} at risk of closure`,
          'financial',
          'critical',
          phase,
          'Severe and prolonged financial distress has put the team\'s future in jeopardy. Without a dramatic turnaround, the team may not survive the offseason.',
          teamId,
        ));
        news.push(makeNews(
          `${baseId}-closure-owner`,
          round,
          `Owner bailout considered for ${teamName}`,
          'financial',
          'critical',
          phase,
          'The team owner is evaluating whether to bail out the team, force a sale, or withdraw from the championship entirely.',
          teamId,
        ));
      }
      teamMoraleDelta = -12;
      sponsorConfidenceDelta = -25;
      developmentCapacityMultiplier = 0.25;
      principalPressureDelta = 40;
      ownerIntervention = true;
      closureHook = true;
      break;
  }

  return {
    news,
    teamMoraleDelta,
    sponsorConfidenceDelta,
    developmentCapacityMultiplier,
    ownerIntervention,
    closureHook,
    principalPressureDelta,
  };
}

function makeNews(
  id: string,
  round: number | undefined,
  headline: string,
  category: NewsCategory,
  priority: NewsPriority,
  careerPhase: string,
  body?: string,
  teamId?: string,
): NewsItem {
  return {
    id,
    round,
    headline,
    body,
    timestamp: new Date().toISOString(),
    category,
    priority,
    careerPhase,
    teamId,
  };
}
