import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
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
  mustRespondInboxCount,
  recommendedInboxCount,
  type InboxCategory,
  type InboxMessage,
  type InboxMessageKind,
  type InboxSeverity,
} from './inboxViewModel';
import { workflowDestination } from '../components/layoutWorkflow';
import { buildManagerOfficeFollowUps } from './managerOfficeFollowUpViewModel';

type InboxFilter = 'all' | 'action' | InboxCategory;
type InboxSection = 'all' | InboxMessageKind;

const FILTERS: ReadonlyArray<{ id: InboxFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'action', label: 'Needs attention' },
  { id: 'technical', label: 'Technical' },
  { id: 'paddock', label: 'Paddock' },
  { id: 'people', label: 'People' },
  { id: 'business', label: 'Business' },
  { id: 'news', label: 'News & stories' },
];

const SECTIONS: ReadonlyArray<{ id: InboxSection; label: string }> = [
  { id: 'all', label: 'All items' },
  { id: 'must_respond', label: 'Must Respond' },
  { id: 'recommended', label: 'Recommended' },
  { id: 'news', label: 'News & stories' },
];

function filterFromQuery(value: string | null): InboxFilter {
  return FILTERS.some((filter) => filter.id === value) ? value as InboxFilter : 'all';
}

function sectionFromQuery(value: string | null): InboxSection {
  return SECTIONS.some((section) => section.id === value) ? value as InboxSection : 'all';
}

const SEVERITY_BADGES: Record<InboxSeverity, { label: string; className: string }> = {
  critical: { label: 'Critical', className: 'bg-red-500/20 text-red-300 border-red-500/40' },
  action: { label: 'Action', className: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  info: { label: 'FYI', className: 'bg-neutral-700/40 text-neutral-400 border-neutral-600/40' },
};

const KIND_BADGES: Record<InboxMessageKind, { label: string; className: string }> = {
  must_respond: { label: 'Must Respond', className: 'bg-red-500/20 text-red-300 border-red-500/40' },
  recommended: { label: 'Recommended', className: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  news: { label: 'News', className: 'bg-neutral-700/40 text-neutral-400 border-neutral-600/40' },
};

export function Inbox() {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [expandedId, setExpandedId] = useState<string>();
  if (!state) return null;

  const filter = filterFromQuery(searchParams.get('category'));
  const section = sectionFromQuery(searchParams.get('section'));
  const messages = inboxMessages(state);
  const read = new Set(state.inboxRead ?? []);
  const filtered = messages.filter((message) =>
    (filter === 'all' ? true : filter === 'action' ? message.actionable : message.category === filter)
    && (section === 'all' || message.kind === section));
  const unread = messages.filter((message) => !read.has(message.id));
  const round = state.calendar[state.currentRaceIndex]?.round ?? state.currentRaceIndex + 1;
  const workflow = workflowDestination(state);
  const activeReviewRace = state.careerPhase?.currentPhase === 'post_race_review'
    && state.careerPhase.lastCompletedRaceId
    ? state.calendar.find((race) => race.id === state.careerPhase?.lastCompletedRaceId)
    : undefined;
  const followUps = activeReviewRace
    ? buildManagerOfficeFollowUps({
      raceId: activeReviewRace.id,
      raceLabel: activeReviewRace.gpName,
      round: activeReviewRace.round,
      news: state.news,
      actionMessages: messages.filter((message) => message.kind !== 'news'),
    })
    : undefined;
  const setInboxQuery = (key: 'category' | 'section', value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'all') next.delete(key);
    else next.set(key, value);
    setSearchParams(next);
  };

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
        actions={(
          <Button variant="primary" onClick={() => navigate(workflow.to)}>
            {workflow.label} →
          </Button>
        )}
      />
      <MetricStrip>
        <WorkspaceMetric label="Must Respond" value={`${mustRespondInboxCount(state)}`} detail="Blocks phase progression" />
        <WorkspaceMetric label="Recommended" value={`${recommendedInboxCount(state)}`} detail="Decisions worth reviewing" />
        <WorkspaceMetric label="News" value={`${messages.filter((message) => message.kind === 'news').length}`} detail="Stories in your feed" />
        <WorkspaceMetric label="Unread" value={`${unread.length}`} detail="Messages you haven't opened" />
      </MetricStrip>
      <WorkspaceTabs
        items={SECTIONS}
        active={section}
        onChange={(nextSection) => setInboxQuery('section', nextSection)}
        ariaLabel="Inbox sections"
      />
      <WorkspaceTabs
        items={FILTERS}
        active={filter}
        onChange={(nextFilter) => setInboxQuery('category', nextFilter)}
        ariaLabel="Inbox category filters"
      />
      <WorkspaceBody className="space-y-2">
        {followUps && (
          <Panel title={`Manager Office · ${followUps.raceLabel}`}>
            <p className="mb-3 text-xs text-neutral-500">What changed in the race and what still needs your attention.</p>
            <div className="grid gap-3 lg:grid-cols-2">
              <FollowUpColumn title="What changed" items={followUps.changed} navigate={navigate} />
              <FollowUpColumn title="What needs action" items={followUps.action} navigate={navigate} />
            </div>
          </Panel>
        )}
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
          <div className="space-y-5">
            {SECTIONS.filter((item) => item.id !== 'all' && (section === 'all' || item.id === section)).map((item) => {
              const sectionMessages = filtered.filter((message) => message.kind === item.id);
              if (sectionMessages.length === 0) return null;
              return (
                <section key={item.id} aria-labelledby={`inbox-section-${item.id}`}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h2 id={`inbox-section-${item.id}`} className="text-xs font-black uppercase tracking-[0.14em] text-neutral-400">
                      {item.label}
                    </h2>
                    <span className="text-[10px] uppercase tracking-wide text-neutral-600">{sectionMessages.length} item{sectionMessages.length === 1 ? '' : 's'}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {sectionMessages.map((message) => {
              const badge = SEVERITY_BADGES[message.severity];
              const kindBadge = KIND_BADGES[message.kind ?? 'news'];
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
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${kindBadge.className}`}>{kindBadge.label}</span>
                    <span className={`min-w-0 flex-1 text-sm ${isRead ? 'text-neutral-400' : 'font-semibold text-neutral-100'}`}>{message.title}</span>
                    <span className="text-[10px] uppercase tracking-wide text-neutral-600">{message.category}</span>
                    {!isRead && <span aria-label="Unread" className="h-2 w-2 rounded-full bg-[var(--era-accent-strong)]" />}
                  </button>
                  {expanded && (
                    <div className="border-t border-neutral-800/60 px-3 py-2">
                      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] uppercase tracking-wide text-neutral-500">
                        <span>Owner: {message.source}</span>
                        {message.blocking && <span className="text-red-300">Blocks advancement</span>}
                      </div>
                      {message.body && <p className="text-sm leading-6 text-neutral-300">{message.body}</p>}
                      {message.whyItMatters && <p className="mt-2 text-xs leading-5 text-neutral-500">Why it matters: {message.whyItMatters}</p>}
                      <div className="mt-2">
                        <div className="flex flex-wrap gap-2">
                          <Button className="px-2 py-1 text-xs" variant="primary" onClick={() => navigate(message.route)}>
                            {message.routeLabel} →
                          </Button>
                          {!message.blocking && (
                            <Button
                              className="px-2 py-1 text-xs"
                              onClick={() => {
                                dispatch({ type: 'DISMISS_INBOX_MESSAGES', messageIds: [message.id] });
                                setExpandedId(undefined);
                              }}
                            >
                              Dismiss
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}

function FollowUpColumn({
  title,
  items,
  navigate,
}: {
  title: string;
  items: ReturnType<typeof buildManagerOfficeFollowUps>['changed'];
  navigate: (to: string) => void;
}) {
  return (
    <div>
      <h2 className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-neutral-400">{title}</h2>
      {items.length === 0 ? (
        <p className="rounded border border-neutral-800 bg-neutral-950/30 p-3 text-xs text-neutral-500">Nothing new here.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => (
            <div key={item.id} className="rounded border border-neutral-800 bg-neutral-950/30 p-3">
              <div className="text-sm font-semibold text-neutral-200">{item.title}</div>
              <p className="mt-1 text-xs leading-5 text-neutral-500">{item.detail}</p>
              <Button className="mt-2 px-2 py-1 text-xs" variant="ghost" onClick={() => navigate(item.route)}>{item.routeLabel} →</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
