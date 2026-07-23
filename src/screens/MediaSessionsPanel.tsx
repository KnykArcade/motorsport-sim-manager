import { useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import { MetricStrip, WorkspaceMetric } from '../components/workspace/Workspace';
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
} from './mediaSessionViewModel';

export function MediaSessionsPanel() {
  const { state, dispatch } = useGame();
  const [selectedId, setSelectedId] = useState<string>();
  if (!state) return null;

  const sessions = state.media?.sessions ?? [];
  const pressure = mediaPressureState(state);
  const pending = pendingMediaSessions(state);
  const selected = sessions.find((session) => session.id === selectedId)
    ?? pending[0]
    ?? sessions[0];
  const completed = sessions.filter((session) => session.status === 'Completed').length;
  const crises = pending.filter((session) => session.type === 'Crisis').length;
  const activePromises = pressure.publicPromises?.filter((promise) => promise.status === 'Active') ?? [];
  const activeStories = pressure.storyThreads?.filter((story) => story.status === 'Active') ?? [];
  const recentPromises = pressure.publicPromises ?? [];
  const recentStories = pressure.storyThreads ?? [];
  const openCrises = pressure.crises?.filter((crisis) => crisis.status === 'Open') ?? [];

  return (
    <div className="space-y-3">
      <MetricStrip>
        <WorkspaceMetric label="Awaiting response" value={pending.length} detail="Optional media duties" />
        <WorkspaceMetric label="Crisis sessions" value={crises} detail="Higher stakeholder pressure" />
        <WorkspaceMetric label="Completed" value={completed} detail="This career" />
        <WorkspaceMetric label="Active stories" value={activeStories.length} detail="Player and AI news cycles" />
      </MetricStrip>

      {openCrises.map((crisis) => (
        <Panel key={crisis.id} title={`Crisis decision · ${crisis.kind}`}>
          <div className="rounded border border-red-800/50 bg-red-950/15 p-3">
            <h3 className="font-bold text-red-100">{crisis.headline}</h3>
            <p className="mt-1 text-xs leading-5 text-red-100/70">{crisis.detail}</p>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {[
                ['TransparentBriefing', 'Brief transparently', 'Accept scrutiny and publish the known facts.'],
                ['PrivateInvestigation', 'Investigate privately', 'Contain the issue while gathering evidence.'],
                ['DenyAndDeflect', 'Deny and deflect', 'Challenge the story and risk a later contradiction.'],
              ].map(([id, label, detail]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => dispatch({
                    type: 'RESOLVE_MEDIA_CRISIS',
                    crisisId: crisis.id,
                    resolution: id as 'TransparentBriefing' | 'PrivateInvestigation' | 'DenyAndDeflect',
                  })}
                  className="rounded border border-red-900/60 bg-neutral-950/50 p-3 text-left hover:border-red-500/70"
                >
                  <div className="text-xs font-bold text-neutral-200">{label}</div>
                  <p className="mt-1 text-[11px] leading-4 text-neutral-500">{detail}</p>
                </button>
              ))}
            </div>
          </div>
        </Panel>
      ))}

      {(recentPromises.length > 0 || recentStories.length > 0) && (
        <div className="grid gap-3 xl:grid-cols-2">
          <Panel title="Public commitments">
            {recentPromises.length === 0 ? (
              <p className="text-sm text-neutral-500">No public commitments have been made.</p>
            ) : (
              <div className="space-y-2">
                {recentPromises.slice(0, 8).map((promise) => (
                  <article key={promise.id} className="rounded border border-neutral-800 bg-neutral-950/40 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <strong className="text-xs text-neutral-200">{mediaPromiseLabel(promise.type)}</strong>
                      <span className={`text-[10px] uppercase tracking-wide ${
                        promise.status === 'Kept'
                          ? 'text-emerald-400'
                          : promise.status === 'Broken' || promise.status === 'Expired'
                            ? 'text-red-400'
                            : 'text-amber-400'
                      }`}>{promise.status === 'Active' ? `Due R${promise.deadlineRound}` : promise.status}</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-neutral-500">{promise.statement}</p>
                    {promise.outcome && <p className="mt-1 text-[11px] leading-4 text-neutral-400">{promise.outcome}</p>}
                  </article>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Persistent media stories">
            {recentStories.length === 0 ? (
              <p className="text-sm text-neutral-500">No persistent media story has developed.</p>
            ) : <div className="space-y-2">
              {recentStories.slice(0, 8).map((story) => (
                <article key={story.id} className="rounded border border-neutral-800 bg-neutral-950/40 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-xs text-neutral-200">{story.headline}</strong>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                      story.stage === 'Flashpoint'
                        ? 'bg-red-500/15 text-red-300'
                        : story.stage === 'Escalating'
                          ? 'bg-amber-500/15 text-amber-300'
                          : story.stage === 'Cooling'
                            ? 'bg-blue-500/15 text-blue-300'
                            : 'bg-neutral-800 text-neutral-400'
                    }`}>{story.scope} · {story.stage}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-neutral-500">{story.summary}</p>
                </article>
              ))}
            </div>}
          </Panel>
        </div>
      )}

      {sessions.length === 0 ? (
        <Panel title="Media schedule">
          <p className="text-sm text-neutral-500">No interview has been triggered yet. Sessions are generated from real preseason, race-weekend, contract, sponsor, and boardroom events.</p>
        </Panel>
      ) : (
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,0.7fr)_minmax(0,1.6fr)]">
          <Panel title="Media schedule">
            <div className="space-y-2">
              {sessions.map((session) => {
                const urgency = mediaSessionUrgency(session);
                const active = selected?.id === session.id;
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => setSelectedId(session.id)}
                    className={`w-full rounded border p-3 text-left ${
                      active
                        ? 'border-amber-500/60 bg-amber-950/20'
                        : 'border-neutral-800 bg-neutral-950/40 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-neutral-200">{session.title}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-wide text-neutral-500">
                          {mediaSessionTypeLabel(session.type)} · {session.round > 0 ? `R${session.round}` : `Season ${session.seasonYear}`}
                        </div>
                      </div>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        urgency === 'critical'
                          ? 'bg-red-500/15 text-red-300'
                          : urgency === 'recommended'
                            ? 'bg-amber-500/15 text-amber-300'
                            : 'bg-neutral-800 text-neutral-500'
                      }`}>
                        {mediaSessionProgress(session)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>

          {selected && (
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
              onDecline={() => dispatch({ type: 'DECLINE_MEDIA_SESSION', sessionId: selected.id })}
            />
          )}
        </div>
      )}
    </div>
  );
}

function MediaSessionDetail({
  session,
  onAnswer,
  canPromise,
  onPromise,
  onDecline,
}: {
  session: MediaSession;
  onAnswer: (questionId: string, style: (typeof MEDIA_RESPONSE_STYLES)[number]['id']) => void;
  canPromise: (questionId: string) => boolean;
  onPromise: (questionId: string) => void;
  onDecline: () => void;
}) {
  const answered = useMemo(() => new Map(session.answers.map((answer) => [answer.questionId, answer])), [session.answers]);
  return (
    <Panel
      title={session.title}
      actions={session.status === 'Pending' ? (
        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={onDecline}>
          Decline duties
        </Button>
      ) : undefined}
    >
      <div className="mb-4 rounded border border-neutral-800 bg-neutral-950/40 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Why the press is here</div>
        <p className="mt-1 text-sm text-neutral-300">{session.trigger}</p>
        <p className="mt-2 text-xs text-neutral-500">
          Answers affect existing driver trust, owner patience, sponsor confidence, team culture, rival respect, and your media image. Exact calculations remain private.
        </p>
      </div>

      <div className="space-y-4">
        {session.questions.map((question) => {
          const answer = answered.get(question.id);
          return (
            <article key={question.id} className="rounded border border-neutral-800 bg-neutral-900/40 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-400">{question.topic}</div>
              <h3 className="mt-1 text-base font-bold text-neutral-100">{question.prompt}</h3>
              <p className="mt-1 text-xs leading-5 text-neutral-500">{question.context}</p>
              {answer ? (
                <div className="mt-3 rounded border border-neutral-700 bg-neutral-950/50 p-3">
                  <div className="text-xs font-semibold text-neutral-200">{answer.style} answer</div>
                  <p className="mt-1 text-xs leading-5 text-neutral-400">{answer.response}</p>
                  <p className="mt-2 text-xs leading-5 text-amber-200/80">{answer.reaction}</p>
                  {canPromise(question.id) && (
                    <button
                      type="button"
                      onClick={() => onPromise(question.id)}
                      className="mt-3 rounded border border-amber-700/50 bg-amber-950/20 px-2.5 py-1.5 text-[11px] font-semibold text-amber-200 hover:border-amber-500"
                    >
                      Make a public commitment
                    </button>
                  )}
                </div>
              ) : session.status === 'Pending' ? (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {MEDIA_RESPONSE_STYLES.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => onAnswer(question.id, style.id)}
                      className="rounded border border-neutral-700 bg-neutral-950/50 p-3 text-left hover:border-amber-500/60 hover:bg-amber-950/10"
                    >
                      <div className="text-xs font-bold text-neutral-200">{style.label}</div>
                      <p className="mt-1 text-[11px] leading-4 text-neutral-500">{style.guidance}</p>
                    </button>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {session.consequenceSummary && (
        <div className="mt-4 rounded border border-amber-800/50 bg-amber-950/15 p-3 text-xs leading-5 text-amber-100/80">
          {session.consequenceSummary}
        </div>
      )}
    </Panel>
  );
}
