import type { GameState } from '../game/careerState';
import { inboxMessages, type InboxMessage } from './inboxViewModel';
import { buildManagerOfficeFollowUps } from './managerOfficeFollowUpViewModel';

export type WeeklyStoryOwner = 'Technical' | 'Relationships' | 'Staff' | 'Development' | 'Business' | 'Race review';

export type WeeklyStoryItem = {
  id: string;
  title: string;
  detail: string;
  owner: WeeklyStoryOwner;
  reason: string;
  route: string;
  routeLabel: string;
};

export type WeeklyStoryGroup = {
  owner: WeeklyStoryOwner;
  items: WeeklyStoryItem[];
};

export type WeeklyStory = {
  headline: string;
  summary: string;
  raceId: string;
  raceLabel: string;
  groups: WeeklyStoryGroup[];
};

function ownerForMessage(message: InboxMessage): WeeklyStoryOwner {
  if (message.category === 'technical') return 'Technical';
  if (message.category === 'business') return 'Business';
  if (message.category === 'people') {
    return message.id.includes('staff') || message.title.toLowerCase().includes('staff')
      ? 'Staff'
      : 'Relationships';
  }
  if (message.category === 'paddock') return 'Relationships';
  return message.title.toLowerCase().includes('development') ? 'Development' : 'Technical';
}

function reasonForOwner(owner: WeeklyStoryOwner): string {
  switch (owner) {
    case 'Technical':
      return 'A pace, reliability, or parts signal from the last race remains on the agenda.';
    case 'Relationships':
      return 'The last race created a people or paddock follow-up that still needs attention.';
    case 'Staff':
      return 'The team’s staffing needs returned as a decision for the new management week.';
    case 'Development':
      return 'The last race clarified a development priority for the next round.';
    case 'Business':
      return 'The race-weekend result created a financial or sponsor follow-up.';
    case 'Race review':
      return 'The latest race is the source of this week’s priorities and consequences.';
  }
}

export function buildWeeklyStory(state: GameState): WeeklyStory | null {
  const raceId = state.careerPhase?.lastCompletedRaceId;
  const race = raceId ? state.calendar.find((candidate) => candidate.id === raceId) : undefined;
  if (!race || (state.careerPhase?.currentPhase !== 'paddock_week' && state.careerPhase?.currentPhase !== 'post_race_review')) {
    return null;
  }

  const messages = inboxMessages(state);
  const followUps = buildManagerOfficeFollowUps({
    raceId: race.id,
    raceLabel: race.gpName,
    round: race.round,
    news: state.news,
    actionMessages: messages.filter((message) => message.actionable),
  });
  const messageById = new Map(messages.map((message) => [message.id, message]));
  const groups = new Map<WeeklyStoryOwner, WeeklyStoryItem[]>();
  const add = (item: WeeklyStoryItem) => {
    const items = groups.get(item.owner) ?? [];
    items.push(item);
    groups.set(item.owner, items);
  };

  add({
    id: `weekly-story-review-${race.id}`,
    title: `${race.gpName} set this week’s priorities`,
    detail: 'The race review is the starting point for the follow-ups below.',
    owner: 'Race review',
    reason: reasonForOwner('Race review'),
    route: `/post-race/${race.id}`,
    routeLabel: 'Open Race Review',
  });

  followUps.action.forEach((item) => {
    const messageId = item.id.replace('follow-up-action-', '');
    const message = messageById.get(messageId);
    const owner = message ? ownerForMessage(message) : 'Race review';
    add({
      id: item.id,
      title: item.title,
      detail: item.detail,
      owner,
      reason: reasonForOwner(owner),
      route: item.route,
      routeLabel: item.routeLabel,
    });
  });

  const orderedOwners: WeeklyStoryOwner[] = ['Race review', 'Technical', 'Relationships', 'Staff', 'Development', 'Business'];
  return {
    headline: `${race.gpName} follow-up week`,
    summary: groups.size > 1
      ? 'The last race has returned as a set of owned priorities. Resolve the items that matter before briefing the next round.'
      : 'The last race is ready for review; no additional owned follow-ups are currently waiting.',
    raceId: race.id,
    raceLabel: race.gpName,
    groups: orderedOwners
      .map((owner) => ({ owner, items: groups.get(owner) ?? [] }))
      .filter((group) => group.items.length > 0),
  };
}
