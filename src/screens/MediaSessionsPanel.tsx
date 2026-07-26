import { useMemo, useState } from 'react';
import { Button } from '../components/Button';
import {
  FmDecisionBar,
  FmKeyValue,
  FmListButton,
  FmPane,
  FmPaneBody,
  FmPaneHeader,
  FmWorkspaceGrid,
} from '../components/workspace/FmPane';
import { useGame } from '../game/GameContext';
import { pendingMediaSessions } from '../sim/mediaSessionEngine';
import {
  canMakePublicMediaPromise,
  mediaPressureState,
  mediaPromiseLabel,
} from '../sim/mediaPressureEngine';
import type { MediaSession } from '../types/mediaTypes';
import {
  MEDIA_RESPONSE_STYLES,
  mediaSessionProgress,
  mediaSessionTypeLabel,
  mediaSessionUrgency,
  selectedMediaSession,
} from './mediaSessionViewModel';

export function MediaSessionsPanel() {
  const { state, dispatch } = useGame();
  const [selectedId, setSelectedId] = useState<string>();
  if (!state) return null;

  const sessions = state.media?.sessions ?? [];
  const pressure = mediaPressureState(state);
  const pending = pendingMediaSessions(state);
  const selected = selectedMediaSession(sessions, pending, selectedId);
  const activeStories = pressure.storyThreads?.filter((story) => story.status === 'Active') ?? [];
  const recentPromises = pressure.publicPromises ?? [];
  const recentStories = pressure.storyThreads ?? [];
  const openCrises = pressure.crises?.filter((crisis) => crisis.status === 'Open') ?? [];

  return (
    <div className="ui-media-workspace">
      <FmWorkspaceGrid>
        <FmPane>
          <FmPaneHeader title="Media schedule" meta={`${pending.length} awaiting response · ${sessions.length} total`} />
          <FmPaneBody>
            {sessions.map((session) => {
              const urgency = mediaSessionUrgency(session);
              return (
                <FmListButton
                  key={session.id}
                  active={selected?.id === session.id}
                  urgent={urgency === 'critical'}
                  onClick={() => setSelectedId(session.id)}
                >
                  <span className="ui-news-list-source">{mediaSessionTypeLabel(session.type)} · {session.round > 0 ? `R${session.round}` : `Season ${session.seasonYear}`}</span>
                  <strong>{session.title}</strong>
                  <span>{session.trigger}</span>
                  <small>{mediaSessionProgress(session)}</small>
                </FmListButton>
              );
            })}
            {sessions.length === 0 && (
              <div className="ui-inbox-empty">No interview has been triggered. Sessions are generated from real preseason, weekend, contract, sponsor, and boardroom events.</div>
            )}
          </FmPaneBody>
        </FmPane>

        <FmPane>
          <FmPaneHeader
            title={selected?.title ?? 'Interview room'}
            meta={selected ? `${mediaSessionTypeLabel(selected.type)} · ${mediaSessionProgress(selected)}` : 'No session selected'}
            actions={selected?.status === 'Pending' ? <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => dispatch({ type: 'DECLINE_MEDIA_SESSION', sessionId: selected.id })}>Decline duties</Button> : undefined}
          />
          <FmPaneBody className="ui-media-interview-pane">
            {selected ? (
              <MediaSessionDetail
                session={selected}
                onAnswer={(questionId, style) => dispatch({
                  type: 'ANSWER_MEDIA_QUESTION',
                  sessionId: selected.id,
                  questionId,
                  style,
                })}
                canPromise={(questionId) => {
                  const question = selected.questions.find((entry) => entry.id === questionId);
                  return Boolean(question && canMakePublicMediaPromise(state, question));
                }}
                onPromise={(questionId) => dispatch({
                  type: 'MAKE_PUBLIC_MEDIA_PROMISE',
                  sessionId: selected.id,
                  questionId,
                })}
              />
            ) : <div className="ui-inbox-empty">Select a scheduled media session.</div>}
          </FmPaneBody>
        </FmPane>

        <FmPane>
          <FmPaneHeader title="Media context" meta={`${openCrises.length} open crises · ${activeStories.length} active stories`} />
          <FmPaneBody className="ui-media-context-pane">
            {openCrises.map((crisis) => (
              <section key={crisis.id} className="ui-media-crisis">
                <h3>Crisis decision · {crisis.kind}</h3>
                <strong>{crisis.headline}</strong>
                <p>{crisis.detail}</p>
                {[
                  ['TransparentBriefing', 'Brief transparently'],
                  ['PrivateInvestigation', 'Investigate privately'],
                  ['DenyAndDeflect', 'Deny and deflect'],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => dispatch({
                      type: 'RESOLVE_MEDIA_CRISIS',
                      crisisId: crisis.id,
                      resolution: id as 'TransparentBriefing' | 'PrivateInvestigation' | 'DenyAndDeflect',
                    })}
                  >
                    {label}
                  </button>
                ))}
              </section>
            ))}
            <section>
              <h3>Current pressure</h3>
              <FmKeyValue label="Pending sessions" value={pending.length} />
              <FmKeyValue label="Active stories" value={activeStories.length} />
              <FmKeyValue label="Public promises" value={recentPromises.filter((promise) => promise.status === 'Active').length} />
              <FmKeyValue label="Completed sessions" value={sessions.filter((session) => session.status === 'Completed').length} />
            </section>
            <section>
              <h3>Public commitments</h3>
              {recentPromises.slice(0, 6).map((promise) => (
                <article key={promise.id}>
                  <strong>{mediaPromiseLabel(promise.type)}</strong>
                  <small>{promise.status === 'Active' ? `Due R${promise.deadlineRound}` : promise.status}</small>
                  <p>{promise.statement}</p>
                </article>
              ))}
              {recentPromises.length === 0 && <p>No public commitments have been made.</p>}
            </section>
            <section>
              <h3>Persistent stories</h3>
              {recentStories.slice(0, 6).map((story) => (
                <article key={story.id}>
                  <strong>{story.headline}</strong>
                  <small>{story.scope} · {story.stage}</small>
                  <p>{story.summary}</p>
                </article>
              ))}
              {recentStories.length === 0 && <p>No persistent media story has developed.</p>}
            </section>
          </FmPaneBody>
        </FmPane>
      </FmWorkspaceGrid>

      <FmDecisionBar
        actions={selected?.status === 'Pending' ? <span>{selected.questions.length - selected.answers.length} question{selected.questions.length - selected.answers.length === 1 ? '' : 's'} unanswered</span> : undefined}
      >
        <strong className="text-neutral-200">Press office:</strong> Answers change existing trust, owner patience, sponsor confidence, team culture, rival respect, and media image.
      </FmDecisionBar>
    </div>
  );
}

function MediaSessionDetail({
  session,
  onAnswer,
  canPromise,
  onPromise,
}: {
  session: MediaSession;
  onAnswer: (questionId: string, style: (typeof MEDIA_RESPONSE_STYLES)[number]['id']) => void;
  canPromise: (questionId: string) => boolean;
  onPromise: (questionId: string) => void;
}) {
  const answered = useMemo(() => new Map(session.answers.map((answer) => [answer.questionId, answer])), [session.answers]);
  return (
    <div>
      <div className="ui-media-trigger">
        <span>Why the press is here</span>
        <p>{session.trigger}</p>
      </div>
      <div className="ui-media-question-list">
        {session.questions.map((question) => {
          const answer = answered.get(question.id);
          return (
            <article key={question.id}>
              <span>{question.topic}</span>
              <h3>{question.prompt}</h3>
              <p>{question.context}</p>
              {answer ? (
                <div className="ui-media-answer">
                  <strong>{answer.style} answer</strong>
                  <p>{answer.response}</p>
                  <em>{answer.reaction}</em>
                  {canPromise(question.id) && (
                    <button type="button" onClick={() => onPromise(question.id)}>Make a public commitment</button>
                  )}
                </div>
              ) : session.status === 'Pending' ? (
                <div className="ui-media-response-grid">
                  {MEDIA_RESPONSE_STYLES.map((style) => (
                    <button key={style.id} type="button" onClick={() => onAnswer(question.id, style.id)}>
                      <strong>{style.label}</strong>
                      <span>{style.guidance}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      {session.consequenceSummary && <div className="ui-media-consequence">{session.consequenceSummary}</div>}
    </div>
  );
}
