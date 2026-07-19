import type { InboxMessage } from './inboxViewModel';
import type { RelationshipCommandSummary } from './relationships/relationshipCommandViewModel';

type DirectRelationshipCoverage = {
  duePromise: boolean;
  jobOpportunity: boolean;
};

export function relationshipInboxMessage(
  summary: RelationshipCommandSummary,
  directCoverage: DirectRelationshipCoverage,
): InboxMessage | undefined {
  const signal = summary.topSignal;
  if (!signal || signal.status === 'Stable') return undefined;
  if (directCoverage.duePromise && signal.id.startsWith('Driver:') && /promise/i.test(signal.reason)) return undefined;
  if (directCoverage.jobOpportunity && signal.id === 'PotentialEmployers') return undefined;

  const category = signal.id.startsWith('RivalPrincipal:')
    ? 'paddock'
    : signal.id === 'Collective:Commercial'
      ? 'business'
      : 'people';
  return {
    id: `inbox-relationship-${signal.id}`,
    severity: signal.status === 'MustActNow' ? 'critical' : 'action',
    category,
    title: `Relationship priority: ${signal.title}`,
    body: `${signal.reason} Review the Relationship Command Center for the risk if ignored.`,
    route: '/relationships',
    routeLabel: 'Open Relationships',
    actionable: true,
  };
}
