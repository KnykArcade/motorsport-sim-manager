import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { teamById, currentRace } from '../game/careerState';
import { formatMoney } from './ui';
import { getHiddenNavRoutes } from '../game/modeRestrictions';

const NAV = [
  { to: '/hq', label: 'Team HQ', icon: '◧' },
  { to: '/calendar', label: 'Calendar', icon: '▦' },
  { to: '/standings', label: 'Standings', icon: '▤' },
  { to: '/news', label: 'News Center', icon: '✉' },
  { to: '/teams', label: 'Team Overview', icon: '⊞' },
  { to: '/history', label: 'Race History', icon: '⌚' },
  { to: '/records', label: 'Universe History', icon: '★' },
  { to: '/drivers', label: 'Drivers', icon: '☷' },
  { to: '/curves', label: 'Dev Curves', icon: '↗' },
  { to: '/market', label: 'Driver Market', icon: '⇄' },
  { to: '/scouting', label: 'Scouting', icon: '⚲' },
  { to: '/development', label: 'Development', icon: '⚙' },
  { to: '/finance', label: 'Finance', icon: '$' },
  { to: '/sponsors', label: 'Sponsors', icon: '✦' },
  { to: '/staff', label: 'Staff', icon: '⚒' },
  { to: '/facilities', label: 'Facilities', icon: '⌂' },
  { to: '/engine', label: 'Engine', icon: '⛽' },
  { to: '/principal', label: 'Principal', icon: '★' },
  { to: '/relationships', label: 'Relationships', icon: '♥' },
  { to: '/politics', label: 'Regulations', icon: '⚖' },
  { to: '/data', label: 'Data Viewer', icon: '⛁' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

export function Layout({ children }: { children: ReactNode }) {
  const { state, saveNow } = useGame();
  const navigate = useNavigate();
  const team = state ? teamById(state, state.selectedTeamId) : undefined;
  const race = state ? currentRace(state) : undefined;
  const hiddenRoutes = getHiddenNavRoutes(state?.gameMode);

  return (
    <div className="flex h-full min-h-screen w-full bg-[#0a0c10] text-neutral-200">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-neutral-800 bg-neutral-950/60">
        <div className="border-b border-neutral-800 px-4 py-4">
          <div className="text-xs font-semibold uppercase tracking-widest text-amber-500">Motorsport</div>
          <div className="text-sm font-bold text-neutral-100">History Manager</div>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {NAV.filter((item) => !hiddenRoutes.has(item.to)).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-amber-500/15 font-semibold text-amber-300'
                    : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-100'
                }`
              }
            >
              <span className="w-4 text-center text-neutral-500">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-1 border-t border-neutral-800 p-2">
          <button
            onClick={saveNow}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-100"
          >
            ⤓ Save Game
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-100"
          >
            ⌂ Main Menu
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950/40 px-6 py-3">
          <div className="flex items-center gap-4">
            {team && (
              <div className="flex items-center gap-2">
                <span className="h-5 w-1.5 rounded-sm" style={{ backgroundColor: team.color }} />
                <span className="font-semibold text-neutral-100">{team.name}</span>
                <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
                  {state?.gameMode === 'Career' ? 'Career' : 'Single Season'}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-6 text-sm">
            {state && (
              <>
                <Metric label="Season" value={String(state.seasonYear)} />
                <Metric
                  label="Round"
                  value={`${Math.min(state.currentRaceIndex + 1, state.calendar.length)} / ${state.calendar.length}`}
                />
                {team && <Metric label="Budget" value={formatMoney(team.budget)} />}
                {race && !state.seasonComplete && <Metric label="Next" value={race.gpName} />}
              </>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="font-semibold text-neutral-100">{value}</div>
    </div>
  );
}
