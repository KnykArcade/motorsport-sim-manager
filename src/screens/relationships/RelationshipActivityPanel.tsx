import { useState } from 'react';
import type { GameState } from '../../game/careerState';
import { Panel } from '../../components/Panel';
import {
  currentRelationshipActivity,
  type RelationshipActivityItem,
  type RelationshipActivityTone,
} from './relationshipActivityViewModel';

type ActivityFilter = 'All' | 'Positive' | 'Negative';

const TONE_STYLES: Record<RelationshipActivityTone, string> = {
  Positive: 'bg-emerald-500/10 text-emerald-300',
  Mixed: 'bg-amber-500/10 text-amber-300',
  Negative: 'bg-red-500/10 text-red-300',
  Informational: 'bg-sky-500/10 text-sky-300',
};

export function RelationshipActivityPanel({ state }: { state: GameState }) {
  const [filter, setFilter] = useState<ActivityFilter>('All');
  const activity = currentRelationshipActivity(state);
  const visible = activity
    .filter((item) => filter === 'All' || item.tone === filter)
    .slice(0, 60);

  return (
    <Panel title="Relationship Change History">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-neutral-400">
          A decision ledger showing who reacted, why they reacted, and the recorded relationship effect.
        </p>
        <div className="flex rounded border border-neutral-800 bg-neutral-950/50 p-1">
          {(['All', 'Positive', 'Negative'] as ActivityFilter[]).map((option) => (
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

function ActivityRow({ item }: { item: RelationshipActivityItem }) {
  const sourceLabel = item.source.replace(/([a-z])([A-Z])/g, '$1 $2');
  return (
    <article className="rounded-lg border border-neutral-800 bg-neutral-900/35 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-neutral-100">{item.targetName}</span>
            <span className="text-[10px] uppercase tracking-wide text-neutral-600">{item.targetType} · {sourceLabel}</span>
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
