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
import { CompactPagination } from '../components/CompactPagination';
import { CURVE_PAGE_SIZE, compactPage, pageCount } from './seasonOverviewViewModel';
import {
  MetricStrip,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceMetric,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';

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
  }

  return (
    <WorkspaceScreen className="era-feature-screen era-driver-curves-screen">
      <WorkspaceHeader
        eyebrow="Driver intelligence"
        title="Development Curves"
        subtitle="Track current ability, projected ceilings, and the age curve shaping every driver."
      />
      <MetricStrip>
        <WorkspaceMetric label="Your drivers" value={mine.length} detail="Team development dossiers" />
        <WorkspaceMetric label="Grid tracked" value={state.drivers.length} detail="Current driver pool" />
        <WorkspaceMetric label="Developing" value={phaseCounts.Developing} detail="Still climbing toward peak" />
        <WorkspaceMetric label="Peak / declining" value={`${phaseCounts.Peak} / ${phaseCounts.Declining}`} detail="Mature and late-career profiles" />
      </MetricStrip>
      <WorkspaceTabs
        items={[
          { id: 'mine' as const, label: `Your Drivers · ${mine.length}` },
          { id: 'grid' as const, label: `Grid · ${state.drivers.length}` },
        ]}
        active={tab}
        onChange={selectTab}
        ariaLabel="Driver development views"
      />
      <WorkspaceBody className="space-y-3">
      {tab === 'mine' && (
        <DevelopmentPlanBoard state={state} dispatch={dispatch} />
      )}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibleDrivers.map(({ driver, curve, age }) => (
            <CurveCard key={driver.id} driver={driver} curve={curve} age={age} />
          ))}
      </div>
      <CompactPagination noun="drivers" total={sorted.length} page={safePage} pageCount={tabPageCount} pageSize={CURVE_PAGE_SIZE} onPage={setPage} />
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}

function DevelopmentPlanBoard({
  state,
  dispatch,
}: {
  state: NonNullable<ReturnType<typeof useGame>['state']>;
  dispatch: ReturnType<typeof useGame>['dispatch'];
}) {
  const drivers = state.drivers
    .filter((driver) => driver.teamId === state.selectedTeamId)
    .map((driver) => ({ id: driver.id, name: driver.name, role: driver.contractType === 'reserve' || driver.contractType === 'third' || driver.contractType === 'test' ? 'Reserve / test' : 'Race driver' }));
  const academy = (state.academy ?? []).map((member) => ({ id: member.id, name: member.name, role: 'Academy' }));
  const subjects = [...drivers, ...academy];
  const used = testingAllocationUsed(state);

  return (
    <Panel>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-neutral-100">Individual development plans</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Direct each driver’s long-term work. Staff recommendations are advisory; only your selections change a plan.
          </p>
        </div>
        <div className="rounded bg-neutral-800/70 px-3 py-2 text-right text-xs">
          <div className="uppercase tracking-wide text-neutral-500">Testing allocation</div>
          <div className="font-semibold text-neutral-200">{used} / {TOTAL_TESTING_ALLOCATION}</div>
        </div>
      </div>
      <div className="space-y-2">
        {subjects.map((subject) => {
          const plan = planForDriver(state, subject.id);
          const recommendation = developmentRecommendation(state, subject.id);
          const mentors = mentorCandidates(state, subject.id);
          const available = TOTAL_TESTING_ALLOCATION - testingAllocationUsed(state, subject.id);
          return (
            <div key={subject.id} className="grid gap-2 rounded border border-neutral-800 bg-neutral-950/30 p-3 lg:grid-cols-[1.1fr_1.4fr_1fr_1.2fr] lg:items-center">
              <div>
                <div className="font-semibold text-neutral-200">{subject.name}</div>
                <div className="text-[11px] text-neutral-500">{subject.role} · {plan.status} · {satisfactionLabel(plan.satisfaction)}</div>
              </div>
              <label className="text-[10px] uppercase tracking-wide text-neutral-500">
                Focus
                <select
                  className="mt-1 w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs normal-case tracking-normal text-neutral-200"
                  value={plan.focus}
                  onChange={(event) => dispatch({ type: 'SET_DRIVER_DEVELOPMENT_FOCUS', driverId: subject.id, focus: event.target.value as DriverDevelopmentFocus })}
                >
                  {(Object.keys(DRIVER_DEVELOPMENT_FOCUS_LABELS) as DriverDevelopmentFocus[]).map((focus) => (
                    <option key={focus} value={focus}>{DRIVER_DEVELOPMENT_FOCUS_LABELS[focus]}</option>
                  ))}
                </select>
                <span className="mt-1 block normal-case tracking-normal text-neutral-600">Staff suggest {DRIVER_DEVELOPMENT_FOCUS_LABELS[recommendation].toLowerCase()}</span>
                <span className="mt-1 block normal-case tracking-normal text-neutral-600">{DRIVER_DEVELOPMENT_FOCUS_DESCRIPTIONS[plan.focus]}</span>
              </label>
              <label className="text-[10px] uppercase tracking-wide text-neutral-500">
                Testing share
                <select
                  className="mt-1 w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs normal-case tracking-normal text-neutral-200"
                  value={plan.testingAllocation}
                  onChange={(event) => dispatch({ type: 'SET_DRIVER_TESTING_ALLOCATION', driverId: subject.id, allocation: Number(event.target.value) })}
                >
                  {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
                    .filter((allocation) => allocation === plan.testingAllocation || allocation <= available)
                    .map((allocation) => <option key={allocation} value={allocation}>{allocation}%</option>)}
                </select>
              </label>
              <label className="text-[10px] uppercase tracking-wide text-neutral-500">
                Mentor
                <select
                  className="mt-1 w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs normal-case tracking-normal text-neutral-200"
                  value={plan.mentorId ?? ''}
                  onChange={(event) => dispatch({ type: 'SET_DRIVER_DEVELOPMENT_MENTOR', driverId: subject.id, mentorId: event.target.value || undefined })}
                >
                  <option value="">No mentor</option>
                  {mentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.name}</option>)}
                </select>
                <span className="mt-1 block normal-case tracking-normal text-neutral-600">{progressLabel(plan.progress)}</span>
              </label>
            </div>
          );
        })}
        {subjects.length === 0 && <p className="text-sm text-neutral-500">No contracted or academy drivers are available for planning.</p>}
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
