import { useEffect, useMemo, useReducer, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { availableSeasons, availableSeries, loadSeasonBundle, getCachedBundle, type SeasonBundle } from '../data';
import { effectiveCarRatings } from '../sim/trackFitEngine';
import { Button } from '../components/Button';
import { StatBar } from '../components/StatBar';
import { formatMoney } from '../components/ui';
import { hasSave } from '../game/saveSystem';
import { PrincipalCreator } from './PrincipalCreator';
import {
  ENGINE_DEAL_SPECS,
  availableEngineOffers,
  createInitialEngineState,
  isManufacturerDeal,
  type EngineOffer,
} from '../sim/engineSupplierEngine';
import { Panel } from '../components/Panel';
import { SINGLE_SEASON_LOCKED_FEATURES, isSingleSeasonMode } from '../game/modeRestrictions';
import type { GameMode, Series, Team } from '../types/gameTypes';
import type { TeamPrincipal } from '../types/principalTypes';
import type { EngineDealType } from '../types/engineTypes';

type Step = 'mode' | 'setup' | 'team' | 'principal' | 'engine' | 'lockedEngine';

type EngineChoice = { supplierId: string; dealType: EngineDealType };

export function NewCareer() {
  const navigate = useNavigate();
  const { dispatch } = useGame();
  const [step, setStep] = useState<Step>('mode');
  const [mode, setMode] = useState<GameMode>('SingleSeason');
  const [year, setYear] = useState(1995);
  const [series, setSeries] = useState<Series>('F1');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [principal, setPrincipal] = useState<TeamPrincipal | null>(null);
  const [engineChoice, setEngineChoice] = useState<EngineChoice | null>(null);
  // A stable seed so the engine offers shown here match the created save.
  const [seed] = useState(() => `seed-${Date.now()}`);

  const selectSeries = (next: Series) => {
    setSeries(next);
    const first = availableSeasons.find((s) => s.series === next);
    if (first) setYear(first.year);
    setSelectedTeamId(null);
  };

  const cachedBundle = useMemo(() => getCachedBundle(year, series), [year, series]);

  const [asyncState, dispatchAsync] = useReducer(
    (_state: { bundle?: SeasonBundle; loading: boolean; error: string | null }, action: { type: 'loaded'; bundle?: SeasonBundle } | { type: 'error' } | { type: 'start' }) => {
      if (action.type === 'start') return { loading: true, error: null };
      if (action.type === 'error') return { loading: false, error: 'Failed to load season data. Please try again.' };
      return { bundle: action.bundle, loading: false, error: null };
    },
    { loading: !getCachedBundle(year, series), error: null }
  );

  useEffect(() => {
    if (cachedBundle) {
      return;
    }
    let cancelled = false;
    dispatchAsync({ type: 'start' });
    loadSeasonBundle(year, series)
      .then((b) => {
        if (cancelled) return;
        dispatchAsync({ type: 'loaded', bundle: b });
      })
      .catch(() => {
        if (cancelled) return;
        dispatchAsync({ type: 'error' });
      });
    return () => { cancelled = true; };
  }, [year, series, cachedBundle]);

  const loadingBundle = !cachedBundle && asyncState.loading;
  const bundleError = !cachedBundle ? asyncState.error : null;
  const activeBundle = cachedBundle ?? asyncState.bundle;

  const startGame = async (teamPrincipal: TeamPrincipal, choice: EngineChoice | null) => {
    if (!selectedTeamId) return;
    if (hasSave() && !confirm('Starting a new game overwrites your existing save. Continue?')) {
      return;
    }
    // Dynamically import full season data to populate the master registry
    // (needed for career market / cross-series engine). This is code-split
    // so it doesn't bloat the initial bundle.
    await import('../data/seasonData');
    dispatch({
      type: 'NEW_GAME',
      options: {
        gameMode: mode,
        seasonYear: year,
        series,
        teamId: selectedTeamId,
        teamPrincipal,
        seed,
        initialEngineSupplierId: choice?.supplierId,
        initialEngineDealType: choice?.dealType,
        bundle: activeBundle,
      },
    });
    navigate('/hq');
  };

  // For Single Season mode, skip engine selection and auto-assign the historical deal.
  const startSingleSeason = async (teamPrincipal: TeamPrincipal) => {
    if (!selectedTeamId) return;
    if (hasSave() && !confirm('Starting a new game overwrites your existing save. Continue?')) {
      return;
    }
    await import('../data/seasonData');
    dispatch({
      type: 'NEW_GAME',
      options: {
        gameMode: 'SingleSeason',
        seasonYear: year,
        series,
        teamId: selectedTeamId,
        teamPrincipal,
        seed,
        bundle: activeBundle,
        // No engine choice — createNewGame auto-assigns the historical deal.
      },
    });
    navigate('/hq');
  };

  const selectedTeam = activeBundle?.teams.find((t) => t.id === selectedTeamId);

  return (
    <div className="min-h-screen bg-[#0a0c10] px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <button onClick={() => navigate('/')} className="mb-6 text-sm text-neutral-500 hover:text-neutral-300">
          ← Main Menu
        </button>

        <Steps step={step} mode={mode} />

        {step === 'mode' && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <ModeCard
                title="Single Season Mode"
                blurb="Replay one historical season. Engine and sponsors are locked to history — focus on race strategy and in-season management."
                selected={mode === 'SingleSeason'}
                onClick={() => setMode('SingleSeason')}
                bullets={['Full historical calendar', 'Race weekend decisions', 'In-season development', 'Locked engine & sponsors', 'No offseason or multi-year systems']}
              />
              <ModeCard
                title="Career Mode"
                blurb="Start in a historical year and continue across multiple seasons with offseason, regulations, and long-term development."
                selected={mode === 'Career'}
                onClick={() => setMode('Career')}
                bullets={['Multi-year progression', 'Offseason & budget allocation', 'Regulation changes', 'Development carryover']}
              />
              <ModeCard
                title="Sandbox Mode"
                blurb="Flexible play mode with access to all systems. No restrictions — experiment with any season, any team, any combination."
                selected={mode === 'Sandbox'}
                onClick={() => setMode('Sandbox')}
                bullets={['All systems unlocked', 'No mode restrictions', 'Full career features', 'Experiment freely']}
              />
            </div>
            {isSingleSeasonMode(mode) && (
              <div className="rounded-lg border border-amber-800/40 bg-amber-900/10 p-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg text-amber-400">🔒</span>
                  <span className="text-sm font-semibold text-amber-300">What's locked in Single Season Mode</span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {SINGLE_SEASON_LOCKED_FEATURES.map((f) => (
                    <div key={f.label} className="text-xs">
                      <span className="font-medium text-neutral-300">{f.label}</span>
                      <span className="text-neutral-500"> — {f.description}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-xs text-sky-400">
                  You still control: race strategy, qualifying plans, in-season car development, driver morale, and staff management.
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <Button variant="primary" onClick={() => setStep('setup')}>
                Continue →
              </Button>
            </div>
          </div>
        )}

        {step === 'setup' && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium text-neutral-300">Series</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {availableSeries.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => selectSeries(s.id)}
                    className={`rounded-xl border p-4 text-left transition ${
                      series === s.id
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700'
                    }`}
                  >
                    <div className="text-lg font-semibold text-neutral-100">{s.label}</div>
                    <div className="text-xs text-neutral-400">
                      {availableSeasons.filter((y) => y.series === s.id).length} season(s) available
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-neutral-300">Starting Season</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {availableSeasons
                  .filter((s) => s.series === series)
                  .map((s) => (
                    <button
                      key={s.year}
                      onClick={() => {
                        setYear(s.year);
                        setSelectedTeamId(null);
                      }}
                      className={`rounded-xl border p-4 text-left transition ${
                        year === s.year
                          ? 'border-sky-500 bg-sky-500/10'
                          : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700'
                      }`}
                    >
                      <div className="text-lg font-semibold text-neutral-100">{s.year}</div>
                      <div className="text-xs text-neutral-400">{s.label}</div>
                    </button>
                  ))}
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep('mode')}>
                ← Back
              </Button>
              <Button variant="primary" onClick={() => setStep('team')}>
                Select Team →
              </Button>
            </div>
          </div>
        )}

        {step === 'team' && loadingBundle && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-400">Loading season data…</p>
          </div>
        )}

        {step === 'team' && bundleError && (
          <div className="space-y-4">
            <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-300">
              {bundleError}
            </div>
            <Button variant="ghost" onClick={() => setStep('setup')}>← Back</Button>
          </div>
        )}

        {step === 'team' && activeBundle && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {activeBundle.teams.map((team) => {
                const car = activeBundle.cars.find((c) => c.id === team.carId);
                const drivers = activeBundle.drivers.filter((d) => d.teamId === team.id);
                const ratings = car ? effectiveCarRatings(car) : null;
                const selected = selectedTeamId === team.id;
                return (
                  <button
                    key={team.id}
                    onClick={() => setSelectedTeamId(team.id)}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      selected
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-600'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-5 w-1.5 rounded-sm" style={{ backgroundColor: team.color }} />
                        <span className="font-bold text-neutral-100">{team.name}</span>
                      </div>
                      <span className="rounded bg-neutral-800 px-2 py-0.5 text-[10px] uppercase text-neutral-400">
                        {team.difficulty}
                      </span>
                    </div>
                    <div className="mb-3 text-xs text-neutral-400">
                      {drivers.map((d) => `#${d.number} ${d.name}`).join('  •  ')}
                    </div>
                    {ratings && (
                      <div className="space-y-1">
                        <StatBar label="Engine" value={ratings.enginePower} />
                        <StatBar label="Aero" value={ratings.aeroEfficiency} />
                        <StatBar label="Mech Grip" value={ratings.mechanicalGrip} />
                        <StatBar label="Reliability" value={ratings.reliability} />
                        <StatBar label="Pit Crew" value={ratings.pitCrewOperations} />
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
                      <span>Budget {formatMoney(team.budget)}</span>
                      <span>Exp. P{team.expectedStanding}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep('setup')}>
                ← Back
              </Button>
              <Button variant="primary" disabled={!selectedTeamId} onClick={() => setStep('principal')}>
                Create Principal →
              </Button>
            </div>
          </div>
        )}

        {step === 'principal' && selectedTeam && (
          <PrincipalCreator
            teamName={selectedTeam.name}
            teamColor={selectedTeam.color}
            confirmLabel={mode === 'SingleSeason' ? 'Start Season →' : 'Choose Engine →'}
            onBack={() => setStep('team')}
            onConfirm={(tp) => {
              setPrincipal(tp);
              if (mode === 'SingleSeason') {
                startSingleSeason(tp);
              } else {
                setStep('engine');
              }
            }}
          />
        )}

        {step === 'engine' && selectedTeam && activeBundle && (
          <EngineSelectStep
            teams={activeBundle.teams}
            teamId={selectedTeam.id}
            teamName={selectedTeam.name}
            year={year}
            series={series}
            seed={seed}
            value={engineChoice}
            onChange={setEngineChoice}
            confirmLabel={`Start ${mode === 'Career' ? 'Career' : mode === 'Sandbox' ? 'Sandbox' : 'Season'}`}
            onBack={() => setStep('principal')}
            onConfirm={(choice) => {
              if (principal) startGame(principal, choice);
            }}
          />
        )}
      </div>
    </div>
  );
}

function EngineSelectStep({
  teams,
  teamId,
  teamName,
  year,
  series,
  seed,
  value,
  onChange,
  confirmLabel,
  onBack,
  onConfirm,
}: {
  teams: Team[];
  teamId: string;
  teamName: string;
  year: number;
  series: Series;
  seed: string;
  value: EngineChoice | null;
  onChange: (c: EngineChoice) => void;
  confirmLabel: string;
  onBack: () => void;
  onConfirm: (c: EngineChoice) => void;
}) {
  const team = teams.find((t) => t.id === teamId)!;
  const { offers, defaultChoice } = useMemo(() => {
    const engine = createInitialEngineState(teams, teamId, year, series, seed);
    const list = availableEngineOffers(engine, team);
    const cur = engine.currentDeal;
    const def: EngineChoice | null = cur
      ? {
          supplierId: list.find((o) => o.supplier.name === cur.supplierName && o.dealType === cur.dealType)?.supplier.id ??
            list[0]?.supplier.id ?? '',
          dealType: cur.dealType,
        }
      : list[0]
      ? { supplierId: list[0].supplier.id, dealType: list[0].dealType }
      : null;
    return { offers: list, defaultChoice: def };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, teamId, year, series, seed]);

  const selected = value ?? defaultChoice;
  const bySupplier = new Map<string, EngineOffer[]>();
  for (const o of offers) {
    const list = bySupplier.get(o.supplier.name) ?? [];
    list.push(o);
    bySupplier.set(o.supplier.name, list);
  }
  const isSelected = (o: EngineOffer) =>
    selected?.supplierId === o.supplier.id && selected?.dealType === o.dealType;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-neutral-100">Choose your engine — {teamName}</h2>
        <p className="text-sm text-neutral-400">
          Pick the supplier and deal tier you begin the season with. Works and factory deals start a
          manufacturer relationship with a performance target. You can renegotiate later (for a buyout fee).
        </p>
      </div>
      <Panel title="Available Engine Deals">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...bySupplier.entries()].map(([supplierName, list]) => (
            <div key={supplierName} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-bold text-neutral-100">{supplierName}</span>
                <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                  Pwr {list[0].supplier.basePower} · Rel {list[0].supplier.baseReliability}
                </span>
              </div>
              <div className="space-y-2">
                {list.map((o) => {
                  const sel = isSelected(o);
                  return (
                    <button
                      key={o.dealType}
                      type="button"
                      onClick={() => onChange({ supplierId: o.supplier.id, dealType: o.dealType })}
                      className={`w-full rounded-md border p-2 text-left transition ${
                        sel
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-neutral-800/80 hover:border-neutral-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-neutral-200">
                          {ENGINE_DEAL_SPECS[o.dealType].label}
                          {isManufacturerDeal(o.dealType) && (
                            <span className="ml-1 text-[10px] uppercase text-amber-400">manufacturer</span>
                          )}
                        </span>
                        <span className="text-xs font-semibold text-amber-300">${o.annualCost}M/yr</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-neutral-300">
                        <span className="rounded bg-neutral-800/60 px-1.5 py-0.5">
                          Power {o.bonus.power >= 0 ? '+' : ''}{o.bonus.power.toFixed(2)}
                        </span>
                        <span className="rounded bg-neutral-800/60 px-1.5 py-0.5">
                          Reliability {o.bonus.reliability >= 0 ? '+' : ''}{o.bonus.reliability.toFixed(2)}
                        </span>
                        <span className="rounded bg-neutral-800/60 px-1.5 py-0.5">{o.upgradeFrequency} upgrades/yr</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          ← Back
        </Button>
        <Button variant="primary" disabled={!selected} onClick={() => selected && onConfirm(selected)}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}

function Steps({ step, mode }: { step: Step; mode: GameMode }) {
  const order: Step[] = mode === 'SingleSeason'
    ? ['mode', 'setup', 'team', 'principal']
    : ['mode', 'setup', 'team', 'principal', 'engine'];
  const labels: Record<Step, string> = {
    mode: 'Game Mode',
    setup: 'Series & Year',
    team: 'Team',
    principal: 'Principal',
    engine: 'Engine',
    lockedEngine: 'Engine',
  };
  return (
    <div className="mb-8 flex items-center gap-2 text-sm">
      {order.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
              step === s ? 'bg-amber-500 text-neutral-950' : 'bg-neutral-800 text-neutral-400'
            }`}
          >
            {i + 1}
          </span>
          <span className={step === s ? 'text-neutral-100' : 'text-neutral-500'}>{labels[s]}</span>
          {i < order.length - 1 && <span className="mx-1 text-neutral-700">→</span>}
        </div>
      ))}
    </div>
  );
}

function ModeCard({
  title,
  blurb,
  bullets,
  selected,
  onClick,
}: {
  title: string;
  blurb: string;
  bullets: string[];
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-5 text-left transition-colors ${
        selected ? 'border-amber-500 bg-amber-500/10' : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-600'
      }`}
    >
      <h3 className="text-lg font-bold text-neutral-100">{title}</h3>
      <p className="mt-1 text-sm text-neutral-400">{blurb}</p>
      <ul className="mt-3 space-y-1 text-sm text-neutral-300">
        {bullets.map((b) => (
          <li key={b} className="flex items-center gap-2">
            <span className="text-amber-500">›</span>
            {b}
          </li>
        ))}
      </ul>
    </button>
  );
}

