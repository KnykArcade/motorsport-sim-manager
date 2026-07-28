import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { teamById, currentRace } from '../game/careerState';
import { getHiddenNavRoutes, getGameModeLabel } from '../game/modeRestrictions';
import { EraThemeProvider } from '../theme/EraThemeContext';
import { getEraTheme, getEraThemeConfig } from '../theme/eraTheme';
import {
  isNavigationItemActive,
  routePath,
  visibleNavigationGroups,
} from './layoutNavigation';
import { contextualNavigationForRoute, pageIdentityForRoute } from './layoutContext';
import { workflowDestination } from './layoutWorkflow';
import { NavIcon } from './NavIcon';
import { inboxMessages, mustRespondInboxCount, unreadInboxCount } from '../screens/inboxViewModel';
import { GlobalSearch } from './GlobalSearch';
import {
  readNavigationHistory,
  updateNavigationHistory,
  writeNavigationHistory,
  type NavigationHistoryEntry,
} from './layoutHistory';

export function Layout({ children }: { children: ReactNode }) {
  const { state, saveNow } = useGame();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const team = state ? teamById(state, state.selectedTeamId) : undefined;
  const race = state ? currentRace(state) : undefined;
  const hiddenRoutes = getHiddenNavRoutes(state?.gameMode);
  const navigationGroups = visibleNavigationGroups(hiddenRoutes);
  const contextualNavigation = contextualNavigationForRoute(location.pathname, hiddenRoutes);
  const pageIdentity = pageIdentityForRoute(location.pathname, location.search);
  const era = getEraTheme(state?.series, state?.seasonYear);
  const eraConfig = getEraThemeConfig(era);
  const workflow = state ? workflowDestination(state) : undefined;
  const inboxUnread = useMemo(() => (state ? unreadInboxCount(state) : 0), [state]);
  const mustRespond = useMemo(() => (state ? mustRespondInboxCount(state) : 0), [state]);
  const blockingMessages = useMemo(
    () => state ? inboxMessages(state).filter((message) => message.blocking) : [],
    [state],
  );
  const firstBlockingMessage = blockingMessages[0];
  const contextualAttention = useMemo(() => {
    const counts = new Map<string, number>();
    for (const message of state ? inboxMessages(state) : []) {
      if (!message.actionable && !message.blocking) continue;
      const path = routePath(message.route);
      counts.set(path, (counts.get(path) ?? 0) + 1);
    }
    return counts;
  }, [state]);
  const currentRound = state
    ? Math.min(state.currentRaceIndex + 1, Math.max(1, state.calendar.length))
    : 0;
  const storedNavigationHistory = readNavigationHistory(
    typeof window === 'undefined' ? undefined : window.sessionStorage,
  );
  const currentHistoryEntry: NavigationHistoryEntry = {
    to: `${location.pathname}${location.search}`,
    title: pageIdentity.title,
    visitedAt: (storedNavigationHistory[0]?.visitedAt ?? 0) + 1,
  };
  const navigationHistory = updateNavigationHistory(
    storedNavigationHistory,
    currentHistoryEntry,
  );

  const goTo = (to: string) => {
    setMobileNavigationOpen(false);
    navigate(to);
  };

  useEffect(() => {
    if (!state) return;
    const current = readNavigationHistory(
      typeof window === 'undefined' ? undefined : window.sessionStorage,
    );
    writeNavigationHistory(
      typeof window === 'undefined' ? undefined : window.sessionStorage,
      updateNavigationHistory(current, {
        to: `${location.pathname}${location.search}`,
        title: pageIdentity.title,
        visitedAt: (current[0]?.visitedAt ?? 0) + 1,
      }),
    );
  }, [location.pathname, location.search, pageIdentity.title, state]);

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

        <aside className={`era-sidebar ui-sidebar fixed inset-y-0 left-0 z-40 flex w-52 shrink-0 flex-col transition-transform lg:static lg:translate-x-0 ${mobileNavigationOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="era-brand ui-brand border-b px-3 py-3">
            <div className="era-brand-kicker text-[9px] font-bold uppercase tracking-[0.2em]">Motorsport</div>
            <div className="text-sm font-black tracking-wide text-neutral-100">History Manager</div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="era-era-chip inline-flex px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide">
                {state?.seasonYear ?? eraConfig.shortLabel} · {state?.series ?? 'Career'}
              </span>
              <button type="button" className="text-[10px] text-neutral-500 hover:text-neutral-200 lg:hidden" onClick={() => setMobileNavigationOpen(false)}>
                Close
              </button>
            </div>
          </div>

          <nav className="ui-sidebar-navigation min-h-0 flex-1 overflow-y-auto px-2 py-2" aria-label="Game navigation">
            {navigationGroups.map((group) => (
              <section key={group.id} className="ui-sidebar-group">
                <h2>{group.label}</h2>
                <div>
                  {group.items.map((navItem) => {
                    const active = isNavigationItemActive(navItem, location.pathname, location.search);
                    return (
                      <NavLink
                        key={navItem.to}
                        to={navItem.to}
                        onClick={() => setMobileNavigationOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={`era-nav-link flex items-center gap-2 px-2.5 py-1.5 text-[11px] transition-colors ${active ? 'is-active font-semibold' : ''}`}
                      >
                        <NavIcon to={routePath(navItem.to)} className="era-nav-icon h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{navItem.label}</span>
                        {navItem.to === '/inbox' && (mustRespond > 0 || inboxUnread > 0) && (
                          <span className={`ml-auto min-w-5 px-1 py-0.5 text-center text-[8px] font-black leading-none ${mustRespond > 0 ? 'ui-nav-urgent' : 'ui-nav-unread'}`}>
                            {(mustRespond || inboxUnread) > 99 ? '99+' : mustRespond || inboxUnread}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </section>
            ))}
          </nav>

          <div className="era-sidebar-actions border-t p-2">
            <div className="grid grid-cols-2 gap-1">
              <button type="button" onClick={saveNow} className="era-nav-action px-2 py-1.5 text-left text-[10px]">Save</button>
              <button type="button" onClick={() => goTo('/settings')} className="era-nav-action px-2 py-1.5 text-left text-[10px]">Settings</button>
            </div>
            <button type="button" onClick={() => goTo('/')} className="era-nav-action mt-1 w-full px-2 py-1.5 text-left text-[10px]">Main Menu</button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="era-topbar ui-topbar flex min-h-[58px] shrink-0 items-center gap-3 border-b px-3">
            <button
              type="button"
              className="era-nav-action px-2 py-1.5 text-xs lg:hidden"
              onClick={() => setMobileNavigationOpen(true)}
              aria-label="Open navigation"
            >
              Menu
            </button>

            <div className="hidden shrink-0 items-center gap-1 sm:flex">
              <button type="button" className="ui-history-button" aria-label="Go back" onClick={() => navigate(-1)}>‹</button>
              <button type="button" className="ui-history-button" aria-label="Go forward" onClick={() => navigate(1)}>›</button>
              <details className="ui-history-menu">
                <summary aria-label="Open recent navigation history">Recent</summary>
                <div>
                  {navigationHistory.length ? navigationHistory.map((entry) => (
                    <button key={`${entry.to}:${entry.visitedAt}`} type="button" onClick={() => goTo(entry.to)}>
                      <strong>{entry.title}</strong>
                      <span>{entry.to}</span>
                    </button>
                  )) : <p>No recent workspaces.</p>}
                </div>
              </details>
            </div>

            <div className="ui-page-identity min-w-0 flex-1">
              <div className="ui-page-section">{pageIdentity.section}</div>
              <h1>{pageIdentity.title}</h1>
            </div>

            {state && <GlobalSearch state={state} hiddenRoutes={hiddenRoutes} onNavigate={goTo} />}

            {team && (
              <div className="ui-topbar-team hidden min-w-0 items-center gap-2 xl:flex">
                <span className="ui-team-badge shrink-0" style={{ backgroundColor: team.color }} aria-hidden="true">
                  {team.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="max-w-40 truncate text-[11px] font-bold text-neutral-100">{team.name}</div>
                  <div className="truncate text-[8px] uppercase tracking-wide text-neutral-500">{getGameModeLabel(state?.gameMode)}</div>
                </div>
              </div>
            )}

            <button
              type="button"
              className={`ui-must-respond hidden shrink-0 md:block ${mustRespond > 0 ? 'has-items' : ''}`}
              onClick={() => goTo('/inbox?section=must_respond')}
            >
              <span>Must Respond</span>
              <strong>{mustRespond}</strong>
            </button>

            {state && (
              <div className="ui-season-context hidden shrink-0 lg:grid">
                <div>
                  <span>Season</span>
                  <strong>{state.seasonYear}</strong>
                </div>
                <div>
                  <span>Round</span>
                  <strong>{currentRound}/{state.calendar.length}</strong>
                </div>
              </div>
            )}

            {race && !state?.seasonComplete && (
              <div className="ui-next-event hidden min-w-0 max-w-48 shrink xl:block">
                <span>Next Event · R{race.round}</span>
                <strong>{race.gpName}</strong>
              </div>
            )}

            {workflow && (
              <button
                type="button"
                className="ui-continue-button min-w-32 shrink-0"
                onClick={() => goTo(firstBlockingMessage
                  ? `/inbox?section=must_respond&message=${encodeURIComponent(firstBlockingMessage.id)}`
                  : workflow.to)}
                title={firstBlockingMessage
                  ? `${firstBlockingMessage.title} must be resolved before advancement.`
                  : workflow.reason}
              >
                <span className="text-[8px] font-semibold uppercase tracking-wide opacity-70">
                  {firstBlockingMessage ? `${blockingMessages.length} required` : workflow.blocked ? `${workflow.blockerCount} required` : workflow.context}
                </span>
                <span>{firstBlockingMessage ? 'Respond in Inbox' : workflow.label} →</span>
              </button>
            )}
          </header>

          <nav className="ui-context-navigation flex shrink-0 items-stretch overflow-x-auto" aria-label={`${pageIdentity.section} navigation`}>
            {contextualNavigation.map((navItem) => {
              const active = isNavigationItemActive(navItem, location.pathname, location.search);
              return (
                <NavLink
                  key={navItem.to}
                  to={navItem.to}
                  aria-current={active ? 'page' : undefined}
                  className={active ? 'is-active' : ''}
                >
                  <span>{navItem.label}</span>
                  {(contextualAttention.get(routePath(navItem.to)) ?? 0) > 0 && (
                    <strong className="ui-context-attention">
                      {contextualAttention.get(routePath(navItem.to))}
                    </strong>
                  )}
                </NavLink>
              );
            })}
          </nav>

          <main className="era-content ui-main-content min-h-0 flex-1 overflow-auto p-3" data-route={location.pathname}>
            {children}
          </main>
        </div>
      </div>
    </EraThemeProvider>
  );
}
