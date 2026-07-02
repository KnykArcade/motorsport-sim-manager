import { useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import {
  activeDriversForTeam,
  carForTeam,
  currentRace,
  teamById,
  driversForTeam,
} from '../game/careerState';
import { getTrackById } from '../data';
import { effectiveCarRatings } from '../sim/trackFitEngine';
import { developmentSlots } from '../sim/facilityEngine';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { TrackDemandBars } from '../components/TrackDemandBars';
import { formatMoney } from '../components/ui';

export function PreSeasonSetup() {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  if (!state) return null;

  const team = teamById(state, state.selectedTeamId);
  const car = carForTeam(state, state.selectedTeamId);
  const drivers = driversForTeam(state, state.selectedTeamId);
  const activeDrivers = activeDriversForTeam(state, state.selectedTeamId);
  const race = currentRace(state);
  const track = race ? getTrackById(race.trackId) : undefined;
  const carRatings = car ? effectiveCarRatings(car) : null;
  const slots = developmentSlots(state.facilities);

  const isCareer = state.gameMode === 'Career';
  const isSingleSeason = state.gameMode === 'SingleSeason';

  const advanceToBriefing = () => {
    dispatch({ type: 'COMPLETE_PRESEASON_SETUP' });
    navigate('/briefing');
  };

  // Engine supplier info.
  const engineDeal = state.engine?.deals?.[state.selectedTeamId] ?? state.engine?.currentDeal;

  // Sponsors.
  const sponsors = state.commercial?.sponsors ?? [];

  // Season objectives (from team expectations).
  const expectation = state.teamExpectations?.[state.selectedTeamId];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Pre-Season Setup</h1>
          <p className="text-sm text-neutral-400">
            {state.seasonYear} {state.series} · {isCareer ? 'Career Mode' : 'Single Season'}
            {isSingleSeason && ' · Historical replay — team setup is locked'}
          </p>
        </div>
        <Button variant="primary" onClick={advanceToBriefing}>
          Advance to Pre-Race Briefing →
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Team Overview */}
          <Panel title="Team Overview">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold uppercase text-neutral-500">Team</div>
                <div className="text-sm text-neutral-200">{team?.name}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-neutral-500">Reputation</div>
                <div className="text-sm text-neutral-200">{Math.round(team?.reputation ?? 0)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-neutral-500">Team Morale</div>
                <div className="text-sm text-neutral-200">{Math.round(team?.morale ?? 0)}%</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-neutral-500">Budget</div>
                <div className="text-sm text-neutral-200">{team ? formatMoney(team.budget) : '—'}</div>
              </div>
            </div>
          </Panel>

          {/* Driver Lineup */}
          <Panel title="Driver Lineup Review">
            <ul className="space-y-2">
              {activeDrivers.map((d) => (
                <li key={d.id} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-200">{d.name} · #{d.number}</span>
                  <span className="text-neutral-400">
                    Overall {d.ratings.overall} · Morale {Math.round(d.morale)}%
                  </span>
                </li>
              ))}
              {drivers.length > activeDrivers.length && (
                <li className="text-xs text-neutral-500">
                  Reserve drivers: {drivers.slice(activeDrivers.length).map((d) => d.name).join(', ')}
                </li>
              )}
              {activeDrivers.length < 2 && (
                <li className="text-sm text-orange-400">
                  Only {activeDrivers.length} active driver(s). Visit the Driver Market to sign a second driver.
                </li>
              )}
            </ul>
          </Panel>

          {/* Car Performance */}
          <Panel title="Car Performance Overview">
            {carRatings && (
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <StatChip label="Power" value={carRatings.enginePower.toFixed(1)} />
                <StatChip label="Aero" value={carRatings.aeroEfficiency.toFixed(1)} />
                <StatChip label="Grip" value={carRatings.mechanicalGrip.toFixed(1)} />
                <StatChip label="Reliability" value={carRatings.reliability.toFixed(1)} />
                <StatChip label="Pit Crew" value={carRatings.pitCrewOperations.toFixed(1)} />
              </div>
            )}
            <div className="mt-3 text-sm text-neutral-400">
              Car condition: {Math.round(car?.condition ?? 0)}%
            </div>
          </Panel>

          {/* Development Slots */}
          <Panel title="Development Slot Overview">
            <div className="text-sm text-neutral-300">
              <span className="text-neutral-200">{slots}</span> development slot(s) available.
              {state.activeDevelopmentProjects.length > 0 && (
                <span className="text-neutral-500"> · {state.activeDevelopmentProjects.length} project(s) active.</span>
              )}
            </div>
            {isCareer && (
              <div className="mt-2 text-xs text-neutral-500">
                Visit the Development screen to assign projects to available slots.
              </div>
            )}
          </Panel>

          {/* Round 1 Preview */}
          {race && track && (
            <Panel title="Calendar / Round 1 Preview">
              <div className="text-sm text-neutral-200">{race.gpName} — {race.trackName}</div>
              <div className="text-xs text-neutral-500">{track.archetype} · Round {race.round}</div>
              <div className="mt-3">
                <TrackDemandBars track={track} />
              </div>
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          {/* Budget / Financial Review */}
          <Panel title="Budget / Financial Review">
            <div className="text-sm text-neutral-200">{team ? formatMoney(team.budget) : '—'}</div>
            <div className="mt-2 text-xs text-neutral-500">
              Prize money per point: $250K. Budget is used for development, staff, facilities, and race packages.
            </div>
          </Panel>

          {/* Sponsor Review */}
          <Panel title="Sponsor Review">
            {sponsors.length > 0 ? (
              <ul className="space-y-2">
                {sponsors.map((s) => (
                  <li key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-neutral-200">{s.name}</span>
                    <span className="text-neutral-400">{Math.round(s.confidence)}%</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-500">No active sponsors.</p>
            )}
            {isCareer && (
              <div className="mt-2 text-xs text-neutral-500">
                Visit the Sponsors screen to manage commercial deals.
              </div>
            )}
          </Panel>

          {/* Engine Supplier */}
          <Panel title="Engine Supplier / Manufacturer">
            {engineDeal ? (
              <div className="space-y-1 text-sm">
                <div className="text-neutral-200">{engineDeal.supplierName}</div>
                <div className="text-neutral-400">Deal type: {engineDeal.dealType}</div>
                <div className="text-xs text-green-400">Power: {engineDeal.powerRating}/10 · Reliability: {engineDeal.reliabilityRating}/10</div>
                <div className="text-xs text-neutral-500">{engineDeal.contractYearsRemaining} year(s) remaining</div>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">Engine deal assigned by historical data.</p>
            )}
            {isCareer && (
              <div className="mt-2 text-xs text-neutral-500">
                Visit the Engine Supplier screen to review or change deals.
              </div>
            )}
          </Panel>

          {/* Staff / Facilities */}
          <Panel title="Staff / Facilities Review">
            {state.facilities && (
              <ul className="space-y-1 text-sm">
                {state.facilities.facilities.slice(0, 4).map((f) => (
                  <li key={f.id} className="flex justify-between text-neutral-400">
                    <span>{f.type}</span>
                    <span>Lv {f.level}/{f.maxLevel}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 text-xs text-neutral-500">
              {state.staff && state.staff.length > 0
                ? `${state.staff.length} staff member(s) hired.`
                : 'No specialist staff hired.'}
            </div>
          </Panel>

          {/* Season Objectives */}
          <Panel title="Season Objectives">
            {expectation ? (
              <div className="space-y-1 text-sm">
                <div className="text-neutral-200">{expectation.primaryObjective}</div>
                {expectation.secondaryObjectives.length > 0 && (
                  <div className="text-neutral-400">{expectation.secondaryObjectives.join(', ')}</div>
                )}
                {expectation.minimumConstructorPosition && (
                  <div className="text-xs text-neutral-500">Target: P{expectation.minimumConstructorPosition} or better</div>
                )}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">
                {isCareer ? 'Objectives will be set based on team reputation.' : 'Historical replay mode — no custom objectives.'}
              </p>
            )}
          </Panel>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="primary" onClick={advanceToBriefing}>
          Advance to Pre-Race Briefing →
        </Button>
      </div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-neutral-700 bg-neutral-900/40 px-3 py-2 text-center">
      <div className="text-xs font-semibold uppercase text-neutral-500">{label}</div>
      <div className="text-sm font-bold text-neutral-200">{value}</div>
    </div>
  );
}
