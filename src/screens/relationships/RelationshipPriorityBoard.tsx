import { Panel } from '../../components/Panel';
import type { RelationshipAttentionProfile } from '../../sim/relationshipAttentionEngine';
import {
  RELATIONSHIP_HIERARCHY,
  relationshipStatusLabel,
  relationshipTargetLabel,
  visibleRelationshipPriorities,
} from './relationshipPriorityViewModel';

const STATUS_STYLES: Record<RelationshipAttentionProfile['status'], string> = {
  MustActNow: 'border-red-500/45 bg-red-500/5 text-red-200',
  WatchClosely: 'border-amber-500/40 bg-amber-500/5 text-amber-200',
  Stable: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200',
};

type Props = {
  profiles: RelationshipAttentionProfile[];
  onReview: (profile: RelationshipAttentionProfile) => void;
};

export function RelationshipPriorityBoard({ profiles, onReview }: Props) {
  const visible = visibleRelationshipPriorities(profiles);

  return (
    <div className="space-y-4">
      <Panel title="Current Priority Board">
        <div className="mb-3 grid gap-2 md:grid-cols-3">
          <SignalExplanation
            title="Authority"
            detail="Formal hierarchy. The owner remains #1 even when another relationship needs attention first."
          />
          <SignalExplanation
            title="Influence"
            detail="Practical leverage on a 1–100 scale. A genuine superstar can rival ownership power."
          />
          <SignalExplanation
            title="Attention"
            detail="What needs action now. Deadlines, disputes, promises, and instability can temporarily reorder the queue."
          />
        </div>

        {visible.length === 0 ? (
          <p className="text-sm text-neutral-500">No current relationship profiles are available.</p>
        ) : (
          <div className="grid gap-2 lg:grid-cols-2">
            {visible.map((profile) => (
              <article
                key={`${profile.target.type}:${profile.target.id}`}
                className={`rounded-lg border p-3 ${STATUS_STYLES[profile.status]}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-neutral-100">{profile.target.name}</div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-wide text-neutral-500">
                      {relationshipTargetLabel(profile.target.type)} · Authority #{profile.authorityRank}
                    </div>
                  </div>
                  <span className="shrink-0 rounded border border-current/25 px-2 py-1 text-[10px] font-bold uppercase tracking-wide">
                    {relationshipStatusLabel(profile.status)}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 rounded bg-neutral-950/35 px-2.5 py-2">
                  <div className="text-[11px] text-neutral-400">{profile.authorityLabel}</div>
                  <div className="shrink-0 text-right">
                    <div className="text-base font-black tabular-nums text-neutral-100">{profile.influence}</div>
                    <div className="text-[9px] uppercase tracking-wide text-neutral-500">Influence</div>
                  </div>
                </div>

                <ul className="mt-2 space-y-1 text-[11px] text-neutral-300">
                  {profile.reasons.slice(0, 2).map((reason) => <li key={reason}>• {reason}</li>)}
                </ul>

                <button
                  type="button"
                  onClick={() => onReview(profile)}
                  className="mt-3 text-[11px] font-semibold text-[var(--era-accent-strong)] hover:underline"
                >
                  Review relationship →
                </button>
              </article>
            ))}
          </div>
        )}
        <p className="mt-3 text-[10px] text-neutral-500">
          Stable rival principals stay in the Rival Matrix so the board remains focused. Any active rival tension will appear here automatically.
        </p>
      </Panel>

      <Panel title="Relationship Management Hierarchy">
        <div className="grid gap-2 lg:grid-cols-2">
          {RELATIONSHIP_HIERARCHY.map((row) => (
            <div key={row.rank} className="flex gap-3 rounded-lg border border-neutral-800 bg-neutral-900/35 p-3">
              <div className="flex h-9 w-12 shrink-0 items-center justify-center rounded bg-neutral-950/70 text-sm font-black text-[var(--era-accent-strong)]">
                #{row.rank}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-neutral-100">{row.title}</div>
                <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">{row.motivation}</p>
                <div className="mt-1.5 text-[9px] font-semibold uppercase tracking-wide text-neutral-600">{row.coverage}</div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function SignalExplanation({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--era-accent-strong)]">{title}</div>
      <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">{detail}</p>
    </div>
  );
}
