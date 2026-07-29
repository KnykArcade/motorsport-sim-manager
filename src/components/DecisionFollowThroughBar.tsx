import { useLocation, useNavigate } from 'react-router';
import { useGame } from '../game/GameContext';
import { inboxMessages } from '../screens/inboxViewModel';
import {
  inboxReturnWithMessage,
  type InboxActionNavigationState,
} from '../screens/decisionActionTarget';

function actionState(value: unknown): InboxActionNavigationState | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<InboxActionNavigationState>;
  if (
    typeof candidate.inboxReturn !== 'string'
    || !candidate.inboxAction
    || typeof candidate.inboxAction.actionId !== 'string'
    || typeof candidate.inboxAction.title !== 'string'
    || !candidate.inboxAction.target
  ) return undefined;
  return candidate as InboxActionNavigationState;
}

export function DecisionFollowThroughBar() {
  const { state } = useGame();
  const location = useLocation();
  const navigate = useNavigate();
  const context = actionState(location.state);
  if (!state || !context) return null;

  const messages = inboxMessages(state);
  const current = messages.find((message) => message.id === context.inboxAction.actionId);
  const resolved = !current;
  const next = messages.find((message) => message.actionable && message.id !== context.inboxAction.actionId);
  const target = context.inboxAction.target;
  const nextRoute = next
    ? inboxReturnWithMessage(
      context.inboxReturn,
      next.id,
      next.kind === 'must_respond' ? 'must_respond' : next.kind === 'recommended' ? 'recommended' : 'all',
    )
    : context.inboxReturn;

  return (
    <section
      className={`mx-3 mt-3 flex flex-wrap items-center gap-3 border px-3 py-2 text-xs ${resolved ? 'border-emerald-700/60 bg-emerald-950/25' : 'border-sky-700/60 bg-sky-950/20'}`}
      aria-label="Decision follow-through"
    >
      <div className="min-w-0 flex-1">
        <div className={`font-bold uppercase tracking-[0.14em] ${resolved ? 'text-emerald-300' : 'text-sky-300'}`}>
          {resolved ? 'Decision completed' : 'Inbox decision in progress'}
        </div>
        <div className="mt-0.5 font-semibold text-neutral-100">{context.inboxAction.title}</div>
        <div className="mt-0.5 text-neutral-400">
          {resolved ? target.immediateConsequence : target.resolutionCondition}
          {resolved && target.delayedConsequence ? ` ${target.delayedConsequence}` : ''}
        </div>
      </div>
      <div className="text-right text-[10px] uppercase tracking-wide text-neutral-500">
        <div>{target.owner}</div>
        <div>{target.deadline}</div>
      </div>
      <button
        type="button"
        className="ui-inline-action rounded border px-3 py-1.5 font-semibold"
        onClick={() => navigate(resolved ? nextRoute : context.inboxReturn)}
      >
        {resolved && next ? 'Next unresolved item →' : 'Return to Inbox →'}
      </button>
    </section>
  );
}
