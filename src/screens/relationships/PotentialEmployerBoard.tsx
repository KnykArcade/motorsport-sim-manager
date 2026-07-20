import { Panel } from '../../components/Panel';
import { relationshipStatusLabel } from './relationshipPriorityViewModel';
import type { PotentialEmployerStanding } from './relationshipEmployerViewModel';
import { RelationshipRiskNote } from './RelationshipRiskNote';
import { employerRiskIfIgnored, relationshipRiskPriorityContext } from './relationshipRiskViewModel';
import { employerManagementMove } from './relationshipActionViewModel';

const STATUS_STYLES: Record<PotentialEmployerStanding['status'], string> = {
  MustActNow: 'border-red-500/45 bg-red-500/5 text-red-200',
  WatchClosely: 'border-amber-500/40 bg-amber-500/5 text-amber-200',
  Stable: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200',
};

type Props = {
  standing?: PotentialEmployerStanding;
  onReview: () => void;
};

export function PotentialEmployerBoard({ standing, onReview }: Props) {
  if (!standing) return null;
  const move = employerManagementMove(standing);

  return (
    <Panel title="Potential Employers · Authority #6">
      <p className="mb-3 text-xs text-neutral-400">
        Other owners matter when your position or ambition changes. Their interest is shown as career leverage, without outranking the owner and people you manage today.
      </p>
      <div className={`rounded-lg border p-3 ${STATUS_STYLES[standing.status]}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-neutral-100">Paddock employment standing</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wide text-neutral-500">
              {standing.authorityLabel}
            </div>
          </div>
          <span className="shrink-0 rounded border border-current/25 px-2 py-1 text-[10px] font-bold uppercase tracking-wide">
            {relationshipStatusLabel(standing.status)}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <Metric label="Market standing" value={`${standing.marketStanding}`} />
          <Metric label="Firm offers" value={`${standing.firmOffers}`} />
          <Metric label="Rumors" value={`${standing.rumors}`} />
        </div>

        <ul className="mt-3 space-y-1 text-[11px] text-neutral-300">
          {standing.reasons.slice(0, 3).map((reason) => <li key={reason}>• {reason}</li>)}
        </ul>

        <RelationshipRiskNote priorityContext={relationshipRiskPriorityContext(standing)}>{employerRiskIfIgnored(standing)}</RelationshipRiskNote>

        <div className="mt-3 rounded border border-neutral-700/70 bg-neutral-950/45 p-2.5">
          <div className="text-[9px] font-bold uppercase tracking-wide text-[var(--era-accent-strong)]">Management move</div>
          <div className="mt-1 text-xs font-semibold text-neutral-100">{move.title}</div>
          <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">{move.rationale}</p>
          <p className="mt-1 text-[10px] leading-relaxed text-neutral-500">{move.expectedEffect}</p>
        </div>

        {standing.opportunities.length > 0 && (
          <div className="mt-3 grid gap-2 lg:grid-cols-3">
            {standing.opportunities.slice(0, 3).map((opportunity) => (
              <article key={opportunity.offer.id} className="rounded border border-neutral-800 bg-neutral-950/35 p-2.5 text-neutral-300">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs font-bold text-neutral-100">{opportunity.teamName}</div>
                  <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-[var(--era-accent-strong)]">
                    {opportunity.accepted ? 'Accepted' : opportunity.offer.kind}
                  </span>
                </div>
                <div className="mt-1 text-[10px] font-semibold text-neutral-400">{opportunity.ownerLabel}</div>
                <p className="mt-1 text-[10px] leading-relaxed text-neutral-500">{opportunity.ownerMotivation}</p>
                <p className="mt-2 text-[10px] leading-relaxed text-neutral-300">{opportunity.interestReason}</p>
              </article>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onReview}
          className="mt-3 text-[11px] font-semibold text-[var(--era-accent-strong)] hover:underline"
        >
          Review career market & offers →
        </button>
      </div>
    </Panel>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-neutral-950/30 px-2 py-1.5 text-center">
      <div className="text-xs font-bold tabular-nums text-neutral-200">{value}</div>
      <div className="text-[8px] uppercase tracking-wide text-neutral-600">{label}</div>
    </div>
  );
}
