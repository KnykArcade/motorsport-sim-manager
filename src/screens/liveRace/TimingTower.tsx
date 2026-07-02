// Left-side timing tower / running order. A compact full-field table with tabs
// (Overview / Gaps / Tyres / Stops / Sectors). Player cars are highlighted and
// every row carries compact reliability (R) and crash (C) risk indicators.

import { useState } from 'react';
import type { LiveCarState } from '../../types/liveTypes';
import { DeltaTag, RiskDot } from './dashboardUi';
import { fmtLap, fmtSector, tyreLetter } from './dashboardFormat';

type Tab = 'Overview' | 'Gaps' | 'Tyres' | 'Stops' | 'Sectors';
const TABS: Tab[] = ['Overview', 'Gaps', 'Tyres', 'Stops', 'Sectors'];

export function TimingTower({
  cars,
  nameOf,
  colorOf,
}: {
  cars: LiveCarState[];
  nameOf: (id: string) => string;
  colorOf: (id: string) => string;
}) {
  const [tab, setTab] = useState<Tab>('Overview');
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-700/60 bg-[#111725]">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-700/50 px-3 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Timing Tower</span>
        <span className="text-[10px] text-slate-500">{cars.filter((c) => c.running).length} running</span>
      </div>
      <div className="flex shrink-0 gap-1 border-b border-slate-700/40 px-2 py-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
              tab === t ? 'bg-amber-500 text-neutral-950' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full text-[11px]">
          <tbody>
            {cars.map((c) => (
              <Row key={c.driverId} car={c} tab={tab} name={nameOf(c.driverId)} color={colorOf(c.teamId)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ car, tab, name, color }: { car: LiveCarState; tab: Tab; name: string; color: string }) {
  const finishedRace = car.status === 'Finished';
  const dnf = !car.running && !finishedRace;
  const classified = car.running || finishedRace;
  const wear = Math.round(car.tire.wear);
  const life = Math.max(0, 100 - wear);
  const tyre = tyreLetter(car.tire.compound);

  return (
    <tr
      className={`border-t border-slate-800/50 ${car.isPlayer ? 'bg-amber-500/10' : ''} ${
        dnf ? 'opacity-40' : ''
      }`}
    >
      <td className="w-6 py-1 pl-2 text-right font-bold tabular-nums text-slate-200">{car.position ?? '–'}</td>
      <td className="w-7 py-1 pl-1 text-center text-[10px]">
        <DeltaTag grid={car.grid} position={car.position} muted={!classified} />
      </td>
      <td className="py-1 pl-1">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-1 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
          <span className={`truncate ${car.isPlayer ? 'font-semibold text-amber-200' : 'text-slate-200'}`}>
            {shortName(name)}
          </span>
        </span>
      </td>
      {tab === 'Overview' && (
        <>
          <td className="py-1 text-center">
            <TyreCell letter={tyre.letter} className={tyre.className} life={life} />
          </td>
          <td className="py-1 pr-1 text-right tabular-nums text-slate-300">{gapText(car, classified)}</td>
          <td className="py-1 pr-1 text-right tabular-nums text-slate-400">
            {car.lastLapTime > 0 ? fmtLap(car.lastLapTime) : '—'}
          </td>
          <td className="py-1 pr-2">
            <span className="flex items-center justify-end gap-1">
              <RiskDot kind="R" level={car.reliabilityRiskLevel} />
              <RiskDot kind="C" level={car.crashRiskLevel} />
            </span>
          </td>
        </>
      )}
      {tab === 'Gaps' && (
        <>
          <td className="py-1 pr-1 text-right tabular-nums text-slate-300">{gapText(car, classified)}</td>
          <td className="py-1 pr-2 text-right tabular-nums text-slate-400">
            {!classified ? '—' : car.position === 1 ? '—' : `+${car.interval.toFixed(1)}`}
          </td>
        </>
      )}
      {tab === 'Tyres' && (
        <>
          <td className="py-1 text-center">
            <span
              className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${tyre.className}`}
            >
              {tyre.letter}
            </span>
          </td>
          <td className="py-1 pr-1 text-right tabular-nums text-slate-300">{wear}%</td>
          <td className="py-1 pr-2 text-right tabular-nums text-slate-500">{car.tire.age}L</td>
        </>
      )}
      {tab === 'Stops' && (
        <>
          <td className="py-1 pr-1 text-right tabular-nums text-slate-300">
            {car.pit.stopsMade}/{car.pit.plannedStops}
          </td>
          <td className="py-1 pr-2 text-right tabular-nums text-slate-500">
            {car.pit.lastPitLap != null ? `L${car.pit.lastPitLap}` : '—'}
          </td>
        </>
      )}
      {tab === 'Sectors' && (
        <>
          <td className="py-1 pr-1 text-right tabular-nums text-slate-400">{fmtSector(car.lastSectors?.[0])}</td>
          <td className="py-1 pr-1 text-right tabular-nums text-slate-400">{fmtSector(car.lastSectors?.[1])}</td>
          <td className="py-1 pr-2 text-right tabular-nums text-slate-400">{fmtSector(car.lastSectors?.[2])}</td>
        </>
      )}
    </tr>
  );
}

function TyreCell({ letter, className, life }: { letter: string; className: string; life: number }) {
  const bar = life <= 20 ? 'bg-red-500' : life <= 45 ? 'bg-orange-500' : life <= 70 ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${className}`}>
        {letter}
      </span>
      <span className="h-1 w-8 overflow-hidden rounded-full bg-slate-800">
        <span className={`block h-full ${bar}`} style={{ width: `${life}%` }} />
      </span>
    </span>
  );
}

function gapText(car: LiveCarState, classified: boolean): string {
  if (!classified) return '—';
  if (car.position === 1) return 'LEAD';
  return `+${car.gapToLeader.toFixed(1)}`;
}

// Compact "F. Surname" so long names fit the tower.
function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}
