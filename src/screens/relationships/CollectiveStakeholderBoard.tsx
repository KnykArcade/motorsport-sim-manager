import { Panel } from '../../components/Panel';
import type { CollectiveStakeholderProfile } from './relationshipStakeholderViewModel';
import { relationshipStatusLabel } from './relationshipPriorityViewModel';
import { RelationshipRiskNote } from './RelationshipRiskNote';
import { collectiveRiskIfIgnored } from './relationshipRiskViewModel';
import { collectiveManagementMove } from './relationshipActionViewModel';

const STATUS_STYLES: Record<CollectiveStakeholderProfile['status'], string> = {
  MustActNow: 'border-red-500/45 bg-red-500/5 text-red-200',
  WatchClosely: 'border-amber-500/40 bg-amber-500/5 text-amber-200',
  Stable: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200',
};

type Props = {
  profiles: CollectiveStakeholderProfile[];
  onReview: (profile: CollectiveStakeholderProfile) => void;
};

export function CollectiveStakeholderBoard({ profiles, onReview }: Props) {
  return (
    <Panel title="Collective Stakeholders · Authority #4–5">
      <p className="mb-3 text-xs text-neutral-400">
        Committees, partners, and supporters are managed as collective relationships. They affect delivery and resources without adding individual-character micromanagement.
      </p>
      {profiles.length === 0 ? (
        <p className="text-sm text-neutral-500">No collective stakeholder data is available on this save.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {profiles.map((profile) => (
            <CollectiveStakeholderCard key={profile.id} profile={profile} onReview={onReview} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function CollectiveStakeholderCard({ profile, onReview }: { profile: CollectiveStakeholderProfile; onReview: (profile: CollectiveStakeholderProfile) => void }) {
  const move = collectiveManagementMove(profile);

  return (
    <article className={`rounded-lg border p-3 ${STATUS_STYLES[profile.status]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-neutral-100">{profile.title}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-neutral-500">
            Authority #{profile.authorityRank} · Collective relationship
          </div>
        </div>
        <span className="shrink-0 rounded border border-current/25 px-2 py-1 text-[10px] font-bold uppercase tracking-wide">
          {relationshipStatusLabel(profile.status)}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 rounded bg-neutral-950/35 px-2.5 py-2">
        <div className="text-[11px] text-neutral-400">{profile.authorityLabel}</div>
        <div className="shrink-0 text-right">
          <div className="text-base font-black tabular-nums text-neutral-100">{profile.health}</div>
          <div className="text-[9px] uppercase tracking-wide text-neutral-500">Health</div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {profile.metrics.map((metric) => (
          <div key={metric.label} className="rounded bg-neutral-950/30 px-2 py-1.5 text-center">
            <div className="text-xs font-bold tabular-nums text-neutral-200">{metric.value}</div>
            <div className="text-[8px] uppercase tracking-wide text-neutral-600">{metric.label}</div>
          </div>
        ))}
      </div>

      <ul className="mt-2 space-y-1 text-[11px] text-neutral-300">
        {profile.reasons.slice(0, 2).map((reason) => <li key={reason}>• {reason}</li>)}
      </ul>

      <div className="mt-3 rounded border border-neutral-700/70 bg-neutral-950/45 p-2.5">
        <div className="text-[9px] font-bold uppercase tracking-wide text-[var(--era-accent-strong)]">Management move</div>
        <div className="mt-1 text-xs font-semibold text-neutral-100">{move.title}</div>
        <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">{move.rationale}</p>
        <p className="mt-1 text-[10px] leading-relaxed text-neutral-500">{move.expectedEffect}</p>
      </div>

      <RelationshipRiskNote>{collectiveRiskIfIgnored(profile)}</RelationshipRiskNote>

      <button
        type="button"
        onClick={() => onReview(profile)}
        className="mt-3 text-[11px] font-semibold text-[var(--era-accent-strong)] hover:underline"
      >
        {profile.actionLabel} →
      </button>
    </article>
  );
}
