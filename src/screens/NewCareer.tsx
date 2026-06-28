import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { getSeasonBundle } from '../data';
import { effectiveCarRatings } from '../sim/trackFitEngine';
import { Button } from '../components/Button';
import { StatBar } from '../components/StatBar';
import { formatMoney } from '../components/ui';
import { hasSave } from '../game/saveSystem';
import type { GameMode } from '../types/gameTypes';

type Step = 'mode' | 'setup' | 'team';

export function NewCareer() {
  const navigate = useNavigate();
  const { dispatch } = useGame();
  const [step, setStep] = useState<Step>('mode');
  const [mode, setMode] = useState<GameMode>('SingleSeason');
  const [year] = useState(1995);
  const [series] = useState<'F1'>('F1');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const bundle = useMemo(() => getSeasonBundle(year, series), [year, series]);

  const startGame = () => {
    if (!selectedTeamId) return;
    if (hasSave() && !confirm('Starting a new game overwrites your existing save. Continue?')) {
      return;
    }
    dispatch({ type: 'NEW_GAME', options: { gameMode: mode, seasonYear: year, series, teamId: selectedTeamId } });
    navigate('/hq');
  };

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
              bullets={['Full 1995 calendar', 'Race weekend decisions', 'In-season development', 'Season review at the end']}
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
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectCard label="Series" value="Formula 1" note="More series coming later" />
              <SelectCard label="Starting Year" value="1995" note="Only fully-seeded season for the MVP" />
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
              <Button variant="primary" disabled={!selectedTeamId} onClick={startGame}>
                Start {mode === 'Career' ? 'Career' : 'Season'} →
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Steps({ step }: { step: Step }) {
  const order: Step[] = ['mode', 'setup', 'team'];
  const labels: Record<Step, string> = { mode: 'Game Mode', setup: 'Series & Year', team: 'Team' };
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

function SelectCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-5">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-neutral-100">{value}</div>
      <div className="mt-1 text-xs text-neutral-500">{note}</div>
    </div>
  );
}
