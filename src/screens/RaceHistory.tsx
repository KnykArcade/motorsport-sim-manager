import { useMemo, useState } from 'react';
import { useGame } from '../game/GameContext';
import { driverById, teamById } from '../game/careerState';
import { formatLapTime } from '../sim/lapArchiveEngine';
import { Panel } from '../components/Panel';
import { RaceResultTable } from '../components/RaceResultTable';

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
  const events = state.raceEvents[selected.raceId] ?? [];
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

          <div className="grid gap-4 lg:grid-cols-2">
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
