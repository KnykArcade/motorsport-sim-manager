import { useMemo, useState } from 'react';
import { useGame } from '../game/GameContext';
import { Panel } from '../components/Panel';
import { DriverDossierButton } from '../components/driverCards/DriverDossier';
import {
  createDriverDevelopmentCurve,
  developmentPhase,
  driverAge,
  projectTrajectory,
  type DevelopmentPhase,
} from '../sim/developmentCurveEngine';
import type { Driver } from '../types/gameTypes';
import type { DriverDevelopmentCurve } from '../types/developmentCurveTypes';
import {
  DRIVER_DEVELOPMENT_FOCUS_DESCRIPTIONS,
  DRIVER_DEVELOPMENT_FOCUS_LABELS,
  type DriverDevelopmentFocus,
} from '../types/developmentCurveTypes';
import {
  developmentRecommendation,
  mentorCandidates,
  planForDriver,
  testingAllocationUsed,
  TOTAL_TESTING_ALLOCATION,
} from '../sim/driverDevelopmentPlanEngine';
import { CURVE_PAGE_SIZE, compactPage, pageCount } from './seasonOverviewViewModel';
import {
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';
import {
  FmKeyValue,
  FmListButton,
  FmPane,
  FmPaneBody,
  FmPaneHeader,
  FmWorkspaceGrid,
} from '../components/workspace/FmPane';
import { selectedDriver } from './driversViewModel';

type Tab = 'mine' | 'grid';

const PHASE_TONE: Record<DevelopmentPhase, string> = {
  Developing: 'bg-green-500/15 text-green-300',
  Peak: 'bg-amber-500/15 text-amber-300',
  Declining: 'bg-red-500/15 text-red-300',
};

export function DriverCurves() {
  const { state, dispatch } = useGame();
  const [tab, setTab] = useState<Tab>('mine');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string>();

  const curves = useMemo(() => state?.developmentCurves ?? {}, [state]);

  if (!state) return null;

  const seed = state.randomSeed;
  const curveFor = (d: Driver): DriverDevelopmentCurve =>
    curves[d.id] ?? createDriverDevelopmentCurve(d, seed);

  const mine = state.drivers.filter((d) => d.teamId === state.selectedTeamId);
  const shown = tab === 'mine' ? mine : state.drivers;
  const sorted = [...shown]
    .map((driver) => ({ driver, curve: curveFor(driver), age: driverAge(driver, seed) }))
    .sort((a, b) => b.driver.ratings.overall - a.driver.ratings.overall);
  const tabPageCount = pageCount(sorted.length, CURVE_PAGE_SIZE);
  const safePage = Math.min(page, tabPageCount - 1);
  const visibleDrivers = compactPage(sorted, safePage, CURVE_PAGE_SIZE);
  const academySubjects = tab === 'mine'
    ? (state.academy ?? []).map((member) => ({
      id: member.id,
      name: member.name,
      role: 'Academy',
      driver: undefined,
      curve: undefined,
      age: undefined,
    }))
    : [];
  const visibleSubjects = [
    ...visibleDrivers.map((item) => ({
      id: item.driver.id,
      name: item.driver.name,
      role: item.driver.contractType === 'reserve' || item.driver.contractType === 'third' || item.driver.contractType === 'test'
        ? 'Reserve / test'
        : 'Race driver',
      driver: item.driver,
      curve: item.curve,
      age: item.age,
    })),
    ...academySubjects,
  ];
  const selectedSubject = selectedDriver(visibleSubjects, selectedId);
  const phaseCounts = sorted.reduce(
    (counts, item) => {
      counts[developmentPhase(item.curve, item.age)] += 1;
      return counts;
    },
    { Developing: 0, Peak: 0, Declining: 0 } as Record<DevelopmentPhase, number>,
  );

  function selectTab(nextTab: Tab) {
    setTab(nextTab);
    setPage(0);
    setSelectedId(undefined);
  }

  return (
    <WorkspaceScreen className="era-feature-screen era-driver-curves-screen ui-team-people-screen">
      <WorkspaceHeader
        eyebrow="Driver intelligence"
        title="Development Curves"
        subtitle="Track current ability, projected ceilings, and the age curve shaping every driver."
      />
      <WorkspaceTabs
        items={[
          { id: 'mine' as const, label: `Your Drivers · ${mine.length}` },
          { id: 'grid' as const, label: `Grid · ${state.drivers.length}` },
        ]}
        active={tab}
        onChange={selectTab}
        ariaLabel="Driver development views"
      />
      <WorkspaceBody className="overflow-hidden">
        <FmWorkspaceGrid columns="three">
          <FmPane>
            <FmPaneHeader title={tab === 'mine' ? 'Development Plans' : 'Grid Development'} meta={`${visibleSubjects.length} in view`} />
            <FmPaneBody className="overflow-auto">
              {visibleSubjects.map((subject) => {
                const phase = subject.driver && subject.curve && subject.age != null
                  ? developmentPhase(subject.curve, subject.age)
                  : undefined;
                return (
                  <FmListButton key={subject.id} active={selectedSubject?.id === subject.id} onClick={() => setSelectedId(subject.id)}>
                    <span className="ui-news-list-source">{subject.role}{phase ? ` · ${phase}` : ''}</span>
                    <strong>{subject.name}</strong>
                    <span>{subject.driver ? `OVR ${subject.driver.ratings.overall.toFixed(1)} · age ${subject.age}` : 'Academy development programme'}</span>
                    <small>{subject.curve ? `Ceiling ${subject.curve.potentialCeiling.toFixed(1)}` : 'Long-term development plan'}</small>
                  </FmListButton>
                );
              })}
              {visibleSubjects.length === 0 && <div className="ui-inbox-empty">No development subjects are available.</div>}
            </FmPaneBody>
            {tab === 'grid' && (
              <div className="ui-team-list-pagination">
                <button type="button" onClick={() => { setPage(Math.max(0, safePage - 1)); setSelectedId(undefined); }} disabled={safePage === 0}>Previous</button>
                <span>{safePage + 1} / {tabPageCount}</span>
                <button type="button" onClick={() => { setPage(Math.min(tabPageCount - 1, safePage + 1)); setSelectedId(undefined); }} disabled={safePage >= tabPageCount - 1}>Next</button>
              </div>
            )}
          </FmPane>
          <FmPane className="ui-driver-profile-pane">
            {selectedSubject ? (
              <>
                <FmPaneHeader title={selectedSubject.name} meta={selectedSubject.role} />
                <FmPaneBody className="ui-driver-profile-body overflow-auto">
                  {selectedSubject.driver && selectedSubject.curve && selectedSubject.age != null && (
                    <CurveCard driver={selectedSubject.driver} curve={selectedSubject.curve} age={selectedSubject.age} />
                  )}
                  {tab === 'mine' && (
                    <DevelopmentPlanEditor
                      state={state}
                      dispatch={dispatch}
                      subject={{ id: selectedSubject.id, name: selectedSubject.name, role: selectedSubject.role }}
                    />
                  )}
                </FmPaneBody>
              </>
            ) : <FmPaneBody className="ui-inbox-empty">Select a driver to review development.</FmPaneBody>}
          </FmPane>
          <FmPane>
            <FmPaneHeader title="Staff Context" meta="Development department" />
            <FmPaneBody className="ui-team-context-pane overflow-auto">
              <section>
                <h3>Programme capacity</h3>
                <FmKeyValue label="Testing used" value={`${testingAllocationUsed(state)}/${TOTAL_TESTING_ALLOCATION}`} />
                <FmKeyValue label="Your drivers" value={mine.length} />
                <FmKeyValue label="Grid tracked" value={state.drivers.length} />
              </section>
              <section>
                <h3>Age curve</h3>
                <FmKeyValue label="Developing" value={phaseCounts.Developing} />
                <FmKeyValue label="At peak" value={phaseCounts.Peak} />
                <FmKeyValue label="Declining" value={phaseCounts.Declining} />
              </section>
              {selectedSubject && tab === 'mine' && (
                <section>
                  <h3>Recommendation</h3>
                  <p>Staff suggest {DRIVER_DEVELOPMENT_FOCUS_LABELS[developmentRecommendation(state, selectedSubject.id)].toLowerCase()}.</p>
                </section>
              )}
            </FmPaneBody>
          </FmPane>
        </FmWorkspaceGrid>
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}

function DevelopmentPlanEditor({
  state,
  dispatch,
  subject,
}: {
  state: NonNullable<ReturnType<typeof useGame>['state']>;
  dispatch: ReturnType<typeof useGame>['dispatch'];
  subject: { id: string; name: string; role: string };
}) {
  const used = testingAllocationUsed(state);
  const plan = planForDriver(state, subject.id);
  const recommendation = developmentRecommendation(state, subject.id);
  const mentors = mentorCandidates(state, subject.id);
  const available = TOTAL_TESTING_ALLOCATION - testingAllocationUsed(state, subject.id);

  return (
    <Panel title="Individual Development Plan">
      <div className="ui-development-plan-header">
        <div>
          <strong>{subject.name}</strong>
          <span>{subject.role} · {plan.status} · {satisfactionLabel(plan.satisfaction)}</span>
        </div>
        <span>{used}/{TOTAL_TESTING_ALLOCATION} testing</span>
      </div>
      <div className="ui-development-plan-fields">
        <label>
          Focus
          <select value={plan.focus} onChange={(event) => dispatch({ type: 'SET_DRIVER_DEVELOPMENT_FOCUS', driverId: subject.id, focus: event.target.value as DriverDevelopmentFocus })}>
            {(Object.keys(DRIVER_DEVELOPMENT_FOCUS_LABELS) as DriverDevelopmentFocus[]).map((focus) => <option key={focus} value={focus}>{DRIVER_DEVELOPMENT_FOCUS_LABELS[focus]}</option>)}
          </select>
          <span>Staff suggest {DRIVER_DEVELOPMENT_FOCUS_LABELS[recommendation].toLowerCase()}</span>
          <span>{DRIVER_DEVELOPMENT_FOCUS_DESCRIPTIONS[plan.focus]}</span>
        </label>
        <label>
          Testing share
          <select value={plan.testingAllocation} onChange={(event) => dispatch({ type: 'SET_DRIVER_TESTING_ALLOCATION', driverId: subject.id, allocation: Number(event.target.value) })}>
            {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
              .filter((allocation) => allocation === plan.testingAllocation || allocation <= available)
              .map((allocation) => <option key={allocation} value={allocation}>{allocation}%</option>)}
          </select>
        </label>
        <label>
          Mentor
          <select value={plan.mentorId ?? ''} onChange={(event) => dispatch({ type: 'SET_DRIVER_DEVELOPMENT_MENTOR', driverId: subject.id, mentorId: event.target.value || undefined })}>
            <option value="">No mentor</option>
            {mentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.name}</option>)}
          </select>
          <span>{progressLabel(plan.progress)}</span>
        </label>
      </div>
    </Panel>
  );
}

function satisfactionLabel(value: number): string {
  if (value >= 75) return 'high satisfaction';
  if (value >= 50) return 'settled';
  if (value >= 35) return 'needs attention';
  return 'frustrated';
}

function progressLabel(value: number): string {
  if (value >= 80) return 'Plan work is well established';
  if (value >= 50) return 'Plan is taking shape';
  if (value >= 20) return 'Early progress';
  return 'Programme recently assigned';
}

function CurveCard({
  driver,
  curve,
  age,
}: {
  driver: Driver;
  curve: DriverDevelopmentCurve;
  age: number;
}) {
  const phase = developmentPhase(curve, age);
  const overall = driver.ratings.overall;
  const trajectory = projectTrajectory(curve, age, overall, 5);
  const maxOverall = Math.max(10, ...trajectory.map((p) => p.overall));
  const { state } = useGame();

  return (
    <Panel>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="font-bold text-neutral-100">{driver.name}</div>
          <div className="text-xs text-neutral-500">
            Age {age} · peak {curve.peakAgeStart}–{curve.peakAgeEnd}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${PHASE_TONE[phase]}`}>
            {phase}
          </span>
          {state && (
            <DriverDossierButton
              state={state}
              subject={{ type: 'driver', driver }}
              context="Development curve"
              focus="development"
              className="px-1.5 py-0.5"
            >
              Card
            </DriverDossierButton>
          )}
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
        <Stat label="Overall">{overall.toFixed(1)}</Stat>
        <Stat label="Ceiling">{curve.potentialCeiling.toFixed(1)}</Stat>
      </div>

      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">
          Projected overall
        </div>
        <div className="flex items-end gap-1.5">
          {trajectory.map((p, i) => (
            <div key={p.age} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`w-full rounded-t ${PHASE_TONE[p.phase].split(' ')[0]}`}
                style={{ height: `${Math.max(6, (p.overall / maxOverall) * 56)}px` }}
                title={`Age ${p.age}: ${p.overall.toFixed(1)}`}
              />
              <span className={`text-[9px] tabular-nums ${i === 0 ? 'text-neutral-300' : 'text-neutral-600'}`}>
                {p.overall.toFixed(1)}
              </span>
              <span className="text-[9px] text-neutral-600">{p.age}</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded bg-neutral-800/50 px-2 py-1">
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="font-semibold tabular-nums text-neutral-200">{children}</div>
    </div>
  );
}
