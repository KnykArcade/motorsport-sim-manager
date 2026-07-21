import { useState } from 'react';
import type { GameState } from '../../game/careerState';
import { Panel } from '../../components/Panel';
import {
  currentRelationshipActivity,
  relationshipFollowUpAgenda,
  relationshipActivitySummary,
  type RelationshipActivityItem,
  type RelationshipActivityTone,
} from './relationshipActivityViewModel';

type ActivityFilter = 'All' | RelationshipActivityTone;

const TONE_STYLES: Record<RelationshipActivityTone, string> = {
  Positive: 'bg-emerald-500/10 text-emerald-300',
  Mixed: 'bg-amber-500/10 text-amber-300',
  Negative: 'bg-red-500/10 text-red-300',
  Informational: 'bg-sky-500/10 text-sky-300',
};

const FOLLOW_UP_STYLES: Record<RelationshipActivityItem['followUp']['cadence'], string> = {
  Immediate: 'border-red-700/45 bg-red-950/20 text-red-200',
  NextRound: 'border-amber-700/45 bg-amber-950/20 text-amber-200',
  Monitor: 'border-sky-700/45 bg-sky-950/20 text-sky-200',
  Background: 'border-neutral-800 bg-neutral-950/35 text-neutral-400',
};

export function RelationshipActivityPanel({ state }: { state: GameState }) {
  const [filter, setFilter] = useState<ActivityFilter>('All');
  const activity = currentRelationshipActivity(state);
  const summary = relationshipActivitySummary(activity);
  const agenda = relationshipFollowUpAgenda(activity);
  const visible = activity
    .filter((item) => filter === 'All' || item.tone === filter)
    .slice(0, 60);

  return (
    <Panel title="Relationship Change History">
      {summary.latest && (
        <div className="mb-3 rounded-lg border border-[var(--era-accent)]/35 bg-[var(--era-accent-soft)] p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wide text-[var(--era-accent-strong)]">Latest recorded outcome</div>
              <div className="mt-1 text-sm font-semibold text-neutral-100">{summary.latest.targetName} · {summary.latest.title}</div>
              <div className="mt-1 text-[10px] uppercase tracking-wide text-neutral-500">
                Priority #{summary.latest.hierarchyRank} · {summary.latest.hierarchyLabel}
              </div>
            </div>
            <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${TONE_STYLES[summary.latest.tone]}`}>
              {summary.latest.tone}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">{summary.latest.detail}</p>
          <FollowUpCallout item={summary.latest} compact />
          <div className="mt-1.5 text-[10px] text-neutral-500">Season {summary.latest.seasonYear} · Round {summary.latest.round}</div>
        </div>
      )}

      <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <OutcomeMetric label="Recorded changes" value={summary.total} detail="Decision outcomes in this save" />
        <OutcomeMetric label="Follow-ups" value={summary.activeFollowUps} detail={`${summary.immediateFollowUps} immediate · ${summary.nextRoundFollowUps} next round`} tone={summary.immediateFollowUps > 0 ? 'negative' : summary.nextRoundFollowUps > 0 ? 'warning' : undefined} />
        <OutcomeMetric label="Positive" value={summary.positive} detail="Favorable reactions" tone="positive" />
        <OutcomeMetric
          label="Direct opinion"
          value={`${summary.netOpinionDelta > 0 ? '+' : ''}${summary.netOpinionDelta}`}
          detail="Net of recorded character reactions"
          tone={summary.netOpinionDelta > 0 ? 'positive' : summary.netOpinionDelta < 0 ? 'negative' : undefined}
        />
      </div>

      <FollowUpAgenda items={agenda} summary={summary} />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-neutral-400">
          A decision ledger showing who reacted, why they reacted, and the recorded relationship effect.
        </p>
        <div className="flex flex-wrap rounded border border-neutral-800 bg-neutral-950/50 p-1">
          {(['All', 'Positive', 'Negative', 'Mixed', 'Informational'] as ActivityFilter[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              className={`rounded px-2.5 py-1 text-[10px] font-semibold ${
                filter === option
                  ? 'bg-[var(--era-accent-soft)] text-[var(--era-accent-strong)]'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-neutral-800 bg-neutral-900/30 p-4 text-sm text-neutral-500">
          {activity.length === 0
            ? 'No relationship changes have been recorded yet.'
            : `No ${filter.toLowerCase()} relationship changes are recorded.`}
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map((item) => <ActivityRow key={item.id} item={item} />)}
        </div>
      )}
      {activity.length > 60 && filter === 'All' && (
        <p className="mt-3 text-[10px] text-neutral-600">Showing the 60 most recent of {activity.length} recorded changes.</p>
      )}
    </Panel>
  );
}

function OutcomeMetric({ label, value, detail, tone }: { label: string; value: string | number; detail: string; tone?: 'positive' | 'negative' | 'warning' }) {
  const valueColor = tone === 'positive' ? 'text-emerald-300' : tone === 'negative' ? 'text-red-300' : tone === 'warning' ? 'text-amber-300' : 'text-neutral-100';
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/35 p-3">
      <div className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-1 text-xl font-black tabular-nums ${valueColor}`}>{value}</div>
      <div className="mt-0.5 text-[10px] text-neutral-600">{detail}</div>
    </div>
  );
}

function FollowUpAgenda({ items, summary }: { items: RelationshipActivityItem[]; summary: ReturnType<typeof relationshipActivitySummary> }) {
  if (items.length === 0) {
    return (
      <div className="mb-3 rounded-lg border border-emerald-800/35 bg-emerald-950/15 p-3">
        <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-300">Follow-up agenda clear</div>
        <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">
          No immediate or next-round relationship follow-ups are active. Keep monitoring the ledger for context rather than forcing a new interaction.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-lg border border-neutral-800 bg-neutral-950/35 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--era-accent-strong)]">Follow-up agenda</div>
          <p className="mt-1 text-[11px] text-neutral-500">
            {summary.immediateFollowUps} immediate · {summary.nextRoundFollowUps} next-round follow-ups from recent relationship outcomes.
          </p>
        </div>
        <span className="rounded border border-neutral-700/70 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-400">
          Top {items.length}
        </span>
      </div>
      <div className="mt-2 grid gap-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.id} className={`rounded border px-2.5 py-2 ${FOLLOW_UP_STYLES[item.followUp.cadence]}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="truncate text-xs font-semibold">{item.targetName}</div>
              <div className="shrink-0 text-[9px] font-bold uppercase tracking-wide opacity-75">
                #{item.hierarchyRank}
              </div>
            </div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-wide opacity-75">{item.followUp.label}</div>
            <p className="mt-1 text-[10px] leading-relaxed opacity-80">{item.followUp.detail}</p>
            <div className="mt-2 rounded border border-current/20 bg-neutral-950/25 px-2 py-1.5">
              <div className="text-[9px] font-bold uppercase tracking-wide opacity-70">Recommended move</div>
              <div className="mt-0.5 text-[10px] font-semibold">{item.followUp.recommendedAction.label}</div>
              <div className="mt-0.5 text-[9px] opacity-70">{item.followUp.recommendedAction.destination}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityRow({ item }: { item: RelationshipActivityItem }) {
  const sourceLabel = item.source.replace(/([a-z])([A-Z])/g, '$1 $2');
  return (
    <article className="rounded-lg border border-neutral-800 bg-neutral-900/35 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-neutral-100">{item.targetName}</span>
            <span className="text-[10px] uppercase tracking-wide text-neutral-600">{item.targetType} · {sourceLabel}</span>
            <span className="rounded border border-neutral-700/70 bg-neutral-950/45 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-neutral-400">
              #{item.hierarchyRank} {item.hierarchyLabel}
            </span>
          </div>
          <div className="mt-1 text-xs font-semibold text-[var(--era-accent-strong)]">{item.title}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${TONE_STYLES[item.tone]}`}>
            {item.tone}
          </span>
          <span className="text-[10px] tabular-nums text-neutral-600">{item.seasonYear} · R{item.round}</span>
        </div>
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-400">{item.detail}</p>
      <FollowUpCallout item={item} />
      {(item.effects.length > 0 || (item.opinionDelta ?? 0) !== 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.opinionDelta ? (
            <span className={`rounded px-2 py-1 text-[10px] ${item.opinionDelta > 0 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
              Opinion {item.opinionDelta > 0 ? '+' : ''}{item.opinionDelta}
            </span>
          ) : null}
          {item.effects.map((effect) => (
            <span key={effect} className="rounded bg-neutral-800 px-2 py-1 text-[10px] text-neutral-300">{effect}</span>
          ))}
        </div>
      )}
    </article>
  );
}

function FollowUpCallout({ item, compact = false }: { item: RelationshipActivityItem; compact?: boolean }) {
  const cadenceLabel = item.followUp.cadence === 'Immediate'
    ? 'Immediate'
    : item.followUp.cadence === 'NextRound'
      ? 'Next round'
      : item.followUp.cadence === 'Monitor'
        ? 'Monitor'
        : 'Background';
  return (
    <div className={`mt-2 rounded border px-2 py-1.5 ${FOLLOW_UP_STYLES[item.followUp.cadence]}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-wide opacity-80">Follow-up · {cadenceLabel}</span>
        <span className="text-[10px] font-semibold">{item.followUp.label}</span>
      </div>
      {!compact && (
        <>
          <p className="mt-0.5 text-[10px] leading-relaxed opacity-80">{item.followUp.detail}</p>
          <div className="mt-1.5 rounded border border-current/20 bg-neutral-950/25 px-2 py-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-[9px] font-bold uppercase tracking-wide opacity-70">Recommended move</span>
              <span className="text-[10px] font-semibold">{item.followUp.recommendedAction.label}</span>
              <span className="text-[9px] opacity-65">→ {item.followUp.recommendedAction.destination}</span>
            </div>
            <p className="mt-0.5 text-[9px] leading-relaxed opacity-70">{item.followUp.recommendedAction.rationale}</p>
          </div>
        </>
      )}
    </div>
  );
}
