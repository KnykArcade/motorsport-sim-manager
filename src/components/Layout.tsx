import { useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { teamById, currentRace } from '../game/careerState';
import { formatMoney } from './ui';
import { getHiddenNavRoutes, getGameModeLabel } from '../game/modeRestrictions';
import { EraThemeProvider } from '../theme/EraThemeContext';
import { getEraTheme, getEraThemeConfig } from '../theme/eraTheme';
import { visibleNavigationGroups } from './layoutNavigation';
import { workflowDestination } from './layoutWorkflow';

export function Layout({ children }: { children: ReactNode }) {
  const { state, saveNow } = useGame();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const team = state ? teamById(state, state.selectedTeamId) : undefined;
  const race = state ? currentRace(state) : undefined;
  const hiddenRoutes = getHiddenNavRoutes(state?.gameMode);
  const navigationGroups = visibleNavigationGroups(hiddenRoutes);
  const era = getEraTheme(state?.series, state?.seasonYear);
  const eraConfig = getEraThemeConfig(era);
  const workflow = state ? workflowDestination(state) : undefined;

  const goTo = (to: string) => {
    setMobileNavigationOpen(false);
    navigate(to);
  };

  return (
    <EraThemeProvider theme={era}>
      <div className={`era-app ui-app-shell ${eraConfig.className} flex h-screen w-full overflow-hidden`} data-era={era}>
        {mobileNavigationOpen && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/65 lg:hidden"
            aria-label="Close navigation"
            onClick={() => setMobileNavigationOpen(false)}
          />
        )}

        <aside className={`era-sidebar ui-sidebar fixed inset-y-0 left-0 z-40 flex w-56 shrink-0 flex-col transition-transform lg:static lg:translate-x-0 ${mobileNavigationOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="era-brand border-b px-4 py-3">
            <div className="era-brand-kicker text-[10px] font-semibold uppercase tracking-[0.18em]">Motorsport</div>
            <div className="text-sm font-black tracking-wide text-neutral-100">History Manager</div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="era-era-chip inline-flex rounded px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
                {eraConfig.label}
              </span>
              <button type="button" className="text-xs text-neutral-500 hover:text-neutral-200 lg:hidden" onClick={() => setMobileNavigationOpen(false)}>
                Close
              </button>
            </div>
          </div>

          <nav className="ui-sidebar-navigation min-h-0 flex-1 overflow-y-auto px-2 py-2" aria-label="Game navigation">
            {navigationGroups.map((group) => (
              <section key={group.id} className="ui-sidebar-group">
                <h2>{group.label}</h2>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileNavigationOpen(false)}
                      className={({ isActive }) =>
                        `era-nav-link flex items-center gap-2 rounded px-2.5 py-1.5 text-xs transition-colors ${isActive ? 'is-active font-semibold' : ''}`
                      }
                    >
                      <span className="era-nav-icon w-5 shrink-0 text-center text-[9px] font-black">{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </section>
            ))}
          </nav>

          <div className="era-sidebar-actions border-t p-2">
            <div className="grid grid-cols-2 gap-1">
              <button onClick={saveNow} className="era-nav-action rounded px-2 py-1.5 text-left text-xs">Save</button>
              <button onClick={() => goTo('/settings')} className="era-nav-action rounded px-2 py-1.5 text-left text-xs">Settings</button>
            </div>
            <button onClick={() => goTo('/')} className="era-nav-action mt-1 w-full rounded px-2 py-1.5 text-left text-xs">Main Menu</button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="era-topbar ui-topbar flex min-h-14 shrink-0 items-center gap-3 border-b px-3 lg:px-4">
            <button
              type="button"
              className="era-nav-action rounded px-2 py-1.5 text-xs lg:hidden"
              onClick={() => setMobileNavigationOpen(true)}
              aria-label="Open navigation"
            >
              Menu
            </button>

            <div className="hidden shrink-0 items-center gap-1 sm:flex">
              <button type="button" className="ui-history-button" aria-label="Go back" onClick={() => navigate(-1)}>‹</button>
              <button type="button" className="ui-history-button" aria-label="Go forward" onClick={() => navigate(1)}>›</button>
            </div>

            {team && (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="h-7 w-1.5 shrink-0 rounded-sm" style={{ backgroundColor: team.color }} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-neutral-100">{team.name}</div>
                  <div className="truncate text-[10px] uppercase tracking-wide text-neutral-500">{state?.series} · {getGameModeLabel(state?.gameMode)}</div>
                </div>
              </div>
            )}

            <div className="hidden shrink-0 items-center gap-5 md:flex">
              {state && <TopbarMetric label="Season" value={String(state.seasonYear)} />}
              {state && <TopbarMetric label="Round" value={`${Math.min(state.currentRaceIndex + 1, state.calendar.length)} / ${state.calendar.length}`} />}
              {team && <TopbarMetric label="Budget" value={formatMoney(team.budget)} />}
              {race && !state?.seasonComplete && <TopbarMetric label="Next event" value={race.gpName} />}
            </div>

            {workflow && (
              <button
                type="button"
                className="ui-continue-button min-w-28 shrink-0"
                onClick={() => goTo(workflow.to)}
                title={`Open ${workflow.context}. Progression remains controlled inside that workspace.`}
              >
                <span className="hidden text-[9px] font-semibold uppercase tracking-wide opacity-70 xl:block">{workflow.context}</span>
                <span>{workflow.label} →</span>
              </button>
            )}
          </header>

          <main className="era-content ui-main-content min-h-0 flex-1 overflow-auto p-3 lg:p-4" data-route={location.pathname}>
            {children}
          </main>
        </div>
      </div>
    </EraThemeProvider>
  );
}

function TopbarMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="era-topbar-metric max-w-40 text-right">
      <div className="text-[9px] font-semibold uppercase tracking-wide">{label}</div>
      <div className="truncate text-xs font-bold">{value}</div>
    </div>
  );
}
