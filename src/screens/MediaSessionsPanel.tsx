import { useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import { MetricStrip, WorkspaceMetric } from '../components/workspace/Workspace';
import { useGame } from '../game/GameContext';
import { pendingMediaSessions } from '../sim/mediaSessionEngine';
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
  const pending = pendingMediaSessions(state);
  const selected = sessions.find((session) => session.id === selectedId)
    ?? pending[0]
    ?? sessions[0];
  const completed = sessions.filter((session) => session.status === 'Completed').length;
  const crises = pending.filter((session) => session.type === 'Crisis').length;

  return (
    <div className="space-y-3">
      <MetricStrip>
        <WorkspaceMetric label="Awaiting response" value={pending.length} detail="Optional media duties" />
        <WorkspaceMetric label="Crisis sessions" value={crises} detail="Higher stakeholder pressure" />
        <WorkspaceMetric label="Completed" value={completed} detail="This career" />
        <WorkspaceMetric label="Declined" value={state.media?.declinedDuties ?? 0} detail="Public absences remembered" />
      </MetricStrip>

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
  onDecline,
}: {
  session: MediaSession;
  onAnswer: (questionId: string, style: (typeof MEDIA_RESPONSE_STYLES)[number]['id']) => void;
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
