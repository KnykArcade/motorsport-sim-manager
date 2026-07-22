import type { GameState } from '../game/careerState';
import { currentRace } from '../game/careerState';
import { getCareerPhase } from '../game/careerPhaseEngine';
import { workflowDestination } from '../components/layoutWorkflow';
import { inboxMessages, inboxTimingLabel, type InboxMessage } from './inboxViewModel';
import { buildWeeklyStory, type WeeklyStory } from './weeklyStoryViewModel';

export type CommandAgendaItem = {
  id: string;
  kind: 'must_respond' | 'recommended' | 'news';
  title: string;
  owner: string;
  whyNow: string;
  consequence: string;
  route: string;
  routeLabel: string;
  blocking: boolean;
  round?: number;
  timingLabel: string;
};

export type CommandChange = {
  id: string;
  title: string;
  detail: string;
  route: string;
  routeLabel: string;
};

export type CommandNextEvent = {
  label: string;
  detail: string;
  route: string;
};

export type CommandContinueAction = {
  label: string;
  route: string;
  disabled: boolean;
  disabledReason?: string;
};

export type CommandAgenda = {
  phase: ReturnType<typeof getCareerPhase> | 'season_complete';
  headline: string;
  subheadline: string;
  nextAction: CommandAgendaItem | null;
  dueThisWeek: CommandAgendaItem[];
  recommendations: CommandAgendaItem[];
  recentChanges: CommandChange[];
  nextEvent: CommandNextEvent;
  continueAction: CommandContinueAction;
  weeklyStory: WeeklyStory | null;
};

function toAgendaItem(message: InboxMessage): CommandAgendaItem {
  return {
    id: message.id,
    kind: message.kind ?? 'news',
    title: message.title,
    owner: message.source ?? 'Team',
    whyNow: message.whyItMatters ?? 'This item is part of the current team agenda.',
    consequence: message.blocking
      ? 'The current phase cannot advance until this is resolved.'
      : 'Reviewing it now keeps the team prepared for the next decision window.',
    route: message.route,
    routeLabel: message.routeLabel,
    blocking: Boolean(message.blocking),
    round: message.round,
    timingLabel: inboxTimingLabel(message.timing ?? 'monitor'),
  };
}

function agendaHeadline(state: GameState, nextAction: CommandAgendaItem | null): string {
  if (state.seasonComplete) return 'The season is complete';
  if (nextAction?.blocking) return nextAction.title;
  if (nextAction) return 'Your next decision is ready';
  return 'The team is ready for the next step';
}

function agendaSubheadline(state: GameState, nextAction: CommandAgendaItem | null): string {
  if (state.seasonComplete) return 'Review the season and decide what comes next.';
  if (nextAction?.blocking) return 'This item needs your response before the career can advance.';
  if (nextAction) return 'Staff and the current race situation have identified the next useful action.';
  return 'No unresolved action is waiting in the current management window.';
}

function nextEventFor(state: GameState, route: string): CommandNextEvent {
  const race = currentRace(state);
  if (state.seasonComplete) {
    return {
      label: 'Season review',
      detail: 'Review the campaign before starting the next chapter.',
      route: '/season-review',
    };
  }
  if (!race) {
    return {
      label: 'Current management window',
      detail: 'Review the command agenda for the next available action.',
      route,
    };
  }
  return {
    label: `Round ${race.round} · ${race.gpName}`,
    detail: `${race.trackName} · The next scheduled race on your calendar.`,
    route: '/weekend',
  };
}

function recentChangesFor(state: GameState, messages: InboxMessage[]): CommandChange[] {
  const changes = messages
    .filter((message) => message.kind === 'news')
    .slice(0, 3)
    .map((message) => ({
      id: message.id,
      title: message.title,
      detail: message.body ?? 'New information from the motorsport world.',
      route: message.route,
      routeLabel: message.routeLabel,
    }));

  if (getCareerPhase(state) === 'post_race_review' && state.careerPhase?.lastCompletedRaceId) {
    return [{
      id: `command-review-${state.careerPhase.lastCompletedRaceId}`,
      title: 'The latest race review is ready',
      detail: 'See what changed in preparation, execution, and the team’s next priorities.',
      route: `/post-race/${state.careerPhase.lastCompletedRaceId}`,
      routeLabel: 'Open Race Review',
    }, ...changes];
  }
  return changes;
}

export function commandAgenda(state: GameState): CommandAgenda {
  const messages = inboxMessages(state);
  const actionItems = state.seasonComplete
    ? []
    : messages.filter((message) => message.actionable).map(toAgendaItem);
  const nextAction = actionItems[0] ?? null;
  const dueThisWeek = actionItems
    .filter((item) => item.id !== nextAction?.id && item.timingLabel === 'Due this week')
    .slice(0, 3);
  const recommendations = actionItems
    .filter((item) => item.id !== nextAction?.id && item.kind === 'recommended')
    .slice(0, 4);
  const workflow = workflowDestination(state);
  const continueAction = nextAction
    ? {
        label: nextAction.blocking ? nextAction.routeLabel : `Review ${nextAction.title}`,
        route: nextAction.route,
        disabled: false,
      }
    : {
        label: state.seasonComplete ? 'Open Season Review' : `Open ${workflow.context}`,
        route: workflow.to,
        disabled: workflow.blocked,
        disabledReason: workflow.blocked ? workflow.reason : undefined,
      };

  return {
    phase: state.seasonComplete ? 'season_complete' : getCareerPhase(state),
    headline: agendaHeadline(state, nextAction),
    subheadline: agendaSubheadline(state, nextAction),
    nextAction,
    dueThisWeek,
    recommendations,
    recentChanges: recentChangesFor(state, messages),
    nextEvent: nextEventFor(state, workflow.to),
    continueAction,
    weeklyStory: buildWeeklyStory(state),
  };
}
