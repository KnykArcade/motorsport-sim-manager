// Center race event log — a fixed-height panel that scrolls internally so it
// never resizes the dashboard. Newest events are at the bottom; the view
// auto-scrolls to the latest event unless the player has scrolled up, in which
// case a "Jump to Latest" button appears. Full history is in the modal.

import { useLayoutEffect, useRef, useState } from 'react';
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

export function EventLogPanel({
  events,
  onOpenFull,
  className,
}: {
  events: RaceEvent[];
  onOpenFull: () => void;
  className?: string;
}) {
  const [filter, setFilter] = useState<Filter>('All');
  const scrollRef = useRef<HTMLUListElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  // Chronological (oldest first, newest last), capped to keep the DOM light.
  const filtered = events.filter((e) => filter === 'All' || bucket(e.text) === filter).slice(-80);

  // Auto-scroll to the newest event while the player is following the feed.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && atBottom) el.scrollTop = el.scrollHeight;
  }, [filtered.length, filter, atBottom]);

  const selectFilter = (f: Filter) => {
    setFilter(f);
    setAtBottom(true); // snap to newest when changing filters
  };

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAtBottom(distanceFromBottom < 24);
  };

  const jumpToLatest = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setAtBottom(true);
  };

  return (
    <DashPanel
      title="Race Event Log"
      className={className}
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
            onClick={() => selectFilter(f)}
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
              filter === f ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:bg-slate-800'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="relative min-h-0 flex-1">
        <ul ref={scrollRef} onScroll={onScroll} className="h-full space-y-1 overflow-y-auto px-2 py-1.5">
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
        {!atBottom && (
          <button
            onClick={jumpToLatest}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-1 text-[10px] font-bold text-neutral-950 shadow-lg hover:bg-amber-400"
          >
            ↓ Jump to Latest
          </button>
        )}
      </div>
    </DashPanel>
  );
}
