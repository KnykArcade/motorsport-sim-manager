export type DecisionActionStatus = 'unresolved' | 'informational';

export type DecisionActionFocus = {
  kind: 'proposal' | 'component' | 'event' | 'person' | 'report' | 'contract' | 'commercial' | 'finance' | 'regulation' | 'story' | 'workspace';
  id: string;
  tab?: string;
  section?: string;
};

export type DecisionActionTarget = {
  actionId: string;
  owner: string;
  route: string;
  routeLabel: string;
  focus: DecisionActionFocus;
  status: DecisionActionStatus;
  deadline: string;
  resolutionCondition: string;
  immediateConsequence: string;
  delayedConsequence?: string;
  followUpRoute: string;
  followUpLabel: string;
};

export type InboxActionNavigationState = {
  inboxReturn: string;
  inboxAction: {
    actionId: string;
    title: string;
    target: DecisionActionTarget;
  };
};

export function focusedRoute(
  route: string,
  focus: Pick<DecisionActionFocus, 'id' | 'tab' | 'section'>,
): string {
  const [pathname, query = ''] = route.split('?');
  const params = new URLSearchParams(query);
  if (focus.tab) params.set('tab', focus.tab);
  if (focus.section) params.set('section', focus.section);
  params.set('focus', focus.id);
  const nextQuery = params.toString();
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

export function inboxActionNavigationState(
  inboxReturn: string,
  title: string,
  target: DecisionActionTarget,
): InboxActionNavigationState {
  return {
    inboxReturn,
    inboxAction: {
      actionId: target.actionId,
      title,
      target,
    },
  };
}

export function inboxReturnWithMessage(
  returnTo: string,
  messageId: string,
  section?: string,
): string {
  const [pathname, query = ''] = returnTo.split('?');
  const params = new URLSearchParams(query);
  params.delete('category');
  if (section) params.set('section', section);
  params.set('message', messageId);
  return `${pathname}?${params.toString()}`;
}
