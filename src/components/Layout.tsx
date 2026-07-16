import { useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { teamById, currentRace } from '../game/careerState';
import { formatMoney } from './ui';
import { getHiddenNavRoutes, getGameModeLabel } from '../game/modeRestrictions';
import { EraThemeProvider } from '../theme/EraThemeContext';
import { getEraTheme, getEraThemeConfig } from '../theme/eraTheme';
import {
  NAVIGATION_GROUPS,
  navigationGroupForRoute,
  navigationItemsForGroup,
  type NavigationGroupId,
} from './layoutNavigation';

export function Layout({ children }: { children: ReactNode }) {
  const { state, saveNow } = useGame();
  const navigate = useNavigate();
  const location = useLocation();
  const [navigationChoice, setNavigationChoice] = useState<{ pathname: string; group: NavigationGroupId }>(() => ({
    pathname: location.pathname,
    group: navigationGroupForRoute(location.pathname),
  }));
  const team = state ? teamById(state, state.selectedTeamId) : undefined;
  const race = state ? currentRace(state) : undefined;
  const hiddenRoutes = getHiddenNavRoutes(state?.gameMode);
  const era = getEraTheme(state?.series, state?.seasonYear);
  const eraConfig = getEraThemeConfig(era);
  const navigationGroup = navigationChoice.pathname === location.pathname
    ? navigationChoice.group
    : navigationGroupForRoute(location.pathname);
  const visibleNavigation = navigationItemsForGroup(navigationGroup, hiddenRoutes);

  return (
    <EraThemeProvider theme={era}>
      <div className={`era-app ${eraConfig.className} flex h-full min-h-screen w-full`} data-era={era}>
        <aside className="era-sidebar flex w-56 shrink-0 flex-col">
          <div className="era-brand border-b px-4 py-4">
            <div className="era-brand-kicker text-xs font-semibold uppercase tracking-widest">Motorsport</div>
            <div className="text-sm font-bold text-neutral-100">History Manager</div>
            <div className="era-era-chip mt-2 inline-flex rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
              {eraConfig.label}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 border-b p-2" aria-label="Navigation groups">
            {NAVIGATION_GROUPS.map((group) => (
              <button
                key={group.id}
                type="button"
                aria-pressed={navigationGroup === group.id}
                onClick={() => setNavigationChoice({ pathname: location.pathname, group: group.id })}
                className={`rounded px-2 py-1.5 text-[11px] font-semibold transition-colors ${navigationGroup === group.id ? 'bg-amber-500 text-neutral-950' : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100'}`}
              >
                {group.label}
              </button>
            ))}
          </div>

          <nav className="min-h-0 flex-1 space-y-0.5 overflow-hidden p-2" aria-label={`${navigationGroup} navigation`}>
            {visibleNavigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `era-nav-link flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive ? 'is-active font-semibold' : ''
                  }`
                }
              >
                <span className="era-nav-icon w-5 text-center text-[10px] font-bold">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="era-sidebar-actions space-y-1 border-t p-2">
            <button onClick={saveNow} className="era-nav-action w-full rounded-md px-3 py-2 text-left text-sm">
              Save Game
            </button>
            <button onClick={() => navigate('/')} className="era-nav-action w-full rounded-md px-3 py-2 text-left text-sm">
              Main Menu
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="era-topbar flex items-center justify-between border-b px-6 py-3">
            <div className="flex min-w-0 items-center gap-4">
              {team && (
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-5 w-1.5 shrink-0 rounded-sm" style={{ backgroundColor: team.color }} />
                  <span className="truncate font-semibold text-neutral-100">{team.name}</span>
                  <span className="era-mode-chip shrink-0 rounded px-2 py-0.5 text-xs">
                    {getGameModeLabel(state?.gameMode)}
                  </span>
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-6 text-sm">
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

          <main className="era-content flex-1 overflow-auto p-6">{children}</main>
        </div>
      </div>
    </EraThemeProvider>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="era-topbar-metric text-right">
      <div className="text-[10px] uppercase tracking-wide">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
