import { useEffect, useMemo, useReducer, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { availableSeasons, seriesGroups, loadSeasonBundle, getCachedBundle, initializeMasterRegistry, preloadMarketBundle, type SeasonBundle, type SeriesGroup } from '../data';
import { effectiveCarRatings } from '../sim/trackFitEngine';
import { Button } from '../components/Button';
import { StatBar } from '../components/StatBar';
import { formatMoney } from '../components/ui';
import { hasSave } from '../game/saveSystem';
import { PrincipalCreator } from './PrincipalCreator';
import { SINGLE_SEASON_LOCKED_FEATURES, isSingleSeasonMode } from '../game/modeRestrictions';
import type { GameMode, Series } from '../types/gameTypes';
import type { TeamPrincipal } from '../types/principalTypes';

type Step = 'mode' | 'setup' | 'team' | 'principal';


export function NewCareer() {
  const navigate = useNavigate();
  const { dispatch } = useGame();
  const [step, setStep] = useState<Step>('mode');
  const [mode, setMode] = useState<GameMode>('SingleSeason');
  const [year, setYear] = useState(1995);
  const [series, setSeries] = useState<Series>('F1');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [, setPrincipal] = useState<TeamPrincipal | null>(null);
  const [selectedDecade, setSelectedDecade] = useState<number | null>(1990);
  const [groupId, setGroupId] = useState<string>('F1');
  // A stable seed so the engine offers shown here match the created save.
  const [seed] = useState(() => `seed-${Date.now()}`);

  const selectSeries = (next: Series) => {
    setSeries(next);
    const first = availableSeasons.find((s) => s.series === next);
    if (first) setYear(first.year);
    setSelectedDecade(null);
    setSelectedTeamId(null);
  };

  const selectGroup = (group: SeriesGroup) => {
    setGroupId(group.id);
    // Single-discipline groups (F1) resolve straight to their series;
    // multi-discipline groups (AOW) default to their first discipline and
    // still show a discipline picker.
    selectSeries(group.disciplines[0].id);
  };

  const activeGroup = seriesGroups.find((g) => g.id === groupId) ?? seriesGroups[0];

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
    Promise.all([
      loadSeasonBundle(year, series),
      preloadMarketBundle(year, series),
    ])
      .then(([b]) => {
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

  const startGame = async (teamPrincipal: TeamPrincipal) => {
    if (!selectedTeamId) return;
    if (hasSave() && !confirm('Starting a new game overwrites your existing save. Continue?')) {
      return;
    }
    // Populate the master registry from lazily loaded season data.
    await initializeMasterRegistry(year, series);
    dispatch({
      type: 'NEW_GAME',
      options: {
        gameMode: mode,
        seasonYear: year,
        series,
        teamId: selectedTeamId,
        teamPrincipal,
        seed,
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
    await initializeMasterRegistry(year, series);
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
  const seriesSeasons = availableSeasons.filter((s) => s.series === series);
  const decadeOptions = Array.from(new Set(seriesSeasons.map((s) => Math.floor(s.year / 10) * 10))).sort((a, b) => a - b);
  const visibleSeasonOptions = selectedDecade == null
    ? []
    : seriesSeasons.filter((s) => Math.floor(s.year / 10) * 10 === selectedDecade);
  const chooseDecade = (decade: number) => {
    setSelectedDecade(decade);
    const first = seriesSeasons.find((s) => Math.floor(s.year / 10) * 10 === decade);
    if (first) {
      setYear(first.year);
      setSelectedTeamId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0c10] px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <button onClick={() => navigate('/')} className="mb-6 text-sm text-neutral-500 hover:text-neutral-300">
          ← Main Menu
        </button>

        <Steps step={step} />

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
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-neutral-100">Choose Series & Season</h2>
                <p className="text-sm text-neutral-400">Pick a series, then choose a decade before selecting a specific season.</p>
              </div>
              <Button variant="primary" onClick={() => setStep('team')}>
                Select Team
              </Button>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-neutral-300">Series</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {seriesGroups.map((g) => {
                  const seasonCount = availableSeasons.filter((y) =>
                    g.disciplines.some((d) => d.id === y.series)
                  ).length;
                  return (
                    <button
                      key={g.id}
                      onClick={() => selectGroup(g)}
                      className={`rounded-xl border p-4 text-left transition ${
                        groupId === g.id
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700'
                      }`}
                    >
                      <div className="text-lg font-semibold text-neutral-100">{g.label}</div>
                      <div className="text-xs text-neutral-400">{g.blurb}</div>
                      <div className="mt-1 text-xs text-neutral-500">{seasonCount} season(s) available</div>
                    </button>
                  );
                })}
              </div>
            </div>
            {activeGroup.disciplines.length > 1 && (
              <div>
                <p className="mb-2 text-sm font-medium text-neutral-300">Discipline</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {activeGroup.disciplines.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => selectSeries(d.id)}
                      className={`rounded-xl border p-4 text-left transition ${
                        series === d.id
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700'
                      }`}
                    >
                      <div className="text-base font-semibold text-neutral-100">{d.label}</div>
                      <div className="text-xs text-neutral-400">
                        {availableSeasons.filter((y) => y.series === d.id).length} season(s) available
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="mb-2 text-sm font-medium text-neutral-300">Era</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {decadeOptions.map((decade) => {
                  const count = seriesSeasons.filter((s) => Math.floor(s.year / 10) * 10 === decade).length;
                  return (
                    <button
                      key={decade}
                      onClick={() => chooseDecade(decade)}
                      className={`rounded-xl border p-4 text-left transition ${
                        selectedDecade === decade
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700'
                      }`}
                    >
                      <div className="text-lg font-semibold text-neutral-100">{decade}s</div>
                      <div className="text-xs text-neutral-400">{count} season{count === 1 ? '' : 's'}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            {selectedDecade != null && (
              <div>
                <p className="mb-2 text-sm font-medium text-neutral-300">Starting Season</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleSeasonOptions.map((s) => (
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
            )}
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep('mode')}>
                ← Back
              </Button>
              <Button variant="primary" onClick={() => setStep('team')}>
                Select Team
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
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-neutral-100">Select Team</h2>
                <p className="text-sm text-neutral-400">{year} {series}</p>
              </div>
              <Button variant="primary" disabled={!selectedTeamId} onClick={() => setStep('principal')}>
                Create Principal
              </Button>
            </div>
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
                        <StatBar label="Engine" value={ratings.enginePower} max={100} />
                        <StatBar label="Aero" value={ratings.aeroEfficiency} max={100} />
                        <StatBar label="Mech Grip" value={ratings.mechanicalGrip} max={100} />
                        <StatBar label="Reliability" value={ratings.reliability} max={100} />
                        <StatBar label="Pit Crew" value={ratings.pitCrewOperations} max={100} />
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
                Create Principal`n              </Button>
            </div>
          </div>
        )}

        {step === 'principal' && selectedTeam && (
          <PrincipalCreator
            teamName={selectedTeam.name}
            teamColor={selectedTeam.color}
            confirmLabel={`Start ${mode === 'Career' ? 'Career' : mode === 'Sandbox' ? 'Sandbox' : 'Season'}`}
            onBack={() => setStep('team')}
            onConfirm={(tp) => {
              setPrincipal(tp);
              if (mode === 'SingleSeason') {
                startSingleSeason(tp);
              } else {
                startGame(tp);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

function Steps({ step }: { step: Step }) {
  const order: Step[] = ['mode', 'setup', 'team', 'principal'];
  const labels: Record<Step, string> = {
    mode: 'Game Mode',
    setup: 'Series & Year',
    team: 'Team',
    principal: 'Principal',
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




