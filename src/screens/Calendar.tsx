import { useGame } from '../game/GameContext';
import { getTrackById, getRegulationSet } from '../data';
import { Panel } from '../components/Panel';
import { RatingBadge } from '../components/RatingBadge';

export function Calendar() {
  const { state } = useGame();
  if (!state) return null;

  const driverName = (id: string) => state.drivers.find((d) => d.id === id)?.name ?? id;

  const regSet = getRegulationSet(state.regulationSetId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-100">{state.seasonYear} Calendar</h1>
        {regSet && (
          <span className="rounded-md bg-neutral-800 px-3 py-1 text-xs font-medium text-neutral-300">
            {regSet.eraLabel}
          </span>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {state.calendar.map((race, idx) => {
          const track = getTrackById(race.trackId);
          const isCurrent = idx === state.currentRaceIndex && !state.seasonComplete;
          const results = state.completedRaceResults[race.id];
          const winner = results?.find((r) => r.position === 1);
          return (
            <Panel
              key={race.id}
              className={isCurrent ? 'ring-1 ring-amber-500' : ''}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-neutral-500">R{race.round}</span>
                    {isCurrent && (
                      <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                        NEXT
                      </span>
                    )}
                    {race.completed && (
                      <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-green-300">
                        DONE
                      </span>
                    )}
                  </div>
                  <div className="mt-1 font-bold text-neutral-100">{race.gpName}</div>
                  <div className="text-xs text-neutral-400">{race.trackName}</div>
                </div>
                {track && (
                  <span className="rounded bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-300">
                    {track.archetype}
                  </span>
                )}
              </div>

              <div className="mt-3 text-xs text-neutral-500">
                {race.laps} laps · {race.distanceKm ?? '—'} km
              </div>

              {track && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <RatingBadge label="Aero" value={track.setupProfile.aeroDemand} />
                  <RatingBadge label="Pwr" value={track.setupProfile.powerDemand} />
                  <RatingBadge label="Mech" value={track.setupProfile.mechanicalDemand} />
                  <RatingBadge label="Risk" value={track.setupProfile.riskDemand} />
                </div>
              )}

              {track && (
                <div className="mt-3 text-xs text-neutral-500">
                  <span className="text-neutral-400">Setup:</span> {track.setupProfile.primarySetupProfile}
                </div>
              )}

              {winner && (
                <div className="mt-2 text-xs text-amber-300">🏆 {driverName(winner.driverId)}</div>
              )}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
