import type { GameState } from '../game/careerState';

export function transferCalendarView(state: GameState) {
  const stories = [...(state.transferCalendar?.stories ?? [])]
    .sort((a, b) => b.startedRound - a.startedRound || a.targetName.localeCompare(b.targetName));
  return {
    expiringDrivers: state.drivers
      .filter((driver) => (driver.contractYearsRemaining ?? 0) <= 1)
      .map((driver) => ({ id: driver.id, name: driver.name, teamId: driver.teamId }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    availableDriverCount: stories.filter((story) => story.outcome === 'Release').length,
    rivalOffers: stories.filter((story) => story.targetType === 'MarketDriver' && story.stage !== 'Confirmed'),
    recentStories: stories.slice(0, 8),
  };
}
