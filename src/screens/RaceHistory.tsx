import { useMemo, useState } from 'react';
import { useGame } from '../game/GameContext';
import { driverById, teamById } from '../game/careerState';
import { formatLapTime } from '../sim/lapArchiveEngine';
import { Panel } from '../components/Panel';
import { RaceResultTable } from '../components/RaceResultTable';
import type { RaceResult } from '../types/gameTypes';

export function RaceHistory() {
  const { state } = useGame();
  const archive = useMemo(
    () => [...(state?.raceArchive ?? [])].sort((a, b) => b.round - a.round || b.season - a.season),
    [state?.raceArchive],
  );
  const [selectedId, setSelectedId] = useState<string | null>(archive[0]?.raceId ?? null);

  if (!state) return null;

  const nameOf = (id: string) => driverById(state, id)?.name ?? id;
  const teamNameOf = (id: string) => teamById(state, id)?.name ?? id;
  const colorOf = (id: string) => teamById(state, id)?.color;

  if (archive.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-neutral-100">Race History</h1>
        <Panel>
          <p className="text-sm text-neutral-400">No races completed yet. Run a race weekend to build the archive.</p>
        </Panel>
      </div>
    );
  }

  const selected = archive.find((e) => e.raceId === selectedId) ?? archive[0];
  const results = state.completedRaceResults[selected.raceId] ?? [];
  const qualifying = state.qualifyingResults[selected.raceId] ?? [];
  const events = state.raceEvents[selected.raceId] ?? [];
  const strategyEvents = events.filter((e) => /(pit|box|stop|tyre|tire|compound|stint|strategy|safety car|rain|weather)/i.test(e.text));
  const fastest = selected.fastestLap;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-100">Race History</h1>
        <p className="text-sm text-neutral-400">Past results, lap-time archive and key moments.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <Panel title="Races">
          <div className="max-h-[70vh] space-y-1 overflow-y-auto">
            {archive.map((e) => (
              <button
                key={e.raceId}
                onClick={() => setSelectedId(e.raceId)}
                className={`w-full rounded px-2 py-1.5 text-left text-sm ${
                  e.raceId === selected.raceId
                    ? 'bg-amber-500/20 text-amber-200'
                    : 'text-neutral-300 hover:bg-neutral-800/60'
                }`}
              >
                <span className="text-neutral-500">{e.season} · R{e.round}</span>
                <div className="font-medium">{e.gpName}</div>
              </button>
            ))}
          </div>
        </Panel>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi label="Winner" value={selected.winnerDriverId ? nameOf(selected.winnerDriverId) : '—'} />
            <Kpi label="Pole" value={selected.poleDriverId ? nameOf(selected.poleDriverId) : '—'} />
            <Kpi
              label="Fastest Lap"
              value={fastest ? `${nameOf(fastest.driverId)} · ${formatLapTime(fastest.timeSec)}` : '—'}
            />
          </div>

          <Panel title={`${selected.gpName} — ${selected.trackName}`}>
            <RaceResultTable
              results={results}
              nameOf={nameOf}
              teamNameOf={teamNameOf}
              colorOf={colorOf}
              highlightTeamId={state.selectedTeamId}
            />
          </Panel>

          <div className="grid gap-4 xl:grid-cols-3">
            <Panel title="Qualifying">
              {qualifying.length === 0 ? (
                <p className="text-sm text-neutral-500">No qualifying archive for this race.</p>
              ) : (
                <div className="max-h-[360px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-800 text-left text-xs uppercase tracking-wide text-neutral-500">
                        <th className="pb-2 font-medium">Pos</th>
                        <th className="pb-2 font-medium">Driver</th>
                        <th className="pb-2 font-medium">Plan</th>
                        <th className="pb-2 text-right font-medium">Gap</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...qualifying].sort((a, b) => a.position - b.position).map((q) => (
                        <tr key={q.driverId} className="border-b border-neutral-900/70">
                          <td className="py-1.5 tabular-nums text-neutral-500">P{q.position}</td>
                          <td className="py-1.5 text-neutral-200">
                            {nameOf(q.driverId)}
                            {q.dnq && <span className="ml-1 text-[10px] font-semibold text-red-400">DNQ</span>}
                          </td>
                          <td className="py-1.5 text-xs text-neutral-400">{q.segment ?? q.runPlan}</td>
                          <td className="py-1.5 text-right tabular-nums text-neutral-500">{q.gapText || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel title="Race Detail">
              {results.length === 0 ? (
                <p className="text-sm text-neutral-500">No classification archive for this race.</p>
              ) : (
                <div className="max-h-[360px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-800 text-left text-xs uppercase tracking-wide text-neutral-500">
                        <th className="pb-2 font-medium">Driver</th>
                        <th className="pb-2 font-medium">Grid</th>
                        <th className="pb-2 font-medium">Finish</th>
                        <th className="pb-2 text-right font-medium">Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...results].sort((a, b) => (a.position ?? 99) - (b.position ?? 99)).map((r) => (
                        <tr key={r.driverId} className="border-b border-neutral-900/70 align-top">
                          <td className="py-1.5">
                            <div className="text-neutral-200">{nameOf(r.driverId)}</div>
                            <div className="text-[10px] text-neutral-500">{teamNameOf(r.teamId)}</div>
                            {r.incidents.length > 0 && (
                              <div className="mt-0.5 text-[10px] text-orange-300">{r.incidents.join(', ')}</div>
                            )}
                          </td>
                          <td className="py-1.5 tabular-nums text-neutral-500">P{r.gridPosition}</td>
                          <td className={`py-1.5 tabular-nums ${r.status === 'Finished' ? 'text-neutral-300' : 'text-red-400'}`}>
                            {r.status === 'Finished' && r.position ? `P${r.position}` : r.status}
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-amber-300">{raceRating(r, results.length)}/10</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel title="Lap-Time Archive">
              <div className="overflow-hidden rounded-lg border border-neutral-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-neutral-900/40 text-left text-xs uppercase tracking-wide text-neutral-500">
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Driver</th>
                      <th className="px-3 py-2 font-medium">Best Lap</th>
                      <th className="px-2 py-2 text-right font-medium">Gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.laps.map((l, i) => {
                      const gap = l.bestLapSec - selected.laps[0].bestLapSec;
                      const isPlayer = driverById(state, l.driverId)?.teamId === state.selectedTeamId;
                      return (
                        <tr
                          key={l.driverId}
                          className={`border-t border-neutral-800/60 ${isPlayer ? 'bg-amber-500/10' : ''}`}
                        >
                          <td className="px-3 py-1.5 tabular-nums text-neutral-500">{i + 1}</td>
                          <td className="px-3 py-1.5">{l.driverName}</td>
                          <td className="px-3 py-1.5 tabular-nums text-neutral-200">{formatLapTime(l.bestLapSec)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-neutral-500">
                            {i === 0 ? '—' : `+${gap.toFixed(3)}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Pit, Tyre & Strategy Notes">
              {strategyEvents.length === 0 ? (
                <p className="text-sm text-neutral-500">No pit, tyre or strategy events were recorded for this race.</p>
              ) : (
                <ul className="max-h-[360px] space-y-1 overflow-y-auto text-sm">
                  {strategyEvents.map((e, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="w-12 shrink-0 tabular-nums text-neutral-500">L{e.lap}</span>
                      <span className="text-neutral-300">{e.text}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[11px] text-neutral-600">
                Detailed stint tables are shown when the race engine records them; older archives use event notes.
              </p>
            </Panel>

            <Panel title="Key Moments">
              {events.length === 0 ? (
                <p className="text-sm text-neutral-500">No notable incidents recorded.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {events.map((e, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="w-12 shrink-0 tabular-nums text-neutral-500">L{e.lap}</span>
                      <span className="text-neutral-300">{e.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-lg font-bold text-neutral-100">{value}</div>
    </div>
  );
}

function raceRating(result: RaceResult, fieldSize: number): string {
  if (typeof result.rating === 'number') return result.rating.toFixed(1);
  if (result.status === 'DNF' || result.status === 'DSQ') return '4.0';
  const finish = result.position ?? fieldSize;
  const movement = result.gridPosition - finish;
  const base = 6.4 + movement * 0.18 + (fieldSize - finish) * 0.08;
  return Math.max(1, Math.min(10, base)).toFixed(1);
}
