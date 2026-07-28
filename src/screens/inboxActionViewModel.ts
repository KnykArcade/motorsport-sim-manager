import type { GameState } from '../game/careerState';
import { staffResponsibilities, staffResponsibilityPolicy } from './staffResponsibilitiesViewModel';
import { weekendCommandRecommendations } from '../sim/weekendCommandEngine';
import type { InboxMessage } from './inboxViewModel';

export type InboxInlineActionKind =
  | 'acknowledge'
  | 'accept_weekend_recommendations'
  | 'delegate_routine';

export type InboxInlineAction = {
  kind: InboxInlineActionKind;
  label: string;
  confirmLabel: string;
  consequence: string;
};

export function nextInboxMessageId(
  messages: InboxMessage[],
  resolvedId: string,
): string | undefined {
  const remaining = messages.filter((message) => message.id !== resolvedId);
  return remaining.find((message) => message.actionable)?.id ?? remaining[0]?.id;
}

export function inboxInlineActions(
  state: GameState,
  message: InboxMessage,
): InboxInlineAction[] {
  const actions: InboxInlineAction[] = [];

  if (message.id.startsWith('inbox-weekend-plan-')) {
    const pending = weekendCommandRecommendations(state).filter(
      (recommendation) => recommendation.status === 'Pending',
    );
    if (pending.length > 0) {
      actions.push({
        kind: 'accept_weekend_recommendations',
        label: 'Accept staff recommendation',
        confirmLabel: `Accept ${pending.length} recommendation${pending.length === 1 ? '' : 's'}`,
        consequence: `Copies the staff strategy and driver-instruction choices into the working weekend plan and resolves ${pending.length} recommendation${pending.length === 1 ? '' : 's'} as accepted. Practice, setup, qualifying, and final plan confirmation remain under your control.`,
      });
    }
  }

  if (message.routineDelegatable && message.responsibility) {
    const policy = staffResponsibilityPolicy(state, message.responsibility);
    const responsibility = staffResponsibilities(state).find(
      (item) => item.id === message.responsibility,
    );
    if (policy !== 'staff_execute_routine' && responsibility?.confidenceLabel !== 'Low') {
      actions.push({
        kind: 'delegate_routine',
        label: 'Delegate routine updates',
        confirmLabel: 'Delegate routine work',
        consequence: `Changes ${responsibility?.area ?? 'this responsibility'} to Staff Handles Routine Work. Safe routine updates leave the Inbox; contracts, spending, promises, owner matters, low-confidence work, and every blocking decision still come to you.`,
      });
    }
  }

  if (!message.blocking && (!message.actionable || message.kind === 'news')) {
    actions.push({
      kind: 'acknowledge',
      label: 'Acknowledge',
      confirmLabel: 'Acknowledge item',
      consequence: 'Marks this item as reviewed and removes it from the Inbox. No gameplay value, decision, budget, relationship, or simulation result changes.',
    });
  }

  return actions;
}
