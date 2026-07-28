import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { SeasonWorkflowRail } from '../components/workspace/SeasonWorkflowRail';
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
  preRaceBriefingTabFromQuery,
  type PreRaceBriefingTab,
} from './raceTransitionViewModel';
import {
  FmDecisionBar,
  FmKeyValue,
  FmListButton,
  FmPane,
  FmPaneBody,
  FmPaneHeader,
  FmWorkspaceGrid,
} from '../components/workspace/FmPane';
import { buildPerformanceDataHub } from './performanceDataHubViewModel';
import { useInformationViewPreferences } from './informationViewPreferences';
import { WhyChangedButton } from '../components/WhyChanged';
import { setupConfidenceExplanation } from './explanationViewModel';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<PreRaceBriefingTab>('overview');
  const [selectedPrepFocus, setSelectedPrepFocus] = useState<string | null>(null);
  const { preferences } = useInformationViewPreferences(state?.id ?? 'no-career');
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
  const requestedPrepFocus = searchParams.get('prep');
  const activePrepFocus = requestedPrepFocus && RACE_PREP_FOCUS_INFO[requestedPrepFocus]
    ? requestedPrepFocus
    : selectedPrepFocus ?? phaseState.racePrepFocus ?? 'balanced';
  const prepFocus = RACE_PREP_FOCUS_INFO[activePrepFocus] ?? RACE_PREP_FOCUS_INFO.balanced;
  const prepConfirmed = (phaseState.racePrepFocusConfirmed ?? !!phaseState.racePrepFocus) && activePrepFocus === phaseState.racePrepFocus;
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
  const pinnedFindings = buildPerformanceDataHub(state).findings
    .filter((finding) => preferences.pinnedFindingIds.includes(finding.id));
  const hasValidLineup = activeDrivers.length >= minDrivers;
  const canEnterWeekend = !!selectedPackage && hasValidLineup && prepConfirmed;
  const weekendBlockedReason = !selectedPackage
    ? 'Select a race package in Paddock Week first'
    : !hasValidLineup
      ? `Sign ${minDrivers - activeDrivers.length} more active race driver${minDrivers - activeDrivers.length === 1 ? '' : 's'}`
      : !prepConfirmed
        ? 'Confirm a race preparation focus'
      : undefined;
  const activeTab = searchParams.has('tab')
    ? preRaceBriefingTabFromQuery(searchParams.get('tab'))
    : tab;
  const selectTab = (nextTab: PreRaceBriefingTab) => {
    setTab(nextTab);
    const next = new URLSearchParams(searchParams);
    next.set('tab', nextTab);
    setSearchParams(next, { replace: true });
  };
  const selectPrepFocus = (focusId: string) => {
    setSelectedPrepFocus(focusId);
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'preparation');
    next.set('prep', focusId);
    setSearchParams(next, { replace: true });
  };

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
        actions={<>
          <Button variant="ghost" onClick={() => navigate('/hq')}>Manager Office</Button>
          <Button
            variant="primary"
            onClick={enterRaceWeekend}
            disabled={!canEnterWeekend}
            title={weekendBlockedReason ?? 'Enter Race Weekend'}
          >
            Enter Race Weekend →
          </Button>
        </>}
      />
      <MetricStrip>
        <WorkspaceMetric label="Championship" value={playerPosition > 0 ? `P${playerPosition}` : 'Opening round'} detail={playerPosition > 0 ? `${playerStanding?.points ?? 0} constructor points` : 'No standings position yet'} />
        <WorkspaceMetric label="Preparation" value={prepFocus.label} detail="Applies to this race only" />
        <WorkspaceMetric label="Race package" value={selectedPackageDef?.label ?? 'Not selected'} detail={selectedPackage ? formatMoney(selectedPackage.cost) : 'Required before weekend entry'} />
        <WorkspaceMetric label="Weekend gate" value={canEnterWeekend ? 'Ready' : 'Blocked'} detail={weekendBlockedReason ?? `${activeDrivers.length}/${minDrivers} active drivers · ${team ? formatMoney(team.budget) : '—'}`} />
      </MetricStrip>
      <SeasonWorkflowRail
        active="briefing"
        context={`${race.gpName} · ${race.trackName}`}
        blocker={canEnterWeekend ? undefined : weekendBlockedReason}
      />
      {!canEnterWeekend && <div className="shrink-0 rounded border border-orange-500/25 bg-orange-500/5 px-3 py-2 text-[11px] text-orange-200">Weekend entry is blocked: {weekendBlockedReason}.</div>}
      <WorkspaceTabs items={PRE_RACE_BRIEFING_TABS} active={activeTab} onChange={selectTab} ariaLabel="Pre-race briefing sections" />
      <WorkspaceBody className="ui-phase14-workspace">

      {activeTab === 'overview' && (
        <FmWorkspaceGrid className="ui-briefing-grid">
          <FmPane>
            <FmPaneHeader title="Circuit brief" meta={`${track.archetype} · Round ${race.round}`} />
            <FmPaneBody className="ui-phase14-pane-body overflow-auto">
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
            </FmPaneBody>
          </FmPane>
          <FmPane>
            <FmPaneHeader title="Strategy focus" meta="Track-led recommendation" />
            <FmPaneBody className="ui-phase14-pane-body">
            <p className="text-sm text-neutral-300">{strategySuggestion}</p>
            {carRatings && (
              <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                <StatChip label="Power" value={carRatings.enginePower.toFixed(1)} />
                <StatChip label="Aero" value={carRatings.aeroEfficiency.toFixed(1)} />
                <StatChip label="Reliability" value={carRatings.reliability.toFixed(1)} />
              </div>
            )}
            {activeDrivers[0] && (
              <div className="ui-explanation-actions">
                <WhyChangedButton explanation={setupConfidenceExplanation(state, activeDrivers[0], track)} label={`Explain ${activeDrivers[0].name} setup`} />
              </div>
            )}
            {pinnedFindings.length > 0 && (
              <div className="ui-pinned-strategy-findings">
                <h3>Pinned analysis</h3>
                {pinnedFindings.map((finding) => (
                  <button type="button" key={finding.id} onClick={() => navigate('/performance')}>
                    <strong>{finding.title}</strong>
                    <span>{finding.conclusion}</span>
                    <small>{finding.confidence} confidence · {finding.trend}</small>
                  </button>
                ))}
              </div>
            )}
            </FmPaneBody>
          </FmPane>
          <FmPane>
            <FmPaneHeader title="Weekend gate" meta={canEnterWeekend ? 'Ready' : 'Action required'} />
            <FmPaneBody className="ui-phase14-pane-body">
              <div className="ui-phase14-dossier">
                <section>
                  <h3>Entry checks</h3>
                  <FmKeyValue label="Race package" value={selectedPackageDef?.label ?? 'Not selected'} />
                  <FmKeyValue label="Race drivers" value={`${activeDrivers.length}/${minDrivers}`} />
                  <FmKeyValue label="Preparation" value={prepConfirmed ? prepFocus.label : 'Not confirmed'} />
                </section>
                <section className={canEnterWeekend ? '' : 'is-warning'}>
                  <h3>{canEnterWeekend ? 'Ready to enter' : 'Blocking action'}</h3>
                  <p>{weekendBlockedReason ?? 'All mandatory race-weekend preparation has been completed.'}</p>
                </section>
              </div>
            </FmPaneBody>
          </FmPane>
        </FmWorkspaceGrid>
      )}

      {activeTab === 'preparation' && (
        <div className="ui-phase14-decision-workspace">
        <FmWorkspaceGrid className="ui-briefing-grid">
          <FmPane>
            <FmPaneHeader title="Race preparation focus" meta="One race only" />
            <FmPaneBody>
              {Object.entries(RACE_PREP_FOCUS_INFO).map(([id, focus]) => (
                <FmListButton
                  key={id}
                  onClick={() => selectPrepFocus(id)}
                  active={activePrepFocus === id}
                >
                  <strong>{focus.label}</strong>
                  <small>{focus.description}</small>
                </FmListButton>
              ))}
            </FmPaneBody>
          </FmPane>
          <FmPane>
            <FmPaneHeader title={prepFocus.label} meta={prepConfirmed ? 'Confirmed plan' : 'Draft selection'} />
            <FmPaneBody className="ui-phase14-pane-body">
              <div className="ui-phase14-dossier">
                <section><h3>Expected effect</h3><p>{prepFocus.description}</p></section>
                <section><h3>Decision scope</h3><FmKeyValue label="Duration" value="Next race only" /><FmKeyValue label="Status" value={prepConfirmed ? 'Confirmed' : 'Draft'} /></section>
                <section><h3>Development status</h3><FmKeyValue label="Active projects" value={activeUpgradePrograms(state).length} /><FmKeyValue label="Completed" value={completedUpgradePrograms(state).length} /></section>
              </div>
            </FmPaneBody>
          </FmPane>
          <FmPane>
            <FmPaneHeader title="Race operations package" meta={selectedPackageDef?.label ?? 'Not selected'} />
            <FmPaneBody className="ui-phase14-pane-body">
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
            </FmPaneBody>
          </FmPane>
        </FmWorkspaceGrid>
        <FmDecisionBar actions={<Button
          variant={prepConfirmed ? 'secondary' : 'primary'}
          disabled={prepConfirmed}
          onClick={() => dispatch({ type: 'CONFIRM_RACE_PREP_FOCUS', focus: activePrepFocus })}
        >
          {prepConfirmed ? `Confirmed: ${prepFocus.label}` : `Confirm ${prepFocus.label}`}
        </Button>}>
          <strong className="text-neutral-200">Preparation decision:</strong> {prepFocus.description}
        </FmDecisionBar>
        </div>
      )}

      {activeTab === 'team' && (
        <FmWorkspaceGrid columns="two" className="ui-briefing-team-grid">
          <FmPane>
            <FmPaneHeader title="Driver status" meta={`${activeDrivers.length}/${minDrivers} required`} />
            <FmPaneBody>
              {activeDrivers.map((driver) => (
                <FmListButton key={driver.id}>
                  <strong>{driver.name}</strong>
                  <small>Morale {Math.round(driver.morale)}% · Confidence {Math.round(driver.confidence)}%</small>
                </FmListButton>
              ))}
            {activeDrivers.length < minDrivers && <p className="mt-3 text-sm text-orange-400">Only {activeDrivers.length} active driver(s). Complete the required race lineup before entering.</p>}
            </FmPaneBody>
          </FmPane>
          <FmPane>
            <FmPaneHeader title="Key rivals" meta="Championship position" />
            <FmPaneBody>
              {rivals.map((rival) => {
                const ai = state.aiTeamStates?.[rival.entityId];
                const spec = ai ? ARCHETYPE_SPECS[ai.archetype] : undefined;
                return (
                  <FmListButton key={rival.entityId}>
                    <span>P{rival.position} · {rival.points} pts</span>
                    <strong>{state.teams.find((entry) => entry.id === rival.entityId)?.name ?? rival.entityId}</strong>
                    {spec && <small>{spec.label} · {spec.description.split(';')[0]}.</small>}
                  </FmListButton>
                );
              })}
              {rivals.length === 0 && <p className="text-sm text-neutral-500">No rival data available.</p>}
            </FmPaneBody>
          </FmPane>
        </FmWorkspaceGrid>
      )}

      {activeTab === 'paddock' && (
        <div className="ui-briefing-paddock-grid">
          <NewsPanel news={state.news} title="Race Preview" maxItems={4} categoryFilter={['preseason', 'ai_team', 'championship']} emptyMessage="No race preview stories." />
          <NewsPanel news={state.news} title="Paddock Watch" maxItems={4} categoryFilter={['development', 'ai_team', 'financial']} emptyMessage="No paddock news." />
          <FmPane>
            <FmPaneHeader title="Sponsor confidence" meta={`${sponsors.length} active partners`} />
            <FmPaneBody>
              {sponsors.length === 0 ? <p className="text-sm text-neutral-500">No active sponsors.</p> : (
                sponsors.map((sponsor) => (
                    <FmListButton key={sponsor.id}>
                      <strong>{sponsor.name}</strong>
                      <small className={sponsor.confidence > 50 ? 'text-emerald-300' : 'text-orange-300'}>{sponsor.confidence > 50 ? 'Satisfied' : 'Unsatisfied'} · {Math.round(sponsor.confidence)}%</small>
                    </FmListButton>
                ))
              )}
            </FmPaneBody>
          </FmPane>
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
