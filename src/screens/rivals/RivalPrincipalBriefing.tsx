import type { RivalPrincipalBrief } from './rivalPrincipalBriefViewModel';

const RISK_STYLES: Record<RivalPrincipalBrief['risk'], string> = {
  High: 'border-red-500/45 bg-red-500/5 text-red-200',
  Watch: 'border-amber-500/40 bg-amber-500/5 text-amber-200',
  Routine: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200',
};

export function RivalPrincipalBriefing({ brief }: { brief: RivalPrincipalBrief }) {
  return (
    <div className={`mt-4 rounded-lg border p-4 ${RISK_STYLES[brief.risk]}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Authority #7 · Rival principal</div>
          <h3 className="mt-1 text-sm font-bold text-neutral-100">{brief.principalName}</h3>
          <div className="mt-0.5 text-xs text-[var(--era-accent-strong)]">{brief.identityLabel}</div>
        </div>
        <div className="flex gap-1.5 text-[10px] font-semibold uppercase tracking-wide">
          <span className="rounded border border-current/25 px-2 py-1">{brief.risk} risk</span>
          <span className="rounded border border-neutral-700 px-2 py-1 text-neutral-400">{brief.trend}</span>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <section className="rounded bg-neutral-950/35 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">What drives them</div>
          <p className="mt-1 text-[11px] leading-relaxed text-neutral-300">{brief.identityDescription}</p>
          <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--era-accent-strong)]">Agenda · {brief.agendaLabel}</div>
          <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">{brief.agendaDescription}</p>
        </section>

        <section className="rounded bg-neutral-950/35 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Why this relationship matters now</div>
          <ul className="mt-1 space-y-1 text-[11px] leading-relaxed text-neutral-300">
            {brief.reasons.map((reason) => <li key={reason}>• {reason}</li>)}
          </ul>
        </section>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.25fr_0.75fr]">
        <section>
          <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Active stakes</div>
          <ul className="mt-1 space-y-1 text-[11px] leading-relaxed text-neutral-400">
            {brief.stakes.map((stake) => <li key={stake}>• {stake}</li>)}
          </ul>
        </section>
        <section className="rounded border border-neutral-800 bg-neutral-950/25 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Latest recorded change</div>
          {brief.latestChange ? (
            <>
              <p className="mt-1 text-[11px] leading-relaxed text-neutral-300">{brief.latestChange.reason}</p>
              <div className={`mt-1 text-[10px] ${brief.latestChange.amount >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                {brief.latestChange.amount >= 0 ? '+' : ''}{brief.latestChange.amount} relationship · {brief.latestChange.seasonYear}{brief.latestChange.round ? ` R${brief.latestChange.round}` : ''}
              </div>
            </>
          ) : <p className="mt-1 text-[11px] text-neutral-500">No consequential event has been recorded yet.</p>}
        </section>
      </div>
    </div>
  );
}
