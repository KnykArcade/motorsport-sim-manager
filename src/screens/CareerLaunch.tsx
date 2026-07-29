import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import { formatMoney } from '../components/ui';
import {
  MetricStrip,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceMetric,
  WorkspaceScreen,
} from '../components/workspace/Workspace';
import { useGame } from '../game/GameContext';
import {
  activeDriversForTeam,
  carForTeam,
  currentRace,
  minRaceDriversForSeries,
  teamById,
} from '../game/careerState';
import {
  careerLaunchState,
} from '../game/careerPhaseEngine';
import { getGameModeLabel, SINGLE_SEASON_LOCKED_FEATURES } from '../game/modeRestrictions';
import { effectiveCarRatings } from '../sim/trackFitEngine';
import {
  OWNER_PERSONALITY_DESCRIPTIONS,
  OWNER_PERSONALITY_LABELS,
} from '../types/expectationTypes';
import type { CareerLaunchStep } from '../types/careerPhaseTypes';

const LAUNCH_STEPS: ReadonlyArray<{
  id: CareerLaunchStep;
  label: string;
  detail: string;
}> = [
  { id: 'appointment', label: 'Appointment', detail: 'Your new role and career rules' },
  { id: 'teamHandover', label: 'Team Handover', detail: 'People, car, budget, and departments' },
  { id: 'ownerIntroduction', label: 'Meet the Owner', detail: 'Expectations and job security' },
  { id: 'firstWeekPlan', label: 'First Week', detail: 'Three decisions before Race 1' },
];

const NEXT_LABEL: Record<CareerLaunchStep, string> = {
  appointment: 'Meet Your Team →',
  teamHandover: 'Meet the Owner →',
  ownerIntroduction: 'Review First-Week Plan →',
  firstWeekPlan: 'Acknowledge Welcome Pack & Start →',
};

export function CareerLaunch() {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  const [reviewedStep, setReviewedStep] = useState<CareerLaunchStep>();
  if (!state) return null;

  const launch = careerLaunchState(state);
  if (!launch) return null;

  const team = teamById(state, state.selectedTeamId);
  const car = carForTeam(state, state.selectedTeamId);
  const drivers = activeDriversForTeam(state, state.selectedTeamId);
  const minimumDrivers = minRaceDriversForSeries(state.series);
  const expectation = state.teamExpectations?.[state.selectedTeamId];
  const reputation = state.teamReputations?.[state.selectedTeamId];
  const organisation = state.teamOrgRatings?.[state.selectedTeamId];
  const race = currentRace(state);
  const ratings = car ? effectiveCarRatings(car) : undefined;
  const stepIndex = LAUNCH_STEPS.findIndex((step) => step.id === launch.currentStep);
  const displayStep = reviewedStep ?? launch.currentStep;
  const reviewingCompletedStep = displayStep !== launch.currentStep;

  const departments = [
    { label: 'Technical research', value: organisation?.research ?? 0 },
    { label: 'Race operations', value: organisation?.operations ?? 0 },
    { label: 'Reliability', value: organisation?.reliabilityDepartment ?? 0 },
    { label: 'Pit crew', value: organisation?.pitCrew ?? 0 },
    { label: 'Staff quality', value: organisation?.staffQuality ?? 0 },
    { label: 'Scouting', value: organisation?.scouting ?? 0 },
  ].sort((a, b) => a.value - b.value);

  const advance = () => {
    setReviewedStep(undefined);
    if (launch.currentStep === 'firstWeekPlan') {
      dispatch({ type: 'COMPLETE_CAREER_LAUNCH' });
      navigate('/preseason?task=driverLineup');
      return;
    }
    dispatch({ type: 'ADVANCE_CAREER_LAUNCH' });
  };

  return (
    <WorkspaceScreen className="era-feature-screen ui-career-launch-screen">
      <WorkspaceHeader
        eyebrow="First day"
        title={displayStep === 'appointment'
          ? `Welcome to ${team?.name ?? 'your new team'}`
          : `${team?.name ?? 'Team'} · First-Day Briefing`}
        subtitle={`${state.seasonYear} ${state.series} · ${getGameModeLabel(state.gameMode)}`}
        actions={(
          <Button
            variant="primary"
            onClick={reviewingCompletedStep ? () => setReviewedStep(undefined) : advance}
          >
            {reviewingCompletedStep
              ? `Return to ${LAUNCH_STEPS[stepIndex]?.label ?? 'Current Step'} →`
              : NEXT_LABEL[launch.currentStep]}
          </Button>
        )}
      />
      <MetricStrip>
        <WorkspaceMetric label="Team Principal" value={state.principal?.name ?? state.teamPrincipal?.name ?? 'You'} detail={`Reputation ${Math.round(state.principal?.reputation ?? 0)}`} />
        <WorkspaceMetric label="Appointment" value={team?.name ?? '—'} detail={`${state.series} · ${state.seasonYear}`} />
        <WorkspaceMetric label="Opening race" value={race?.gpName ?? '—'} detail={race ? `Round ${race.round} · ${race.trackName}` : 'Calendar unavailable'} />
        <WorkspaceMetric label="Job security" value={`${Math.round(state.principal?.jobSecurity ?? 0)}%`} detail={`${state.principal?.contractYearsRemaining ?? 0}-year contract`} />
      </MetricStrip>

      <WorkspaceBody className="ui-career-launch-workspace">
        <aside className="ui-career-launch-rail" aria-label="First-day progress">
          <div className="ui-career-launch-rail-heading">Your first day</div>
          {LAUNCH_STEPS.map((step, index) => {
            const status = index < stepIndex ? 'is-complete' : index === stepIndex ? 'is-active' : 'is-upcoming';
            return (
              <button
                key={step.id}
                type="button"
                className={`ui-career-launch-step ${status} ${displayStep === step.id ? 'is-viewing' : ''}`}
                disabled={index > stepIndex}
                aria-current={displayStep === step.id ? 'step' : undefined}
                onClick={() => setReviewedStep(index === stepIndex ? undefined : step.id)}
              >
                <span>{index < stepIndex ? '✓' : index + 1}</span>
                <div>
                  <strong>{step.label}</strong>
                  <small>{step.detail}</small>
                </div>
              </button>
            );
          })}
          <div className="ui-career-launch-rail-note">
            This introduction appears only for a newly created career. Existing saves continue from their current work.
          </div>
        </aside>

        <main className="ui-career-launch-content">
          {displayStep === 'appointment' && (
            <Panel title="Your appointment" actions={<StatusTag label="Contract confirmed" tone="green" />}>
              <div className="ui-career-launch-hero">
                <div>
                  <div className="ui-career-launch-kicker">{state.seasonYear} {state.series}</div>
                  <h2>{state.principal?.name ?? state.teamPrincipal?.name ?? 'Team Principal'}, welcome to {team?.name ?? 'the team'}.</h2>
                  <p>
                    Ownership has appointed you to lead the race team, manage its people and resources,
                    and take every consequential decision from preseason through the championship.
                  </p>
                </div>
                <div className="ui-career-launch-team-mark" style={{ borderColor: team?.color, color: team?.color }}>
                  {team?.name.slice(0, 2).toUpperCase() ?? 'TM'}
                </div>
              </div>
              <div className="ui-career-launch-facts">
                <LaunchFact label="Role" value="Team Principal" detail="Full sporting and operational control" />
                <LaunchFact label="Game mode" value={getGameModeLabel(state.gameMode)} detail={modeRuleSummary(state.gameMode)} />
                <LaunchFact label="Championship" value={`${state.seasonYear} ${state.series}`} detail={`${state.calendar.length} scheduled rounds`} />
                <LaunchFact label="Career rules" value={state.careerMobilityMode === 'TeamLock' ? 'Team locked' : 'Standard mobility'} detail="Existing race-engine and management systems remain active" />
              </div>
              {state.gameMode === 'SingleSeason' && (
                <div className="ui-career-launch-rule-note">
                  <strong>Historical replay rules</strong>
                  <span>{SINGLE_SEASON_LOCKED_FEATURES.map((feature) => feature.label).join(', ')} remain locked for this one-season save.</span>
                </div>
              )}
            </Panel>
          )}

          {displayStep === 'teamHandover' && (
            <div className="ui-career-launch-panel-grid">
              <Panel title="Team handover" actions={<StatusTag label={`${drivers.length}/${minimumDrivers} race seats`} tone={drivers.length >= minimumDrivers ? 'green' : 'amber'} />}>
                <div className="ui-career-launch-driver-list">
                  {drivers.map((driver) => (
                    <div key={driver.id}>
                      <span className="ui-career-launch-number">#{driver.number}</span>
                      <div><strong>{driver.name}</strong><small>Overall {driver.ratings.overall} · Morale {Math.round(driver.morale)}%</small></div>
                    </div>
                  ))}
                </div>
                <div className="ui-career-launch-facts is-compact">
                  <LaunchFact label="Available budget" value={team ? formatMoney(team.budget) : '—'} detail="Funds every department and preseason decision" />
                  <LaunchFact label="Organisation" value={`${Math.round(organisation?.overallTeamRating ?? 0)}/100`} detail={`Reputation ${Math.round(team?.reputation ?? 0)}`} />
                </div>
              </Panel>
              <Panel title="Car baseline" actions={<StatusTag label={`${Math.round(car?.condition ?? 0)}% condition`} tone="neutral" />}>
                <div className="ui-career-launch-rating-grid">
                  <LaunchRating label="Power" value={ratings?.enginePower ?? 0} />
                  <LaunchRating label="Aero" value={ratings?.aeroEfficiency ?? 0} />
                  <LaunchRating label="Grip" value={ratings?.mechanicalGrip ?? 0} />
                  <LaunchRating label="Reliability" value={ratings?.reliability ?? 0} />
                  <LaunchRating label="Pit crew" value={ratings?.pitCrewOperations ?? 0} />
                </div>
              </Panel>
              <Panel title="Immediate weaknesses" actions={<span className="text-[10px] uppercase tracking-wide text-neutral-500">Lowest departments</span>}>
                <div className="ui-career-launch-departments">
                  {departments.slice(0, 3).map((department) => (
                    <div key={department.label}>
                      <span>{department.label}</span>
                      <strong>{Math.round(department.value)}/100</strong>
                      <div><i style={{ width: `${Math.max(0, Math.min(100, department.value))}%` }} /></div>
                    </div>
                  ))}
                </div>
                <p className="ui-career-launch-footnote">These are real organisation ratings. They affect technical work, operations, recruitment, and race execution.</p>
              </Panel>
            </div>
          )}

          {displayStep === 'ownerIntroduction' && (
            <div className="ui-career-launch-panel-grid">
              <Panel title="Owner introduction" actions={<StatusTag label={reputation?.ownerPersonality ? OWNER_PERSONALITY_LABELS[reputation.ownerPersonality] : 'Ownership'} tone="neutral" />}>
                <div className="ui-career-launch-owner">
                  <div className="ui-career-launch-owner-mark">OWNER</div>
                  <div>
                    <h2>{expectation?.primaryObjective ?? 'Establish a competitive foundation.'}</h2>
                    <p>{reputation?.ownerPersonality ? OWNER_PERSONALITY_DESCRIPTIONS[reputation.ownerPersonality] : 'Ownership expects disciplined management and visible progress.'}</p>
                  </div>
                </div>
                {expectation?.secondaryObjectives.length ? (
                  <ul className="ui-career-launch-objectives">
                    {expectation.secondaryObjectives.map((objective) => <li key={objective}>{objective}</li>)}
                  </ul>
                ) : null}
              </Panel>
              <Panel title="Your starting position">
                <div className="ui-career-launch-facts">
                  <LaunchFact label="Job security" value={`${Math.round(state.principal?.jobSecurity ?? 0)}%`} detail="Changes with results, ownership confidence, and promises" />
                  <LaunchFact label="Owner patience" value={`${Math.round(expectation?.ownerPatience ?? reputation?.ownerPatience ?? 0)}%`} detail="How much time ownership will allow" />
                  <LaunchFact label="Season target" value={expectation?.minimumConstructorPosition ? `P${expectation.minimumConstructorPosition} or better` : 'Objective-led'} detail="Confirmed in your first-week owner mandate" />
                  <LaunchFact label="Team identity" value={`${Math.round(team?.reputation ?? 0)} reputation`} detail={`${Math.round(reputation?.historicalPrestige ?? 0)} historical prestige`} />
                </div>
              </Panel>
              <div className="ui-career-launch-owner-note">
                The owner briefing is information, not a hidden decision. Your meaningful choice comes next when you select the season mandate and its funding-versus-risk level.
              </div>
            </div>
          )}

          {displayStep === 'firstWeekPlan' && (
            <div className="ui-career-launch-panel-grid">
              <Panel title="Your first management week" actions={<StatusTag label="3 decisions" tone="amber" />}>
                <p className="ui-career-launch-intro">
                  Your Welcome Pack combines the routine team, budget, commercial, and opening-race reports.
                  After acknowledging it, the game will take you directly through the three decisions that matter.
                </p>
                <div className="ui-career-launch-task-list">
                  <LaunchTask number="1" title="Confirm the race lineup" detail={`${drivers.length}/${minimumDrivers} required race seats currently filled.`} route="Drivers & contracts" />
                  <LaunchTask number="2" title="Launch and test the car" detail="Choose the public launch approach, testing focus, and confirm the technical plan." route="Technical team" />
                  <LaunchTask number="3" title="Agree the owner mandate" detail="Choose the funding level, performance expectation, and job-security risk." route="Owner & board" />
                </div>
              </Panel>
              <Panel title="Then: Race 1 preparation">
                <div className="ui-career-launch-next-event">
                  <span>Opening event</span>
                  <strong>{race?.gpName ?? 'Race 1'}</strong>
                  <small>{race ? `${race.trackName} · Round ${race.round}` : 'Calendar details unavailable'}</small>
                </div>
                <ol className="ui-career-launch-sequence">
                  <li>Finish the three first-week decisions.</li>
                  <li>Open the Race 1 briefing automatically.</li>
                  <li>Set preparation focus and enter the race weekend.</li>
                </ol>
              </Panel>
              <div className="ui-career-launch-ready">
                <div>
                  <strong>Ready to begin</strong>
                  <span>No routine choice will be made for you. The Welcome Pack only acknowledges information already shown in this first-day briefing.</span>
                </div>
                <Button variant="primary" onClick={advance}>Acknowledge Welcome Pack & Start First Week →</Button>
              </div>
            </div>
          )}
        </main>
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}

function modeRuleSummary(mode: 'Career' | 'SingleSeason' | 'Sandbox'): string {
  if (mode === 'Career') return 'Multi-season career with offseason progression';
  if (mode === 'SingleSeason') return 'One historical season with long-term systems locked';
  return 'Flexible career with all management systems available';
}

function StatusTag({ label, tone }: { label: string; tone: 'green' | 'amber' | 'neutral' }) {
  return <span className={`ui-career-launch-status is-${tone}`}>{label}</span>;
}

function LaunchFact({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="ui-career-launch-fact"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function LaunchRating({ label, value }: { label: string; value: number }) {
  return <div><span>{label}</span><strong>{value.toFixed(1)}</strong></div>;
}

function LaunchTask({ number, title, detail, route }: { number: string; title: string; detail: string; route: string }) {
  return <div><span>{number}</span><div><strong>{title}</strong><p>{detail}</p></div><small>{route}</small></div>;
}
