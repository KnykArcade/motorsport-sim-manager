// Data Analytics — the permanent pit-wall analytics panel at the top-right of the
// Live Race screen. It never disappears; instead it switches display mode:
//
//   • Monitoring          — no player decision required; shows a live intelligence
//                           feed (focus, strategy read, telemetry tiles, next
//                           trigger) plus any recent-decision cooldown context.
//   • Decision            — one or more pending recommendations await the player;
//                           one row per driver with Accept / Modify / Ignore /
//                           Let Crew Decide, grouped under a shared event header
//                           with Accept All / Ignore All / Apply-to-both. A
//                           countdown shows when a high/urgent decision has paused
//                           the race. This panel IS the decision interface — there
//                           is no duplicate pop-up for normal decisions.
//   • Active Instruction  — an accepted duration instruction is being applied;
//                           shows the laps remaining (never re-prompted) with a
//                           compact monitoring line beneath.
//   • Cooldown            — a Monitoring sub-state shown after an ignored/expired
//                           recommendation, explaining why it will not immediately
//                           reappear.

import { useState } from 'react';
import type { AnalyticsRecommendation, RecAction } from '../../types/liveTypes';
import type { AnalyticsMonitor, MonitorStatus, MonitorTile, PanelMode } from '../../sim/analyticsMonitor';
import { kindLabel, selectPanelMode } from '../../sim/analyticsMonitor';

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

// Monitoring tile status → dot + text colour.
const STATUS_DOT: Record<MonitorStatus, string> = {
  green: 'bg-emerald-400',
  yellow: 'bg-amber-400',
  orange: 'bg-orange-400',
  red: 'bg-red-400',
  blue: 'bg-sky-400',
  purple: 'bg-fuchsia-400',
};
const STATUS_TEXT: Record<MonitorStatus, string> = {
  green: 'text-emerald-300',
  yellow: 'text-amber-300',
  orange: 'text-orange-300',
  red: 'text-red-300',
  blue: 'text-sky-300',
  purple: 'text-fuchsia-300',
};

// Thin coloured top border reflecting the panel's current urgency.
const MODE_BORDER: Record<PanelMode, string> = {
  monitoring: 'border-t-slate-600',
  cooldown: 'border-t-slate-500',
  active: 'border-t-emerald-500/70',
  decision: 'border-t-amber-500/70',
};

const MODE_LABEL: Record<PanelMode, string> = {
  monitoring: 'Monitoring',
  cooldown: 'Cooldown',
  active: 'Active',
  decision: 'Decision',
};

export function RecommendationsPanel({
  recs,
  monitor,
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
  monitor: AnalyticsMonitor;
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

  const pending = recs.filter((r) => r.status === 'pending');
  const active = recs.filter((r) => r.status === 'active');

  const mode: PanelMode = selectPanelMode(recs, monitor.recent.length);

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
    <div className={`rounded-lg border border-t-2 border-slate-700/60 bg-[#111725] ${MODE_BORDER[mode]} ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-700/50 px-3 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
          ⬡ Data Analytics — {MODE_LABEL[mode]}
          {mode === 'decision' && grouped ? ` · ${header}` : ''}
        </span>
        {decisionSecondsLeft != null ? (
          <span className="flex items-center gap-1 text-[10px] font-bold text-red-300">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
            Decision {decisionSecondsLeft}s
          </span>
        ) : mode === 'decision' ? (
          <span className="text-[10px] text-slate-500">
            {pending.length} {pending.length === 1 ? 'alert' : 'alerts'}
          </span>
        ) : (
          <span className="text-[10px] text-slate-500">Confidence {monitor.confidence}%</span>
        )}
      </div>

      {/* Decision mode — one actionable row per driver. */}
      {mode === 'decision' && (
        <>
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
        </>
      )}

      {/* Active-instruction mode — accepted durations run down without re-prompting. */}
      {mode === 'active' && (
        <div className="space-y-1 p-2">
          {active.map((rec) => (
            <ActiveRow key={rec.id} rec={rec} name={nameOf(rec.driverId)} currentLap={currentLap} />
          ))}
          <p className="px-0.5 pt-0.5 text-[10px] text-slate-400">{monitor.headline}</p>
        </div>
      )}

      {/* Monitoring / cooldown mode — the idle intelligence feed. */}
      {(mode === 'monitoring' || mode === 'cooldown') && (
        <div className="max-h-[300px] space-y-2 overflow-y-auto p-2">
          <p className="text-[11px] leading-snug text-slate-200">{monitor.headline}</p>
          {monitor.recent.length > 0 && (
            <div className="space-y-1 rounded border border-slate-700/60 bg-slate-800/40 p-1.5">
              <div className="text-[9px] uppercase tracking-wide text-slate-500">Recent decision</div>
              {monitor.recent.slice(0, 2).map((r) => (
                <div key={`${r.driverId}:${r.kind}`} className="text-[10px] text-slate-300">
                  Lap {r.lap} — {nameOf(r.driverId)} ignored {kindLabel(r.kind)} recommendation.
                  <span className="text-slate-500">
                    {' '}
                    Cooldown {r.cooldownLapsRemaining} lap{r.cooldownLapsRemaining === 1 ? '' : 's'}.
                  </span>
                </div>
              ))}
            </div>
          )}
          {monitor.drivers.map((d) => (
            <div key={d.driverId} className="rounded-md border border-slate-700/50 bg-slate-900/40 p-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-100">{nameOf(d.driverId)}</span>
                {d.position != null && <span className="text-[10px] font-semibold text-slate-400">P{d.position}</span>}
              </div>
              <p className="mt-0.5 text-[10px] leading-snug text-slate-300">{d.focus}</p>
              <p className="mt-0.5 text-[9px] leading-snug text-slate-500">{d.strategyRead}</p>
              <div className="mt-1.5 grid grid-cols-2 gap-1">
                {d.tiles.map((t) => (
                  <Tile key={t.key} tile={t} />
                ))}
              </div>
              <p className="mt-1.5 text-[9px] text-slate-500">{d.nextTrigger}</p>
            </div>
          ))}
          {monitor.drivers.length === 0 && (
            <p className="text-[10px] text-slate-500">No player cars running — monitoring paused.</p>
          )}
        </div>
      )}
    </div>
  );
}

// A compact telemetry tile (Gap / Tyre / Reliability / Fuel / Strategy / Traffic / Weather).
function Tile({ tile }: { tile: MonitorTile }) {
  return (
    <div className="flex items-start gap-1.5 rounded bg-slate-800/60 px-1.5 py-1">
      <span className={`mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[tile.status]}`} />
      <div className="min-w-0">
        <div className="text-[8px] uppercase tracking-wide text-slate-500">{tile.label}</div>
        <div className={`truncate text-[10px] font-semibold ${STATUS_TEXT[tile.status]}`}>{tile.value}</div>
      </div>
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
