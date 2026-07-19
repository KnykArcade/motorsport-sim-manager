import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { Button } from '../components/Button';
import {
  MetricStrip,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceMetric,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';
import {
  inboxMessages,
  type InboxCategory,
  type InboxMessage,
  type InboxSeverity,
} from './inboxViewModel';

type InboxFilter = 'all' | 'action' | InboxCategory;

const FILTERS: ReadonlyArray<{ id: InboxFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'action', label: 'Needs attention' },
  { id: 'technical', label: 'Technical' },
  { id: 'paddock', label: 'Paddock' },
  { id: 'people', label: 'People' },
  { id: 'business', label: 'Business' },
  { id: 'news', label: 'News & stories' },
];

const SEVERITY_BADGES: Record<InboxSeverity, { label: string; className: string }> = {
  critical: { label: 'Critical', className: 'bg-red-500/20 text-red-300 border-red-500/40' },
  action: { label: 'Action', className: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  info: { label: 'FYI', className: 'bg-neutral-700/40 text-neutral-400 border-neutral-600/40' },
};

export function Inbox() {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [expandedId, setExpandedId] = useState<string>();
  if (!state) return null;

  const messages = inboxMessages(state);
  const read = new Set(state.inboxRead ?? []);
  const filtered = messages.filter((message) =>
    filter === 'all' ? true : filter === 'action' ? message.actionable : message.category === filter);
  const unread = messages.filter((message) => !read.has(message.id));
  const actionable = messages.filter((message) => message.actionable);
  const round = state.calendar[state.currentRaceIndex]?.round ?? state.currentRaceIndex + 1;

  const openMessage = (message: InboxMessage) => {
    if (!read.has(message.id)) dispatch({ type: 'MARK_INBOX_READ', messageIds: [message.id] });
    setExpandedId((current) => (current === message.id ? undefined : message.id));
  };

  return (
    <WorkspaceScreen className="era-feature-screen">
      <WorkspaceHeader
        eyebrow="Inbox"
        title="Inbox"
        subtitle={`${state.seasonYear} ${state.series} · Round ${round}`}
      />
      <MetricStrip>
        <WorkspaceMetric label="Needs attention" value={`${actionable.length}`} detail="Decisions waiting on you" />
        <WorkspaceMetric label="Unread" value={`${unread.length}`} detail="Messages you haven't opened" />
        <WorkspaceMetric label="This week" value={`${messages.length}`} detail="Items in your feed" />
      </MetricStrip>
      <WorkspaceTabs items={FILTERS} active={filter} onChange={setFilter} ariaLabel="Inbox filters" />
      <WorkspaceBody className="space-y-2">
        <div className="flex justify-end">
          <Button
            className="px-2 py-1 text-xs"
            onClick={() => dispatch({ type: 'MARK_INBOX_READ', messageIds: messages.map((message) => message.id) })}
          >
            Mark all read
          </Button>
        </div>
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-500">Nothing here — enjoy the quiet week.</p>
        ) : (
          <ul className="space-y-1.5">
            {filtered.map((message) => {
              const badge = SEVERITY_BADGES[message.severity];
              const isRead = read.has(message.id);
              const expanded = expandedId === message.id;
              return (
                <li key={message.id} className={`rounded border ${isRead ? 'border-neutral-800/60 bg-neutral-950/30' : 'border-neutral-700 bg-neutral-900/50'}`}>
                  <button
                    type="button"
                    className="flex w-full flex-wrap items-center gap-3 px-3 py-2 text-left"
                    onClick={() => openMessage(message)}
                    aria-expanded={expanded}
                  >
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.className}`}>{badge.label}</span>
                    <span className={`min-w-0 flex-1 text-sm ${isRead ? 'text-neutral-400' : 'font-semibold text-neutral-100'}`}>{message.title}</span>
                    <span className="text-[10px] uppercase tracking-wide text-neutral-600">{message.category}</span>
                    {!isRead && <span aria-label="Unread" className="h-2 w-2 rounded-full bg-[var(--era-accent-strong)]" />}
                  </button>
                  {expanded && (
                    <div className="border-t border-neutral-800/60 px-3 py-2">
                      {message.body && <p className="text-sm leading-6 text-neutral-300">{message.body}</p>}
                      <div className="mt-2">
                        <Button className="px-2 py-1 text-xs" variant="primary" onClick={() => navigate(message.route)}>
                          {message.routeLabel} →
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}
