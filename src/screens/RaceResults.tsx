import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { getTrackById } from '../data';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { RaceResultTable } from '../components/RaceResultTable';
import { NewsFeed } from '../components/NewsFeed';
import { StandingsTable } from '../components/StandingsTable';

export function RaceResults() {
  const { raceId } = useParams();
  const { state } = useGame();
  const navigate = useNavigate();
  if (!state || !raceId) return null;

  const race = state.calendar.find((r) => r.id === raceId);
  const results = state.completedRaceResults[raceId];
  const events = state.raceEvents[raceId] ?? [];
  const track = race ? getTrackById(race.trackId) : undefined;
  if (!race || !results) return null;

  const driverName = (id: string) => state.drivers.find((d) => d.id === id)?.name ?? id;
  const teamName = (id: string) => state.teams.find((t) => t.id === id)?.name ?? id;
  const teamColor = (id: string) => state.teams.find((t) => t.id === id)?.color;
  const teamOfDriver = (id: string) => teamName(state.drivers.find((d) => d.id === id)?.teamId ?? '');
  const playerDriverIds = state.drivers.filter((d) => d.teamId === state.selectedTeamId).map((d) => d.id);

  const trackImpact = track
    ? `${race.trackName} rewarded ${topDemand(track)}. ${track.setupProfile.strategyNotes}`
    : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">{race.gpName} — Result</h1>
          <p className="text-sm text-neutral-400">{race.trackName} · Round {race.round}</p>
        </div>
        {state.seasonComplete ? (
          <Button variant="primary" onClick={() => navigate('/season-review')}>Season Review →</Button>
        ) : (
          <Button variant="primary" onClick={() => navigate('/hq')}>Back to HQ →</Button>
        )}
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
              <p className="text-sm text-neutral-300">{trackImpact}</p>
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
        </div>

        <div className="space-y-6">
          <Panel title="Headlines">
            <NewsFeed items={state.news.filter((n) => n.round === race.round)} />
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

function topDemand(track: ReturnType<typeof getTrackById>): string {
  if (!track) return 'a balanced approach';
  const demands: [string, number][] = [
    ['engine power', track.setupProfile.powerDemand],
    ['aero efficiency', track.setupProfile.aeroDemand],
    ['mechanical grip', track.setupProfile.mechanicalDemand],
  ];
  demands.sort((a, b) => b[1] - a[1]);
  return `${demands[0][0]} and ${demands[1][0]}`;
}
