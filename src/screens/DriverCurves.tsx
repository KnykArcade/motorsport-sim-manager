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
import { CompactPagination } from '../components/CompactPagination';
import { CURVE_PAGE_SIZE, compactPage, pageCount } from './seasonOverviewViewModel';

type Tab = 'mine' | 'grid';

const PHASE_TONE: Record<DevelopmentPhase, string> = {
  Developing: 'bg-green-500/15 text-green-300',
  Peak: 'bg-amber-500/15 text-amber-300',
  Declining: 'bg-red-500/15 text-red-300',
};

export function DriverCurves() {
  const { state } = useGame();
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

  function selectTab(nextTab: Tab) {
    setTab(nextTab);
    setPage(0);
  }

  return (
    <div className="era-feature-screen era-driver-curves-screen space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Development Curves</h1>
          <p className="text-sm text-neutral-400">
            Drivers improve toward a ceiling while young, plateau through their peak years, then
            decline with age. Ratings shift each offseason — your Driver Academy speeds up your own
            youngsters.
          </p>
        </div>
        <div className="flex gap-2">
          <TabButton active={tab === 'mine'} onClick={() => selectTab('mine')}>
            Your Drivers ({mine.length})
          </TabButton>
          <TabButton active={tab === 'grid'} onClick={() => selectTab('grid')}>
            Grid ({state.drivers.length})
          </TabButton>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibleDrivers.map(({ driver, curve, age }) => (
            <CurveCard key={driver.id} driver={driver} curve={curve} age={age} />
          ))}
      </div>
      <CompactPagination noun="drivers" total={sorted.length} page={safePage} pageCount={tabPageCount} pageSize={CURVE_PAGE_SIZE} onPage={setPage} />
    </div>
  );
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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm ${
        active
          ? 'bg-amber-500 font-semibold text-neutral-950'
          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
      }`}
    >
      {children}
    </button>
  );
}
