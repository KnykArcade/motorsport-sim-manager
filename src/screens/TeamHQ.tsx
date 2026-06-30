import { useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import {
  carForTeam,
  currentRace,
  driversForTeam,
  teamById,
} from '../game/careerState';
import { effectiveCarRatings } from '../sim/trackFitEngine';
import { getTrackById } from '../data';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { StatBar } from '../components/StatBar';
import { StandingsTable } from '../components/StandingsTable';
import { NewsFeed } from '../components/NewsFeed';
import { TrackDemandBars } from '../components/TrackDemandBars';
import { formatMoney } from '../components/ui';

export function TeamHQ() {
  const { state } = useGame();
  const navigate = useNavigate();
  if (!state) return null;

  const team = teamById(state, state.selectedTeamId);
  const car = carForTeam(state, state.selectedTeamId);
  const drivers = driversForTeam(state, state.selectedTeamId);
  const race = currentRace(state);
  const track = race ? getTrackById(race.trackId) : undefined;
  const ratings = car ? effectiveCarRatings(car) : null;

  const driverName = (id: string) => state.drivers.find((d) => d.id === id)?.name ?? id;
  const teamName = (id: string) => state.teams.find((t) => t.id === id)?.name ?? id;
  const teamColor = (id: string) => state.teams.find((t) => t.id === id)?.color;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">{team?.name} — Team HQ</h1>
          <p className="text-sm text-neutral-400">{state.seasonYear} {state.series} · {state.gameMode === 'Career' ? 'Career Mode' : 'Single Season'}</p>
        </div>
        {state.seasonComplete ? (
          <Button variant="primary" onClick={() => navigate('/season-review')}>
            Season Review →
          </Button>
        ) : (
          <Button variant="primary" onClick={() => navigate('/weekend')}>
            Go to Next Race: {race?.gpName} →
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Budget" value={team ? formatMoney(team.budget) : '—'} />
        <KpiCard label="Team Morale" value={`${Math.round(team?.morale ?? 0)}%`} />
        <KpiCard label="Reputation" value={`${Math.round(team?.reputation ?? 0)}`} />
        <KpiCard label="Active Projects" value={String(state.activeDevelopmentProjects.length)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Next race briefing */}
          {race && track && !state.seasonComplete && (
            <Panel
              title={`Next Race · Round ${race.round}`}
              actions={<Button onClick={() => navigate('/weekend')}>Enter Weekend →</Button>}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-lg font-bold text-neutral-100">{race.gpName}</div>
                  <div className="text-sm text-neutral-400">{race.trackName}</div>
                  <div className="mt-2 inline-block rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
                    {track.archetype}
                  </div>
                  <div className="mt-3 text-xs text-neutral-500">
                    {race.laps} laps · {race.distanceKm ?? '—'} km
                  </div>
                </div>
                <TrackDemandBars track={track} />
              </div>
            </Panel>
          )}

          {/* Car performance */}
          {ratings && (
            <Panel title="Car Performance">
              <div className="grid gap-2 md:grid-cols-2">
                <StatBar label="Engine Power" value={ratings.enginePower} />
                <StatBar label="Aero Efficiency" value={ratings.aeroEfficiency} />
                <StatBar label="Mechanical Grip" value={ratings.mechanicalGrip} />
                <StatBar label="Reliability" value={ratings.reliability} />
                <StatBar label="Pit Crew Ops" value={ratings.pitCrewOperations} />
                <StatBar label="Condition" value={(car?.condition ?? 0) / 10} />
              </div>
            </Panel>
          )}

          {/* Drivers */}
          <Panel title="Drivers">
            <div className="grid gap-3 sm:grid-cols-2">
              {drivers.map((d) => (
                <div key={d.id} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-100">#{d.number} {d.name}</span>
                    <span className="text-xs text-neutral-500">OVR {d.ratings.overall.toFixed(1)}</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    <StatBar label="Morale" value={d.morale / 10} />
                    <StatBar label="Confidence" value={d.confidence / 10} />
                    <StatBar label="Qualifying" value={d.ratings.qualifying} />
                    <StatBar label="Race Pace" value={d.ratings.racePace} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Quick Actions">
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => navigate('/calendar')}>Calendar</Button>
              <Button onClick={() => navigate('/standings')}>Standings</Button>
              <Button onClick={() => navigate('/history')}>Race History</Button>
              <Button onClick={() => navigate('/drivers')}>Drivers</Button>
              <Button onClick={() => navigate('/development')}>Development</Button>
              <Button onClick={() => navigate('/finance')}>Finance</Button>
              <Button onClick={() => navigate('/staff')}>Staff</Button>
              <Button onClick={() => navigate('/facilities')}>Facilities</Button>
              <Button onClick={() => navigate('/engine')}>Engine</Button>
              <Button onClick={() => navigate('/principal')}>Principal</Button>
              <Button onClick={() => navigate('/relationships')}>Relationships</Button>
              <Button onClick={() => navigate('/politics')}>Regulations</Button>
              <Button onClick={() => navigate('/scouting')}>Scouting</Button>
              <Button onClick={() => navigate('/curves')}>Dev Curves</Button>
              <Button onClick={() => navigate('/records')}>Universe History</Button>
              <Button onClick={() => navigate('/data')}>Team Data</Button>
              <Button onClick={() => navigate('/settings')}>Settings</Button>
            </div>
          </Panel>

          <Panel title="News Feed">
            <NewsFeed items={state.news} limit={6} />
          </Panel>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <StandingsTable
          title="Drivers' Championship"
          entries={state.driverStandings.slice(0, 8)}
          nameOf={driverName}
          subtitleOf={(id) => teamName(state.drivers.find((d) => d.id === id)?.teamId ?? '')}
          highlightId={drivers[0]?.id}
        />
        <StandingsTable
          title="Constructors' Championship"
          entries={state.constructorStandings.slice(0, 8)}
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
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-neutral-100">{value}</div>
    </div>
  );
}
