// Modal/drawer content that keeps the dashboard compact: the full event log,
// detailed pit strategy, and team orders live here rather than taking permanent
// vertical space on the main screen.

import type { ReactNode } from 'react';
import type { LiveCarState } from '../../types/liveTypes';
import type { RaceEvent } from '../../types/simTypes';
import type { TeamOrder } from '../../types/relationshipTypes';
import { TEAM_ORDER_SPECS } from '../../sim/relationshipEngine';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-[#111725]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-700 px-4 py-2.5">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">{title}</h3>
          <button onClick={onClose} className="rounded px-2 py-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100">
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

export function FullEventLogModal({ events, onClose }: { events: RaceEvent[]; onClose: () => void }) {
  return (
    <Modal title="Full Event Log" onClose={onClose}>
      {events.length === 0 ? (
        <p className="text-sm text-slate-500">No events yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {[...events].reverse().map((e, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span className="w-10 shrink-0 font-semibold text-slate-500">L{e.lap}</span>
              <span className="text-slate-300">{e.text}</span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

export function StrategyModal({
  playerCars,
  currentLap,
  finished,
  nameOf,
  onPit,
  onClose,
}: {
  playerCars: LiveCarState[];
  currentLap: number;
  finished: boolean;
  nameOf: (id: string) => string;
  onPit: (driverId: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal title="Pit Strategy" onClose={onClose}>
      <div className="space-y-3">
        {playerCars.map((c) => {
          const w = c.pit.window;
          const stopsLeft = c.pit.plannedStops - c.pit.stopsMade;
          const open = !!w && currentLap >= w.open && currentLap <= w.close;
          const canPit = c.running && !c.pit.inPitThisLap && !finished;
          let status: string;
          if (!c.running) status = 'Out of the race';
          else if (c.pit.pitRequested) status = 'Box, box! Pitting this lap';
          else if (!w || stopsLeft <= 0) status = 'No more stops planned';
          else if (currentLap < w.open) status = `Window opens L${w.open} (in ${w.open - currentLap})`;
          else if (open) status = `WINDOW OPEN — box now (ideal L${w.ideal}, through L${w.close})`;
          else status = 'Window closed — stop overdue';
          return (
            <div key={c.driverId} className="rounded-lg border border-slate-700 bg-slate-800/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-100">{nameOf(c.driverId)}</span>
                <span className="text-xs text-slate-400">
                  Stops {c.pit.stopsMade}/{c.pit.plannedStops} · {c.tire.compound} · wear {Math.round(c.tire.wear)}%
                </span>
              </div>
              <p className={`mt-1 text-xs font-medium ${open ? 'text-emerald-300' : 'text-slate-300'}`}>{status}</p>
              <button
                onClick={() => onPit(c.driverId)}
                disabled={!canPit}
                className={`mt-2 w-full rounded py-1.5 text-sm font-bold ${
                  canPit ? (c.pit.pitRequested ? 'bg-amber-600 text-white hover:bg-amber-500' : 'bg-sky-600 text-white hover:bg-sky-500') : 'bg-slate-800 text-slate-600'
                }`}
              >
                {c.pit.pitRequested ? 'Cancel Pit Request' : 'Pit Now'}
              </button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

export function TeamOrdersModal({
  playerCars,
  focusDriverId,
  nameOf,
  onOrder,
  onClose,
}: {
  playerCars: LiveCarState[];
  focusDriverId?: string;
  nameOf: (id: string) => string;
  onOrder: (order: TeamOrder, favoredDriverId?: string) => void;
  onClose: () => void;
}) {
  const running = playerCars.filter((c) => c.running);
  const twoCars = running.length >= 2;
  const favoredOptions = focusDriverId ? running.filter((c) => c.driverId === focusDriverId) : running;
  const title = focusDriverId ? `Team Orders — ${nameOf(focusDriverId)}` : 'Team Orders';
  return (
    <Modal title={title} onClose={onClose}>
      <p className="mb-3 text-xs text-slate-400">
        Call the pit wall. Orders take effect on track immediately and shape morale, loyalty and the teammate
        relationship after the race.
      </p>
      <div className="space-y-2.5">
        {TEAM_ORDER_SPECS.map((spec) => {
          const needsTwo =
            spec.order === 'SwapPositions' || spec.order === 'HoldPosition' || spec.order === 'LetThemRace';
          const disabled = needsTwo && !twoCars;
          return (
            <div key={spec.order} className="rounded-lg border border-slate-700 bg-slate-800/30 p-2.5">
              <span className="text-sm font-semibold text-slate-100">{spec.label}</span>
              <p className="mt-0.5 text-[11px] text-slate-500">{spec.description}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {spec.needsFavored ? (
                  favoredOptions.map((c) => (
                    <button
                      key={c.driverId}
                      onClick={() => onOrder(spec.order, c.driverId)}
                      disabled={disabled}
                      className="rounded bg-slate-700 px-3 py-1 text-xs font-semibold text-slate-100 hover:bg-slate-600 disabled:opacity-40"
                    >
                      {nameOf(c.driverId)}
                    </button>
                  ))
                ) : (
                  <button
                    onClick={() => onOrder(spec.order)}
                    disabled={disabled}
                    className="rounded bg-slate-700 px-3 py-1 text-xs font-semibold text-slate-100 hover:bg-slate-600 disabled:opacity-40"
                  >
                    Issue
                  </button>
                )}
              </div>
              {disabled && <p className="mt-1 text-[10px] text-slate-600">Needs both cars running.</p>}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

