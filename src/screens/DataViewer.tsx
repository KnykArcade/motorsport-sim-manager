import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  cars1995,
  drivers1995,
  teams1995,
  tracks1995,
  calendar1995,
  setupOptions,
} from '../data';
import { getPointsSystem } from '../data/pointsSystems/pointsSystems';
import { developmentProjectCatalog } from '../data/development/developmentProjects';
import { Button } from '../components/Button';
import { RatingBadge } from '../components/RatingBadge';

type Tab = 'calendar' | 'tracks' | 'teams' | 'drivers' | 'cars' | 'points' | 'setups' | 'development';

const TABS: { id: Tab; label: string }[] = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'tracks', label: 'Track Ratings' },
  { id: 'teams', label: 'Teams' },
  { id: 'drivers', label: 'Drivers' },
  { id: 'cars', label: 'Cars' },
  { id: 'points', label: 'Points' },
  { id: 'setups', label: 'Setup Options' },
  { id: 'development', label: 'Development' },
];

export function DataViewer() {
  const [tab, setTab] = useState<Tab>('calendar');
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0a0c10] p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-neutral-100">Data Viewer</h1>
          <Button variant="ghost" onClick={() => navigate(-1)}>← Back</Button>
        </div>
        <p className="text-sm text-neutral-500">
          The raw 1995 seed database, auto-generated from the source spreadsheet. Edit values in{' '}
          <code className="rounded bg-neutral-800 px-1 py-0.5 text-xs">src/data/</code>.
        </p>

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                tab === t.id ? 'bg-amber-500 font-semibold text-neutral-950' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-lg border border-neutral-800">
          {tab === 'calendar' && <CalendarTable />}
          {tab === 'tracks' && <TracksTable />}
          {tab === 'teams' && <TeamsTable />}
          {tab === 'drivers' && <DriversTable />}
          {tab === 'cars' && <CarsTable />}
          {tab === 'points' && <PointsTable />}
          {tab === 'setups' && <SetupsTable />}
          {tab === 'development' && <DevTable />}
        </div>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap px-3 py-1.5 text-sm text-neutral-200">{children}</td>;
}

function CalendarTable() {
  return (
    <table className="w-full">
      <thead className="bg-neutral-900/60">
        <tr><Th>#</Th><Th>Grand Prix</Th><Th>Track</Th><Th>Laps</Th><Th>Distance</Th></tr>
      </thead>
      <tbody>
        {calendar1995.map((r) => (
          <tr key={r.id} className="border-t border-neutral-800/60">
            <Td>{r.round}</Td><Td>{r.gpName}</Td><Td>{r.trackName}</Td><Td>{r.laps}</Td><Td>{r.distanceKm ?? '—'} km</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TracksTable() {
  return (
    <table className="w-full">
      <thead className="bg-neutral-900/60">
        <tr>
          <Th>Track</Th><Th>Archetype</Th><Th>Corners</Th><Th>Braking</Th><Th>Straights</Th>
          <Th>Technical</Th><Th>Risk</Th><Th>Aero D</Th><Th>Power D</Th><Th>Mech D</Th><Th>Risk D</Th>
        </tr>
      </thead>
      <tbody>
        {tracks1995.map((t) => (
          <tr key={t.id} className="border-t border-neutral-800/60">
            <Td>{t.name}</Td>
            <Td><span className="rounded bg-neutral-800 px-1.5 py-0.5 text-xs">{t.archetype}</span></Td>
            <Td>{t.attributes.corners}</Td>
            <Td>{t.attributes.braking}</Td>
            <Td>{t.attributes.straights}</Td>
            <Td>{t.attributes.technical}</Td>
            <Td>{t.attributes.riskWallProximity}</Td>
            <Td><RatingBadge value={t.setupProfile.aeroDemand} /></Td>
            <Td><RatingBadge value={t.setupProfile.powerDemand} /></Td>
            <Td><RatingBadge value={t.setupProfile.mechanicalDemand} /></Td>
            <Td><RatingBadge value={t.setupProfile.riskDemand} /></Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TeamsTable() {
  return (
    <table className="w-full">
      <thead className="bg-neutral-900/60">
        <tr><Th>Team</Th><Th>Drivers</Th><Th>Budget</Th><Th>Reputation</Th><Th>Exp.</Th><Th>Difficulty</Th></tr>
      </thead>
      <tbody>
        {teams1995.map((t) => (
          <tr key={t.id} className="border-t border-neutral-800/60">
            <Td>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-1.5 rounded-sm" style={{ backgroundColor: t.color }} />
                {t.name}
              </span>
            </Td>
            <Td>{t.driverIds.map((id) => drivers1995.find((d) => d.id === id)?.name).join(', ')}</Td>
            <Td>${(t.budget / 1_000_000).toFixed(0)}M</Td>
            <Td>{t.reputation}</Td>
            <Td>P{t.expectedStanding}</Td>
            <Td>{t.difficulty}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DriversTable() {
  const teamName = (id: string) => teams1995.find((t) => t.id === id)?.name ?? id;
  return (
    <table className="w-full">
      <thead className="bg-neutral-900/60">
        <tr><Th>#</Th><Th>Driver</Th><Th>Team</Th><Th>OVR</Th><Th>Quali</Th><Th>Race</Th><Th>Corner</Th><Th>Overtake</Th><Th>Composure</Th></tr>
      </thead>
      <tbody>
        {[...drivers1995].sort((a, b) => b.ratings.overall - a.ratings.overall).map((d) => (
          <tr key={d.id} className="border-t border-neutral-800/60">
            <Td>{d.number}</Td><Td>{d.name}</Td><Td>{teamName(d.teamId)}</Td>
            <Td><RatingBadge value={d.ratings.overall} /></Td>
            <Td>{d.ratings.qualifying}</Td><Td>{d.ratings.racePace}</Td>
            <Td>{d.ratings.cornering}</Td><Td>{d.ratings.overtakingRacecraft}</Td><Td>{d.ratings.composure}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CarsTable() {
  const teamName = (id: string) => teams1995.find((t) => t.id === id)?.name ?? id;
  return (
    <table className="w-full">
      <thead className="bg-neutral-900/60">
        <tr><Th>Team</Th><Th>Engine</Th><Th>Aero</Th><Th>Mech Grip</Th><Th>Reliability</Th><Th>Pit Crew</Th></tr>
      </thead>
      <tbody>
        {cars1995.map((c) => (
          <tr key={c.id} className="border-t border-neutral-800/60">
            <Td>{teamName(c.teamId)}</Td>
            <Td><RatingBadge value={c.ratings.enginePower} /></Td>
            <Td><RatingBadge value={c.ratings.aeroEfficiency} /></Td>
            <Td><RatingBadge value={c.ratings.mechanicalGrip} /></Td>
            <Td><RatingBadge value={c.ratings.reliability} /></Td>
            <Td><RatingBadge value={c.ratings.pitCrewOperations} /></Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PointsTable() {
  const pts = getPointsSystem('pts-1995');
  return (
    <table className="w-full">
      <thead className="bg-neutral-900/60"><tr><Th>Position</Th><Th>Points</Th></tr></thead>
      <tbody>
        {Object.entries(pts.pointsByPosition).map(([pos, p]) => (
          <tr key={pos} className="border-t border-neutral-800/60"><Td>P{pos}</Td><Td>{p}</Td></tr>
        ))}
      </tbody>
    </table>
  );
}

function SetupsTable() {
  return (
    <table className="w-full">
      <thead className="bg-neutral-900/60">
        <tr><Th>Setup</Th><Th>DF</Th><Th>Top Spd</Th><Th>Mech</Th><Th>Brake</Th><Th>Tire</Th><Th>Quali</Th><Th>Race</Th><Th>Risk</Th></tr>
      </thead>
      <tbody>
        {setupOptions.map((s) => (
          <tr key={s.id} className="border-t border-neutral-800/60">
            <Td>{s.name}</Td><Td>{s.downforce}</Td><Td>{s.topSpeed}</Td><Td>{s.mechanicalGrip}</Td>
            <Td>{s.brakingStability}</Td><Td>{s.tirePreservation}</Td><Td>{s.qualifyingBoost}</Td>
            <Td>{s.racePaceBoost}</Td><Td>{s.riskModifier}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DevTable() {
  return (
    <table className="w-full">
      <thead className="bg-neutral-900/60">
        <tr><Th>Project</Th><Th>Category</Th><Th>Horizon</Th><Th>Cost</Th><Th>Races</Th><Th>Success</Th><Th>Carryover</Th></tr>
      </thead>
      <tbody>
        {developmentProjectCatalog.map((p) => (
          <tr key={p.id} className="border-t border-neutral-800/60">
            <Td>{p.name}</Td><Td>{p.category}</Td><Td>{p.horizon}</Td>
            <Td>${(p.cost / 1_000_000).toFixed(1)}M</Td><Td>{p.durationRaces}</Td>
            <Td>{Math.round(p.successChance * 100)}%</Td><Td>{Math.round(p.carryoverRate * 100)}%</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
