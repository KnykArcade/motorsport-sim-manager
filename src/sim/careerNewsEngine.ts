// Career News Engine — central storytelling system that generates structured
// news items based on real gameplay events across all career phases.
//
// This engine extends the existing race news system (newsEngine.ts) with
// career-phase-aware news generation: preseason setup, qualifying results,
// race weekend outcomes, paddock week events, financial distress, youth
// academy activity, driver market moves, and AI team actions.
//
// All news items are structured with category, priority, and career phase
// metadata so the UI can filter, sort, and display them meaningfully.

import type { NewsItem, NewsCategory, NewsPriority, QualifyingResult, RaceResult } from '../types/gameTypes';
import type { GameState } from '../game/careerState';
import { completedUpgradePrograms } from './technicalAdapters';
import type { CareerPhase } from '../types/careerPhaseTypes';
import { biggestGainer, biggestLoser } from './positionDelta';
import { createSeededRandom, deriveSeed } from './random';

// ---------------------------------------------------------------------------
// Template variety — multiple body variants for each news type, picked
// deterministically via seeded RNG so the same race always produces the same
// article, but different races get different phrasing.
// ---------------------------------------------------------------------------

function pickVariant<T>(variants: readonly T[], seed: string): T {
  const rng = createSeededRandom(seed);
  return variants[Math.floor(rng.next() * variants.length)];
}

// Race win body templates. {team} and {driver} are replaced at call site.
const WIN_BODIES = [
  '{team} takes victory after a strong weekend.',
  'A commanding drive from {driver} delivers {team} the top step of the podium.',
  '{team}\'s strategy pays off as {driver} crosses the line first to claim the win.',
  'Lights-to-flag perfection from {driver} gives {team} a well-earned victory.',
  'A flawless performance sees {driver} lead home the field for {team}.',
] as const;

// Player DNF body templates.
const DNF_BODIES = [
  'A difficult race ends early for {team}.',
  'Heartbreak for {driver} as a mechanical issue forces retirement.',
  'The weekend promised much but delivered heartbreak for {team}.',
  '{driver} is left stranded on the sidelines as the race slips away.',
  'Reliability woes strike again — {team} will want to forget this one quickly.',
] as const;

// Podium body templates.
const PODIUM_BODIES = [
  'Podium finish for {team}.',
  'A strong result for {driver} caps off a fine weekend for {team}.',
  '{team} celebrates a podium as {driver} delivers when it mattered.',
  'The champagne flows for {driver} and {team} after a hard-fought podium.',
  'Important points for {team} as {driver} stands on the podium.',
] as const;

const POLE_BODIES = [
  '{team} driver secures the front of the grid.',
  'A stunning lap puts {driver} on pole position.',
  '{team} locks out the front row with a blistering qualifying performance.',
  'The perfect start for {driver} — pole position at the {gp}.',
] as const;

const QUAL_TOP3_BODIES = [
  'Strong qualifying performance from {team}.',
  '{driver} nails the lap when it mattered to secure a top-3 start.',
  'A great qualifying effort puts {team} in the mix for tomorrow.',
  'The setup changes paid off — {driver} is pleased with the car.',
] as const;

const QUAL_DNQ_BODIES = [
  'The car was outside the top 24 and will not start the race.',
  'A disastrous qualifying session leaves {driver} on the sidelines.',
  'Heartbreak for {team} as {driver} fails to make the grid.',
] as const;

// Biggest mover body templates.
const MOVER_BODIES = [
  'One of the biggest movers of the day, climbing {n} places.',
  'A brilliant drive through the field saw {n} positions gained.',
  'Charging through the pack — a {n}-place climb that turned heads.',
  'From the back to the points: a stunning {n}-place recovery drive.',
] as const;

// Biggest loser body templates.
const LOSER_BODIES = [
  'A day to forget after losing {n} places.',
  'Nothing went right for {driver} as the race unravelled in costly fashion.',
  'A weekend to forget — {n} positions lost and no answers in the debrief.',
  'The less said about this one the better for {driver}.',
] as const;

// ---------------------------------------------------------------------------
// Career News Context — the data the engine needs to generate phase-appropriate news
// ---------------------------------------------------------------------------

export type CareerNewsContext = {
  state: GameState;
  phase: CareerPhase;
  round: number;
  gpName: string;
  seed: string;
};

// ---------------------------------------------------------------------------
// News item factory
// ---------------------------------------------------------------------------

function makeNews(
  id: string,
  round: number | undefined,
  headline: string,
  category: NewsCategory,
  priority: NewsPriority,
  careerPhase: CareerPhase,
  body?: string,
  teamId?: string,
  driverId?: string,
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
    driverId,
  };
}

// ---------------------------------------------------------------------------
// Deduplication helper — prevents duplicate news items
// ---------------------------------------------------------------------------

export function deduplicateNews(existing: NewsItem[], newItems: NewsItem[]): NewsItem[] {
  const existingIds = new Set(existing.map((n) => n.id));
  return newItems.filter((n) => !existingIds.has(n.id));
}

// ---------------------------------------------------------------------------
// Spam control — merge news batches, deduplicate by headline similarity,
// and cap the number of items per round so the feed doesn't get overwhelmed.
// ---------------------------------------------------------------------------

const priorityRank: Record<NewsPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

// Maximum number of news items per round (per race weekend).
const MAX_NEWS_PER_ROUND = 10;

// Normalize a headline for similarity comparison: lowercase, trim, collapse spaces.
function normalizeHeadline(h: string): string {
  return h.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Merge multiple news batches, deduplicating by ID and by headline similarity.
// Items with the same normalized headline are considered duplicates — only the
// first (highest-priority) one is kept.
export function mergeNewsWithSpamControl(
  existing: NewsItem[],
  ...batches: NewsItem[][]
): NewsItem[] {
  const seenIds = new Set(existing.map((n) => n.id));
  const seenHeadlines = new Set(existing.map((n) => normalizeHeadline(n.headline)));
  const merged: NewsItem[] = [];

  // Flatten all batches and sort by priority so highest-priority items are
  // added first (and thus win headline dedup).
  const allNew = batches.flat().sort(
    (a, b) => (priorityRank[a.priority ?? 'normal'] ?? 2) - (priorityRank[b.priority ?? 'normal'] ?? 2),
  );

  for (const item of allNew) {
    if (seenIds.has(item.id)) continue;
    const norm = normalizeHeadline(item.headline);
    if (seenHeadlines.has(norm)) continue;
    seenIds.add(item.id);
    seenHeadlines.add(norm);
    merged.push(item);
  }

  return merged;
}

// Cap the number of items per round, keeping the highest-priority ones.
// Items without a round are always kept.
export function capNewsPerRound(items: NewsItem[], max: number = MAX_NEWS_PER_ROUND): NewsItem[] {
  const byRound = new Map<number, NewsItem[]>();
  const noRound: NewsItem[] = [];

  for (const item of items) {
    if (item.round == null) {
      noRound.push(item);
    } else {
      const arr = byRound.get(item.round) ?? [];
      arr.push(item);
      byRound.set(item.round, arr);
    }
  }

  const capped: NewsItem[] = [...noRound];
  for (const [, arr] of byRound) {
    if (arr.length <= max) {
      capped.push(...arr);
    } else {
      arr.sort((a, b) => (priorityRank[a.priority ?? 'normal'] ?? 2) - (priorityRank[b.priority ?? 'normal'] ?? 2));
      capped.push(...arr.slice(0, max));
    }
  }

  return capped;
}

// ---------------------------------------------------------------------------
// Preseason news
// ---------------------------------------------------------------------------

export function generatePreseasonNews(ctx: CareerNewsContext): NewsItem[] {
  const { state } = ctx;
  const items: NewsItem[] = [];
  const team = state.teams.find((t) => t.id === state.selectedTeamId);
  if (!team) return items;

  // Preseason kickoff news.
  items.push(makeNews(
    `news-preseason-${state.seasonYear}-kickoff`,
    undefined,
    `${state.seasonYear} ${state.series} season begins — ${team.name} prepares for the year ahead`,
    'preseason',
    'normal',
    'pre_season_setup',
    `${team.name} enters the ${state.seasonYear} season with a budget of $${(team.budget / 1_000_000).toFixed(1)}M and a reputation of ${team.reputation}.`,
    team.id,
  ));

  // Budget warning if low.
  if (team.budget < 5_000_000) {
    items.push(makeNews(
      `news-preseason-${state.seasonYear}-budget-warning`,
      undefined,
      `${team.name} enters the season with a tight budget`,
      'financial',
      'high',
      'pre_season_setup',
      `With only $${(team.budget / 1_000_000).toFixed(1)}M available, the team will need to manage costs carefully this season.`,
      team.id,
    ));
  }

  // Driver lineup news.
  const teamDrivers = state.drivers.filter((d) => d.teamId === state.selectedTeamId);
  if (teamDrivers.length > 0) {
    const driverNames = teamDrivers.map((d) => d.name).join(' and ');
    items.push(makeNews(
      `news-preseason-${state.seasonYear}-lineup`,
      undefined,
      `${team.name} confirms ${teamDrivers.length}-driver lineup: ${driverNames}`,
      'driver_market',
      'normal',
      'pre_season_setup',
      undefined,
      team.id,
    ));
  }

  return items;
}

// ---------------------------------------------------------------------------
// Qualifying news
// ---------------------------------------------------------------------------

export function generateQualifyingNews(
  ctx: CareerNewsContext,
  qualifying: QualifyingResult[],
  driverNames: Record<string, string>,
  teamNames: Record<string, string>,
): NewsItem[] {
  const { round, gpName, state, seed } = ctx;
  const items: NewsItem[] = [];
  const team = state.teams.find((t) => t.id === state.selectedTeamId);

  const pole = qualifying.find((q) => q.position === 1 && !q.dnq);
  if (pole) {
    const isPlayerDriver = team?.driverIds.includes(pole.driverId);
    const poleBody = pickVariant(POLE_BODIES, deriveSeed(seed, 'pole', `${round}`))
      .replace('{team}', teamNames[pole.teamId] ?? pole.teamId)
      .replace('{driver}', driverNames[pole.driverId] ?? pole.driverId)
      .replace('{gp}', gpName);
    items.push(makeNews(
      `news-qual-${round}-pole`,
      round,
      `${driverNames[pole.driverId]} takes pole at the ${gpName}`,
      'qualifying',
      isPlayerDriver ? 'high' : 'normal',
      'race_weekend',
      poleBody,
      pole.teamId,
      pole.driverId,
    ));
  }

  // Player team qualifying performance.
  if (team) {
    const playerResults = qualifying.filter((q) => team.driverIds.includes(q.driverId));
    for (const result of playerResults) {
      if (result.dnq) {
        const dnqBody = pickVariant(QUAL_DNQ_BODIES, deriveSeed(seed, 'qual-dnq', `${round}-${result.driverId}`))
          .replace('{team}', team.name)
          .replace('{driver}', driverNames[result.driverId] ?? result.driverId);
        items.push(makeNews(
          `news-qual-${round}-dnq-${result.driverId}`,
          round,
          `${driverNames[result.driverId]} fails to qualify at the ${gpName}`,
          'qualifying',
          'high',
          'race_weekend',
          dnqBody,
          team.id,
          result.driverId,
        ));
      } else if (result.position <= 3) {
        const top3Body = pickVariant(QUAL_TOP3_BODIES, deriveSeed(seed, 'qual-top3', `${round}-${result.driverId}`))
          .replace('{team}', team.name)
          .replace('{driver}', driverNames[result.driverId] ?? result.driverId);
        items.push(makeNews(
          `news-qual-${round}-top3-${result.driverId}`,
          round,
          `${driverNames[result.driverId]} qualifies P${result.position} at the ${gpName}`,
          'qualifying',
          'high',
          'race_weekend',
          top3Body,
          team.id,
          result.driverId,
        ));
      }
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// Race result news (extends existing generateRaceNews with structured fields)
// ---------------------------------------------------------------------------

export function generateCareerRaceNews(
  ctx: CareerNewsContext,
  _qualifying: QualifyingResult[],
  race: RaceResult[],
  driverNames: Record<string, string>,
  teamNames: Record<string, string>,
): NewsItem[] {
  const { round, gpName, state } = ctx;
  const items: NewsItem[] = [];
  const team = state.teams.find((t) => t.id === state.selectedTeamId);

  const winner = race.find((r) => r.position === 1);
  if (winner) {
    const isPlayerDriver = team?.driverIds.includes(winner.driverId);
    const winBody = pickVariant(WIN_BODIES, deriveSeed(ctx.seed, 'win', `${ctx.round}`))
      .replace('{team}', teamNames[winner.teamId] ?? winner.teamId)
      .replace('{driver}', driverNames[winner.driverId] ?? winner.driverId);
    items.push(makeNews(
      `news-race-${round}-win`,
      round,
      `${driverNames[winner.driverId]} wins the ${gpName}`,
      'race_result',
      isPlayerDriver ? 'critical' : 'high',
      'post_race_review',
      winBody,
      winner.teamId,
      winner.driverId,
    ));
  }

  // Player team race results.
  if (team) {
    const playerResults = race.filter((r) => team.driverIds.includes(r.driverId));
    for (const result of playerResults) {
      if (result.status === 'DNF') {
        const dnfBody = pickVariant(DNF_BODIES, deriveSeed(ctx.seed, 'dnf', `${ctx.round}-${result.driverId}`))
          .replace('{team}', team.name)
          .replace('{driver}', driverNames[result.driverId] ?? result.driverId);
        items.push(makeNews(
          `news-race-${round}-dnf-${result.driverId}`,
          round,
          `${driverNames[result.driverId]} retires from the ${gpName}`,
          'race_result',
          'high',
          'post_race_review',
          result.incidents[0] ?? dnfBody,
          team.id,
          result.driverId,
        ));
      } else if (result.position != null && result.position <= 3 && result.position > 1) {
        const podiumBody = pickVariant(PODIUM_BODIES, deriveSeed(ctx.seed, 'podium', `${ctx.round}-${result.driverId}`))
          .replace('{team}', team.name)
          .replace('{driver}', driverNames[result.driverId] ?? result.driverId);
        items.push(makeNews(
          `news-race-${round}-podium-${result.driverId}`,
          round,
          `${driverNames[result.driverId]} finishes P${result.position} at the ${gpName}`,
          'race_result',
          'high',
          'post_race_review',
          podiumBody,
          team.id,
          result.driverId,
        ));
      }
    }
  }

  // Biggest mover.
  const gainer = biggestGainer(race);
  if (gainer && gainer.positionsGained >= 4) {
    const moverBody = pickVariant(MOVER_BODIES, deriveSeed(ctx.seed, 'mover', `${ctx.round}`))
      .replace('{n}', String(gainer.positionsGained));
    items.push(makeNews(
      `news-race-${round}-mover`,
      round,
      `${driverNames[gainer.driverId]} charges from P${gainer.startingGridPosition} to P${gainer.currentPosition}`,
      'race_result',
      'normal',
      'post_race_review',
      moverBody,
      undefined,
      gainer.driverId,
    ));
  }

  // Biggest loser.
  const loser = biggestLoser(race);
  if (loser && loser.positionsLost >= 4) {
    const loserBody = pickVariant(LOSER_BODIES, deriveSeed(ctx.seed, 'loser', `${ctx.round}`))
      .replace('{n}', String(loser.positionsLost))
      .replace('{driver}', driverNames[loser.driverId] ?? loser.driverId);
    items.push(makeNews(
      `news-race-${round}-slider`,
      round,
      `${driverNames[loser.driverId]} slips from P${loser.startingGridPosition} to P${loser.currentPosition}`,
      'race_result',
      'normal',
      'post_race_review',
      loserBody,
      undefined,
      loser.driverId,
    ));
  }

  return items;
}

// ---------------------------------------------------------------------------
// Paddock week news
// ---------------------------------------------------------------------------

export function generatePaddockNews(ctx: CareerNewsContext): NewsItem[] {
  const { state, round } = ctx;
  const items: NewsItem[] = [];
  const team = state.teams.find((t) => t.id === state.selectedTeamId);
  if (!team) return items;

  // Development project completion news.
  const completedProjects = completedUpgradePrograms(state);
  const recentProjects = completedProjects.filter(
    (p) => !state.careerPhase?.announcedCompletedProjectIds?.includes(p.id),
  );
  for (const project of recentProjects.slice(0, 3)) {
    items.push(makeNews(
      `news-paddock-${round}-dev-${project.id}`,
      round,
      `${team.name}: ${project.name} development complete`,
      'development',
      'normal',
      'paddock_week',
      `New upgrade package ready for the next race weekend.`,
      team.id,
    ));
  }

  // Financial distress news.
  const distress = state.financialDistress?.[team.id];
  if (distress && distress.level !== 'Stable') {
    const distressMessages: Record<string, { headline: string; body: string }> = {
      Tight: {
        headline: `${team.name} monitoring budget closely`,
        body: 'The team is operating with a thin margin and must manage costs.',
      },
      AtRisk: {
        headline: `Financial pressure mounting at ${team.name}`,
        body: `${distress.consecutiveNegativeCashRaces} consecutive races in the red.`,
      },
      Critical: {
        headline: `${team.name} in critical financial state`,
        body: 'Prolonged financial distress is drawing scrutiny from team owners.',
      },
      Administration: {
        headline: `Owner intervention looms at ${team.name}`,
        body: 'The team faces potential administration without a turnaround.',
      },
      ClosureRisk: {
        headline: `${team.name} at risk of closure`,
        body: 'Severe financial distress threatens the team\'s future.',
      },
    };
    const msg = distressMessages[distress.level];
    if (msg) {
      items.push(makeNews(
        `news-paddock-${round}-distress`,
        round,
        msg.headline,
        'financial',
        distress.level === 'Critical' || distress.level === 'Administration' || distress.level === 'ClosureRisk' ? 'critical' : 'high',
        'paddock_week',
        msg.body,
        team.id,
      ));
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// Youth academy news
// ---------------------------------------------------------------------------

export function generateYouthAcademyNews(ctx: CareerNewsContext): NewsItem[] {
  const { state } = ctx;
  const items: NewsItem[] = [];
  const team = state.teams.find((t) => t.id === state.selectedTeamId);
  if (!team) return items;

  // New academy signing news.
  const academy = state.academy ?? [];
  const recentSignings = academy.filter((m) => m.signedYear === state.seasonYear);
  for (const member of recentSignings.slice(0, 3)) {
    items.push(makeNews(
      `news-youth-${state.seasonYear}-${member.id}`,
      undefined,
      `${team.name} signs ${member.name} to youth academy`,
      'youth_academy',
      'normal',
      'pre_season_setup',
      `${member.name} (${member.nationality}, age ${state.seasonYear - member.birthYear}) joins the academy program.`,
      team.id,
    ));
  }

  return items;
}

// ---------------------------------------------------------------------------
// Master career news generator — dispatches to phase-specific generators
// ---------------------------------------------------------------------------

export function generateCareerNews(ctx: CareerNewsContext): NewsItem[] {
  switch (ctx.phase) {
    case 'pre_season_setup':
      return generatePreseasonNews(ctx);
    case 'pre_race_briefing':
      return []; // Pre-race briefing news handled by package selection
    case 'race_weekend':
      return []; // Qualifying/race news generated by dedicated functions
    case 'post_race_review':
      return []; // Race result news generated by dedicated function
    case 'paddock_week':
      return generatePaddockNews(ctx);
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// News helpers for the UI
// ---------------------------------------------------------------------------

export function sortNewsByPriority(items: NewsItem[]): NewsItem[] {
  const priorityOrder: Record<NewsPriority, number> = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3,
  };
  return [...items].sort((a, b) => {
    const pa = priorityOrder[a.priority ?? 'normal'];
    const pb = priorityOrder[b.priority ?? 'normal'];
    if (pa !== pb) return pa - pb;
    // Newer items first (by timestamp).
    return (b.timestamp ?? '').localeCompare(a.timestamp ?? '');
  });
}

export function filterNewsByCategory(items: NewsItem[], category: NewsCategory): NewsItem[] {
  return items.filter((i) => i.category === category);
}

export function filterNewsByPhase(items: NewsItem[], phase: CareerPhase): NewsItem[] {
  return items.filter((i) => i.careerPhase === phase);
}

export function priorityColor(priority: NewsPriority | undefined): string {
  switch (priority) {
    case 'critical': return 'text-red-400';
    case 'high': return 'text-amber-400';
    case 'normal': return 'text-neutral-200';
    case 'low': return 'text-neutral-500';
    default: return 'text-neutral-200';
  }
}

export function categoryLabel(category: NewsCategory | undefined): string {
  switch (category) {
    case 'race_result': return 'Race Result';
    case 'qualifying': return 'Qualifying';
    case 'practice': return 'Practice';
    case 'preseason': return 'Pre-Season';
    case 'paddock': return 'Paddock';
    case 'post_race': return 'Post-Race';
    case 'financial': return 'Financial';
    case 'driver_market': return 'Driver Market';
    case 'youth_academy': return 'Youth Academy';
    case 'development': return 'Development';
    case 'sponsor': return 'Sponsor';
    case 'ai_team': return 'AI Team';
    case 'career_event': return 'Career Event';
    case 'championship': return 'Championship';
    case 'regulation': return 'Regulation';
    case 'general': return 'General';
    default: return 'General';
  }
}

// ---------------------------------------------------------------------------
// News archive — major stories that should persist beyond the 50-item feed
// ---------------------------------------------------------------------------

// Categories that are always considered "major" and should be archived.
const MAJOR_CATEGORIES: NewsCategory[] = [
  'race_result',
  'career_event',
  'financial',
  'championship',
  'regulation',
];

// Priorities that are always considered "major".
const MAJOR_PRIORITIES: NewsPriority[] = ['critical'];

// Determine if a news item is "major" and should be archived.
export function isMajorStory(item: NewsItem): boolean {
  if (item.priority && MAJOR_PRIORITIES.includes(item.priority)) return true;
  if (item.category && MAJOR_CATEGORIES.includes(item.category)) return true;
  // Race wins are always major.
  if (item.headline.includes(' wins ')) return true;
  if (item.headline.includes('champion')) return true;
  if (item.headline.includes('closure') || item.headline.includes('closure risk')) return true;
  if (item.headline.includes('fired') || item.headline.includes('sacks')) return true;
  if (item.headline.includes('appointed') || item.headline.includes('hires')) return true;
  return false;
}

// Archive major stories from the current feed before it gets trimmed.
// Returns the combined archive (existing + new major stories, deduplicated).
export function archiveMajorStories(
  currentNews: NewsItem[],
  existingArchive?: NewsItem[],
): NewsItem[] {
  const archive = existingArchive ?? [];
  const archiveIds = new Set(archive.map((n) => n.id));
  const newMajor = currentNews.filter((n) => isMajorStory(n) && !archiveIds.has(n.id));
  return [...archive, ...newMajor];
}

// Filter news by team (player team or all).
export function filterNewsByTeam(items: NewsItem[], teamId: string | undefined): NewsItem[] {
  if (!teamId) return items;
  return items.filter((n) => n.teamId === teamId || !n.teamId);
}

// Filter news by season (based on timestamp year).
export function filterNewsBySeason(items: NewsItem[], seasonYear: number): NewsItem[] {
  return items.filter((n) => {
    try {
      return new Date(n.timestamp).getFullYear() === seasonYear;
    } catch {
      return false;
    }
  });
}

// Filter news by priority.
export function filterNewsByPriority(items: NewsItem[], priority: NewsPriority): NewsItem[] {
  return items.filter((n) => (n.priority ?? 'normal') === priority);
}
