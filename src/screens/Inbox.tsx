import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useGame } from '../game/GameContext';
import { currentRace, teamById } from '../game/careerState';
import { Button } from '../components/Button';
import { FmPane, FmPaneBody, FmPaneHeader } from '../components/workspace/FmPane';
import {
  inboxMessages,
  inboxTimingLabel,
  mustRespondInboxCount,
  recommendedInboxCount,
  type InboxCategory,
  type InboxMessage,
  type InboxMessageKind,
  type InboxSeverity,
} from './inboxViewModel';
import { workflowDestination } from '../components/layoutWorkflow';
import { buildManagerOfficeFollowUps } from './managerOfficeFollowUpViewModel';
import { commandLoopGuide } from './commandLoopGuideViewModel';
import { commandAgenda } from './commandAgendaViewModel';
import {
  inboxInlineActions,
  nextInboxMessageId,
  type InboxInlineAction,
} from './inboxActionViewModel';
import { prepareAcceptedWeekendRecommendations } from './inboxWeekendAction';
import {
  readInboxWorkspaceState,
  writeInboxWorkspaceState,
  type InboxWorkspaceState,
} from './inboxWorkspaceStorage';

type InboxFilter = 'all' | 'action' | InboxCategory;
type InboxSection = 'all' | InboxMessageKind;

const FILTERS: ReadonlyArray<{ id: InboxFilter; label: string }> = [
  { id: 'all', label: 'All categories' },
  { id: 'action', label: 'Needs attention' },
  { id: 'technical', label: 'Technical' },
  { id: 'paddock', label: 'Paddock' },
  { id: 'people', label: 'People' },
  { id: 'business', label: 'Business' },
  { id: 'news', label: 'News & stories' },
];

const SECTIONS: ReadonlyArray<{ id: InboxSection; label: string }> = [
  { id: 'all', label: 'All Items' },
  { id: 'must_respond', label: 'Must Respond' },
  { id: 'recommended', label: 'Recommended' },
  { id: 'news', label: 'News & Stories' },
];

const SEVERITY_LABELS: Record<InboxSeverity, string> = {
  critical: 'Critical',
  action: 'Action',
  info: 'Information',
};

const KIND_LABELS: Record<InboxMessageKind, string> = {
  must_respond: 'Must Respond',
  recommended: 'Recommended',
  news: 'News',
};

function filterFromQuery(value: string | null): InboxFilter {
  return FILTERS.some((filter) => filter.id === value) ? value as InboxFilter : 'all';
}

function sectionFromQuery(value: string | null): InboxSection {
  return SECTIONS.some((section) => section.id === value) ? value as InboxSection : 'all';
}

function messageDate(message: InboxMessage): string {
  if (message.timestamp) {
    const date = new Date(message.timestamp);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
    }
  }
  return message.round !== undefined ? `Round ${message.round}` : 'Current';
}

function countForSection(messages: InboxMessage[], section: InboxSection): number {
  return section === 'all'
    ? messages.length
    : messages.filter((message) => message.kind === section).length;
}

function countForFilter(messages: InboxMessage[], filter: InboxFilter): number {
  if (filter === 'all') return messages.length;
  if (filter === 'action') return messages.filter((message) => message.actionable).length;
  return messages.filter((message) => message.category === filter).length;
}

export function Inbox() {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [workspaceState, setWorkspaceState] = useState<InboxWorkspaceState | undefined>(() =>
    state
      ? readInboxWorkspaceState(
        typeof window === 'undefined' ? undefined : window.sessionStorage,
        state.selectedTeamId,
        state.seasonYear,
      )
      : undefined);
  const [pendingAction, setPendingAction] = useState<InboxInlineAction>();
  const listBodyRef = useRef<HTMLDivElement>(null);
  const contextBodyRef = useRef<HTMLDivElement>(null);
  const restoredWorkspaceRef = useRef(workspaceState);

  useEffect(() => {
    const restored = restoredWorkspaceRef.current;
    if (!restored) return;
    const frame = window.requestAnimationFrame(() => {
      if (listBodyRef.current) listBodyRef.current.scrollTop = restored.listScrollTop;
      if (contextBodyRef.current) contextBodyRef.current.scrollTop = restored.contextScrollTop;
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (!state) return null;

  const filter = filterFromQuery(searchParams.get('category') ?? workspaceState?.category ?? null);
  const section = sectionFromQuery(searchParams.get('section') ?? workspaceState?.section ?? null);
  const messages = inboxMessages(state);
  const read = new Set(state.inboxRead ?? []);
  const filtered = messages.filter((message) =>
    (filter === 'all' ? true : filter === 'action' ? message.actionable : message.category === filter)
    && (section === 'all' || message.kind === section));
  const selectedId = searchParams.get('message') ?? workspaceState?.selectedMessageId;
  const selectedMessage = filtered.find((message) => message.id === selectedId) ?? filtered[0];
  const unreadCount = messages.filter((message) => !read.has(message.id)).length;
  const team = teamById(state, state.selectedTeamId);
  const race = currentRace(state);
  const workflow = workflowDestination(state);
  const agenda = commandAgenda(state);
  const guide = commandLoopGuide(state);
  const inlineActions = selectedMessage ? inboxInlineActions(state, selectedMessage) : [];
  const activeReviewRace = state.careerPhase?.currentPhase === 'post_race_review'
    && state.careerPhase.lastCompletedRaceId
    ? state.calendar.find((entry) => entry.id === state.careerPhase?.lastCompletedRaceId)
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

  const persistWorkspace = (patch: Partial<InboxWorkspaceState>) => {
    const next: InboxWorkspaceState = {
      teamId: state.selectedTeamId,
      seasonYear: state.seasonYear,
      category: filter,
      section,
      selectedMessageId: selectedMessage?.id,
      listScrollTop: listBodyRef.current?.scrollTop ?? workspaceState?.listScrollTop ?? 0,
      contextScrollTop: contextBodyRef.current?.scrollTop ?? workspaceState?.contextScrollTop ?? 0,
      ...patch,
    };
    setWorkspaceState(next);
    writeInboxWorkspaceState(
      typeof window === 'undefined' ? undefined : window.sessionStorage,
      next,
    );
  };

  const setSelectedMessage = (messageId: string | undefined) => {
    const next = new URLSearchParams(searchParams);
    if (messageId) next.set('message', messageId);
    else next.delete('message');
    setSearchParams(next);
    persistWorkspace({ selectedMessageId: messageId });
    setPendingAction(undefined);
  };

  const setInboxQuery = (key: 'category' | 'section', value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'all') next.delete(key);
    else next.set(key, value);
    next.delete('message');
    setSearchParams(next);
    persistWorkspace({
      [key]: value,
      selectedMessageId: undefined,
      listScrollTop: 0,
      contextScrollTop: 0,
    });
    setPendingAction(undefined);
  };

  const selectMessage = (message: InboxMessage) => {
    if (!read.has(message.id)) dispatch({ type: 'MARK_INBOX_READ', messageIds: [message.id] });
    setSelectedMessage(message.id);
  };

  const selectNextUnresolved = (resolvedId: string) => {
    setSelectedMessage(nextInboxMessageId(filtered, resolvedId));
  };

  const openWorkspace = (message: InboxMessage) => {
    if (!read.has(message.id)) dispatch({ type: 'MARK_INBOX_READ', messageIds: [message.id] });
    persistWorkspace({ selectedMessageId: message.id });
    const returnParams = new URLSearchParams(searchParams);
    returnParams.set('message', message.id);
    navigate(message.route, {
      state: {
        inboxReturn: `/inbox?${returnParams.toString()}`,
      },
    });
  };

  const confirmInlineAction = () => {
    if (!selectedMessage || !pendingAction) return;
    if (pendingAction.kind === 'acknowledge') {
      dispatch({ type: 'DISMISS_INBOX_MESSAGES', messageIds: [selectedMessage.id] });
    }
    if (pendingAction.kind === 'delegate_routine' && selectedMessage.responsibility) {
      dispatch({
        type: 'SET_STAFF_RESPONSIBILITY_POLICY',
        responsibility: selectedMessage.responsibility,
        policy: 'staff_execute_routine',
      });
    }
    if (pendingAction.kind === 'accept_weekend_recommendations') {
      const recommendationIds = prepareAcceptedWeekendRecommendations(
        state,
        typeof window === 'undefined' ? undefined : window.sessionStorage,
      );
      for (const recommendationId of recommendationIds) {
        dispatch({
          type: 'RESOLVE_WEEKEND_RECOMMENDATION',
          recommendationId,
          resolution: 'Accepted',
        });
      }
    }
    selectNextUnresolved(selectedMessage.id);
    setPendingAction(undefined);
  };

  return (
    <div className="ui-inbox-screen">
      <div className="ui-inbox-toolbar">
        <div className="ui-inbox-view-tabs" role="tablist" aria-label="Inbox views">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={section === item.id}
              className={section === item.id ? 'is-active' : ''}
              onClick={() => setInboxQuery('section', item.id)}
            >
              {item.label}
              <span>{countForSection(messages, item.id)}</span>
            </button>
          ))}
        </div>
        <div className="ui-inbox-toolbar-summary">
          <span><strong>{mustRespondInboxCount(state)}</strong> must respond</span>
          <span><strong>{recommendedInboxCount(state)}</strong> recommended</span>
          <span><strong>{unreadCount}</strong> unread</span>
          <Button
            className="px-2 py-1 text-[10px]"
            onClick={() => dispatch({ type: 'MARK_INBOX_READ', messageIds: messages.map((message) => message.id) })}
          >
            Mark all read
          </Button>
        </div>
      </div>

      <div className="ui-inbox-grid">
        <FmPane className="ui-inbox-folders" ariaLabel="Inbox folders">
          <FmPaneHeader title="Folders" meta={`${messages.length} total items`} />
          <FmPaneBody>
            <div className="ui-inbox-folder-list">
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={filter === item.id ? 'is-active' : ''}
                  onClick={() => setInboxQuery('category', item.id)}
                >
                  <span>{item.label}</span>
                  <strong>{countForFilter(messages, item.id)}</strong>
                </button>
              ))}
            </div>
            <div className="ui-inbox-folder-note">
              Required decisions remain visible until resolved.
            </div>
          </FmPaneBody>
        </FmPane>

        <FmPane className="ui-inbox-list" ariaLabel="Message list">
          <FmPaneHeader
            title={SECTIONS.find((item) => item.id === section)?.label ?? 'All Items'}
            meta={`${filtered.length} item${filtered.length === 1 ? '' : 's'} in this view`}
          />
          <FmPaneBody
            bodyRef={listBodyRef}
            onScroll={(event) => persistWorkspace({ listScrollTop: event.currentTarget.scrollTop })}
          >
            {filtered.length === 0 ? (
              <div className="ui-inbox-empty">Nothing here — enjoy the quiet week.</div>
            ) : (
              <div className="ui-inbox-message-list">
                {filtered.map((message) => {
                  const unread = !read.has(message.id);
                  const active = selectedMessage?.id === message.id;
                  return (
                    <button
                      key={message.id}
                      type="button"
                      className={`ui-inbox-message ${active ? 'is-active' : ''} ${unread ? 'is-unread' : ''}`}
                      onClick={() => selectMessage(message)}
                      aria-pressed={active}
                    >
                      <span className={`ui-inbox-severity is-${message.severity}`} aria-label={SEVERITY_LABELS[message.severity]} />
                      <span className="ui-inbox-message-copy">
                        <span className="ui-inbox-message-source">{message.source}</span>
                        <strong>{message.title}</strong>
                        <span className="ui-inbox-message-preview">{message.body ?? message.whyItMatters}</span>
                      </span>
                      <span className="ui-inbox-message-meta">
                        <span>{messageDate(message)}</span>
                        {unread && <i aria-label="Unread" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </FmPaneBody>
        </FmPane>

        <FmPane className="ui-inbox-reader" ariaLabel="Selected message">
          {selectedMessage ? (
            <>
              <FmPaneHeader
                title={selectedMessage.source}
                meta={`${messageDate(selectedMessage)} · ${selectedMessage.category}`}
              />
              <FmPaneBody className="ui-inbox-reader-body">
                <article>
                  <div className="ui-inbox-reader-flags">
                    <span className={`is-${selectedMessage.kind ?? 'news'}`}>
                      {KIND_LABELS[selectedMessage.kind ?? 'news']}
                    </span>
                    {selectedMessage.timing && <span>{inboxTimingLabel(selectedMessage.timing)}</span>}
                    {selectedMessage.blocking && <span className="is-blocking">Blocks advancement</span>}
                  </div>
                  <h2>{selectedMessage.title}</h2>
                  {selectedMessage.body && <p className="ui-inbox-reader-message">{selectedMessage.body}</p>}
                  {selectedMessage.whyItMatters && (
                    <div className="ui-inbox-why">
                      <strong>Why this matters</strong>
                      <p>{selectedMessage.whyItMatters}</p>
                    </div>
                  )}
                  {pendingAction && (
                    <div className="ui-inbox-confirmation" role="alert">
                      <strong>Confirm inline action</strong>
                      <h3>{pendingAction.label}</h3>
                      <p>{pendingAction.consequence}</p>
                    </div>
                  )}
                </article>
              </FmPaneBody>
              <div className="ui-inbox-action-bar">
                {pendingAction ? (
                  <>
                    <Button variant="primary" onClick={confirmInlineAction}>
                      {pendingAction.confirmLabel}
                    </Button>
                    <Button onClick={() => setPendingAction(undefined)}>Cancel</Button>
                  </>
                ) : (
                  <>
                    {inlineActions.map((action) => (
                      <Button key={action.kind} variant="primary" onClick={() => setPendingAction(action)}>
                        {action.label}
                      </Button>
                    ))}
                    <Button
                      variant={inlineActions.length > 0 ? 'ghost' : 'primary'}
                      onClick={() => openWorkspace(selectedMessage)}
                    >
                      {inlineActions.length > 0 ? `Open full workspace · ${selectedMessage.routeLabel}` : selectedMessage.routeLabel} →
                    </Button>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="ui-inbox-empty">Select a folder with messages to continue.</div>
          )}
        </FmPane>

        <FmPane className="ui-inbox-context" ariaLabel="Message context">
          <FmPaneHeader title="Context" meta="Live game state" />
          <FmPaneBody
            className="ui-inbox-context-body"
            bodyRef={contextBodyRef}
            onScroll={(event) => persistWorkspace({ contextScrollTop: event.currentTarget.scrollTop })}
          >
            {selectedMessage && (
              <ContextSection title="Selected item">
                <ContextRow label="Owner" value={selectedMessage.source ?? '—'} />
                <ContextRow label="Type" value={KIND_LABELS[selectedMessage.kind ?? 'news']} />
                <ContextRow label="Priority" value={SEVERITY_LABELS[selectedMessage.severity]} />
                <ContextRow label="Category" value={selectedMessage.category} />
                {selectedMessage.timing && <ContextRow label="Timing" value={inboxTimingLabel(selectedMessage.timing)} />}
              </ContextSection>
            )}

            <ContextSection title="Team">
              <ContextRow label="Team" value={team?.name ?? '—'} />
              <ContextRow label="Series" value={state.series} />
              <ContextRow label="Season" value={String(state.seasonYear)} />
            </ContextSection>

            <ContextSection title="Next event">
              <ContextRow label="Event" value={race?.gpName ?? 'Season complete'} />
              {race && <ContextRow label="Round" value={`${race.round} of ${state.calendar.length}`} />}
              {race && <ContextRow label="Circuit" value={race.trackName} />}
            </ContextSection>

            <ContextSection title="Current workflow">
              <p className="ui-inbox-context-callout">{workflow.reason}</p>
              <button type="button" onClick={() => navigate(workflow.to)}>{workflow.label} →</button>
            </ContextSection>

            <ContextSection title="Weekly agenda">
              {agenda.nextAction ? (
                <button
                  type="button"
                  className="ui-inbox-context-link"
                  onClick={() => navigate(agenda.nextAction!.route)}
                >
                  <strong>Next · {agenda.nextAction.title}</strong>
                  <span>{agenda.nextAction.timingLabel} · {agenda.nextAction.routeLabel} →</span>
                </button>
              ) : (
                <p className="ui-inbox-context-callout">No unresolved action is waiting this week.</p>
              )}
              {agenda.dueThisWeek.map((item) => (
                <button key={item.id} type="button" className="ui-inbox-context-link" onClick={() => navigate(item.route)}>
                  <strong>{item.owner} · {item.title}</strong>
                  <span>{item.routeLabel} →</span>
                </button>
              ))}
            </ContextSection>

            {followUps && (
              <ContextSection title={`Manager Office · ${followUps.raceLabel}`}>
                {[...followUps.changed, ...followUps.action].map((item) => (
                  <button key={item.id} type="button" className="ui-inbox-context-link" onClick={() => navigate(item.route)}>
                    <strong>{item.title}</strong>
                    <span>{item.routeLabel} →</span>
                  </button>
                ))}
              </ContextSection>
            )}

            {guide && (
              <ContextSection title={guide.title}>
                <p className="ui-inbox-context-callout">{guide.summary}</p>
                <ol className="ui-inbox-guide-steps">
                  {guide.steps.map((step) => (
                    <li key={step.number}><strong>{step.number}</strong><span>{step.title}</span></li>
                  ))}
                </ol>
              </ContextSection>
            )}
          </FmPaneBody>
        </FmPane>
      </div>
    </div>
  );
}

function ContextSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="ui-inbox-context-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="ui-inbox-context-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
