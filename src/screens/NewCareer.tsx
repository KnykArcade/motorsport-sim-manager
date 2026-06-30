import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { getSeasonBundle, availableSeasons, availableSeries } from '../data';
import { effectiveCarRatings } from '../sim/trackFitEngine';
import { Button } from '../components/Button';
import { StatBar } from '../components/StatBar';
import { formatMoney } from '../components/ui';
import { hasSave } from '../game/saveSystem';
import { PrincipalCreator } from './PrincipalCreator';
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

  const selectSeries = (next: Series) => {
    setSeries(next);
    const first = availableSeasons.find((s) => s.series === next);
    if (first) setYear(first.year);
    setSelectedTeamId(null);
  };

  const bundle = useMemo(() => getSeasonBundle(year, series), [year, series]);

  const startGame = (teamPrincipal: TeamPrincipal) => {
    if (!selectedTeamId) return;
    if (hasSave() && !confirm('Starting a new game overwrites your existing save. Continue?')) {
      return;
    }
    dispatch({
      type: 'NEW_GAME',
      options: { gameMode: mode, seasonYear: year, series, teamId: selectedTeamId, teamPrincipal },
    });
    navigate('/hq');
  };

  const selectedTeam = bundle?.teams.find((t) => t.id === selectedTeamId);

  return (
    <div className="min-h-screen bg-[#0a0c10] px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <button onClick={() => navigate('/')} className="mb-6 text-sm text-neutral-500 hover:text-neutral-300">
          ← Main Menu
        </button>

        <Steps step={step} />

        {step === 'mode' && (
          <div className="grid gap-4 md:grid-cols-2">
            <ModeCard
              title="Single Season Mode"
              blurb="Replay one historical season from start to finish. Best for quick historical what-if simulations."
              selected={mode === 'SingleSeason'}
              onClick={() => setMode('SingleSeason')}
              bullets={['Full historical calendar', 'Race weekend decisions', 'In-season development', 'Season review at the end']}
            />
            <ModeCard
              title="Career Mode"
              blurb="Start in a historical year and continue across multiple seasons with offseason, regulations, and long-term development."
              selected={mode === 'Career'}
              onClick={() => setMode('Career')}
              bullets={['Multi-year progression', 'Offseason & budget allocation', 'Regulation changes', 'Development carryover']}
            />
            <div className="md:col-span-2 flex justify-end">
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

        {step === 'team' && bundle && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {bundle.teams.map((team) => {
                const car = bundle.cars.find((c) => c.id === team.carId);
                const drivers = bundle.drivers.filter((d) => d.teamId === team.id);
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
            confirmLabel={`Start ${mode === 'Career' ? 'Career' : 'Season'}`}
            onBack={() => setStep('team')}
            onConfirm={startGame}
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

