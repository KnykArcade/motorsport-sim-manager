// Center race event log — recent events only, with category filters and a
// "View Full Log" button that opens the full log in a modal.

import { useState } from 'react';
import type { RaceEvent } from '../../types/simTypes';
import { DashPanel } from './dashboardUi';

type Filter = 'All' | 'Incidents' | 'Strategy' | 'Status';
const FILTERS: Filter[] = ['All', 'Incidents', 'Strategy', 'Status'];

// Classify an event line into a filter bucket from keywords.
function bucket(text: string): Exclude<Filter, 'All'> {
  const t = text.toLowerCase();
  if (/(retir|crash|contact|accident|puncture|damage|spin|collision|incident|off|failure|dnf)/.test(t))
    return 'Incidents';
  if (/(pit|box|tyre|tire|strateg|recommendation|mode|stop|undercut|order|swap|protect|conservativ|attack|push|defend)/.test(t))
    return 'Strategy';
  return 'Status';
}

export function EventLogPanel({ events, onOpenFull }: { events: RaceEvent[]; onOpenFull: () => void }) {
  const [filter, setFilter] = useState<Filter>('All');
  const filtered = [...events]
    .reverse()
    .filter((e) => filter === 'All' || bucket(e.text) === filter)
    .slice(0, 40);

  return (
    <DashPanel
      title="Race Event Log"
      right={
        <button
          onClick={onOpenFull}
          className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300 hover:bg-slate-700"
        >
          View Full Log
        </button>
      }
      bodyClass="flex flex-col"
    >
      <div className="flex shrink-0 gap-1 border-b border-slate-700/40 px-2 py-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
              filter === f ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:bg-slate-800'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-1.5">
        {filtered.length === 0 ? (
          <li className="text-[11px] text-slate-500">No events yet.</li>
        ) : (
          filtered.map((e, i) => (
            <li key={i} className="flex gap-2 text-[11px] leading-snug">
              <span className="w-8 shrink-0 font-semibold text-slate-500">L{e.lap}</span>
              <span className="text-slate-300">{e.text}</span>
            </li>
          ))
        )}
      </ul>
    </DashPanel>
  );
}
