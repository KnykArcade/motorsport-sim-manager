import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import {
  activeDriversForTeam,
  carForTeam,
  currentRace,
  teamById,
  driversForTeam,
  minRaceDriversForSeries,
} from '../game/careerState';
import { getTrackById, getRegulationSet } from '../data';
import { effectiveCarRatings } from '../sim/trackFitEngine';
import { developmentSlots } from '../sim/facilityEngine';
import { activeUpgradePrograms } from '../sim/technicalAdapters';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { RegulationPanel } from '../components/RegulationPanel';
import { TrackDemandBars } from '../components/TrackDemandBars';
import { NewsPanel } from '../components/NewsPanel';
import { formatMoney } from '../components/ui';
import {
  MetricStrip,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceMetric,
  WorkspaceScreen,
} from '../components/workspace/Workspace';
import { isPreseasonChecklistComplete, getPreseasonApprovals } from '../game/careerPhaseEngine';
import { getGameModeLabel } from '../game/modeRestrictions';
import {
  OWNER_PERSONALITY_LABELS,
  OWNER_PERSONALITY_DESCRIPTIONS,
  type BoardroomMandateLevel,
} from '../types/expectationTypes';
import { MANDATE_OPTIONS } from '../sim/boardroomEngine';
import type { CarLaunchApproach, PreseasonTestingFocus } from '../types/phase18Types';
import { PRESEASON_FLAW_FIX_COST, PRESEASON_TESTING_COST, preseasonProgramFor } from '../sim/phase18PreseasonEngine';
import { PRIZE_MONEY_PER_POINT } from '../sim/financeEngine';

type PreseasonTab = 'teamOverview' | 'budget' | 'driverLineup' | 'carDevelopment' | 'sponsorsEngine' | 'seasonObjectives' | 'roundOnePreview';

const PRESEASON_BRIEFINGS: Array<{
  id: PreseasonTab;
  order: string;
  title: string;
  eyebrow: string;
  summary: string;
  confirmLabel: string;
}> = [
  {
    id: 'teamOverview',
    order: '1',
    title: 'Welcome to the season',
    eyebrow: 'Owner introduction',
    summary: 'Team identity, principal reputation, regulations, and the broad season picture.',
    confirmLabel: 'Confirm Team Introduction',
  },
  {
    id: 'budget',
    order: '2',
    title: 'Owner briefing',
    eyebrow: 'Finance and budget',
    summary: 'Available money, spending priorities, and the financial runway for the first steps.',
    confirmLabel: 'Confirm Budget Review',
  },
  {
    id: 'driverLineup',
    order: '3',
    title: 'Team briefing',
    eyebrow: 'Driver line-up',
    summary: 'Your race drivers, reserves, and whether the grid is ready to go for Round 1.',
    confirmLabel: 'Confirm Race Lineup',
  },
  {
    id: 'carDevelopment',
    order: '4',
    title: 'Technical briefing',
    eyebrow: 'Car and development',
    summary: 'Launch plan, testing programme, readiness, and any hidden flaws to correct.',
    confirmLabel: 'Confirm Development Plan',
  },
  {
    id: 'sponsorsEngine',
    order: '5',
    title: 'Commercial briefing',
    eyebrow: 'Sponsors and engine',
    summary: 'Sponsor confidence and engine-supplier context before the race season begins.',
    confirmLabel: 'Confirm Sponsor & Engine Setup',
  },
  {
    id: 'seasonObjectives',
    order: '6',
    title: 'Owner mandate',
    eyebrow: 'Season objectives',
    summary: 'The results target, board expectations, and any mandate decisions to lock in.',
    confirmLabel: 'Confirm Season Objective',
  },
  {
    id: 'roundOnePreview',
    order: '7',
    title: 'Race 1 preview',
    eyebrow: 'Opening weekend',
    summary: 'Track demands and the first-race outlook so you know what is coming next.',
    confirmLabel: 'Confirm Round 1 Preview',
  },
];

const LAUNCH_OPTIONS: Array<{ id: CarLaunchApproach; label: string; description: string }> = [
  { id: 'Measured', label: 'Measured Reveal', description: 'Protect expectations and give engineers a calm start.' },
  { id: 'CommercialShowcase', label: 'Commercial Showcase', description: 'Prioritize sponsor confidence and public momentum.' },
  { id: 'PerformanceStatement', label: 'Performance Statement', description: 'Set an ambitious tone with greater pressure to deliver.' },
];

const TESTING_OPTIONS: Array<{ id: PreseasonTestingFocus; label: string; description: string }> = [
  { id: 'Balanced', label: 'Balanced Baseline', description: 'Steady gains across pace, reliability, operations, and knowledge.' },
  { id: 'Performance', label: 'Performance Runs', description: 'Prioritize outright pace with less durability work.' },
  { id: 'Reliability', label: 'Reliability Validation', description: 'Maximize mileage and the chance of discovering hidden flaws.' },
  { id: 'RaceOperations', label: 'Race Operations', description: 'Practice procedures, pit work, and Race 1 execution.' },
  { id: 'Experimental', label: 'Experimental Programme', description: 'Highest pace upside with extra reliability and flaw risk.' },
];

export function PreSeasonSetup() {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<PreseasonTab>('teamOverview');

  if (!state) return null;

  const team = teamById(state, state.selectedTeamId);
  const car = carForTeam(state, state.selectedTeamId);
  const drivers = driversForTeam(state, state.selectedTeamId);
  const activeDrivers = activeDriversForTeam(state, state.selectedTeamId);
  const minDrivers = minRaceDriversForSeries(state.series);
  const race = currentRace(state);
  const track = race ? getTrackById(race.trackId) : undefined;
  const carRatings = car ? effectiveCarRatings(car) : null;
  const slots = developmentSlots(state.facilities);
  const preseasonProgram = preseasonProgramFor(state);
  const preseasonHub = state.phase18?.preseason;
  const canConfirmDevelopment = !!preseasonProgram?.launchCompleted && !!preseasonProgram.testingCompleted;

  const isCareer = state.gameMode === 'Career';
  const isSingleSeason = state.gameMode === 'SingleSeason';

  const approvals = getPreseasonApprovals(state);
  const checklistComplete = isPreseasonChecklistComplete(state);

  const activeBriefing = PRESEASON_BRIEFINGS.find((briefing) => briefing.id === activeTab) ?? PRESEASON_BRIEFINGS[0];
  const approvedCount = Object.values(approvals).filter(Boolean).length;
  const totalTabs = PRESEASON_BRIEFINGS.length;

  const advanceToBriefing = () => {
    if (!checklistComplete) return;
    dispatch({ type: 'COMPLETE_PRESEASON_SETUP' });
    navigate('/briefing');
  };

  const approveTab = (tabId: PreseasonTab) => {
    dispatch({ type: 'APPROVE_PRESEASON_TAB', tabId });
    const currentIndex = PRESEASON_BRIEFINGS.findIndex((tab) => tab.id === tabId);
    const nextTab = PRESEASON_BRIEFINGS[currentIndex + 1];
    if (nextTab) setActiveTab(nextTab.id);
  };

  // Engine supplier info.
  const engineDeal = state.engine?.deals?.[state.selectedTeamId] ?? state.engine?.currentDeal;

  // Sponsors.
  const sponsors = state.commercial?.sponsors ?? [];

  // Season objectives (from team expectations).
  const expectation = state.teamExpectations?.[state.selectedTeamId];

  // Driver lineup validation: NASCAR requires 1 race driver, all other series 2.
  const hasValidLineup = activeDrivers.length >= minDrivers;
  const remainingApprovals = totalTabs - approvedCount;
  const advanceBlockedReason = checklistComplete ? undefined : `${remainingApprovals} review${remainingApprovals === 1 ? '' : 's'} remaining`;

  return (
    <WorkspaceScreen className="era-feature-screen era-preseason-setup-screen">
      <WorkspaceHeader
        eyebrow="Season preparation"
        title={`${state.seasonYear} ${state.series} Preseason Setup`}
        subtitle={<>{getGameModeLabel(state.gameMode)}{isSingleSeason && ' · Historical replay — management choices follow mode restrictions'}</>}
        actions={<>
          <Button variant="ghost" onClick={() => navigate('/hq')}>Manager Office</Button>
          <Button variant="primary" onClick={advanceToBriefing} disabled={!checklistComplete} title={advanceBlockedReason}>
            {checklistComplete ? 'Advance to Race 1 Briefing →' : `${remainingApprovals} reviews remaining`}
          </Button>
        </>}
      />
      <MetricStrip>
        <WorkspaceMetric label="Review progress" value={`${approvedCount}/${totalTabs}`} detail={checklistComplete ? 'Preseason checklist complete' : `${remainingApprovals} confirmations required`} />
        <WorkspaceMetric label="Available budget" value={team ? formatMoney(team.budget) : '—'} detail={preseasonProgram?.testingCompleted ? `${preseasonProgram.testingFocus} testing complete` : 'Testing programme not complete'} />
        <WorkspaceMetric label="Race line-up" value={`${activeDrivers.length}/${minDrivers}`} detail={hasValidLineup ? 'Required seats filled' : 'Driver signing required'} />
        <WorkspaceMetric label="Race 1 readiness" value={preseasonProgram?.testingCompleted ? `${preseasonProgram.readiness.overall}%` : 'Pending'} detail={race?.gpName ?? 'Opening event unavailable'} />
      </MetricStrip>
      <div className="ui-decision-strip flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <span className="ui-decision-strip-pulse" aria-hidden="true" />
          <div className="min-w-0">
            <div className="font-semibold text-neutral-100">Preseason operations desk</div>
            <div className="truncate text-neutral-400">
              {checklistComplete
                ? 'All preseason reviews are confirmed. The Race 1 briefing is ready to open.'
                : `${remainingApprovals} review${remainingApprovals === 1 ? '' : 's'} still need confirmation before the Race 1 briefing.`}
            </div>
          </div>
        </div>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          {preseasonProgram?.testingCompleted ? `${preseasonProgram.readiness.overall}% readiness` : 'Testing not complete'}
        </span>
      </div>
      <WorkspaceBody className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Panel title="Welcome to the season" actions={<span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Start here</span>}>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="space-y-3">
              <p className="text-sm text-neutral-300">
                This is your preseason onboarding desk: a quick introduction to the team, then a short set of season-start briefings to confirm before Round 1.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoBlock label="Team" value={team?.name ?? '—'} detail={`Reputation ${Math.round(team?.reputation ?? 0)} · Morale ${Math.round(team?.morale ?? 0)}%`} />
                <InfoBlock label="Team Principal" value={state.principal?.name ?? 'Your principal'} detail={`Level ${state.principal?.level ?? 0} · ${Math.round(state.principal?.reputation ?? 0)} reputation`} />
                <InfoBlock label="Budget" value={team ? formatMoney(team.budget) : '—'} detail={preseasonProgram?.testingCompleted ? `${preseasonProgram.testingFocus} testing complete` : 'Testing programme still pending'} />
                <InfoBlock label="Grid readiness" value={`${activeDrivers.length}/${minDrivers}`} detail={hasValidLineup ? 'Lineup is ready for Race 1' : 'Driver signing still required'} />
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Drivers</div>
                <div className="mt-2 space-y-2">
                  {activeDrivers.map((driver) => (
                    <div key={driver.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-neutral-200">{driver.name}</span>
                      <span className="text-neutral-500">#{driver.number} · OVR {driver.ratings.overall}</span>
                    </div>
                  ))}
                  {drivers.length > activeDrivers.length && (
                    <div className="text-xs text-neutral-500">
                      Reserve drivers: {drivers.slice(activeDrivers.length).map((driver) => driver.name).join(', ')}
                    </div>
                  )}
                </div>
              </div>
              {(() => {
                const regSet = getRegulationSet(state.regulationSetId);
                if (!regSet) return null;
                return <RegulationPanel regulationSet={regSet} seasonYear={state.seasonYear} locked={isSingleSeason} compact />;
              })()}
            </div>
          </div>
        </Panel>

        <div className="space-y-3">
          <Panel title="Season progress" actions={<span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{approvedCount}/{totalTabs} confirmed</span>}>
            <div className="space-y-2">
              {PRESEASON_BRIEFINGS.map((briefing, index) => {
                const approved = approvals[briefing.id];
                const isActive = activeTab === briefing.id;
                return (
                  <button
                    key={briefing.id}
                    type="button"
                    onClick={() => setActiveTab(briefing.id)}
                    className={`flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition ${
                      isActive
                        ? 'border-[var(--era-accent)] bg-[var(--era-accent-soft)]'
                        : 'border-neutral-800 bg-neutral-950/40 hover:border-neutral-700'
                    }`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900 text-xs font-bold text-neutral-200">
                      {approved ? '✓' : briefing.order}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-neutral-100">{briefing.title}</span>
                        <span className="text-[10px] uppercase tracking-wide text-neutral-500">{briefing.eyebrow}</span>
                      </span>
                      <span className="mt-1 block text-xs text-neutral-400">{briefing.summary}</span>
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                      {approved ? 'Done' : index === 0 ? 'Intro' : 'Next task'}
                    </span>
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>

      <div className="space-y-4">
        {activeTab === 'teamOverview' && (
          <BriefingPanel
            briefing={activeBriefing}
            status={approvals.teamOverview}
            onConfirm={() => approveTab('teamOverview')}
            confirmDisabled={approvals.teamOverview}
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <NewsPanel
                news={state.news}
                title="Season preview"
                maxItems={4}
                categoryFilter={['preseason', 'driver_market', 'financial']}
                emptyMessage="Season preview stories will appear here."
              />
              <NewsPanel
                news={state.news}
                title="Youth academy watch"
                maxItems={3}
                categoryFilter={['youth_academy']}
                emptyMessage="No youth academy news this season."
              />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <InfoBlock label="Reputation" value={Math.round(team?.reputation ?? 0)} detail="Owner expectations and early reputation" />
              <InfoBlock label="Morale" value={`${Math.round(team?.morale ?? 0)}%`} detail="How settled the team is entering preseason" />
            </div>
          </BriefingPanel>
        )}

        {activeTab === 'budget' && (
          <BriefingPanel
            briefing={activeBriefing}
            status={approvals.budget}
            onConfirm={() => approveTab('budget')}
            confirmDisabled={approvals.budget}
          >
            <div className="text-sm text-neutral-200">{team ? formatMoney(team.budget) : '—'}</div>
            <div className="mt-2 text-xs text-neutral-500">
              Race points generate {formatMoney(PRIZE_MONEY_PER_POINT)} in prize money per point. Budget is used for development, staff, facilities, and race packages.
            </div>
          </BriefingPanel>
        )}

        {activeTab === 'driverLineup' && (
          <BriefingPanel
            briefing={activeBriefing}
            status={approvals.driverLineup}
            onConfirm={() => approveTab('driverLineup')}
            confirmDisabled={approvals.driverLineup || !hasValidLineup}
            secondaryAction={!hasValidLineup ? <Button variant="secondary" onClick={() => navigate('/market')}>Visit Driver Market</Button> : undefined}
          >
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
            </ul>
            {!hasValidLineup && (
              <div className="mt-3 rounded-lg bg-orange-950/30 p-3 text-sm text-orange-300">
                <p className="font-semibold">Incomplete Lineup</p>
                <p className="text-xs">
                  Your team requires {minDrivers} active race driver{minDrivers === 1 ? '' : 's'}. Visit the Driver Market to sign {minDrivers === 1 ? 'a driver' : 'a second driver'}.
                </p>
              </div>
            )}
          </BriefingPanel>
        )}

        {activeTab === 'carDevelopment' && (
          <BriefingPanel
            briefing={activeBriefing}
            status={approvals.carDevelopment}
            onConfirm={() => approveTab('carDevelopment')}
            confirmDisabled={approvals.carDevelopment || !canConfirmDevelopment}
          >
            {carRatings && (
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <StatChip label="Power" value={carRatings.enginePower.toFixed(1)} />
                <StatChip label="Aero" value={carRatings.aeroEfficiency.toFixed(1)} />
                <StatChip label="Grip" value={carRatings.mechanicalGrip.toFixed(1)} />
                <StatChip label="Reliability" value={carRatings.reliability.toFixed(1)} />
                <StatChip label="Pit Crew" value={carRatings.pitCrewOperations.toFixed(1)} />
              </div>
            )}
            <div className="mt-5 space-y-4 border-t border-neutral-800 pt-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-neutral-100">Car launch</h3>
                  <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${preseasonProgram?.launchCompleted ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>{preseasonProgram?.launchCompleted ? preseasonProgram.launchApproach : 'Decision required'}</span>
                </div>
                <p className="mt-1 text-xs text-neutral-500">The launch sets sponsor expectations, team morale, and the public tone before testing.</p>
                {!preseasonProgram?.launchCompleted && <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {LAUNCH_OPTIONS.map((option) => <button key={option.id} type="button" onClick={() => dispatch({ type: 'COMPLETE_CAR_LAUNCH', approach: option.id })} className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-3 text-left hover:border-[var(--era-accent)]"><div className="text-xs font-semibold text-[var(--era-accent-strong)]">{option.label}</div><p className="mt-1 text-[11px] text-neutral-400">{option.description}</p></button>)}
                </div>}
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-neutral-100">Testing programme</h3>
                  <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${preseasonProgram?.testingCompleted ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>{preseasonProgram?.testingCompleted ? preseasonProgram.testingFocus : preseasonProgram?.launchCompleted ? 'Choose focus' : 'Launch first'}</span>
                </div>
                {!preseasonProgram?.testingCompleted && <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                  {TESTING_OPTIONS.map((option) => {
                    const cost = isSingleSeason ? 0 : PRESEASON_TESTING_COST[option.id];
                    const insufficientBudget = (team?.budget ?? 0) < cost;
                    const blockedReason = !preseasonProgram?.launchCompleted ? 'Complete the car launch first' : insufficientBudget ? `Needs ${formatMoney(cost)}` : undefined;
                    return <button key={option.id} type="button" disabled={!preseasonProgram?.launchCompleted || insufficientBudget} title={blockedReason} onClick={() => dispatch({ type: 'COMPLETE_PRESEASON_TESTING', focus: option.id })} className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-3 text-left enabled:hover:border-amber-500/60 disabled:cursor-not-allowed disabled:opacity-40"><div className="text-xs font-semibold text-amber-300">{option.label}</div><p className="mt-1 text-[11px] text-neutral-400">{option.description}</p><div className={`mt-2 text-[10px] ${insufficientBudget ? 'text-red-300' : 'text-neutral-500'}`}>{blockedReason ?? (cost ? formatMoney(cost) : 'Included')}</div></button>;
                  })}
                </div>}
                {preseasonProgram?.testingCompleted && <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {preseasonProgram.testingReports.map((report) => <div key={report.day} className="rounded border border-neutral-800 bg-neutral-900/45 p-3"><div className="text-xs font-semibold text-neutral-100">{report.headline}</div><p className="mt-1 text-[11px] text-neutral-400">{report.summary}</p><div className="mt-2 flex justify-between text-[10px] text-neutral-500"><span>Pace {report.paceSignal}</span><span>Reliability {report.reliabilitySignal}</span><span>Confidence {report.confidence}%</span></div></div>)}
                </div>}
              </div>
              {preseasonProgram?.testingCompleted && <div>
                <h3 className="text-sm font-semibold text-neutral-100">Race 1 readiness</h3>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <ReadinessChip label="Overall" value={preseasonProgram.readiness.overall} />
                  <ReadinessChip label="Pace" value={preseasonProgram.readiness.pace} />
                  <ReadinessChip label="Reliability" value={preseasonProgram.readiness.reliability} />
                  <ReadinessChip label="Operations" value={preseasonProgram.readiness.operations} />
                  <ReadinessChip label="Knowledge" value={preseasonProgram.readiness.knowledge} />
                </div>
              </div>}
              {preseasonProgram?.hiddenFlaws.some((flaw) => flaw.discovered) && <div className="rounded-lg border border-orange-500/35 bg-orange-500/5 p-3">
                <h3 className="text-sm font-semibold text-orange-200">Discovered technical issues</h3>
                <div className="mt-2 space-y-2">{preseasonProgram.hiddenFlaws.filter((flaw) => flaw.discovered).map((flaw) => { const insufficientBudget = (team?.budget ?? 0) < PRESEASON_FLAW_FIX_COST; return <div key={flaw.id} className="flex flex-wrap items-center justify-between gap-2 text-xs"><div><span className="font-semibold text-neutral-200">{flaw.area}</span><span className="ml-2 text-neutral-400">{flaw.description}</span></div>{flaw.resolved ? <span className="text-emerald-300">Corrected</span> : <Button variant="ghost" className="px-2 py-1 text-[11px]" disabled={insufficientBudget} title={insufficientBudget ? `Needs ${formatMoney(PRESEASON_FLAW_FIX_COST)}` : undefined} onClick={() => dispatch({ type: 'RESOLVE_PRESEASON_FLAW', flawId: flaw.id })}>{insufficientBudget ? `Insufficient budget · ${formatMoney(PRESEASON_FLAW_FIX_COST)}` : `Correct before Race 1 (${formatMoney(PRESEASON_FLAW_FIX_COST)})`}</Button>}</div>; })}</div>
              </div>}
            </div>
            <div className="mt-3 text-sm text-neutral-400">
              Car condition: {Math.round(car?.condition ?? 0)}%
            </div>
            <div className="mt-4 text-sm text-neutral-300">
              <span className="text-neutral-200">{slots}</span> development slot(s) available.
              {activeUpgradePrograms(state).length > 0 && (
                <span className="text-neutral-500"> · {activeUpgradePrograms(state).length} project(s) active.</span>
              )}
            </div>
            {isCareer && (
              <div className="mt-2 text-xs text-neutral-500">
                Visit the Development screen to assign projects to available slots.
              </div>
            )}
          </BriefingPanel>
        )}

        {activeTab === 'sponsorsEngine' && (
          <BriefingPanel
            briefing={activeBriefing}
            status={approvals.sponsorsEngine}
            onConfirm={() => approveTab('sponsorsEngine')}
            confirmDisabled={approvals.sponsorsEngine}
          >
            <div className="space-y-4">
              <div>
                <div className="text-xs font-semibold uppercase text-neutral-500 mb-2">Sponsors</div>
                {isSingleSeason && (
                  <div className="mb-2 rounded-md bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
                    Sponsors are locked to historical data for Single Season mode.
                  </div>
                )}
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
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-neutral-500 mb-2">Engine Supplier</div>
                {isSingleSeason && (
                  <div className="mb-2 rounded-md bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
                    Engine supplier is locked to historical data for Single Season mode.
                  </div>
                )}
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
              </div>
            </div>
          </BriefingPanel>
        )}

        {activeTab === 'seasonObjectives' && (
          <BriefingPanel
            briefing={activeBriefing}
            status={approvals.seasonObjectives}
            onConfirm={() => approveTab('seasonObjectives')}
            confirmDisabled={approvals.seasonObjectives || (!isSingleSeason && !state.boardroom?.mandate)}
          >
            {expectation ? (
              <div className="space-y-1 text-sm">
                {state.teamReputations?.[state.selectedTeamId]?.ownerPersonality && (
                  <div className="mb-2 rounded bg-neutral-800/50 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-300">Owner type</span>
                      <span className="font-semibold text-neutral-100">{OWNER_PERSONALITY_LABELS[state.teamReputations[state.selectedTeamId].ownerPersonality!]}</span>
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">{OWNER_PERSONALITY_DESCRIPTIONS[state.teamReputations[state.selectedTeamId].ownerPersonality!]}</div>
                  </div>
                )}
                <div className="text-neutral-200">{expectation.primaryObjective}</div>
                {expectation.secondaryObjectives.length > 0 && (
                  <div className="text-neutral-400">{expectation.secondaryObjectives.join(', ')}</div>
                )}
                {expectation.minimumConstructorPosition && (
                  <div className="text-xs text-neutral-500">Target: P{expectation.minimumConstructorPosition} or better</div>
                )}
                {!isSingleSeason && !state.boardroom?.mandate && (
                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    {(Object.keys(MANDATE_OPTIONS) as BoardroomMandateLevel[]).map((mandate) => (
                      <button
                        key={mandate}
                        type="button"
                        onClick={() => dispatch({ type: 'SELECT_BOARDROOM_MANDATE', mandate })}
                        className="rounded-lg border border-neutral-700 bg-neutral-950/40 p-3 text-left hover:border-emerald-500/50"
                      >
                        <div className="font-semibold text-neutral-100">{mandate}</div>
                        <div className="mt-1 text-xs text-neutral-400">{MANDATE_OPTIONS[mandate].description}</div>
                        <div className="mt-2 text-xs text-emerald-300">${MANDATE_OPTIONS[mandate].fundingMillions}M support</div>
                      </button>
                    ))}
                  </div>
                )}
                {state.boardroom?.mandate && (
                  <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-200">
                    {state.boardroom.mandate} mandate agreed · ${state.boardroom.mandateFundingMillions ?? 0}M support · {state.boardroom.mandateJobRisk ?? 'Standard'} job risk
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">
                {isSingleSeason ? 'Historical replay mode — no custom objectives.' : 'Objectives will be set based on team reputation.'}
              </p>
            )}
          </BriefingPanel>
        )}

        {activeTab === 'roundOnePreview' && (
          <BriefingPanel
            briefing={activeBriefing}
            status={approvals.roundOnePreview}
            onConfirm={() => approveTab('roundOnePreview')}
            confirmDisabled={approvals.roundOnePreview}
          >
            {race && track ? (
              <>
                <div className="text-sm text-neutral-200">{race.gpName} — {race.trackName}</div>
                <div className="text-xs text-neutral-500">{track.archetype} · Round {race.round}</div>
                <div className="mt-3">
                  <TrackDemandBars track={track} />
                </div>
                {preseasonProgram?.testingCompleted && <div className="mt-4 rounded-lg border border-[var(--era-accent)]/35 bg-[var(--era-accent-soft)] p-3">
                  <div className="flex items-center justify-between"><span className="text-sm font-semibold text-[var(--era-accent-strong)]">Your Race 1 readiness</span><span className="text-lg font-bold text-neutral-100">{preseasonProgram.readiness.overall}%</span></div>
                  <p className="mt-1 text-xs text-neutral-400">Testing readiness modifies the opening-round car baseline. Any unresolved hidden flaw can reduce reliability.</p>
                </div>}
                {(preseasonHub?.rivalReports.length ?? 0) > 0 && <div className="mt-4">
                  <h3 className="text-sm font-semibold text-neutral-100">Rival testing watch</h3>
                  <p className="mt-1 text-xs text-neutral-500">Fuel loads and run plans are unknown. Treat every claim as an estimate.</p>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">{preseasonHub!.rivalReports.slice(0, 4).map((report) => <div key={report.id} className="rounded border border-neutral-800 bg-neutral-900/45 p-2.5"><div className="flex justify-between gap-2 text-[10px] uppercase text-neutral-500"><span>{state.teams.find((entry) => entry.id === report.teamId)?.name ?? report.teamId}</span><span>{report.assessment} · {report.confidence}%</span></div><p className="mt-1 text-xs text-neutral-300">{report.claim}</p></div>)}</div>
                </div>}
              </>
            ) : (
              <p className="text-sm text-neutral-500">Race data not available.</p>
            )}
          </BriefingPanel>
        )}
      </div>
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}

function BriefingPanel({
  briefing,
  status,
  onConfirm,
  confirmDisabled,
  secondaryAction,
  children,
}: {
  briefing: { title: string; eyebrow: string; confirmLabel: string };
  status: boolean;
  onConfirm: () => void;
  confirmDisabled: boolean;
  secondaryAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Panel
      title={briefing.title}
      actions={<span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{briefing.eyebrow}</span>}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-xs">
        <span className={status ? 'text-emerald-300' : 'text-neutral-400'}>{status ? 'Briefing confirmed' : 'Review and confirm when ready'}</span>
        <span className="text-neutral-500">A short season-start task, not a permanent setting.</span>
      </div>
      {children}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {secondaryAction}
        <Button variant="primary" onClick={onConfirm} disabled={confirmDisabled}>
          {status ? 'Confirmed' : briefing.confirmLabel}
        </Button>
      </div>
    </Panel>
  );
}

function InfoBlock({ label, value, detail }: { label: string; value: ReactNode; detail: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-3">
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-neutral-100">{value}</div>
      <div className="mt-1 text-xs text-neutral-500">{detail}</div>
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

function ReadinessChip({ label, value }: { label: string; value: number }) {
  const tone = value >= 75 ? 'text-emerald-300' : value >= 60 ? 'text-[var(--era-accent-strong)]' : value >= 45 ? 'text-amber-300' : 'text-red-300';
  return <div className="rounded border border-neutral-800 bg-neutral-900/45 px-3 py-2 text-center"><div className="text-[10px] uppercase text-neutral-500">{label}</div><div className={`mt-1 text-lg font-bold ${tone}`}>{value}</div></div>;
}
