// Driver/Staff Market Drama Engine
//
// Generates structured NewsItems for market events: driver signings, bidding
// wars, refusals, staff hires, and random paddock drama. Pure and deterministic
// per (seed, seasonYear).

import type { NewsItem, NewsCategory, NewsPriority } from '../types/gameTypes';
import { createSeededRandom, deriveSeed } from './random';

function makeNews(
  id: string,
  headline: string,
  category: NewsCategory,
  priority: NewsPriority,
  body: string,
  teamId?: string,
  driverId?: string,
): NewsItem {
  return {
    id,
    headline,
    body,
    timestamp: new Date().toISOString(),
    category,
    priority,
    careerPhase: 'offseason',
    teamId,
    driverId,
  };
}

// --- Driver signing news ----------------------------------------------------

export function driverSignedNews(
  driverName: string,
  teamName: string,
  teamId: string,
  driverId: string,
  seasonYear: number,
  isStar: boolean,
): NewsItem {
  const priority: NewsPriority = isStar ? 'high' : 'normal';
  const headline = isStar
    ? `${teamName} lands ${driverName} for ${seasonYear}`
    : `${teamName} signs ${driverName} for ${seasonYear}`;
  const body = isStar
    ? `${driverName} joins ${teamName} in a headline-grabbing move. The signing signals real ambition for the upcoming season.`
    : `${driverName} will drive for ${teamName} in the ${seasonYear} season.`;
  return makeNews(
    `news-signing-${seasonYear}-${driverId}`,
    headline,
    'driver_market',
    priority,
    body,
    teamId,
    driverId,
  );
}

export function driverBiddingLostNews(
  driverName: string,
  teamName: string,
  rivalBid: number,
  seasonYear: number,
  driverId: string,
): NewsItem {
  return makeNews(
    `news-bid-lost-${seasonYear}-${driverId}`,
    `${teamName} loses out on ${driverName}`,
    'driver_market',
    'normal',
    `${teamName} were outbid for ${driverName}'s signature. A rival team secured the deal with an offer of ~$${rivalBid}M.`,
    undefined,
    driverId,
  );
}

export function driverRefusedNews(
  driverName: string,
  series: string,
  seasonYear: number,
  driverId: string,
): NewsItem {
  return makeNews(
    `news-refused-${seasonYear}-${driverId}`,
    `${driverName} rejects ${series} move`,
    'driver_market',
    'normal',
    `${driverName} turned down a move to ${series}, preferring to stay in their current series for now.`,
    undefined,
    driverId,
  );
}

// --- Staff hiring news ------------------------------------------------------

export function staffHiredNews(
  staffName: string,
  role: string,
  teamName: string,
  teamId: string,
  seasonYear: number,
): NewsItem {
  return makeNews(
    `news-staff-${seasonYear}-${teamId}-${staffName}`,
    `${teamName} hires ${staffName} as ${role}`,
    'ai_team',
    'normal',
    `${teamName} has appointed ${staffName} to lead their ${role} department, bolstering off-track operations.`,
    teamId,
  );
}

// --- Random market drama events ---------------------------------------------

type DramaEvent = {
  headline: string;
  body: string;
  category: NewsCategory;
  priority: NewsPriority;
};

const DRAMA_EVENTS: DramaEvent[] = [
  {
    headline: 'Contract dispute rocks the paddock',
    body: 'A leading driver is reportedly unhappy with contract terms, sparking rumours of a mid-season move.',
    category: 'driver_market',
    priority: 'high',
  },
  {
    headline: 'Surprise academy graduate turns heads',
    body: 'A young prospect has impressed in private testing, drawing attention from rival teams.',
    category: 'youth_academy',
    priority: 'normal',
  },
  {
    headline: 'Veteran driver considers retirement',
    body: 'A seasoned campaigner is weighing up whether to continue for another season or hang up the helmet.',
    category: 'driver_market',
    priority: 'normal',
  },
  {
    headline: 'Sponsor pressure builds over driver lineup',
    body: 'A major sponsor is reportedly pushing for a marquee signing to boost the team\'s profile.',
    category: 'sponsor',
    priority: 'normal',
  },
  {
    headline: 'Engine supplier rumoured to switch partners',
    body: 'Whispers in the paddock suggest an engine supplier may be eyeing a new team partnership.',
    category: 'general',
    priority: 'normal',
  },
  {
    headline: 'Technical department leadership changes at rival',
    body: 'A key technical figure has been linked with a move to a rival outfit, sending shockwaves through the paddock.',
    category: 'ai_team',
    priority: 'high',
  },
];

export function generateMarketDramaNews(
  seed: string,
  seasonYear: number,
  count = 2,
): NewsItem[] {
  const rng = createSeededRandom(deriveSeed(seed, 'drama', seasonYear));
  const shuffled = [...DRAMA_EVENTS].sort(() => rng.next() - 0.5);
  const chosen = shuffled.slice(0, Math.min(count, shuffled.length));
  return chosen.map((event, idx) =>
    makeNews(
      `news-drama-${seasonYear}-${idx}`,
      event.headline,
      event.category,
      event.priority,
      event.body,
    ),
  );
}
