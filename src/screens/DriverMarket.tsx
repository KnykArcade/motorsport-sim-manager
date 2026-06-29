import { useMemo, useState } from 'react';
import { useGame } from '../game/GameContext';
import { getMarketBundle } from '../data';
import { Panel } from '../components/Panel';
import { StatBar } from '../components/StatBar';
import { formatMoney } from '../components/ui';
import type { MarketDriver, MarketSkillRatings, YouthProspect } from '../types/marketTypes';

type Tab = 'senior' | 'youth';

export function DriverMarket() {
  const { state } = useGame();
  const [tab, setTab] = useState<Tab>('senior');

  const bundle = useMemo(
    () => (state ? getMarketBundle(state.seasonYear, state.series) : undefined),
    [state],
  );

  if (!state) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Driver Market</h1>
          <p className="text-sm text-neutral-400">
            Scout senior drivers available for {state.seasonYear + 1} and under-18 academy prospects.
          </p>
        </div>
        <div className="flex gap-2">
          <TabButton active={tab === 'senior'} onClick={() => setTab('senior')}>
            Senior Market{bundle ? ` (${bundle.drivers.length})` : ''}
          </TabButton>
          <TabButton active={tab === 'youth'} onClick={() => setTab('youth')}>
            Youth Academy{bundle ? ` (${bundle.youth.length})` : ''}
          </TabButton>
        </div>
      </div>

      {!bundle && (
        <Panel>
          <p className="text-sm text-neutral-400">
            No driver market data is available for the {state.seasonYear} {state.series} season yet.
          </p>
        </Panel>
      )}

      {bundle && tab === 'senior' && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...bundle.drivers]
            .sort((a, b) => b.overall - a.overall)
            .map((d) => (
              <SeniorCard key={d.id} d={d} />
            ))}
        </div>
      )}

      {bundle && tab === 'youth' && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...bundle.youth]
            .sort((a, b) => b.potential - a.potential)
            .map((y) => (
              <YouthCard key={y.id} y={y} />
            ))}
        </div>
      )}
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

function TopSkills({ skills }: { skills: MarketSkillRatings }) {
  return (
    <div className="grid grid-cols-1 gap-1">
      <StatBar label="Cornering" value={skills.cornering} />
      <StatBar label="Braking" value={skills.braking} />
      <StatBar label="Overtaking" value={skills.overtakingRacecraft} />
      <StatBar label="Consistency" value={skills.enduranceConsistency} />
    </div>
  );
}

function Money({ m }: { m: number }) {
  return <>{formatMoney(m * 1_000_000)}</>;
}

function SeniorCard({ d }: { d: MarketDriver }) {
  return (
    <Panel>
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <div className="font-bold text-neutral-100">{d.name}</div>
          <div className="text-xs text-neutral-500">
            {d.nationality} · {d.age} · {d.context}
          </div>
        </div>
        <div className="text-right">
          <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs font-semibold text-amber-300">
            {d.overall.toFixed(1)}
          </span>
          <div className="mt-0.5 text-[10px] text-neutral-500">
            POT {d.potential.toFixed(1)}
          </div>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap gap-1 text-[10px]">
        <Tag>{d.marketStatus}</Tag>
        <Tag>{d.primaryRole}</Tag>
        {d.immediateF1Eligible && <Tag tone="good">F1-ready</Tag>}
        <Tag tone="warn">{d.negotiationDifficulty} difficulty</Tag>
      </div>

      <TopSkills skills={d.skills} />

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <Stat label="Salary/yr">
          <Money m={d.salary} />
        </Stat>
        <Stat label="Buyout">
          <Money m={d.buyoutCost} />
        </Stat>
        <Stat label="Sponsor/yr">
          <Money m={d.sponsorValue} />
        </Stat>
      </div>

      {d.notes && <p className="mt-2 text-[11px] italic text-neutral-500">{d.notes}</p>}
    </Panel>
  );
}

function YouthCard({ y }: { y: YouthProspect }) {
  return (
    <Panel>
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <div className="font-bold text-neutral-100">{y.name}</div>
          <div className="text-xs text-neutral-500">
            {y.nationality} · age {y.age} · {y.currentLevel}
          </div>
        </div>
        <div className="text-right">
          <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs font-semibold text-sky-300">
            POT {y.potential.toFixed(1)}
          </span>
          <div className="mt-0.5 text-[10px] text-neutral-500">now {y.overall.toFixed(1)}</div>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap gap-1 text-[10px]">
        {y.academyEligibleNow && <Tag tone="good">Eligible now</Tag>}
        <Tag>{y.riskLevel} risk</Tag>
        <Tag>~{y.yearsUntilF1Ready}y to F1</Tag>
      </div>

      <TopSkills skills={y.skills} />

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <Stat label="Signing">
          <Money m={y.signingCost} />
        </Stat>
        <Stat label="Academy/yr">
          <Money m={y.yearlyAcademyCost} />
        </Stat>
      </div>

      <p className="mt-2 text-[11px] text-neutral-400">{y.suggestedPath}</p>
      {y.notes && <p className="mt-1 text-[11px] italic text-neutral-500">{y.notes}</p>}
    </Panel>
  );
}

function Tag({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'good' | 'warn' }) {
  const tones = {
    neutral: 'bg-neutral-800 text-neutral-300',
    good: 'bg-green-500/15 text-green-300',
    warn: 'bg-amber-500/15 text-amber-300',
  };
  return <span className={`rounded px-1.5 py-0.5 ${tones[tone]}`}>{children}</span>;
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded bg-neutral-800/50 px-2 py-1">
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="font-semibold tabular-nums text-neutral-200">{children}</div>
    </div>
  );
}
