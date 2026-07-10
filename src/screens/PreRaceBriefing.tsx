import { useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import {
  activeDriversForTeam,
  carForTeam,
  currentRace,
  minRaceDriversForSeries,
  teamById,
} from '../game/careerState';
import { getTrackById, getRegulationSet } from '../data';
import { effectiveCarRatings } from '../sim/trackFitEngine';
import { getOrCreatePhaseState } from '../game/careerPhaseEngine';
import { ARCHETYPE_SPECS } from '../sim/aiTeamEngine';
import { RACE_WEEKEND_PACKAGES } from '../sim/raceWeekendPackageEngine';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { TrackDemandBars } from '../components/TrackDemandBars';
import { NewsPanel } from '../components/NewsPanel';
import { formatMoney } from '../components/ui';

const RACE_PREP_FOCUS_INFO: Record<string, { label: string; description: string }> = {
  balanced: {
    label: 'Balanced Preparation',
    description: 'Slight consistency and mistake-reduction bonus for this race.',
  },
  qualifying: {
    label: 'Qualifying Focus',
    description: 'Improved one-lap pace. May slightly reduce race pace.',
  },
  race: {
    label: 'Race Pace Focus',
    description: 'Improved long-run pace and strategy. May slightly reduce qualifying performance.',
  },
  reliability: {
    label: 'Reliability Focus',
    description: 'Lower mechanical/DNF risk this race, with a small pace tradeoff.',
  },
  power: {
    label: 'Engine Power Focus',
    description: 'Improved straight-line speed. Higher reliability risk.',
  },
  budget: {
    label: 'Budget Preparation',
    description: 'Reduced weekend operational costs (−20%). Significant pace, reliability, and mistake-risk penalties.',
  },
};

export function PreRaceBriefing() {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  if (!state) return null;

  const race = currentRace(state);
  const track = race ? getTrackById(race.trackId) : undefined;
  const team = teamById(state, state.selectedTeamId);
  const car = carForTeam(state, state.selectedTeamId);
  const activeDrivers = activeDriversForTeam(state, state.selectedTeamId);
  const minDrivers = minRaceDriversForSeries(state.series);
  const carRatings = car ? effectiveCarRatings(car) : null;

  if (!race || !track) return null;

  // Race prep focus display
  const phaseState = getOrCreatePhaseState(state);
  const prepFocusId = phaseState.racePrepFocus ?? 'balanced';
  const prepFocusInfo = RACE_PREP_FOCUS_INFO[prepFocusId] ?? RACE_PREP_FOCUS_INFO['balanced'];
  const selectedPackage = state.raceWeekendPackage?.raceId === race.id ? state.raceWeekendPackage : undefined;
  const selectedPackageDef = selectedPackage ? RACE_WEEKEND_PACKAGES[selectedPackage.packageType] : undefined;

  const teamName = (id: string) => state.teams.find((t) => t.id === id)?.name ?? id;

  const enterRaceWeekend = () => {
    dispatch({ type: 'ADVANCE_TO_RACE_WEEKEND' });
    navigate('/weekend');
  };

  // Find key rivals (top 3 in constructors).
  const rivals = state.constructorStandings
    .slice(0, 5)
    .filter((s) => s.entityId !== state.selectedTeamId)
    .slice(0, 3);

  // Sponsor objective summary.
  const sponsors = state.commercial?.sponsors ?? [];
  const sponsorSummary = sponsors.length > 0
    ? sponsors.map((s) => `${s.name}: ${s.confidence > 50 ? 'Satisfied' : 'Unsatisfied'} (${Math.round(s.confidence)}%)`).join(', ')
    : 'No active sponsors';

  // Strategy suggestion based on track demands.
  const strategySuggestion = (() => {
    const demands = [
      ['power', track.setupProfile.powerDemand],
      ['aero', track.setupProfile.aeroDemand],
      ['mechanical', track.setupProfile.mechanicalDemand],
    ] as [string, number][];
    demands.sort((a, b) => b[1] - a[1]);
    const top = demands[0][0];
    if (top === 'power') return 'Focus on top-speed and engine performance. Consider a low-downforce setup.';
    if (top === 'aero') return 'Prioritize aerodynamic efficiency. A high-downforce setup is recommended.';
    return 'Focus on mechanical grip and braking stability. A balanced setup works well here.';
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Pre-Race Briefing</h1>
          <p className="text-sm text-neutral-400">{race.gpName} · {race.trackName} · Round {race.round}</p>
        </div>
        <Button
          variant="primary"
          onClick={enterRaceWeekend}
          disabled={!selectedPackage}
          title={selectedPackage ? 'Enter Race Weekend' : 'Select a race package before the pre-race briefing'}
        >
          Enter Race Weekend →
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">

          {/* Race Preview News */}
          <div className="grid gap-4 sm:grid-cols-2">
            <NewsPanel
              news={state.news}
              title="Race Preview"
              maxItems={3}
              categoryFilter={['preseason', 'ai_team', 'championship']}
              emptyMessage="No race preview stories."
            />
            <NewsPanel
              news={state.news}
              title="Paddock Watch"
              maxItems={3}
              categoryFilter={['development', 'ai_team', 'financial']}
              emptyMessage="No paddock news."
            />
          </div>
          {/* Race Details */}
          <Panel title="Race Details">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold uppercase text-neutral-500">Grand Prix</div>
                <div className="text-sm text-neutral-200">{race.gpName}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-neutral-500">Track</div>
                <div className="text-sm text-neutral-200">{track.name}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-neutral-500">Archetype</div>
                <div className="text-sm text-neutral-200">{track.archetype}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-neutral-500">Round</div>
                <div className="text-sm text-neutral-200">{race.round} of {state.calendar.length}</div>
              </div>
            </div>
            <div className="mt-4">
              <TrackDemandBars track={track} />
            </div>
            {(() => {
              const regSet = getRegulationSet(state.regulationSetId);
              if (!regSet) return null;
              return (
                <div className="mt-4 grid gap-2 sm:grid-cols-3 text-xs">
                  <div className="rounded bg-neutral-800/50 px-2 py-1">
                    <span className="text-neutral-500">Qualifying: </span>
                    <span className="text-neutral-300">{regSet.qualifyingFormat}</span>
                  </div>
                  <div className="rounded bg-neutral-800/50 px-2 py-1">
                    <span className="text-neutral-500">Refueling: </span>
                    <span className={regSet.refuelingAllowed ? 'text-green-400' : 'text-red-400'}>
                      {regSet.refuelingAllowed ? 'Allowed' : 'Banned'}
                    </span>
                  </div>
                  <div className="rounded bg-neutral-800/50 px-2 py-1">
                    <span className="text-neutral-500">DRS: </span>
                    <span className={regSet.drsEnabled ? 'text-green-400' : 'text-neutral-400'}>
                      {regSet.drsEnabled ? 'Enabled' : 'Not in use'}
                    </span>
                  </div>
                </div>
              );
            })()}
          </Panel>

          {/* Strategy Focus */}
          <Panel title="Strategy Focus">
            <p className="text-sm text-neutral-300">{strategySuggestion}</p>
            {carRatings && (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <StatChip label="Power" value={carRatings.enginePower.toFixed(1)} />
                <StatChip label="Aero" value={carRatings.aeroEfficiency.toFixed(1)} />
                <StatChip label="Reliability" value={carRatings.reliability.toFixed(1)} />
              </div>
            )}
          </Panel>

          {/* Race Preparation Focus */}
          <Panel title="Race Preparation Focus">
            <div className="space-y-2">
              <div className="text-sm font-semibold text-neutral-100">{prepFocusInfo.label}</div>
              <p className="text-sm text-neutral-300">{prepFocusInfo.description}</p>
              <div className="text-xs text-neutral-500">Duration: Next race only.</div>
            </div>
          </Panel>

          {/* Race Operations Package */}
          <Panel title="Race Operations Package">
            {selectedPackage && selectedPackageDef ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-neutral-100">{selectedPackageDef.label}</div>
                  <div className="text-sm text-neutral-300">{formatMoney(selectedPackage.cost)}</div>
                </div>
                <p className="text-sm text-neutral-300">{selectedPackageDef.description}</p>
                <div className="grid gap-2 text-xs sm:grid-cols-3">
                  <span className="rounded bg-neutral-800/50 px-2 py-1 text-neutral-300">
                    Pace {selectedPackageDef.effects.paceModifier > 0 ? '+' : ''}{selectedPackageDef.effects.paceModifier.toFixed(1)}
                  </span>
                  <span className="rounded bg-neutral-800/50 px-2 py-1 text-neutral-300">
                    Reliability {selectedPackageDef.effects.reliabilityPrep > 0 ? '+' : ''}{selectedPackageDef.effects.reliabilityPrep.toFixed(2)}
                  </span>
                  <span className="rounded bg-neutral-800/50 px-2 py-1 text-neutral-300">
                    Pit crew {selectedPackageDef.effects.pitCrewPrep > 0 ? '+' : ''}{selectedPackageDef.effects.pitCrewPrep.toFixed(2)}
                  </span>
                </div>
                <div className="text-xs text-neutral-500">Selected before the race weekend. Applies through qualifying and race day.</div>
              </div>
            ) : (
              <p className="text-sm text-orange-300">No race package selected. Return to Paddock Week before entering the weekend.</p>
            )}
          </Panel>

          {/* Driver Status */}
          <Panel title="Driver Status">
            <ul className="space-y-2">
              {activeDrivers.map((d) => (
                <li key={d.id} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-200">{d.name}</span>
                  <span className="text-neutral-400">
                    Morale {Math.round(d.morale)}% · Confidence {Math.round(d.confidence)}%
                  </span>
                </li>
              ))}
              {activeDrivers.length < minDrivers && (
                <li className="text-sm text-orange-400">
                  Only {activeDrivers.length} active driver(s). Sign {minDrivers === 1 ? 'a driver' : 'a second driver'} before racing.
                </li>
              )}
            </ul>
          </Panel>

          {/* Development Status */}
          <Panel title="Development Status">
            <div className="text-sm text-neutral-300">
              <span className="text-neutral-200">{state.activeDevelopmentProjects.length}</span> active project(s)
              {state.completedDevelopmentProjects.length > 0 && (
                <span className="text-neutral-500"> · {state.completedDevelopmentProjects.length} completed this season</span>
              )}
            </div>
            {state.activeDevelopmentProjects.length > 0 && (
              <ul className="mt-2 space-y-1">
                {state.activeDevelopmentProjects.map((p) => (
                  <li key={p.id} className="text-sm text-neutral-400">
                    {p.name} — {p.progressRaces}/{p.adjustedDurationRaces ?? p.durationRaces} races
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          {/* Standings Snapshot */}
          <Panel title="Championship Snapshot">
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-neutral-500">Constructors' Position: </span>
                <span className="font-semibold text-neutral-100">
                  P{state.constructorStandings.findIndex((s) => s.entityId === state.selectedTeamId) + 1 || '—'}
                </span>
              </div>
              <div>
                <span className="text-neutral-500">Points: </span>
                <span className="text-neutral-200">
                  {state.constructorStandings.find((s) => s.entityId === state.selectedTeamId)?.points ?? 0}
                </span>
              </div>
            </div>
          </Panel>

          {/* Key Rivals */}
          <Panel title="Key Rivals">
            <ul className="space-y-2">
              {rivals.map((r, i) => {
                const ai = state.aiTeamStates?.[r.entityId];
                const spec = ai ? ARCHETYPE_SPECS[ai.archetype] : undefined;
                return (
                  <li key={r.entityId} className="text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-200">P{i + 1 + (i === 0 && r.entityId !== state.selectedTeamId ? 0 : 0)} {teamName(r.entityId)}</span>
                      <span className="text-neutral-400">{r.points} pts</span>
                    </div>
                    {spec && (
                      <div className="text-[11px] text-neutral-500">
                        {spec.label} · {spec.description.split(';')[0]}.
                      </div>
                    )}
                  </li>
                );
              })}
              {rivals.length === 0 && (
                <li className="text-sm text-neutral-500">No rival data available.</li>
              )}
            </ul>
          </Panel>

          {/* Sponsor Objective */}
          <Panel title="Sponsor Objective">
            <p className="text-sm text-neutral-300">{sponsorSummary}</p>
          </Panel>

          {/* Budget */}
          <Panel title="Budget">
            <p className="text-sm text-neutral-200">{team ? formatMoney(team.budget) : '—'}</p>
          </Panel>
        </div>
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
