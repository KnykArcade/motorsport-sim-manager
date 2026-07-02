import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { getTrackById } from '../data';
import { buildPostRaceSummary } from '../game/careerPhaseEngine';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { RaceResultTable } from '../components/RaceResultTable';
import { StandingsTable } from '../components/StandingsTable';
import { formatMoney } from '../components/ui';

export function PostRaceReview() {
  const { raceId } = useParams();
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  if (!state || !raceId) return null;

  const race = state.calendar.find((r) => r.id === raceId);
  const results = state.completedRaceResults[raceId];
  const events = state.raceEvents[raceId] ?? [];
  const track = race ? getTrackById(race.trackId) : undefined;
  if (!race || !results) return null;

  const summary = buildPostRaceSummary(state);

  const driverName = (id: string) => state.drivers.find((d) => d.id === id)?.name ?? id;
  const teamName = (id: string) => state.teams.find((t) => t.id === id)?.name ?? id;
  const teamColor = (id: string) => state.teams.find((t) => t.id === id)?.color;
  const teamOfDriver = (id: string) => teamName(state.drivers.find((d) => d.id === id)?.teamId ?? '');
  const playerDriverIds = state.drivers.filter((d) => d.teamId === state.selectedTeamId).map((d) => d.id);

  const continueToPaddock = () => {
    dispatch({ type: 'ADVANCE_TO_PADDOCK_WEEK' });
    navigate('/paddock');
  };

  const playerResults = results.filter((r) => r.teamId === state.selectedTeamId);
  const bestFinish = playerResults.reduce(
    (best, r) => (r.position !== null && (best === null || r.position < best) ? r.position : best),
    null as number | null,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Post-Race Review</h1>
          <p className="text-sm text-neutral-400">{race.gpName} · {race.trackName} · Round {race.round}</p>
        </div>
        {state.seasonComplete ? (
          <Button variant="primary" onClick={() => navigate('/season-review')}>Season Review →</Button>
        ) : (
          <Button variant="primary" onClick={continueToPaddock}>Continue to Paddock Week →</Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Points Scored" value={String(summary?.pointsGained ?? 0)} />
        <KpiCard label="Best Finish" value={bestFinish !== null ? `P${bestFinish}` : '—'} />
        <KpiCard label="Budget Impact" value={formatMoney(summary?.budgetImpact ?? 0)} />
        <KpiCard label="Car Condition" value={`${Math.round(summary?.carCondition ?? 0)}%`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Race Classification">
            <RaceResultTable
              results={results}
              nameOf={driverName}
              teamNameOf={teamName}
              colorOf={teamColor}
              highlightTeamId={state.selectedTeamId}
            />
          </Panel>

          {track && (
            <Panel title="Track Impact">
              <p className="text-sm text-neutral-300">
                {race.trackName} rewarded {topDemand(track)}. {track.setupProfile.strategyNotes}
              </p>
            </Panel>
          )}

          <Panel title="Race Event Log">
            {events.length === 0 ? (
              <p className="text-sm text-neutral-500">Quiet race — no major incidents.</p>
            ) : (
              <ul className="space-y-1.5">
                {events.map((e, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="w-14 shrink-0 text-xs font-semibold text-neutral-500">Lap {e.lap}</span>
                    <span className="text-neutral-300">{e.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {summary && summary.damageNotes.length > 0 && (
            <Panel title="Damage & Repairs">
              <ul className="space-y-1.5">
                {summary.damageNotes.map((note, i) => (
                  <li key={i} className="text-sm text-orange-300">{note}</li>
                ))}
              </ul>
            </Panel>
          )}

          {summary && summary.devMessages.length > 0 && (
            <Panel title="Development Updates">
              <ul className="space-y-1.5">
                {summary.devMessages.map((msg, i) => (
                  <li key={i} className="text-sm text-neutral-300">{msg}</li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          <Panel title="Driver Performance">
            <ul className="space-y-2">
              {playerResults.map((r) => {
                const driver = state.drivers.find((d) => d.id === r.driverId);
                return (
                  <li key={r.driverId} className="flex items-center justify-between text-sm">
                    <span className="text-neutral-200">{driver?.name ?? r.driverId}</span>
                    <span className={r.status === 'DNF' || r.status === 'DSQ' ? 'text-red-400' : 'text-neutral-300'}>
                      {r.status === 'DNF' || r.status === 'DSQ' ? r.status : `P${r.position}`} · {r.points} pts
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title="Championship Impact">
            <p className="text-sm text-neutral-300">
              Constructors' position: <span className="font-semibold text-neutral-100">P{summary?.constructorPosition ?? '—'}</span> ({summary?.constructorPoints ?? 0} pts)
            </p>
          </Panel>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <StandingsTable
          title="Drivers' Championship"
          entries={state.driverStandings.slice(0, 10)}
          nameOf={driverName}
          subtitleOf={teamOfDriver}
          highlightId={playerDriverIds[0]}
        />
        <StandingsTable
          title="Constructors' Championship"
          entries={state.constructorStandings.slice(0, 10)}
          nameOf={teamName}
          colorOf={teamColor}
          highlightId={state.selectedTeamId}
        />
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-lg font-bold text-neutral-100">{value}</div>
    </div>
  );
}

function topDemand(track: NonNullable<ReturnType<typeof getTrackById>>): string {
  const demands: [string, number][] = [
    ['engine power', track.setupProfile.powerDemand],
    ['aero efficiency', track.setupProfile.aeroDemand],
    ['mechanical grip', track.setupProfile.mechanicalDemand],
  ];
  demands.sort((a, b) => b[1] - a[1]);
  return `${demands[0][0]} and ${demands[1][0]}`;
}
