import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  availableSeasons,
  loadSeasonBundle,
  getCachedBundle,
  getTrackById,
  registryList,
  setupOptions,
  type SeasonBundle,
} from '../data';
import { getPointsSystem } from '../data/pointsSystems/pointsSystems';
import { developmentProjectCatalog } from '../data/development/developmentProjects';
import { useGame } from '../game/GameContext';
import { Button } from '../components/Button';
import { RatingBadge } from '../components/RatingBadge';
import type { Car, Driver, Series, Team, Track } from '../types/gameTypes';

type Tab =
  | 'calendar'
  | 'tracks'
  | 'teams'
  | 'drivers'
  | 'cars'
  | 'points'
  | 'setups'
  | 'development'
  | 'registry';

const TABS: { id: Tab; label: string }[] = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'tracks', label: 'Track Ratings' },
  { id: 'teams', label: 'Teams' },
  { id: 'drivers', label: 'Drivers' },
  { id: 'cars', label: 'Cars' },
  { id: 'points', label: 'Points' },
  { id: 'setups', label: 'Setup Options' },
  { id: 'development', label: 'Development' },
  { id: 'registry', label: 'Master Registry' },
];

const seasonKey = (year: number, series: Series) => `${year}-${series}`;

export function DataViewer() {
  const [tab, setTab] = useState<Tab>('calendar');
  const navigate = useNavigate();
  const { state } = useGame();

  // Ensure the master registry is initialized (needed for the Registry tab).
  useEffect(() => { void import('../data/seasonData'); }, []);

  // Default to the current game's season if one is loaded and has data;
  // otherwise fall back to the first available season.
  const defaultKey = useMemo(() => {
    if (state && getCachedBundle(state.seasonYear, state.series)) {
      return seasonKey(state.seasonYear, state.series);
    }
    const first = availableSeasons[0];
    return seasonKey(first.year, first.series);
  }, [state]);

  const [selected, setSelected] = useState<string>(defaultKey);
  const choice =
    availableSeasons.find((s) => seasonKey(s.year, s.series) === selected) ?? availableSeasons[0];

  const [bundle, setBundle] = useState<SeasonBundle | undefined>(getCachedBundle(choice.year, choice.series));
  const [loadingBundle, setLoadingBundle] = useState(false);

  useEffect(() => {
    const cached = getCachedBundle(choice.year, choice.series);
    if (cached) {
      setBundle(cached);
      setLoadingBundle(false);
      return;
    }
    let cancelled = false;
    setLoadingBundle(true);
    loadSeasonBundle(choice.year, choice.series)
      .then((b) => {
        if (cancelled) return;
        setBundle(b);
        setLoadingBundle(false);
      })
      .catch(() => {
        if (cancelled) return;
        setBundle(undefined);
        setLoadingBundle(false);
      });
    return () => { cancelled = true; };
  }, [choice.year, choice.series]);

  return (
    <div className="min-h-screen bg-[#0a0c10] p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-neutral-100">Data Viewer</h1>
          <Button variant="ghost" onClick={() => navigate(-1)}>← Back</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-neutral-400">Season</label>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200"
          >
            {availableSeasons.map((s) => (
              <option key={seasonKey(s.year, s.series)} value={seasonKey(s.year, s.series)}>
                {s.label}
              </option>
            ))}
          </select>
          <p className="text-sm text-neutral-500">
            Raw seed database, auto-generated from the source spreadsheets. Edit values in{' '}
            <code className="rounded bg-neutral-800 px-1 py-0.5 text-xs">src/data/</code>.
          </p>
        </div>

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
          {tab === 'registry' ? (
            <RegistryTable />
          ) : loadingBundle ? (
            <p className="p-6 text-sm text-neutral-400">Loading season data…</p>
          ) : !bundle ? (
            <p className="p-6 text-sm text-neutral-400">No data for this season.</p>
          ) : (
            <>
              {tab === 'calendar' && <CalendarTable bundle={bundle} />}
              {tab === 'tracks' && <TracksTable bundle={bundle} />}
              {tab === 'teams' && <TeamsTable bundle={bundle} />}
              {tab === 'drivers' && <DriversTable bundle={bundle} />}
              {tab === 'cars' && <CarsTable bundle={bundle} />}
              {tab === 'points' && <PointsTable bundle={bundle} />}
              {tab === 'setups' && <SetupsTable />}
              {tab === 'development' && <DevTable />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// The tracks raced in a season, resolved from the calendar's track ids.
function seasonTracks(bundle: SeasonBundle): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const r of bundle.season.calendar) {
    if (seen.has(r.trackId)) continue;
    const t = getTrackById(r.trackId);
    if (t) {
      out.push(t);
      seen.add(r.trackId);
    }
  }
  return out;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap px-3 py-1.5 text-sm text-neutral-200">{children}</td>;
}

function CalendarTable({ bundle }: { bundle: SeasonBundle }) {
  return (
    <table className="w-full">
      <thead className="bg-neutral-900/60">
        <tr><Th>#</Th><Th>Grand Prix</Th><Th>Track</Th><Th>Laps</Th><Th>Distance</Th></tr>
      </thead>
      <tbody>
        {bundle.season.calendar.map((r) => (
          <tr key={r.id} className="border-t border-neutral-800/60">
            <Td>{r.round}</Td><Td>{r.gpName}</Td><Td>{r.trackName}</Td><Td>{r.laps}</Td><Td>{r.distanceKm ?? '—'} km</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TracksTable({ bundle }: { bundle: SeasonBundle }) {
  return (
    <table className="w-full">
      <thead className="bg-neutral-900/60">
        <tr>
          <Th>Track</Th><Th>Archetype</Th><Th>Corners</Th><Th>Braking</Th><Th>Straights</Th>
          <Th>Technical</Th><Th>Risk</Th><Th>Aero D</Th><Th>Power D</Th><Th>Mech D</Th><Th>Risk D</Th>
        </tr>
      </thead>
      <tbody>
        {seasonTracks(bundle).map((t) => (
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

function TeamsTable({ bundle }: { bundle: SeasonBundle }) {
  const { teams, drivers }: { teams: Team[]; drivers: Driver[] } = bundle;
  return (
    <table className="w-full">
      <thead className="bg-neutral-900/60">
        <tr><Th>Team</Th><Th>Drivers</Th><Th>Budget</Th><Th>Reputation</Th><Th>Exp.</Th><Th>Difficulty</Th></tr>
      </thead>
      <tbody>
        {teams.map((t) => (
          <tr key={t.id} className="border-t border-neutral-800/60">
            <Td>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-1.5 rounded-sm" style={{ backgroundColor: t.color }} />
                {t.name}
              </span>
            </Td>
            <Td>{t.driverIds.map((id) => drivers.find((d) => d.id === id)?.name).join(', ')}</Td>
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

function DriversTable({ bundle }: { bundle: SeasonBundle }) {
  const { teams, drivers }: { teams: Team[]; drivers: Driver[] } = bundle;
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? id;
  return (
    <table className="w-full">
      <thead className="bg-neutral-900/60">
        <tr><Th>#</Th><Th>Driver</Th><Th>Team</Th><Th>OVR</Th><Th>Quali</Th><Th>Race</Th><Th>Corner</Th><Th>Overtake</Th><Th>Composure</Th></tr>
      </thead>
      <tbody>
        {[...drivers].sort((a, b) => b.ratings.overall - a.ratings.overall).map((d) => (
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

function CarsTable({ bundle }: { bundle: SeasonBundle }) {
  const { teams, cars }: { teams: Team[]; cars: Car[] } = bundle;
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? id;
  return (
    <table className="w-full">
      <thead className="bg-neutral-900/60">
        <tr><Th>Team</Th><Th>Engine</Th><Th>Aero</Th><Th>Mech Grip</Th><Th>Reliability</Th><Th>Pit Crew</Th></tr>
      </thead>
      <tbody>
        {cars.map((c) => (
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

function PointsTable({ bundle }: { bundle: SeasonBundle }) {
  const pts = getPointsSystem(bundle.season.pointsSystemId);
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

function RegistryTable() {
  const all = useMemo(() => registryList(), []);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const rows = useMemo(() => {
    const filtered = q
      ? all.filter(
          (e) =>
            e.canonicalName.includes(q) ||
            e.driverId.includes(q) ||
            (e.nationality ?? '').toLowerCase().includes(q),
        )
      : all;
    return filtered.slice(0, 400);
  }, [all, q]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-neutral-800 p-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name / id / nationality…"
          className="w-64 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200"
        />
        <span className="text-xs text-neutral-500">
          {all.length} canonical drivers · showing {rows.length}
        </span>
      </div>
      <table className="w-full">
        <thead className="bg-neutral-900/60">
          <tr>
            <Th>Driver</Th><Th>Nat</Th><Th>Born</Th><Th>Pref</Th><Th>Eligible</Th>
            <Th>Status</Th><Th>Mkt Entry</Th><Th>Academy</Th><Th>Adult</Th>
            <Th>OVR</Th><Th>Pot</Th><Th>Seasons</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.driverId} className="border-t border-neutral-800/60">
              <Td>{e.displayName}</Td>
              <Td>{e.nationality ?? '—'}</Td>
              <Td>{e.birthYear ?? '—'}</Td>
              <Td>{e.preferredSeries}</Td>
              <Td>{e.eligibleSeries.join(', ')}</Td>
              <Td><span className="rounded bg-neutral-800 px-1.5 py-0.5 text-xs">{e.careerStatus}</span></Td>
              <Td>{e.marketEntryYear}</Td>
              <Td>{e.academyEligibleYear ?? '—'}</Td>
              <Td>{e.adultEligibleYear ?? '—'}</Td>
              <Td><RatingBadge value={e.baseRatings.overall} /></Td>
              <Td>{e.potential.toFixed(1)}</Td>
              <Td>{e.baseRatingsByYear.length}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
