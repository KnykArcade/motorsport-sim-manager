import type { GameState } from '../game/careerState';
import type { NewsItem } from '../types/gameTypes';
import type { TransferCalendarStory } from '../types/transferCalendarTypes';
import { careerMarketBundle } from './careerMarketEngine';
import { competingBidFor } from './driverBiddingEngine';
import { schedulePersonnelMove } from './personnelMoveEngine';

function hash01(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function timestamp(state: GameState, round: number): string {
  return new Date(Date.UTC(state.seasonYear, 0, Math.max(1, round))).toISOString();
}

function storyNews(state: GameState, story: TransferCalendarStory, confirmed: boolean): NewsItem {
  const renewal = story.outcome === 'Renewal';
  const release = story.outcome === 'Release';
  return {
    id: `transfer-${confirmed ? 'confirmed' : 'rumor'}-${story.id}`,
    round: story.startedRound,
    headline: confirmed
      ? renewal ? `${story.targetName} agrees ${story.destinationTeamName} renewal`
        : release ? `${story.targetName} set for free agency`
          : `${story.targetName} agrees ${story.destinationTeamName} move`
      : renewal ? `${story.destinationTeamName} opens renewal talks with ${story.targetName}`
        : release ? `${story.targetName} expected to leave ${story.sourceTeamName ?? 'current team'}`
          : `${story.destinationTeamName} targets ${story.targetName}`,
    body: confirmed
      ? `The agreement takes effect at the ${state.seasonYear + 1} season rollover; the current contract and seat remain unchanged until then.`
      : `Paddock sources describe talks as active. A decision is expected by round ${story.deadlineRound}.`,
    timestamp: timestamp(state, story.startedRound),
    category: 'driver_market',
    priority: confirmed ? 'high' : 'normal',
  };
}

export function progressTransferCalendar(state: GameState, round: number): GameState {
  if (state.gameMode === 'SingleSeason' || state.seasonComplete) return state;
  const calendar = state.transferCalendar ?? { lastProcessedRound: 0, stories: [] };
  if (calendar.lastProcessedRound >= round) return state;
  let next = state;
  const news: NewsItem[] = [];
  const pendingMarketIds = new Set((state.pendingSignings ?? []).filter((signing) => signing.source === 'market').map((signing) => signing.sourceId));

  let stories = calendar.stories.map((story) => {
    if (story.stage === 'Rumor' && round > story.startedRound) {
      const confirmed = { ...story, stage: 'Confirmed' as const };
      if (story.targetType === 'GridDriver' && story.outcome !== 'Release' && story.sourceTeamId) {
        next = schedulePersonnelMove(next, {
          targetType: 'Driver', targetId: story.targetId, targetName: story.targetName,
          sourceTeamId: story.sourceTeamId,
          destinationTeamId: story.destinationTeamId, destinationTeamName: story.destinationTeamName,
          agreedSeason: state.seasonYear, effectiveSeason: state.seasonYear + 1,
          reason: story.outcome === 'Renewal' ? 'AI contract renewal' : 'AI pre-contract agreement',
        });
      }
      news.push(storyNews(state, confirmed, true));
      return confirmed;
    }
    if (story.targetType === 'MarketDriver' && story.stage === 'Offer' && round >= story.deadlineRound) {
      if (pendingMarketIds.has(story.targetId)) return { ...story, stage: 'Contested' as const };
      news.push(storyNews(state, story, true));
      next = { ...next, signedMarketIds: [...new Set([...(next.signedMarketIds ?? []), story.targetId])] };
      return { ...story, stage: 'Confirmed' as const };
    }
    return story;
  });

  const expiring = state.drivers
    .filter((driver) => driver.teamId !== state.selectedTeamId && (driver.contractYearsRemaining ?? 0) <= 1)
    .filter((driver) => !stories.some((story) => story.targetType === 'GridDriver' && story.targetId === driver.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (expiring.length > 0) {
    const driver = expiring[Math.floor(hash01(`${state.randomSeed}-${round}-transfer-driver`) * expiring.length)];
    const source = state.teams.find((team) => team.id === driver.teamId)!;
    const roll = hash01(`${state.randomSeed}-${state.seasonYear}-${round}-${driver.id}-transfer-outcome`);
    const outcome: TransferCalendarStory['outcome'] = roll < 0.38 ? 'Renewal' : roll < 0.82 ? 'Transfer' : 'Release';
    const alternatives = state.teams.filter((team) => team.id !== state.selectedTeamId && team.id !== driver.teamId);
    const destination = outcome === 'Renewal' || alternatives.length === 0
      ? source
      : alternatives[Math.floor(hash01(`${state.randomSeed}-${round}-${driver.id}-destination`) * alternatives.length)];
    const story: TransferCalendarStory = {
      id: `${state.seasonYear}-${round}-grid-${driver.id}`,
      targetType: 'GridDriver', targetId: driver.id, targetName: driver.name,
      sourceTeamId: source.id, sourceTeamName: source.name,
      destinationTeamId: destination.id, destinationTeamName: destination.name,
      outcome, stage: 'Rumor', startedRound: round, deadlineRound: round + 1,
    };
    stories = [...stories, story];
    news.push(storyNews(state, story, false));
  }

  const activeMarketOffer = stories.some((story) => story.targetType === 'MarketDriver' && (story.stage === 'Offer' || story.stage === 'Contested'));
  if (!activeMarketOffer) {
    const market = careerMarketBundle(state).drivers
      .filter((driver) => !(state.signedMarketIds ?? []).includes(driver.id))
      .filter((driver) => !stories.some((story) => story.targetType === 'MarketDriver' && story.targetId === driver.id))
      .sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id));
    const rivals = state.teams.filter((team) => team.id !== state.selectedTeamId);
    if (market.length > 0 && rivals.length > 0) {
      const driver = market[Math.floor(hash01(`${state.randomSeed}-${round}-market-target`) * Math.min(12, market.length))];
      const rival = rivals[Math.floor(hash01(`${state.randomSeed}-${round}-market-rival`) * rivals.length)];
      const story: TransferCalendarStory = {
        id: `${state.seasonYear}-${round}-market-${driver.id}`,
        targetType: 'MarketDriver', targetId: driver.id, targetName: driver.name,
        destinationTeamId: rival.id, destinationTeamName: rival.name,
        outcome: 'RivalOffer', stage: 'Offer', startedRound: round, deadlineRound: round + 2,
        offeredBid: competingBidFor(driver, state.randomSeed),
      };
      stories = [...stories, story];
      news.push(storyNews(state, story, false));
    }
  }

  return {
    ...next,
    transferCalendar: { lastProcessedRound: round, stories: stories.slice(-120) },
    news: [...news, ...next.news].slice(0, 80),
  };
}
