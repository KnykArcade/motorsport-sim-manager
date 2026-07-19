import { Panel } from '../../components/Panel';
import { relationshipStatusLabel } from './relationshipPriorityViewModel';
import type { ExternalTalentContext } from './relationshipTalentViewModel';
import { RelationshipRiskNote } from './RelationshipRiskNote';
import { externalTalentRiskIfIgnored } from './relationshipRiskViewModel';

const STATUS_STYLES: Record<ExternalTalentContext['status'], string> = {
  MustActNow: 'border-red-500/45 bg-red-500/5 text-red-200',
  WatchClosely: 'border-amber-500/40 bg-amber-500/5 text-amber-200',
  Stable: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200',
};

type Props = {
  context: ExternalTalentContext;
  onReviewDrivers: () => void;
  onReviewStaff: () => void;
};

export function ExternalTalentBoard({ context, onReviewDrivers, onReviewStaff }: Props) {
  const hasDriverContext = context.openRaceSeats > 0 || context.targets.some((target) => target.kind === 'Driver');
  const hasStaffContext = context.staffVacancies > 0 || context.targets.some((target) => target.kind === 'Staff');

  return (
    <Panel title="External Talent · Authority #8">
      <p className="mb-3 text-xs text-neutral-400">
        Other drivers and staff stay low priority until you create a recruitment context. Only saved scouting, approaches, vacancies, and pending agreements appear here.
      </p>
      <div className={`rounded-lg border p-3 ${STATUS_STYLES[context.status]}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-neutral-100">Recruitment relationship context</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wide text-neutral-500">{context.authorityLabel}</div>
          </div>
          <span className="shrink-0 rounded border border-current/25 px-2 py-1 text-[10px] font-bold uppercase tracking-wide">
            {relationshipStatusLabel(context.status)}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <Metric label="Live targets" value={`${context.targets.length}`} />
          <Metric label="Open seats" value={`${context.openRaceSeats}`} />
          <Metric label="Staff vacancies" value={`${context.staffVacancies}`} />
        </div>

        <ul className="mt-3 space-y-1 text-[11px] text-neutral-300">
          {context.reasons.slice(0, 3).map((reason) => <li key={reason}>• {reason}</li>)}
        </ul>

        <RelationshipRiskNote>{externalTalentRiskIfIgnored(context)}</RelationshipRiskNote>

        {context.targets.length > 0 && (
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {context.targets.map((target) => (
              <article key={`${target.kind}:${target.id}`} className="rounded border border-neutral-800 bg-neutral-950/35 p-2.5 text-neutral-300">
                <div className="flex items-start justify-between gap-2">
                  <div className="truncate text-xs font-bold text-neutral-100">{target.name}</div>
                  <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-[var(--era-accent-strong)]">{target.kind}</span>
                </div>
                <div className="mt-1 text-[10px] font-semibold text-neutral-300">{target.signal}</div>
                <p className="mt-1 text-[10px] leading-relaxed text-neutral-500">{target.detail}</p>
              </article>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-3">
          {hasDriverContext && <button type="button" onClick={onReviewDrivers} className="text-[11px] font-semibold text-[var(--era-accent-strong)] hover:underline">Review driver market →</button>}
          {hasStaffContext && <button type="button" onClick={onReviewStaff} className="text-[11px] font-semibold text-[var(--era-accent-strong)] hover:underline">Review staff market →</button>}
        </div>
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
