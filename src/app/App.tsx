import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { lazy, Suspense } from 'react';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { GameProvider, useGame } from '../game/GameContext';
import { canEnterRaceWeekend } from '../game/rosterEnforcement';
import { currentRace, type GameState } from '../game/careerState';
import { garageAddressForRace } from '../sim/garageLeadershipEngine';
import { Layout } from '../components/Layout';
import { UnavailableWorkspace } from '../components/UnavailableWorkspace';
import { MainMenu } from '../screens/MainMenu';
import { NewCareer } from '../screens/NewCareer';
import { isResumableWorkspace, workflowDestination } from '../components/layoutWorkflow';
import {
  routeAccessForState,
  routeDefinitionForPath,
} from './routeCatalog';

// Code-split in-game screens — each screen loads on demand to reduce the
// initial bundle. MainMenu and NewCareer stay eager for first-paint.
const TeamHQ = lazy(() => import('../screens/TeamHQ').then((m) => ({ default: m.TeamHQ })));
const Calendar = lazy(() => import('../screens/Calendar').then((m) => ({ default: m.Calendar })));
const Standings = lazy(() => import('../screens/Standings').then((m) => ({ default: m.Standings })));
const TeamOverview = lazy(() => import('../screens/TeamOverview').then((m) => ({ default: m.TeamOverview })));
const Drivers = lazy(() => import('../screens/Drivers').then((m) => ({ default: m.Drivers })));
const DriverContractNegotiation = lazy(() => import('../screens/DriverContractNegotiation').then((m) => ({ default: m.DriverContractNegotiation })));
const MarketContractNegotiation = lazy(() => import('../screens/MarketContractNegotiation').then((m) => ({ default: m.MarketContractNegotiation })));
const StaffContractNegotiation = lazy(() => import('../screens/StaffContractNegotiation').then((m) => ({ default: m.StaffContractNegotiation })));
const DriverMarket = lazy(() => import('../screens/DriverMarket').then((m) => ({ default: m.DriverMarket })));
const TechnicalCenter = lazy(() => import('../screens/TechnicalCenter').then((m) => ({ default: m.TechnicalCenter })));
const Finance = lazy(() => import('../screens/Finance').then((m) => ({ default: m.Finance })));
const Sponsors = lazy(() => import('../screens/Sponsors').then((m) => ({ default: m.Sponsors })));
const Staff = lazy(() => import('../screens/Staff').then((m) => ({ default: m.Staff })));
const RaceHistory = lazy(() => import('../screens/RaceHistory').then((m) => ({ default: m.RaceHistory })));
const DataViewer = lazy(() => import('../screens/DataViewer').then((m) => ({ default: m.DataViewer })));
const PerformanceDataHub = lazy(() => import('../screens/PerformanceDataHub').then((m) => ({ default: m.PerformanceDataHub })));
const TeamPrincipal = lazy(() => import('../screens/TeamPrincipal').then((m) => ({ default: m.TeamPrincipal })));
const Relationships = lazy(() => import('../screens/Relationships').then((m) => ({ default: m.Relationships })));
const RivalRelationships = lazy(() => import('../screens/RivalRelationships').then((m) => ({ default: m.RivalRelationships })));
const PaddockStories = lazy(() => import('../screens/PaddockStories').then((m) => ({ default: m.PaddockStories })));
const Politics = lazy(() => import('../screens/Politics').then((m) => ({ default: m.Politics })));
const DriverCurves = lazy(() => import('../screens/DriverCurves').then((m) => ({ default: m.DriverCurves })));
const UniverseHistory = lazy(() => import('../screens/UniverseHistory').then((m) => ({ default: m.UniverseHistory })));
const Settings = lazy(() => import('../screens/Settings').then((m) => ({ default: m.Settings })));
const RaceWeekend = lazy(() => import('../screens/RaceWeekend').then((m) => ({ default: m.RaceWeekend })));
const LiveRace = lazy(() => import('../screens/LiveRace').then((m) => ({ default: m.LiveRace })));
const RaceResults = lazy(() => import('../screens/RaceResults').then((m) => ({ default: m.RaceResults })));
const SeasonReview = lazy(() => import('../screens/SeasonReview').then((m) => ({ default: m.SeasonReview })));
const Offseason = lazy(() => import('../screens/Offseason').then((m) => ({ default: m.Offseason })));
const PostRaceReview = lazy(() => import('../screens/PostRaceReview').then((m) => ({ default: m.PostRaceReview })));
const PaddockWeek = lazy(() => import('../screens/PaddockWeek').then((m) => ({ default: m.PaddockWeek })));
const PreRaceBriefing = lazy(() => import('../screens/PreRaceBriefing').then((m) => ({ default: m.PreRaceBriefing })));
const PreSeasonSetup = lazy(() => import('../screens/PreSeasonSetup').then((m) => ({ default: m.PreSeasonSetup })));
const CareerLaunch = lazy(() => import('../screens/CareerLaunch').then((m) => ({ default: m.CareerLaunch })));
const NewsCenter = lazy(() => import('../screens/NewsCenter').then((m) => ({ default: m.NewsCenter })));
const Inbox = lazy(() => import('../screens/Inbox').then((m) => ({ default: m.Inbox })));
const Scouting = lazy(() => import('../screens/Scouting').then((m) => ({ default: m.Scouting })));
const TeamPlanner = lazy(() => import('../screens/TeamPlanner').then((m) => ({ default: m.TeamPlanner })));

function WorkspaceTracker() {
  const { state, dispatch } = useGame();
  const location = useLocation();

  useEffect(() => {
    if (!state || location.pathname === '/' || location.pathname === '/new') return;
    const workspace = `${location.pathname}${location.search}`;
    if (!isResumableWorkspace(workspace, state)) return;
    if (workspace === state.lastWorkspace) return;
    dispatch({ type: 'SET_LAST_WORKSPACE', workspace });
  }, [dispatch, location.pathname, location.search, state]);

  return null;
}

type ExtraRouteCheck = (state: GameState, pathname: string) => {
  allowed: boolean;
  reason?: string;
  fallback?: string;
};

function InGameRoute({
  children,
  extraCheck,
}: {
  children: ReactNode;
  extraCheck?: ExtraRouteCheck;
}) {
  const { state } = useGame();
  const navigate = useNavigate();
  const location = useLocation();
  if (!state) return <Navigate to="/" replace />;

  const access = routeAccessForState(location.pathname, state);
  const extra = access.available && extraCheck
    ? extraCheck(state, location.pathname)
    : { allowed: true };
  if (access.available && extra.allowed) return <Layout>{children}</Layout>;

  const nextAction = workflowDestination(state);
  const definition = access.definition ?? routeDefinitionForPath(location.pathname);
  const fallback = extra.fallback
    ?? (definition?.fallback !== 'next_action' ? definition?.fallback : undefined)
    ?? nextAction.to;
  const fallbackTitle = routeDefinitionForPath(fallback)?.title;
  const title = definition?.restriction?.title
    ?? `${definition?.title ?? 'Workspace'} unavailable`;

  return (
    <Layout>
      <UnavailableWorkspace
        title={title}
        reason={extra.reason ?? access.reason ?? 'Open the current career task to continue.'}
        actionLabel={fallbackTitle ? `Open ${fallbackTitle}` : nextAction.label}
        onAction={() => navigate(fallback)}
      />
    </Layout>
  );
}

function raceWeekendCheck(state: GameState): ReturnType<ExtraRouteCheck> {
  const check = canEnterRaceWeekend(state);
  return check.allowed
    ? { allowed: true }
    : { allowed: false, reason: check.reason, fallback: '/market' };
}

function liveRaceCheck(state: GameState, pathname: string): ReturnType<ExtraRouteCheck> {
  const roster = raceWeekendCheck(state);
  if (!roster.allowed) return roster;
  const race = currentRace(state);
  const requestedRaceId = pathname.split('/').filter(Boolean).at(-1);
  if (!race || requestedRaceId !== race.id) {
    return {
      allowed: false,
      reason: 'That live-race address does not match the current event.',
      fallback: '/weekend',
    };
  }
  if (!garageAddressForRace(state, race.id)) {
    return {
      allowed: false,
      reason: 'Complete the race-weekend leadership briefing before opening the live race.',
      fallback: '/weekend',
    };
  }
  return { allowed: true };
}

export default function App() {
  return (
    <GameProvider>
      <HashRouter>
        <WorkspaceTracker />
        <Suspense fallback={
          <div className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-500">
            <div className="text-sm">Loading…</div>
          </div>
        }>
        <Routes>
          <Route path="/" element={<MainMenu />} />
          <Route path="/new" element={<NewCareer />} />
          <Route path="/data" element={<DataViewer />} />
          <Route path="/settings" element={<Settings />} />

          <Route path="/hq" element={<InGameRoute><TeamHQ /></InGameRoute>} />
          <Route path="/career-launch" element={<InGameRoute><CareerLaunch /></InGameRoute>} />
          <Route path="/preseason" element={<InGameRoute><PreSeasonSetup /></InGameRoute>} />
          <Route path="/paddock" element={<InGameRoute><PaddockWeek /></InGameRoute>} />
          <Route path="/briefing" element={<InGameRoute><PreRaceBriefing /></InGameRoute>} />
          <Route path="/post-race/:raceId" element={<InGameRoute><PostRaceReview /></InGameRoute>} />
          <Route path="/inbox" element={<InGameRoute><Inbox /></InGameRoute>} />
          <Route path="/calendar" element={<InGameRoute><Calendar /></InGameRoute>} />
          <Route path="/standings" element={<InGameRoute><Standings /></InGameRoute>} />
          <Route path="/teams" element={<InGameRoute><TeamOverview /></InGameRoute>} />
          <Route path="/planner" element={<InGameRoute><TeamPlanner /></InGameRoute>} />
          <Route path="/drivers" element={<InGameRoute><Drivers /></InGameRoute>} />
          <Route path="/drivers/:driverId/negotiate" element={<InGameRoute><DriverContractNegotiation /></InGameRoute>} />
          <Route path="/market/:marketId/negotiate/:seatDriverId" element={<InGameRoute><MarketContractNegotiation /></InGameRoute>} />
          <Route path="/staff/:staffId/negotiate" element={<InGameRoute><StaffContractNegotiation /></InGameRoute>} />
          <Route path="/market" element={<InGameRoute><DriverMarket /></InGameRoute>} />
          <Route path="/technical" element={<InGameRoute><TechnicalCenter /></InGameRoute>} />
          <Route path="/development" element={<Navigate to="/technical" replace />} />
          <Route path="/finance" element={<InGameRoute><Finance /></InGameRoute>} />
          <Route path="/sponsors" element={<InGameRoute><Sponsors /></InGameRoute>} />
          <Route path="/staff" element={<InGameRoute><Staff /></InGameRoute>} />
          <Route path="/facilities" element={<Navigate to="/technical" replace />} />
          <Route path="/engine" element={<Navigate to="/technical" replace />} />
          <Route path="/principal" element={<InGameRoute><TeamPrincipal /></InGameRoute>} />
          <Route path="/relationships" element={<InGameRoute><Relationships /></InGameRoute>} />
          <Route path="/rivals" element={<InGameRoute><RivalRelationships /></InGameRoute>} />
          <Route path="/stories" element={<InGameRoute><PaddockStories /></InGameRoute>} />
          <Route path="/politics" element={<InGameRoute><Politics /></InGameRoute>} />
          <Route path="/scouting" element={<InGameRoute><Scouting /></InGameRoute>} />
          <Route path="/curves" element={<InGameRoute><DriverCurves /></InGameRoute>} />
          <Route path="/records" element={<InGameRoute><UniverseHistory /></InGameRoute>} />
          <Route path="/history" element={<InGameRoute><RaceHistory /></InGameRoute>} />
          <Route path="/performance" element={<InGameRoute><PerformanceDataHub /></InGameRoute>} />
          <Route path="/weekend" element={<InGameRoute extraCheck={raceWeekendCheck}><RaceWeekend /></InGameRoute>} />
          <Route path="/live-race/:raceId" element={<InGameRoute extraCheck={liveRaceCheck}><LiveRace /></InGameRoute>} />
          <Route path="/results/:raceId" element={<InGameRoute><RaceResults /></InGameRoute>} />
          <Route path="/season-review" element={<InGameRoute><SeasonReview /></InGameRoute>} />
          <Route path="/offseason" element={<InGameRoute><Offseason /></InGameRoute>} />
          <Route path="/news" element={<InGameRoute><NewsCenter /></InGameRoute>} />

          <Route path="*" element={<InGameRoute><></></InGameRoute>} />
        </Routes>
        </Suspense>
      </HashRouter>
    </GameProvider>
  );
}
