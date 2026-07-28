import { useEffect, useMemo, useReducer, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  availableSeasons,
  initializeMasterRegistry,
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
import {
  MetricStrip,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceMetric,
  WorkspaceScreen,
} from '../components/workspace/Workspace';

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

const TAB_CONTEXT: Record<Tab, { description: string; fields: string }> = {
  calendar: { description: 'The complete selected-season schedule and race distances.', fields: 'Round, event, circuit, laps, distance' },
  tracks: { description: 'Circuit characteristics and setup-demand ratings used by the simulation.', fields: 'Archetype, attributes, aero, power, mechanical, risk' },
  teams: { description: 'Historical entrants with their initial budget, reputation, expectations, and lineup.', fields: 'Team, drivers, budget, reputation, expected finish, difficulty' },
  drivers: { description: 'The selected season grid and its state-backed driver ratings.', fields: 'Number, driver, team, overall, pace, racecraft, composure' },
  cars: { description: 'Team car and pit-operations ratings at the start of the selected season.', fields: 'Engine, aero, grip, reliability, pit crew' },
  points: { description: 'The points table assigned to the selected championship.', fields: 'Finishing position and points awarded' },
  setups: { description: 'Global setup options and their deterministic performance trade-offs.', fields: 'Downforce, speed, grip, braking, tyres, pace, risk' },
  development: { description: 'Available car-development projects and their cost, timing, and carryover.', fields: 'Category, horizon, cost, races, success, carryover' },
  registry: { description: 'The canonical driver registry shared across historical seasons and career markets.', fields: 'Identity, eligibility, career status, ratings, season records' },
};

const seasonKey = (year: number, series: Series) => `${year}-${series}`;

export function DataViewer() {
  const [tab, setTab] = useState<Tab>('calendar');
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { state } = useGame();
  const [registryReady, setRegistryReady] = useState(false);

  // Ensure the master registry is initialized (needed for the Registry tab).
  useEffect(() => {
    let cancelled = false;
    initializeMasterRegistry()
      .then(() => {
        if (!cancelled) setRegistryReady(true);
      })
      .catch(() => {
        if (!cancelled) setRegistryReady(false);
      });
    return () => { cancelled = true; };
  }, []);

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

  const cachedBundle = useMemo(() => getCachedBundle(choice.year, choice.series), [choice.year, choice.series]);

  const [asyncState, dispatchAsync] = useReducer(
    (_state: { bundle?: SeasonBundle; loading: boolean }, action: { type: 'loaded'; bundle?: SeasonBundle } | { type: 'start' }) => {
      if (action.type === 'start') return { loading: true };
      return { bundle: action.bundle, loading: false };
    },
    { loading: !getCachedBundle(choice.year, choice.series) }
  );

  useEffect(() => {
    if (cachedBundle) {
      return;
    }
    let cancelled = false;
    dispatchAsync({ type: 'start' });
    loadSeasonBundle(choice.year, choice.series)
      .then((b) => {
        if (cancelled) return;
        dispatchAsync({ type: 'loaded', bundle: b });
      })
      .catch(() => {
        if (cancelled) return;
        dispatchAsync({ type: 'loaded' });
      });
    return () => { cancelled = true; };
  }, [choice.year, choice.series, cachedBundle]);

  const loadingBundle = !cachedBundle && asyncState.loading;
  const activeBundle = cachedBundle ?? asyncState.bundle;

  return (
    <WorkspaceScreen className="era-feature-screen era-data-viewer-screen">
      <WorkspaceHeader
        eyebrow="Archive lab"
        title="Data Viewer"
        subtitle={`${choice.label} · Read-only source data and simulation reference tables`}
        actions={<Button variant="ghost" onClick={() => navigate(-1)}>← Back</Button>}
      />
      <div className="ui-data-viewer-toolbar">
        <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500" htmlFor="data-viewer-season">Season dataset</label>
        <select
          id="data-viewer-season"
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
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${TABS.find((item) => item.id === tab)?.label.toLowerCase()}…`}
          aria-label="Search selected dataset"
        />
        <span>Read-only research workspace</span>
      </div>
      <MetricStrip>
        <WorkspaceMetric label="Calendar rounds" value={activeBundle?.season.calendar.length ?? '—'} detail="Selected season schedule" />
        <WorkspaceMetric label="Teams" value={activeBundle?.teams.length ?? '—'} detail="Loaded entries" />
        <WorkspaceMetric label="Drivers" value={activeBundle?.drivers.length ?? '—'} detail="Loaded entries" />
        <WorkspaceMetric label="Registry" value={registryReady ? 'Ready' : 'Loading'} detail="Master data index" />
      </MetricStrip>
      <WorkspaceBody>
        <div className="ui-data-viewer-grid">
          <nav className="ui-data-viewer-categories" aria-label="Data viewer sections">
            <div className="ui-fm-pane-header">
              <div>
                <div className="ui-fm-pane-title">Dataset categories</div>
                <div className="ui-fm-pane-meta">{TABS.length} read-only tables</div>
              </div>
            </div>
            <div className="ui-fm-pane-body">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`ui-fm-list-button ${tab === item.id ? 'is-active' : ''}`}
                  onClick={() => {
                    setTab(item.id);
                    setQuery('');
                  }}
                >
                  <strong>{item.label}</strong>
                  <span>{TAB_CONTEXT[item.id].fields}</span>
                </button>
              ))}
            </div>
          </nav>
          <section className="ui-data-viewer-table">
          {tab === 'registry' ? (
            registryReady ? <RegistryTable query={query} /> : <p className="p-6 text-sm text-neutral-400">Loading registry data...</p>
          ) : loadingBundle ? (
            <p className="p-6 text-sm text-neutral-400">Loading season data…</p>
          ) : !activeBundle ? (
            <p className="p-6 text-sm text-neutral-400">No data for this season.</p>
          ) : (
            <>
              {tab === 'calendar' && <CalendarTable bundle={activeBundle} query={query} />}
              {tab === 'tracks' && <TracksTable bundle={activeBundle} query={query} />}
              {tab === 'teams' && <TeamsTable bundle={activeBundle} query={query} />}
              {tab === 'drivers' && <DriversTable bundle={activeBundle} query={query} />}
              {tab === 'cars' && <CarsTable bundle={activeBundle} query={query} />}
              {tab === 'points' && <PointsTable bundle={activeBundle} query={query} />}
              {tab === 'setups' && <SetupsTable query={query} />}
              {tab === 'development' && <DevTable query={query} />}
            </>
          )}
          </section>
          <aside className="ui-data-viewer-context">
            <div className="ui-fm-pane-header">
              <div>
                <div className="ui-fm-pane-title">Dataset context</div>
                <div className="ui-fm-pane-meta">{choice.label}</div>
              </div>
            </div>
            <div className="ui-fm-scroll-column">
              <div className="ui-fm-section-label">{TABS.find((item) => item.id === tab)?.label}</div>
              <p className="ui-fm-detail-copy mt-2">{TAB_CONTEXT[tab].description}</p>
              <div className="mt-4">
                <div className="ui-fm-key-value"><span>Access</span><strong>Read only</strong></div>
                <div className="ui-fm-key-value"><span>Season</span><strong>{choice.label}</strong></div>
                <div className="ui-fm-key-value"><span>Fields</span><strong>{TAB_CONTEXT[tab].fields}</strong></div>
                <div className="ui-fm-key-value"><span>Search</span><strong>{query.trim() || 'All records'}</strong></div>
              </div>
              <p className="mt-4 text-[11px] leading-5 text-neutral-500">
                Values are loaded from the game&apos;s source datasets. Editing is intentionally disabled.
              </p>
            </div>
          </aside>
        </div>
      </WorkspaceBody>
    </WorkspaceScreen>
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

function CalendarTable({ bundle, query }: { bundle: SeasonBundle; query: string }) {
  return (
    <table className="w-full">
      <thead className="bg-neutral-900/60">
        <tr><Th>#</Th><Th>Grand Prix</Th><Th>Track</Th><Th>Laps</Th><Th>Distance</Th></tr>
      </thead>
      <tbody>
        {bundle.season.calendar.filter((r) => matchesSearch(query, r.gpName, r.trackName, r.round)).map((r) => (
          <tr key={r.id} className="border-t border-neutral-800/60">
            <Td>{r.round}</Td><Td>{r.gpName}</Td><Td>{r.trackName}</Td><Td>{r.laps}</Td><Td>{r.distanceKm ?? '—'} km</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TracksTable({ bundle, query }: { bundle: SeasonBundle; query: string }) {
  return (
    <table className="w-full">
      <thead className="bg-neutral-900/60">
        <tr>
          <Th>Track</Th><Th>Archetype</Th><Th>Corners</Th><Th>Braking</Th><Th>Straights</Th>
          <Th>Technical</Th><Th>Risk</Th><Th>Aero D</Th><Th>Power D</Th><Th>Mech D</Th><Th>Risk D</Th>
        </tr>
      </thead>
      <tbody>
        {seasonTracks(bundle).filter((t) => matchesSearch(query, t.name, t.archetype)).map((t) => (
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

function TeamsTable({ bundle, query }: { bundle: SeasonBundle; query: string }) {
  const { teams, drivers }: { teams: Team[]; drivers: Driver[] } = bundle;
  return (
    <table className="w-full">
      <thead className="bg-neutral-900/60">
        <tr><Th>Team</Th><Th>Drivers</Th><Th>Budget</Th><Th>Reputation</Th><Th>Exp.</Th><Th>Difficulty</Th></tr>
      </thead>
      <tbody>
        {teams.filter((t) => matchesSearch(query, t.name, t.difficulty, t.expectedStanding)).map((t) => (
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

function DriversTable({ bundle, query }: { bundle: SeasonBundle; query: string }) {
  const { teams, drivers }: { teams: Team[]; drivers: Driver[] } = bundle;
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? id;
  return (
    <table className="w-full">
      <thead className="bg-neutral-900/60">
        <tr><Th>#</Th><Th>Driver</Th><Th>Team</Th><Th>OVR</Th><Th>Quali</Th><Th>Race</Th><Th>Corner</Th><Th>Overtake</Th><Th>Composure</Th></tr>
      </thead>
      <tbody>
        {[...drivers].filter((d) => matchesSearch(query, d.name, teamName(d.teamId), d.number)).sort((a, b) => b.ratings.overall - a.ratings.overall).map((d) => (
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

function CarsTable({ bundle, query }: { bundle: SeasonBundle; query: string }) {
  const { teams, cars }: { teams: Team[]; cars: Car[] } = bundle;
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? id;
  return (
    <table className="w-full">
      <thead className="bg-neutral-900/60">
        <tr><Th>Team</Th><Th>Engine</Th><Th>Aero</Th><Th>Mech Grip</Th><Th>Reliability</Th><Th>Pit Crew</Th></tr>
      </thead>
      <tbody>
        {cars.filter((c) => matchesSearch(query, teamName(c.teamId))).map((c) => (
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

function PointsTable({ bundle, query }: { bundle: SeasonBundle; query: string }) {
  const pts = getPointsSystem(bundle.season.pointsSystemId);
  return (
    <table className="w-full">
      <thead className="bg-neutral-900/60"><tr><Th>Position</Th><Th>Points</Th></tr></thead>
      <tbody>
        {Object.entries(pts.pointsByPosition).filter(([pos, p]) => matchesSearch(query, pos, p)).map(([pos, p]) => (
          <tr key={pos} className="border-t border-neutral-800/60"><Td>P{pos}</Td><Td>{p}</Td></tr>
        ))}
      </tbody>
    </table>
  );
}

function SetupsTable({ query }: { query: string }) {
  return (
    <table className="w-full">
      <thead className="bg-neutral-900/60">
        <tr><Th>Setup</Th><Th>DF</Th><Th>Top Spd</Th><Th>Mech</Th><Th>Brake</Th><Th>Tire</Th><Th>Quali</Th><Th>Race</Th><Th>Risk</Th></tr>
      </thead>
      <tbody>
        {setupOptions.filter((s) => matchesSearch(query, s.name)).map((s) => (
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

function RegistryTable({ query }: { query: string }) {
  const all = useMemo(() => registryList(), []);
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

function DevTable({ query }: { query: string }) {
  return (
    <table className="w-full">
      <thead className="bg-neutral-900/60">
        <tr><Th>Project</Th><Th>Category</Th><Th>Horizon</Th><Th>Cost</Th><Th>Races</Th><Th>Success</Th><Th>Carryover</Th></tr>
      </thead>
      <tbody>
        {developmentProjectCatalog.filter((p) => matchesSearch(query, p.name, p.category, p.horizon)).map((p) => (
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

function matchesSearch(query: string, ...values: Array<string | number | undefined>): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return values.some((value) => String(value ?? '').toLowerCase().includes(normalized));
}
