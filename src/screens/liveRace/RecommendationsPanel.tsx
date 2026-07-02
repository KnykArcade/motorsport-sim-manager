// Data Analytics — the permanent, compact pit-wall command panel at the top of
// the Live Race right column. It is a fixed-height summary (not a telemetry
// dashboard — fuel/engine/tyre bars live in the driver cards below) that always
// shows a cell for BOTH player drivers and never pushes the cards off screen.
//
// One panel, three states (see analyticsMonitor.selectPanelMode):
//   • Decision Required  — a driver has a pending recommendation: issue +
//                          recommendation + impact + Accept / Modify / Ignore /
//                          Let Crew Decide, inline (no duplicate pop-up). The
//                          other driver shows a compact "No decision pending" cell.
//   • Recent Decision    — an accepted duration instruction is running (laps
//     / Active Instruction  remaining, total, next review) or a recent ignored
//                          decision is on cooldown. The other driver stays visible.
//   • Monitoring         — no decisions: each driver shows a one-line plan read,
//                          a compact focus label and its next re-trigger.

import { useState } from 'react';
import type { AnalyticsRecommendation, RecAction } from '../../types/liveTypes';
import type {
  AnalyticsMonitor,
  DriverMonitor,
  DriverPanelCell,
  PanelMode,
} from '../../sim/analyticsMonitor';
import { kindLabel, selectPanelMode, driverPanelCell } from '../../sim/analyticsMonitor';

const PRIORITY_TEXT: Record<AnalyticsRecommendation['priority'], string> = {
  low: 'text-slate-400',
  medium: 'text-amber-300',
  high: 'text-orange-300',
  urgent: 'text-red-300',
};

// Thin coloured top border reflecting the panel's current urgency.
const MODE_BORDER: Record<PanelMode, string> = {
  monitoring: 'border-t-slate-600',
  cooldown: 'border-t-emerald-500/60',
  active: 'border-t-emerald-500/70',
  decision: 'border-t-amber-500/70',
};

const MODE_LABEL: Record<PanelMode, string> = {
  monitoring: 'Monitoring',
  cooldown: 'Recent Decision',
  active: 'Recent Decision',
  decision: 'Decision Required',
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
  className?: string;
}) {
  const mode: PanelMode = selectPanelMode(recs, monitor.recent.length);
  const pendingCount = recs.filter((r) => r.status === 'pending').length;
  const grouped = pendingCount > 1;

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-lg border border-t-2 border-slate-700/60 bg-[#111725] ${MODE_BORDER[mode]} ${className}`}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-slate-700/50 px-2.5 py-1">
        <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-300">
          ⬡ Data Analytics — {MODE_LABEL[mode]}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-[10px] text-slate-500">Confidence {monitor.confidence}%</span>
          {decisionSecondsLeft != null && (
            <span className="flex items-center gap-1 rounded-full border border-red-500/50 px-1.5 py-0.5 text-[10px] font-bold text-red-300">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
              {decisionSecondsLeft}s
            </span>
          )}
        </span>
      </div>

      {monitor.drivers.length === 0 ? (
        <p className="p-2 text-[10px] text-slate-500">No player cars running — monitoring paused.</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden p-1">
          {monitor.drivers.map((d) => (
            <DriverCell
              key={d.driverId}
              driver={d}
              name={nameOf(d.driverId)}
              cell={driverPanelCell(d.driverId, recs, monitor.recent, currentLap)}
              compact={grouped}
              onAccept={onAccept}
              onModify={onModify}
              onIgnore={onIgnore}
              onLetCrewDecide={onLetCrewDecide}
            />
          ))}

          {grouped && (
            <div className="mt-auto grid shrink-0 grid-cols-2 gap-1 pt-0.5">
              <button
                onClick={onAcceptAll}
                className="rounded bg-emerald-600 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-500"
              >
                Accept All
              </button>
              <button
                onClick={onIgnoreAll}
                className="rounded bg-slate-800 py-0.5 text-[10px] font-bold text-slate-400 hover:bg-slate-700"
              >
                Ignore All
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Small state badge shown top-right of each driver cell.
function CellBadge({ state }: { state: DriverPanelCell['state'] }) {
  const styles: Record<DriverPanelCell['state'], string> = {
    decision: 'border-amber-500/60 bg-amber-500/15 text-amber-300',
    active: 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300',
    recent: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300',
    monitoring: 'border-slate-600 bg-slate-800/60 text-slate-400',
  };
  const label: Record<DriverPanelCell['state'], string> = {
    decision: 'Decision',
    active: 'Active',
    recent: 'Recent',
    monitoring: 'No decision',
  };
  return (
    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide ${styles[state]}`}>
      {label[state]}
    </span>
  );
}

const CELL_BORDER: Record<DriverPanelCell['state'], string> = {
  decision: 'border-amber-500/50 bg-amber-500/[0.06]',
  active: 'border-emerald-500/40 bg-emerald-500/[0.05]',
  recent: 'border-slate-700/60 bg-slate-900/40',
  monitoring: 'border-slate-700/50 bg-slate-900/40',
};

function DriverCell({
  driver,
  name,
  cell,
  compact = false,
  onAccept,
  onModify,
  onIgnore,
  onLetCrewDecide,
}: {
  driver: DriverMonitor;
  name: string;
  cell: DriverPanelCell;
  compact?: boolean; // double-decision: drop the extra Let Crew Decide row / clamp copy
  onAccept: (rec: AnalyticsRecommendation) => void;
  onModify: (rec: AnalyticsRecommendation, action: RecAction) => void;
  onIgnore: (rec: AnalyticsRecommendation) => void;
  onLetCrewDecide: (rec: AnalyticsRecommendation) => void;
}) {
  const [modifying, setModifying] = useState(false);
  const rec = cell.state === 'decision' || cell.state === 'active' ? cell.rec : null;

  // Double-decision: one ultra-compact block per driver (name + rec on a single
  // line, then Accept / Ignore) so both fit the fixed panel with no scroll.
  if (compact && cell.state === 'decision' && !modifying) {
    return (
      <div className={`rounded-md border p-1 ${CELL_BORDER.decision}`}>
        <div className="flex items-baseline gap-1.5">
          {driver.position != null && (
            <span className="shrink-0 text-[10px] font-bold text-slate-400">P{driver.position}</span>
          )}
          <span className="shrink-0 text-[11px] font-bold text-slate-100">{name}</span>
          <span className="min-w-0 flex-1 truncate text-[10px] text-slate-300">
            — {cell.rec.recommendedAction}
            {cell.rec.suggestedDuration ? ` ${cell.rec.suggestedDuration}` : ''}
          </span>
          <span className={`shrink-0 text-[9px] font-bold ${PRIORITY_TEXT[cell.rec.priority]}`}>
            {cell.rec.confidence}%
          </span>
        </div>
        <div className="mt-0.5 grid grid-cols-2 gap-1">
          <button
            onClick={() => onAccept(cell.rec)}
            className="rounded bg-emerald-600 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-500"
          >
            Accept
          </button>
          <button
            onClick={() => onIgnore(cell.rec)}
            className="rounded bg-slate-800 py-0.5 text-[10px] font-bold text-slate-400 hover:bg-slate-700"
          >
            Ignore
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-md border p-1 ${CELL_BORDER[cell.state]}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-baseline gap-1.5">
          {driver.position != null && (
            <span className="text-[10px] font-bold text-slate-400">P{driver.position}</span>
          )}
          <span className="truncate text-[11px] font-bold text-slate-100">{name}</span>
        </span>
        <span className="flex items-center gap-1.5">
          {rec && (
            <span className={`text-[9px] font-bold ${PRIORITY_TEXT[rec.priority]}`}>{rec.confidence}%</span>
          )}
          <CellBadge state={cell.state} />
        </span>
      </div>

      {cell.state === 'decision' && (
        <div className="mt-0.5">
          {/* Dense one-line summary: recommendation + impact, clamped to a single
              line in every state so the fixed-height panel never overflows. */}
          <p className="text-[10px] font-medium text-slate-100 line-clamp-1">
            ▸ {cell.rec.recommendedAction}
            {cell.rec.suggestedDuration ? ` (${cell.rec.suggestedDuration})` : ''}
            <span className="text-slate-400"> — {cell.rec.expectedImpact}</span>
          </p>

          {!modifying ? (
            // Single-decision: all four controls on one compact row.
            <div className="mt-1 grid grid-cols-4 gap-1">
                <button
                  onClick={() => onAccept(cell.rec)}
                  className="rounded bg-emerald-600 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-500"
                >
                  Accept
                </button>
                <button
                  onClick={() => setModifying(true)}
                  className="rounded bg-slate-700 py-0.5 text-[10px] font-bold text-slate-100 hover:bg-slate-600"
                >
                  Modify
                </button>
                <button
                  onClick={() => onLetCrewDecide(cell.rec)}
                  className="rounded border border-slate-700 py-0.5 text-[10px] font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Crew
                </button>
                <button
                  onClick={() => onIgnore(cell.rec)}
                  className="rounded bg-slate-800 py-0.5 text-[10px] font-bold text-slate-400 hover:bg-slate-700"
                >
                  Ignore
                </button>
            </div>
          ) : (
            <div className="mt-1 space-y-0.5">
              {[cell.rec.action, ...cell.rec.alternatives].map((a) => (
                <button
                  key={a.type}
                  onClick={() => {
                    onModify(cell.rec, a);
                    setModifying(false);
                  }}
                  className="w-full truncate rounded bg-slate-800 px-2 py-0.5 text-left text-[10px] font-semibold text-slate-200 hover:bg-slate-700"
                >
                  {a.label}
                </button>
              ))}
              <button
                onClick={() => setModifying(false)}
                className="w-full rounded py-0.5 text-[9px] text-slate-500 hover:text-slate-300"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {cell.state === 'active' && (
        <div className="mt-0.5">
          <p className="truncate text-[10px] font-medium text-slate-100">
            {cell.rec.appliedAction?.label ?? cell.rec.action.label}
            {cell.remaining != null && (
              <span className="text-emerald-300">
                {' '}
                — {cell.remaining} lap{cell.remaining === 1 ? '' : 's'} left
              </span>
            )}
            {cell.total != null && <span className="text-slate-500"> · {cell.total}L total</span>}
          </p>
          <p className="truncate text-[9px] text-slate-500">
            {cell.reviewLap != null && <>Review Lap {cell.reviewLap} · </>}
            Watching: {driver.focusLabel.toLowerCase()}
          </p>
        </div>
      )}

      {cell.state === 'recent' && (
        <div className="mt-0.5">
          <p className="truncate text-[10px] text-slate-300">
            Lap {cell.recent.lap} — {kindLabel(cell.recent.kind)} ignored · cooldown{' '}
            {cell.recent.cooldownLapsRemaining}L
          </p>
          <MonitorFootline driver={driver} />
        </div>
      )}

      {cell.state === 'monitoring' && (
        <div className="mt-0.5">
          <p className="text-[10px] text-slate-300">No decision pending · plan on target</p>
          <MonitorFootline driver={driver} />
        </div>
      )}
    </div>
  );
}

// The shared compact "Focus · Next" line used by the monitoring/recent cells.
function MonitorFootline({ driver }: { driver: DriverMonitor }) {
  return (
    <p className="text-[9px] text-slate-500">
      <span className="text-slate-400">Focus:</span> {driver.focusLabel}
      <span className="mx-1 text-slate-600">·</span>
      <span className="text-slate-400">Next:</span> {driver.triggerShort}
    </p>
  );
}
