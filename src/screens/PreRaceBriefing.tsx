import { useState } from 'react';
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
import { activeUpgradePrograms, completedUpgradePrograms } from '../sim/technicalAdapters';
import {
  MetricStrip,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceMetric,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';
import {
  PRE_RACE_BRIEFING_TABS,
  type PreRaceBriefingTab,
} from './raceTransitionViewModel';

const RACE_PREP_FOCUS_INFO: Record<string, { label: string; description: string }> = {
  balanced: { label: 'Balanced Preparation', description: 'Slight consistency and mistake-reduction bonus for this race.' },
  qualifying: { label: 'Qualifying Focus', description: 'Improved one-lap pace. May slightly reduce race pace.' },
  race: { label: 'Race Pace Focus', description: 'Improved long-run pace and strategy. May slightly reduce qualifying performance.' },
  reliability: { label: 'Reliability Focus', description: 'Lower mechanical/DNF risk this race, with a small pace tradeoff.' },
  power: { label: 'Engine Power Focus', description: 'Improved straight-line speed. Higher reliability risk.' },
  budget: { label: 'Budget Preparation', description: 'Reduced weekend operational costs (−20%). Significant pace, reliability, and mistake-risk penalties.' },
};

export function PreRaceBriefing() {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  const [tab, setTab] = useState<PreRaceBriefingTab>('overview');
  if (!state) return null;

  const race = currentRace(state);
  const track = race ? getTrackById(race.trackId) : undefined;
  const team = teamById(state, state.selectedTeamId);
  const car = carForTeam(state, state.selectedTeamId);
  const activeDrivers = activeDriversForTeam(state, state.selectedTeamId);
  const minDrivers = minRaceDriversForSeries(state.series);
  const carRatings = car ? effectiveCarRatings(car) : null;
  if (!race || !track) return null;

  const phaseState = getOrCreatePhaseState(state);
  const prepFocus = RACE_PREP_FOCUS_INFO[phaseState.racePrepFocus ?? 'balanced'] ?? RACE_PREP_FOCUS_INFO.balanced;
  const selectedPackage = state.raceWeekendPackage?.raceId === race.id ? state.raceWeekendPackage : undefined;
  const selectedPackageDef = selectedPackage ? RACE_WEEKEND_PACKAGES[selectedPackage.packageType] : undefined;
  const regulationSet = getRegulationSet(state.regulationSetId);
  const playerStanding = state.constructorStandings.find((entry) => entry.entityId === state.selectedTeamId);
  const playerPosition = state.constructorStandings.findIndex((entry) => entry.entityId === state.selectedTeamId) + 1;
  const rivals = state.constructorStandings
    .map((entry, index) => ({ ...entry, position: index + 1 }))
    .filter((entry) => entry.entityId !== state.selectedTeamId)
    .slice(0, 3);
  const sponsors = state.commercial?.sponsors ?? [];
  const strategySuggestion = strategyForTrack(track);
  const hasValidLineup = activeDrivers.length >= minDrivers;
  const canEnterWeekend = !!selectedPackage && hasValidLineup;
  const weekendBlockedReason = !selectedPackage
    ? 'Select a race package in Paddock Week first'
    : !hasValidLineup
      ? `Sign ${minDrivers - activeDrivers.length} more active race driver${minDrivers - activeDrivers.length === 1 ? '' : 's'}`
      : undefined;

  const enterRaceWeekend = () => {
    if (!canEnterWeekend) return;
    dispatch({ type: 'ADVANCE_TO_RACE_WEEKEND' });
    navigate('/weekend');
  };

  return (
    <WorkspaceScreen className="era-feature-screen era-pre-race-briefing-screen">
      <WorkspaceHeader
        eyebrow="Race operations"
        title={`${race.gpName} Briefing`}
        subtitle={`${race.trackName} · Round ${race.round} of ${state.calendar.length} · ${track.archetype}`}
        actions={<Button
          variant="primary"
          onClick={enterRaceWeekend}
          disabled={!canEnterWeekend}
          title={weekendBlockedReason ?? 'Enter Race Weekend'}
        >
          Enter Race Weekend →
        </Button>}
      />
      <MetricStrip>
        <WorkspaceMetric label="Championship" value={playerPosition > 0 ? `P${playerPosition}` : 'Opening round'} detail={playerPosition > 0 ? `${playerStanding?.points ?? 0} constructor points` : 'No standings position yet'} />
        <WorkspaceMetric label="Preparation" value={prepFocus.label} detail="Applies to this race only" />
        <WorkspaceMetric label="Race package" value={selectedPackageDef?.label ?? 'Not selected'} detail={selectedPackage ? formatMoney(selectedPackage.cost) : 'Required before weekend entry'} />
        <WorkspaceMetric label="Weekend gate" value={canEnterWeekend ? 'Ready' : 'Blocked'} detail={weekendBlockedReason ?? `${activeDrivers.length}/${minDrivers} active drivers · ${team ? formatMoney(team.budget) : '—'}`} />
      </MetricStrip>
      {!canEnterWeekend && <div className="shrink-0 rounded border border-orange-500/25 bg-orange-500/5 px-3 py-2 text-[11px] text-orange-200">Weekend entry is blocked: {weekendBlockedReason}.</div>}
      <WorkspaceTabs items={PRE_RACE_BRIEFING_TABS} active={tab} onChange={setTab} ariaLabel="Pre-race briefing sections" />
      <WorkspaceBody className="space-y-3">

      {tab === 'overview' && (
        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
          <Panel title="Race Details">
            <div className="grid gap-3 sm:grid-cols-4">
              <Detail label="Grand Prix" value={race.gpName} />
              <Detail label="Track" value={track.name} />
              <Detail label="Archetype" value={track.archetype} />
              <Detail label="Round" value={`${race.round} of ${state.calendar.length}`} />
            </div>
            <div className="mt-4"><TrackDemandBars track={track} /></div>
            {regulationSet && (
              <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
                <Rule label="Qualifying" value={regulationSet.qualifyingFormat} />
                <Rule label="Refueling" value={regulationSet.refuelingAllowed ? 'Allowed' : 'Banned'} />
                <Rule label="DRS" value={regulationSet.drsEnabled ? 'Enabled' : 'Not in use'} />
              </div>
            )}
          </Panel>
          <Panel title="Strategy Focus">
            <p className="text-sm text-neutral-300">{strategySuggestion}</p>
            {carRatings && (
              <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                <StatChip label="Power" value={carRatings.enginePower.toFixed(1)} />
                <StatChip label="Aero" value={carRatings.aeroEfficiency.toFixed(1)} />
                <StatChip label="Reliability" value={carRatings.reliability.toFixed(1)} />
              </div>
            )}
          </Panel>
        </div>
      )}

      {tab === 'preparation' && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Panel title="Race Preparation Focus">
            <div className="text-sm font-semibold text-neutral-100">{prepFocus.label}</div>
            <p className="mt-2 text-sm text-neutral-300">{prepFocus.description}</p>
            <div className="mt-2 text-xs text-neutral-500">Duration: next race only.</div>
          </Panel>
          <Panel title="Race Operations Package">
            {selectedPackage && selectedPackageDef ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-neutral-100">{selectedPackageDef.label}</div>
                  <div className="text-sm text-neutral-300">{formatMoney(selectedPackage.cost)}</div>
                </div>
                <p className="text-sm text-neutral-300">{selectedPackageDef.description}</p>
                <div className="grid gap-2 text-xs sm:grid-cols-3">
                  <Rule label="Pace" value={signed(selectedPackageDef.effects.paceModifier, 1)} />
                  <Rule label="Reliability" value={signed(selectedPackageDef.effects.reliabilityPrep, 2)} />
                  <Rule label="Pit crew" value={signed(selectedPackageDef.effects.pitCrewPrep, 2)} />
                </div>
              </div>
            ) : <p className="text-sm text-orange-300">No race package selected. Return to Paddock Week before entering the weekend.</p>}
          </Panel>
          <div className="lg:col-span-2">
            <Panel title="Development Status">
              <div className="text-sm text-neutral-300">{activeUpgradePrograms(state).length} active project(s) · {completedUpgradePrograms(state).length} completed this season</div>
              {activeUpgradePrograms(state).length > 0 && (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {activeUpgradePrograms(state).slice(0, 6).map((project) => (
                    <div key={project.id} className="rounded border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-neutral-400">
                      <span className="font-medium text-neutral-200">{project.name}</span> · {project.progressRaces}/{project.adjustedDurationRaces ?? project.durationRaces} races
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}

      {tab === 'team' && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Panel title="Driver Status">
            <div className="grid gap-2 sm:grid-cols-2">
              {activeDrivers.map((driver) => (
                <div key={driver.id} className="rounded border border-neutral-800 bg-neutral-950/40 p-3">
                  <div className="text-sm font-semibold text-neutral-100">{driver.name}</div>
                  <div className="mt-1 text-xs text-neutral-400">Morale {Math.round(driver.morale)}% · Confidence {Math.round(driver.confidence)}%</div>
                </div>
              ))}
            </div>
            {activeDrivers.length < minDrivers && <p className="mt-3 text-sm text-orange-400">Only {activeDrivers.length} active driver(s). Complete the required race lineup before entering.</p>}
          </Panel>
          <Panel title="Key Rivals">
            <div className="space-y-2">
              {rivals.map((rival) => {
                const ai = state.aiTeamStates?.[rival.entityId];
                const spec = ai ? ARCHETYPE_SPECS[ai.archetype] : undefined;
                return (
                  <div key={rival.entityId} className="rounded border border-neutral-800 bg-neutral-950/40 px-3 py-2">
                    <div className="flex justify-between text-sm"><span className="font-medium text-neutral-200">P{rival.position} {state.teams.find((entry) => entry.id === rival.entityId)?.name ?? rival.entityId}</span><span className="text-neutral-400">{rival.points} pts</span></div>
                    {spec && <div className="mt-1 text-[11px] text-neutral-500">{spec.label} · {spec.description.split(';')[0]}.</div>}
                  </div>
                );
              })}
              {rivals.length === 0 && <p className="text-sm text-neutral-500">No rival data available.</p>}
            </div>
          </Panel>
        </div>
      )}

      {tab === 'paddock' && (
        <div className="grid gap-3 lg:grid-cols-2">
          <NewsPanel news={state.news} title="Race Preview" maxItems={4} categoryFilter={['preseason', 'ai_team', 'championship']} emptyMessage="No race preview stories." />
          <NewsPanel news={state.news} title="Paddock Watch" maxItems={4} categoryFilter={['development', 'ai_team', 'financial']} emptyMessage="No paddock news." />
          <div className="lg:col-span-2">
            <Panel title="Sponsor Confidence">
              {sponsors.length === 0 ? <p className="text-sm text-neutral-500">No active sponsors.</p> : (
                <div className="grid gap-2 md:grid-cols-2">
                  {sponsors.map((sponsor) => (
                    <div key={sponsor.id} className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm">
                      <span className="font-medium text-neutral-200">{sponsor.name}</span>
                      <span className={sponsor.confidence > 50 ? 'text-emerald-300' : 'text-orange-300'}>{sponsor.confidence > 50 ? 'Satisfied' : 'Unsatisfied'} · {Math.round(sponsor.confidence)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}

function strategyForTrack(track: NonNullable<ReturnType<typeof getTrackById>>): string {
  const demands: [string, number][] = [
    ['power', track.setupProfile.powerDemand],
    ['aero', track.setupProfile.aeroDemand],
    ['mechanical', track.setupProfile.mechanicalDemand],
  ];
  demands.sort((a, b) => b[1] - a[1]);
  if (demands[0][0] === 'power') return 'Focus on top speed and engine performance. Consider a lower-downforce setup.';
  if (demands[0][0] === 'aero') return 'Prioritize aerodynamic efficiency. A higher-downforce setup is recommended.';
  return 'Focus on mechanical grip and braking stability. A balanced setup works well here.';
}

function signed(value: number, digits: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[10px] font-semibold uppercase text-neutral-500">{label}</div><div className="text-sm text-neutral-200">{value}</div></div>;
}

function Rule({ label, value }: { label: string; value: string }) {
  return <div className="rounded bg-neutral-800/50 px-2 py-1"><span className="text-neutral-500">{label}: </span><span className="text-neutral-300">{value}</span></div>;
}

function StatChip({ label, value }: { label: string; value: string }) {
  return <div className="rounded border border-neutral-700 bg-neutral-900/40 px-3 py-2 text-center"><div className="text-xs font-semibold uppercase text-neutral-500">{label}</div><div className="text-sm font-bold text-neutral-200">{value}</div></div>;
}
