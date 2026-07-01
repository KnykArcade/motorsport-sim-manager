// Grouped Data Analytics decision panel — the single decision interface for
// normal in-race strategy calls. Shows one row per player driver with that
// driver's own pending recommendation (issue, recommended action, confidence,
// expected impact) and independent Accept / Modify / Ignore / Let Crew Decide
// controls. When more than one driver has a pending decision they group under a
// shared event header with optional shortcuts — "Accept All", "Ignore All" and
// an optional "Apply to both" (never the default). A live countdown appears when
// a high/urgent decision has paused the race; accepted duration-based
// instructions are listed compactly with their laps remaining (no re-prompt).

import { useState } from 'react';
import type { AnalyticsRecommendation, RecAction } from '../../types/liveTypes';

const PRIORITY_STYLE: Record<AnalyticsRecommendation['priority'], string> = {
  low: 'border-slate-600 bg-slate-800/40',
  medium: 'border-amber-500/50 bg-amber-500/10',
  high: 'border-orange-500/60 bg-orange-500/10',
  urgent: 'border-red-500/70 bg-red-500/10',
};

const PRIORITY_TEXT: Record<AnalyticsRecommendation['priority'], string> = {
  low: 'text-slate-400',
  medium: 'text-amber-300',
  high: 'text-orange-300',
  urgent: 'text-red-300',
};

// A human label for a group of same-kind recommendations (the shared event).
const EVENT_LABEL: Record<string, string> = {
  safetyCarPit: 'Safety Car',
  weatherTyres: 'Weather Change',
  pitWindow: 'Pit Window',
  tyres: 'Tyre Strategy',
  reliability: 'Reliability',
  component: 'Component Health',
  crash: 'Crash Risk',
  teammate: 'Team Orders',
};

export function RecommendationsPanel({
  recs,
  currentLap,
  decisionSecondsLeft = null,
  nameOf,
  onAccept,
  onModify,
  onIgnore,
  onLetCrewDecide,
  onAcceptAll,
  onIgnoreAll,
  onApplyToBoth,
  className = '',
}: {
  recs: AnalyticsRecommendation[];
  currentLap: number;
  decisionSecondsLeft?: number | null;
  nameOf: (driverId: string) => string;
  onAccept: (rec: AnalyticsRecommendation) => void;
  onModify: (rec: AnalyticsRecommendation, action: RecAction) => void;
  onIgnore: (rec: AnalyticsRecommendation) => void;
  onLetCrewDecide: (rec: AnalyticsRecommendation) => void;
  onAcceptAll: () => void;
  onIgnoreAll: () => void;
  onApplyToBoth: (action: RecAction) => void;
  className?: string;
}) {
  const [applyMenu, setApplyMenu] = useState(false);
  if (recs.length === 0) return null;

  const pending = recs.filter((r) => r.status === 'pending');
  const active = recs.filter((r) => r.status === 'active');

  const grouped = pending.length > 1;
  const sameKind = grouped && pending.every((r) => r.kind === pending[0].kind);
  const header = sameKind ? EVENT_LABEL[pending[0].kind] ?? 'Data Analytics' : 'Data Analytics';

  // Union of distinct actions across pending recs, for the "Apply to both" shortcut.
  const bothActions: RecAction[] = [];
  for (const r of pending) {
    for (const a of [r.action, ...r.alternatives]) {
      if (!bothActions.some((x) => x.type === a.type)) bothActions.push(a);
    }
  }

  return (
    <div className={`rounded-lg border border-slate-700/60 bg-[#111725] ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-700/50 px-3 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
          ⬡ Data Analytics{grouped ? ` · ${header}` : ''}
        </span>
        {decisionSecondsLeft != null ? (
          <span className="flex items-center gap-1 text-[10px] font-bold text-red-300">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
            Decision {decisionSecondsLeft}s
          </span>
        ) : (
          <span className="text-[10px] text-slate-500">
            {pending.length > 0
              ? `${pending.length} ${pending.length === 1 ? 'alert' : 'alerts'}`
              : `${active.length} active`}
          </span>
        )}
      </div>

      {pending.length > 0 && (
        <div className="space-y-1.5 p-2">
          {pending.map((rec) => (
            <DriverRow
              key={rec.id}
              rec={rec}
              name={nameOf(rec.driverId)}
              onAccept={() => onAccept(rec)}
              onModify={(a) => onModify(rec, a)}
              onIgnore={() => onIgnore(rec)}
              onLetCrewDecide={() => onLetCrewDecide(rec)}
            />
          ))}
        </div>
      )}

      {grouped && (
        <div className="border-t border-slate-700/50 p-2">
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={onAcceptAll}
              className="rounded bg-emerald-600 py-1 text-[10px] font-bold text-white hover:bg-emerald-500"
            >
              Accept All
            </button>
            <button
              onClick={onIgnoreAll}
              className="rounded bg-slate-800 py-1 text-[10px] font-bold text-slate-400 hover:bg-slate-700"
            >
              Ignore All
            </button>
          </div>
          <button
            onClick={() => setApplyMenu((v) => !v)}
            className="mt-1 w-full rounded border border-slate-700 py-1 text-[10px] font-semibold text-slate-300 hover:bg-slate-800"
          >
            Apply to both ▾
          </button>
          {applyMenu && (
            <div className="mt-1 space-y-1">
              {bothActions.map((a) => (
                <button
                  key={a.type}
                  onClick={() => {
                    onApplyToBoth(a);
                    setApplyMenu(false);
                  }}
                  className="w-full rounded bg-slate-800 px-2 py-1 text-left text-[10px] font-semibold text-slate-200 hover:bg-slate-700"
                >
                  Both drivers → {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {active.length > 0 && (
        <div className="space-y-1 border-t border-slate-700/50 p-2">
          <div className="text-[9px] uppercase tracking-wide text-slate-500">Active instructions</div>
          {active.map((rec) => (
            <ActiveRow key={rec.id} rec={rec} name={nameOf(rec.driverId)} currentLap={currentLap} />
          ))}
        </div>
      )}
    </div>
  );
}

// Compact status line for an accepted, duration-based instruction currently
// being applied. Shows the laps remaining; the card is never re-prompted.
function ActiveRow({
  rec,
  name,
  currentLap,
}: {
  rec: AnalyticsRecommendation;
  name: string;
  currentLap: number;
}) {
  const label = rec.appliedAction?.label ?? rec.action.label;
  const remaining = rec.appliedUntilLap != null ? Math.max(0, rec.appliedUntilLap - currentLap) : null;
  const suffix =
    remaining == null
      ? ''
      : rec.appliedUntilLap != null && remaining > 0
        ? ` — ${remaining} lap${remaining === 1 ? '' : 's'} remaining`
        : '';
  return (
    <div className="flex items-center justify-between rounded bg-slate-800/50 px-2 py-1">
      <span className="text-[10px] font-semibold text-slate-200">
        {name}: {label} active{suffix}
      </span>
      {rec.appliedUntilLap != null && (
        <span className="text-[9px] text-slate-500">until L{rec.appliedUntilLap}</span>
      )}
    </div>
  );
}

function DriverRow({
  rec,
  name,
  onAccept,
  onModify,
  onIgnore,
  onLetCrewDecide,
}: {
  rec: AnalyticsRecommendation;
  name: string;
  onAccept: () => void;
  onModify: (action: RecAction) => void;
  onIgnore: () => void;
  onLetCrewDecide: () => void;
}) {
  const [modifying, setModifying] = useState(false);
  return (
    <div className={`rounded-md border p-2 ${PRIORITY_STYLE[rec.priority]}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-100">{name}</span>
        <span className={`text-[9px] font-bold uppercase tracking-wider ${PRIORITY_TEXT[rec.priority]}`}>
          {rec.priority} · {rec.confidence}%
        </span>
      </div>
      <p className="mt-0.5 text-[11px] text-slate-300">{rec.issue}</p>
      <p className="mt-0.5 text-[11px] font-medium text-slate-100">
        ▸ {rec.recommendedAction}
        {rec.suggestedDuration ? ` (${rec.suggestedDuration})` : ''}
      </p>
      <p className="mt-0.5 text-[10px] text-slate-400">Impact: {rec.expectedImpact}</p>

      {!modifying ? (
        <>
          <div className="mt-1.5 grid grid-cols-3 gap-1">
            <button
              onClick={onAccept}
              className="rounded bg-emerald-600 py-1 text-[10px] font-bold text-white hover:bg-emerald-500"
            >
              Accept
            </button>
            <button
              onClick={() => setModifying(true)}
              className="rounded bg-slate-700 py-1 text-[10px] font-bold text-slate-100 hover:bg-slate-600"
            >
              Modify
            </button>
            <button
              onClick={onIgnore}
              className="rounded bg-slate-800 py-1 text-[10px] font-bold text-slate-400 hover:bg-slate-700"
            >
              Ignore
            </button>
          </div>
          <button
            onClick={onLetCrewDecide}
            className="mt-1 w-full rounded border border-slate-700 py-0.5 text-[10px] font-semibold text-slate-300 hover:bg-slate-800"
          >
            Let Crew Decide
          </button>
        </>
      ) : (
        <div className="mt-1.5 space-y-1">
          <div className="text-[9px] uppercase tracking-wide text-slate-500">Alternative actions</div>
          {[rec.action, ...rec.alternatives].map((a) => (
            <button
              key={a.type}
              onClick={() => {
                onModify(a);
                setModifying(false);
              }}
              className="w-full rounded bg-slate-800 px-2 py-1 text-left text-[10px] font-semibold text-slate-200 hover:bg-slate-700"
            >
              {a.label}
            </button>
          ))}
          <button
            onClick={() => setModifying(false)}
            className="w-full rounded py-0.5 text-[10px] text-slate-500 hover:text-slate-300"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
