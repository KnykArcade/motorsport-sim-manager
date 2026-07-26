import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  const [selectedId, setSelectedId] = useState<string>();
  if (!state) return null;

  const filter = filterFromQuery(searchParams.get('category'));
  const section = sectionFromQuery(searchParams.get('section'));
  const messages = inboxMessages(state);
  const read = new Set(state.inboxRead ?? []);
  const filtered = messages.filter((message) =>
    (filter === 'all' ? true : filter === 'action' ? message.actionable : message.category === filter)
    && (section === 'all' || message.kind === section));
  const selectedMessage = filtered.find((message) => message.id === selectedId) ?? filtered[0];
  const unreadCount = messages.filter((message) => !read.has(message.id)).length;
  const team = teamById(state, state.selectedTeamId);
  const race = currentRace(state);
  const workflow = workflowDestination(state);
  const guide = commandLoopGuide(state);
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

  const setInboxQuery = (key: 'category' | 'section', value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'all') next.delete(key);
    else next.set(key, value);
    setSelectedId(undefined);
    setSearchParams(next);
  };

  const selectMessage = (message: InboxMessage) => {
    if (!read.has(message.id)) dispatch({ type: 'MARK_INBOX_READ', messageIds: [message.id] });
    setSelectedId(message.id);
  };

  const dismissSelected = () => {
    if (!selectedMessage || selectedMessage.blocking) return;
    dispatch({ type: 'DISMISS_INBOX_MESSAGES', messageIds: [selectedMessage.id] });
    setSelectedId(undefined);
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
          <FmPaneBody>
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
                </article>
              </FmPaneBody>
              <div className="ui-inbox-action-bar">
                <Button variant="primary" onClick={() => navigate(selectedMessage.route)}>
                  {selectedMessage.routeLabel} →
                </Button>
                {!selectedMessage.blocking && (
                  <Button onClick={dismissSelected}>Dismiss</Button>
                )}
              </div>
            </>
          ) : (
            <div className="ui-inbox-empty">Select a folder with messages to continue.</div>
          )}
        </FmPane>

        <FmPane className="ui-inbox-context" ariaLabel="Message context">
          <FmPaneHeader title="Context" meta="Live game state" />
          <FmPaneBody className="ui-inbox-context-body">
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
