import { useGame } from '../game/GameContext';
import { Panel } from '../components/Panel';
import { StatBar } from '../components/StatBar';
import { Button } from '../components/Button';
import { DriverDossierButton } from '../components/driverCards/DriverDossier';
import { ScoutingWidget } from '../components/scouting/ScoutingWidget';
import { readoutForDriverRating } from '../components/scouting/ratingDisplay';
import { driverScoutTarget } from '../sim/scoutingEngine';
import {
  activeDriversForTeam,
  reserveDriversForTeam,
  teamById,
} from '../game/careerState';

export function Drivers() {
  const { state, dispatch } = useGame();
  if (!state) return null;

  const teamName = (id: string) => state.teams.find((t) => t.id === id)?.name ?? id;
  const teamColor = (id: string) => state.teams.find((t) => t.id === id)?.color ?? '#666';

  const ordered = [...state.drivers].sort(
    (a, b) => (readoutForDriverRating(state, b, 'overall').value ?? 0) - (readoutForDriverRating(state, a, 'overall').value ?? 0),
  );

  const playerTeam = teamById(state, state.selectedTeamId);
  const raceSeats = activeDriversForTeam(state, state.selectedTeamId);
  const reserves = reserveDriversForTeam(state, state.selectedTeamId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-neutral-100">Drivers</h1>

      {playerTeam && (
        <Panel className="ring-1 ring-amber-500/60">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-100">
              Your Race Lineup — {playerTeam.name}
            </h2>
            <span className="text-xs text-neutral-500">Only two cars per team race</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {[0, 1].map((seat) => {
              const driver = raceSeats[seat];
              return (
                <div key={seat} className="rounded border border-neutral-700 bg-neutral-900/60 p-3">
                  <div className="text-xs uppercase tracking-wide text-neutral-500">
                    Car {seat + 1}
                  </div>
                  {driver ? (
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-neutral-100">
                          #{driver.number} {driver.name}
                        </span>
                        <span className="ml-2 rounded bg-neutral-800 px-2 py-0.5 text-xs font-semibold text-amber-300">
                          {driver.ratings.overall.toFixed(1)}
                        </span>
                      </div>
                      <DriverDossierButton
                        state={state}
                        subject={{ type: 'driver', driver }}
                        context={`Car ${seat + 1} - ${playerTeam.name}`}
                        focus="relationship"
                      />
                    </div>
                  ) : (
                    <div className="mt-1 text-sm text-neutral-500">Empty seat</div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4">
            <div className="mb-2 text-sm font-semibold text-neutral-300">
              Reserve Drivers {reserves.length === 0 && <span className="font-normal text-neutral-500">— none</span>}
            </div>
            {reserves.length > 0 && (
              <div className="space-y-2">
                {reserves.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-900/40 px-3 py-2"
                  >
                    <span className="text-sm text-neutral-200">
                      #{r.number} {r.name}{' '}
                      <span className="text-xs text-amber-300/80">
                        {r.ratings.overall.toFixed(1)}
                      </span>
                      {r.contractType === 'third' && (
                        <span className="ml-2 rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] text-sky-300">
                          3rd driver
                        </span>
                      )}
                    </span>
                    <div className="flex gap-2">
                      <DriverDossierButton
                        state={state}
                        subject={{ type: 'driver', driver: r }}
                        context={`Reserve - ${playerTeam.name}`}
                        focus="development"
                      />
                      {[0, 1].map((seat) => (
                        <Button
                          key={seat}
                          variant="ghost"
                          onClick={() =>
                            dispatch({
                              type: 'SWAP_RACE_DRIVER',
                              seatIndex: seat,
                              reserveDriverId: r.id,
                            })
                          }
                        >
                          → Car {seat + 1}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {ordered.map((d) => {
          const isPlayer = d.teamId === state.selectedTeamId;
          const overall = readoutForDriverRating(state, d, 'overall');
          const stat = (key: keyof typeof d.ratings) => readoutForDriverRating(state, d, key);
          return (
            <Panel key={d.id} className={isPlayer ? 'ring-1 ring-amber-500/60' : ''}>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-1.5 rounded-sm" style={{ backgroundColor: teamColor(d.teamId) }} />
                  <span className="font-bold text-neutral-100">#{d.number} {d.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs font-semibold text-amber-300">
                    {overall.label}
                  </span>
                  <DriverDossierButton
                    state={state}
                    subject={{ type: 'driver', driver: d }}
                    context={teamName(d.teamId)}
                    focus={isPlayer ? 'relationship' : 'identity'}
                  />
                </div>
              </div>
              <div className="mb-2 text-xs text-neutral-500">{teamName(d.teamId)}</div>
              {!isPlayer && (
                <div className="mb-2">
                  <ScoutingWidget target={driverScoutTarget(d)} entityType="Driver" compact />
                </div>
              )}
              <div className="grid grid-cols-1 gap-1">
                <StatBar label="Qualifying" value={stat('qualifying').value ?? 0} valueLabel={stat('qualifying').label} />
                <StatBar label="Race Pace" value={stat('racePace').value ?? 0} valueLabel={stat('racePace').label} />
                <StatBar label="Cornering" value={stat('cornering').value ?? 0} valueLabel={stat('cornering').label} />
                <StatBar label="Overtaking" value={stat('overtakingRacecraft').value ?? 0} valueLabel={stat('overtakingRacecraft').label} />
                <StatBar label="Composure" value={stat('composure').value ?? 0} valueLabel={stat('composure').label} />
                <StatBar label="Aggression" value={stat('aggression').value ?? 0} valueLabel={stat('aggression').label} />
                <StatBar label="Morale" value={d.morale / 10} />
                <StatBar label="Confidence" value={d.confidence / 10} />
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
