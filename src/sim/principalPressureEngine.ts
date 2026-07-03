// Team Principal Pressure & Job Movement Engine
//
// Manages principal job security, owner pressure, firings, and movement for
// both the player and AI team principals. Pressure is driven by:
//   - Constructor performance vs expectation
//   - Financial distress (negative balance, emergency packages)
//   - Owner pressure from financial distress system
//   - Race performance trends
//
// The player can be fired in Standard Career mode but not in Team Lock mode.
// AI principals are always subject to pressure and firing rules.
//
// This engine is intentionally conservative — it does not delete teams or break
// saves. Firings generate news and create job-market state for recovery.

import type { NewsItem, NewsCategory, NewsPriority } from '../types/gameTypes';
import type { FinancialDistressState } from '../types/raceWeekendPackageTypes';

// Player career mobility setting.
export type CareerMobilityMode = 'StandardCareer' | 'TeamLock' | 'Sandbox';

// AI principal state tracked per team.
export type AIPrincipalState = {
  principalId: string;
  name: string;
  teamId: string;
  // 0-100: higher = more pressure from owner.
  pressure: number;
  // Years remaining on contract.
  contractYearsRemaining: number;
  // Seasons completed at this team.
  seasonsAtTeam: number;
  // Whether the principal was fired this offseason.
  fired: boolean;
};

// Result of a pressure evaluation for a principal.
export type PrincipalPressureEvaluation = {
  pressureDelta: number;
  newPressure: number;
  shouldFire: boolean;
  news: NewsItem[];
};

// Evaluate principal pressure based on performance and finances.
// Used for both player and AI principals.
export function evaluatePrincipalPressure(
  principalName: string,
  teamId: string,
  teamName: string,
  currentPressure: number,
  distress: FinancialDistressState | undefined,
  constructorPosition: number,
  expectedPosition: number,
  seasonYear: number,
  isPlayer: boolean,
  mobilityMode: CareerMobilityMode,
): PrincipalPressureEvaluation {
  let pressureDelta = 0;
  const news: NewsItem[] = [];

  // Financial distress contribution.
  if (distress) {
    switch (distress.level) {
      case 'Tight':
        pressureDelta += 3;
        break;
      case 'AtRisk':
        pressureDelta += 8;
        break;
      case 'Critical':
        pressureDelta += 15;
        break;
      case 'Administration':
        pressureDelta += 25;
        break;
      case 'ClosureRisk':
        pressureDelta += 40;
        break;
      case 'Stable':
        pressureDelta -= 5;
        break;
    }
  }

  // Performance vs expectation.
  const positionDelta = constructorPosition - expectedPosition;
  if (positionDelta > 0) {
    // Underperforming (higher position = worse).
    pressureDelta += Math.min(20, positionDelta * 3);
  } else if (positionDelta < -2) {
    // Overperforming — reduce pressure.
    pressureDelta += Math.max(-15, positionDelta * 2);
  }

  // Clamp pressure to 0-100.
  const newPressure = Math.max(0, Math.min(100, currentPressure + pressureDelta));

  // Determine if firing is warranted.
  let shouldFire = false;

  if (isPlayer && mobilityMode === 'TeamLock') {
    // Team Lock prevents forced player firing.
    shouldFire = false;
  } else if (isPlayer && mobilityMode === 'Sandbox') {
    // Sandbox mode — no forced firing.
    shouldFire = false;
  } else {
    // Standard Career or AI principal — firing is possible.
    // Fire only at very high pressure with sustained poor performance.
    if (newPressure >= 85) {
      shouldFire = true;
    } else if (newPressure >= 70 && distress && distress.level === 'ClosureRisk') {
      shouldFire = true;
    }
  }

  // Generate pressure news.
  if (pressureDelta > 10 && newPressure >= 50) {
    const isHighPressure = newPressure >= 70;
    news.push(makeNews(
      `news-principal-pressure-${seasonYear}-${teamId}`,
      undefined,
      isHighPressure
        ? `Pressure mounts on ${teamName} principal ${principalName}`
        : `${teamName} principal ${principalName} under scrutiny`,
      'career_event',
      isHighPressure ? 'high' : 'normal',
      'paddock_week',
      isHighPressure
        ? `Owner pressure is mounting at ${teamName}. ${principalName} must deliver results or face consequences.`
        : `The owner at ${teamName} is monitoring ${principalName}'s performance closely.`,
      teamId,
    ));
  }

  // Generate firing news.
  if (shouldFire) {
    news.push(makeNews(
      `news-principal-fired-${seasonYear}-${teamId}`,
      undefined,
      isPlayer
        ? `${teamName} sacks principal ${principalName}`
        : `${teamName} fires team principal ${principalName}`,
      'career_event',
      'critical',
      'paddock_week',
      isPlayer
        ? `${principalName} has been relieved of duties at ${teamName}. The team owner has lost confidence after sustained poor performance and financial difficulties.`
        : `${teamName} has parted ways with team principal ${principalName} after a period of underperformance and financial pressure.`,
      teamId,
    ));
  }

  return {
    pressureDelta,
    newPressure,
    shouldFire,
    news,
  };
}

// Generate news for a new AI principal hire.
export function principalHiredNews(
  principalName: string,
  teamId: string,
  teamName: string,
  seasonYear: number,
): NewsItem {
  return makeNews(
    `news-principal-hired-${seasonYear}-${teamId}`,
    undefined,
    `${teamName} appoints ${principalName} as team principal`,
    'career_event',
    'high',
    'paddock_week',
    `${teamName} has appointed ${principalName} as their new team principal, hoping for a fresh direction.`,
    teamId,
  );
}

// Generate news for a voluntary player job move.
export function playerJobMoveNews(
  principalName: string,
  oldTeamId: string,
  oldTeamName: string,
  newTeamId: string,
  newTeamName: string,
  seasonYear: number,
): NewsItem {
  return makeNews(
    `news-principal-move-${seasonYear}-${oldTeamId}-${newTeamId}`,
    undefined,
    `${principalName} leaves ${oldTeamName} for ${newTeamName}`,
    'career_event',
    'critical',
    'paddock_week',
    `Team principal ${principalName} has departed ${oldTeamName} to take up the reins at ${newTeamName}.`,
    newTeamId,
  );
}

// Generate news for a player job offer.
export function playerJobOfferNews(
  principalName: string,
  teamId: string,
  teamName: string,
  seasonYear: number,
): NewsItem {
  return makeNews(
    `news-principal-offer-${seasonYear}-${teamId}`,
    undefined,
    `${teamName} approaches ${principalName} about principal role`,
    'career_event',
    'high',
    'paddock_week',
    `${teamName} has made an approach for team principal ${principalName}.`,
    teamId,
  );
}

// Generate a replacement AI principal name.
export function generateReplacementPrincipalName(seed: string): string {
  const firstNames = [
    'James', 'Robert', 'Claire', 'Marco', 'Sophie', 'David', 'Elena', 'Thomas',
    'Andrea', 'Nathan', 'Yuki', 'Karl', 'Isabelle', 'Pierre', 'Anna', 'Stefano',
  ];
  const lastNames = [
    'Bennett', 'Rossi', 'Schmidt', 'Lefevre', 'Andersson', 'Tanaka', 'Müller',
    'Ferrari', 'Walker', 'Costa', 'Lindberg', 'Dubois', 'O\'Brien', 'Nakamura',
    'Garcia', 'Weber',
  ];
  // Simple deterministic hash from seed.
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const firstIdx = Math.abs(hash) % firstNames.length;
  const lastIdx = Math.abs(hash >> 8) % lastNames.length;
  return `${firstNames[firstIdx]} ${lastNames[lastIdx]}`;
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
