import type { InboxMessage } from './inboxViewModel';
import type { NewsItem } from '../types/gameTypes';

export type ManagerOfficeFollowUpItem = {
  id: string;
  title: string;
  detail: string;
  route: string;
  routeLabel: string;
  round?: number;
  timestamp?: string;
};

export type ManagerOfficeFollowUps = {
  raceId: string;
  raceLabel: string;
  changed: ManagerOfficeFollowUpItem[];
  action: ManagerOfficeFollowUpItem[];
};

export function buildManagerOfficeFollowUps(input: {
  raceId: string;
  raceLabel: string;
  round: number;
  news: NewsItem[];
  actionMessages: InboxMessage[];
}): ManagerOfficeFollowUps {
  const raceNews = input.news
    .filter((item) => item.round === input.round)
    .filter((item) => item.category === 'race_result'
      || item.category === 'post_race'
      || item.category === 'championship'
      || item.category === 'paddock')
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 6)
    .map((item) => ({
      id: `follow-up-news-${item.id}`,
      title: item.headline,
      detail: item.body ?? 'Race-weekend story from the motorsport world.',
      route: '/news',
      routeLabel: 'Open News Center',
      round: item.round,
      timestamp: item.timestamp,
    }));

  const changed = [
    {
      id: `follow-up-review-${input.raceId}`,
      title: `${input.raceLabel} review is ready`,
      detail: 'See what the result tells you about preparation, execution, and the next race.',
      route: `/post-race/${input.raceId}`,
      routeLabel: 'Open Race Review',
      round: input.round,
    },
    ...raceNews,
  ];

  const action = input.actionMessages
    .filter((message) => message.actionable)
    .sort((a, b) => (a.round ?? 0) - (b.round ?? 0) || a.id.localeCompare(b.id))
    .slice(0, 8)
    .map((message) => ({
      id: `follow-up-action-${message.id}`,
      title: message.title,
      detail: message.whyItMatters ?? message.body ?? 'This item still needs attention.',
      route: message.route,
      routeLabel: message.routeLabel,
      round: message.round,
      timestamp: message.timestamp,
    }));

  return {
    raceId: input.raceId,
    raceLabel: input.raceLabel,
    changed,
    action,
  };
}
