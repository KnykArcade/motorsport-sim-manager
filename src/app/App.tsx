import { HashRouter, Navigate, Route, Routes, useParams, useNavigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { GameProvider, useGame } from '../game/GameContext';
import { canEnterRaceWeekend } from '../game/rosterEnforcement';
import { currentRace } from '../game/careerState';
import { Layout } from '../components/Layout';
import { MainMenu } from '../screens/MainMenu';
import { NewCareer } from '../screens/NewCareer';
import { getCareerPhase } from '../game/careerPhaseEngine';
import { getRouteRestrictionInfo } from '../game/modeRestrictions';

// Code-split in-game screens — each screen loads on demand to reduce the
// initial bundle. MainMenu and NewCareer stay eager for first-paint.
const TeamHQ = lazy(() => import('../screens/TeamHQ').then((m) => ({ default: m.TeamHQ })));
const Calendar = lazy(() => import('../screens/Calendar').then((m) => ({ default: m.Calendar })));
const Standings = lazy(() => import('../screens/Standings').then((m) => ({ default: m.Standings })));
const TeamOverview = lazy(() => import('../screens/TeamOverview').then((m) => ({ default: m.TeamOverview })));
const Drivers = lazy(() => import('../screens/Drivers').then((m) => ({ default: m.Drivers })));
const DriverMarket = lazy(() => import('../screens/DriverMarket').then((m) => ({ default: m.DriverMarket })));
const TechnicalCenter = lazy(() => import('../screens/TechnicalCenter').then((m) => ({ default: m.TechnicalCenter })));
const Finance = lazy(() => import('../screens/Finance').then((m) => ({ default: m.Finance })));
const Sponsors = lazy(() => import('../screens/Sponsors').then((m) => ({ default: m.Sponsors })));
const Staff = lazy(() => import('../screens/Staff').then((m) => ({ default: m.Staff })));
const RaceHistory = lazy(() => import('../screens/RaceHistory').then((m) => ({ default: m.RaceHistory })));
const DataViewer = lazy(() => import('../screens/DataViewer').then((m) => ({ default: m.DataViewer })));
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
const NewsCenter = lazy(() => import('../screens/NewsCenter').then((m) => ({ default: m.NewsCenter })));
const Inbox = lazy(() => import('../screens/Inbox').then((m) => ({ default: m.Inbox })));
const Scouting = lazy(() => import('../screens/Scouting').then((m) => ({ default: m.Scouting })));

// Wrap in-game screens with the dashboard layout and redirect to the menu when
// there is no active game.
function InGame({ children }: { children: ReactNode }) {
  const { state } = useGame();
  if (!state) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

// Guard for routes restricted in Single Season mode. Redirects to HQ with a
// locked message if the route is restricted for the current game mode.
function ModeGuard({ route, children }: { route: string; children: ReactNode }) {
  const { state } = useGame();
  const navigate = useNavigate();
  if (!state) return <Navigate to="/" replace />;
  const lockInfo = getRouteRestrictionInfo(route, state.gameMode);
  if (lockInfo) {
    return (
      <Layout>
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-600/40 bg-amber-900/20 text-xl text-amber-400">🔒</span>
            <h1 className="text-2xl font-bold text-neutral-100">{lockInfo.title}</h1>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
            <p className="text-sm text-neutral-300">{lockInfo.reason}</p>
          </div>
          <div className="rounded-lg border border-sky-800/50 bg-sky-900/20 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-sky-400">What to focus on</div>
            <p className="mt-1 text-sm text-sky-200">{lockInfo.focus}</p>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <button onClick={() => navigate('/hq')} className="rounded-lg bg-neutral-800 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700">← Back to Team HQ</button>
            <button onClick={() => navigate('/calendar')} className="rounded-lg bg-neutral-800 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700">Calendar</button>
            <button onClick={() => navigate('/technical')} className="rounded-lg bg-neutral-800 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700">Technical Center</button>
            <button onClick={() => navigate('/standings')} className="rounded-lg bg-neutral-800 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700">Standings</button>
          </div>
        </div>
      </Layout>
    );
  }
  return <Layout>{children}</Layout>;
}

// Route guard for the live race broadcast: only accessible during race_weekend
// phase, when roster checks pass, and when the requested raceId matches the
// current race. Prevents direct URL access from bypassing the phase flow.
function LiveRaceGuard({ children }: { children: ReactNode }) {
  const { state } = useGame();
  const { raceId } = useParams();
  if (!state) return <Navigate to="/" replace />;
  const phase = getCareerPhase(state);
  if (phase !== 'race_weekend') {
    if (phase === 'pre_season_setup') return <Navigate to="/preseason" replace />;
    if (phase === 'paddock_week') return <Navigate to="/paddock" replace />;
    if (phase === 'pre_race_briefing') return <Navigate to="/briefing" replace />;
    if (phase === 'post_race_review') {
      const lastRaceId = state.careerPhase?.lastCompletedRaceId;
      if (lastRaceId) return <Navigate to={`/post-race/${lastRaceId}`} replace />;
    }
    return <Navigate to="/hq" replace />;
  }
  const check = canEnterRaceWeekend(state);
  if (!check.allowed) return <Navigate to="/market" replace />;
  const race = currentRace(state);
  if (!race || (raceId && race.id !== raceId)) return <Navigate to="/weekend" replace />;
  return <>{children}</>;
}

// Route guard that redirects to the correct career phase screen when the
// player navigates to /hq. This ensures the player always lands on the right
// phase after save/load.
function PhaseRedirect({ children }: { children: ReactNode }) {
  const { state } = useGame();
  if (!state) return <Navigate to="/" replace />;
  const phase = getCareerPhase(state);
  if (phase === 'pre_season_setup') return <Navigate to="/preseason" replace />;
  if (phase === 'post_race_review') {
    const lastRaceId = state.careerPhase?.lastCompletedRaceId;
    if (lastRaceId) return <Navigate to={`/post-race/${lastRaceId}`} replace />;
  }
  if (phase === 'paddock_week') return <Navigate to="/paddock" replace />;
  if (phase === 'pre_race_briefing') return <Navigate to="/briefing" replace />;
  return <Layout>{children}</Layout>;
}

// Post-race review guard: shows active review with advance button when raceId
// matches lastCompletedRaceId and phase is post_race_review. Old races are
// shown read-only. Wrong phase redirects to the correct phase screen.
function PostRaceReviewGuard({ children }: { children: ReactNode }) {
  const { state } = useGame();
  const { raceId } = useParams();
  if (!state) return <Navigate to="/" replace />;
  if (!raceId) return <Navigate to="/hq" replace />;

  // If the raceId has results, it's a valid historical race — allow viewing.
  const hasResults = !!state.completedRaceResults[raceId];
  if (!hasResults) {
    // No results for this raceId — redirect to correct phase.
    const phase = getCareerPhase(state);
    if (phase === 'pre_season_setup') return <Navigate to="/preseason" replace />;
    if (phase === 'paddock_week') return <Navigate to="/paddock" replace />;
    if (phase === 'pre_race_briefing') return <Navigate to="/briefing" replace />;
    if (phase === 'race_weekend') return <Navigate to="/weekend" replace />;
    return <Navigate to="/hq" replace />;
  }

  // If we're in post_race_review and this is the active race, show with advance button.
  // Otherwise (old race or wrong phase), show read-only.
  return <Layout>{children}</Layout>;
}

// Paddock week guard: also blocks if there are unresolved required decisions
// and the player tries to navigate away to briefing/race weekend.
function PaddockWeekGuard({ children }: { children: ReactNode }) {
  const { state } = useGame();
  if (!state) return <Navigate to="/" replace />;
  const phase = getCareerPhase(state);
  if (phase !== 'paddock_week') {
    // Redirect to the correct phase screen.
    if (phase === 'pre_season_setup') return <Navigate to="/preseason" replace />;
    if (phase === 'pre_race_briefing') return <Navigate to="/briefing" replace />;
    if (phase === 'race_weekend') return <Navigate to="/weekend" replace />;
    if (phase === 'post_race_review') {
      const lastRaceId = state.careerPhase?.lastCompletedRaceId;
      if (lastRaceId) return <Navigate to={`/post-race/${lastRaceId}`} replace />;
    }
    return <Navigate to="/hq" replace />;
  }
  return <Layout>{children}</Layout>;
}

// Pre-race briefing guard: only accessible when in pre_race_briefing phase.
function PreRaceBriefingGuard({ children }: { children: ReactNode }) {
  const { state } = useGame();
  if (!state) return <Navigate to="/" replace />;
  const phase = getCareerPhase(state);
  if (phase !== 'pre_race_briefing') {
    if (phase === 'pre_season_setup') return <Navigate to="/preseason" replace />;
    if (phase === 'paddock_week') return <Navigate to="/paddock" replace />;
    if (phase === 'race_weekend') return <Navigate to="/weekend" replace />;
    if (phase === 'post_race_review') {
      const lastRaceId = state.careerPhase?.lastCompletedRaceId;
      if (lastRaceId) return <Navigate to={`/post-race/${lastRaceId}`} replace />;
    }
    return <Navigate to="/hq" replace />;
  }
  return <Layout>{children}</Layout>;
}

// Preseason guard: only accessible when in pre_season_setup phase.
function PreseasonGuard({ children }: { children: ReactNode }) {
  const { state } = useGame();
  if (!state) return <Navigate to="/" replace />;
  const phase = getCareerPhase(state);
  if (phase !== 'pre_season_setup') {
    if (phase === 'paddock_week') return <Navigate to="/paddock" replace />;
    if (phase === 'pre_race_briefing') return <Navigate to="/briefing" replace />;
    if (phase === 'race_weekend') return <Navigate to="/weekend" replace />;
    if (phase === 'post_race_review') {
      const lastRaceId = state.careerPhase?.lastCompletedRaceId;
      if (lastRaceId) return <Navigate to={`/post-race/${lastRaceId}`} replace />;
    }
    return <Navigate to="/hq" replace />;
  }
  return <Layout>{children}</Layout>;
}

// Race weekend guard with phase check: only accessible when in race_weekend phase.
function RaceWeekendPhaseGuard({ children }: { children: ReactNode }) {
  const { state } = useGame();
  if (!state) return <Navigate to="/" replace />;
  const phase = getCareerPhase(state);
  if (phase !== 'race_weekend') {
    if (phase === 'pre_season_setup') return <Navigate to="/preseason" replace />;
    if (phase === 'paddock_week') return <Navigate to="/paddock" replace />;
    if (phase === 'pre_race_briefing') return <Navigate to="/briefing" replace />;
    if (phase === 'post_race_review') {
      const lastRaceId = state.careerPhase?.lastCompletedRaceId;
      if (lastRaceId) return <Navigate to={`/post-race/${lastRaceId}`} replace />;
    }
    return <Navigate to="/hq" replace />;
  }
  const check = canEnterRaceWeekend(state);
  if (!check.allowed) return <Navigate to="/market" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <GameProvider>
      <HashRouter>
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

          <Route path="/hq" element={<PhaseRedirect><TeamHQ /></PhaseRedirect>} />
          <Route path="/preseason" element={<PreseasonGuard><PreSeasonSetup /></PreseasonGuard>} />
          <Route path="/paddock" element={<PaddockWeekGuard><PaddockWeek /></PaddockWeekGuard>} />
          <Route path="/briefing" element={<PreRaceBriefingGuard><PreRaceBriefing /></PreRaceBriefingGuard>} />
          <Route path="/post-race/:raceId" element={<PostRaceReviewGuard><PostRaceReview /></PostRaceReviewGuard>} />
          <Route path="/inbox" element={<InGame><Inbox /></InGame>} />
          <Route path="/calendar" element={<InGame><Calendar /></InGame>} />
          <Route path="/standings" element={<InGame><Standings /></InGame>} />
          <Route path="/teams" element={<InGame><TeamOverview /></InGame>} />
          <Route path="/drivers" element={<InGame><Drivers /></InGame>} />
          <Route path="/market" element={<InGame><DriverMarket /></InGame>} />
          <Route path="/technical" element={<InGame><TechnicalCenter /></InGame>} />
          <Route path="/development" element={<Navigate to="/technical" replace />} />
          <Route path="/finance" element={<InGame><Finance /></InGame>} />
          <Route path="/sponsors" element={<ModeGuard route="/sponsors"><Sponsors /></ModeGuard>} />
          <Route path="/staff" element={<InGame><Staff /></InGame>} />
          <Route path="/facilities" element={<Navigate to="/technical" replace />} />
          <Route path="/engine" element={<Navigate to="/technical" replace />} />
          <Route path="/principal" element={<InGame><TeamPrincipal /></InGame>} />
          <Route path="/relationships" element={<InGame><Relationships /></InGame>} />
          <Route path="/rivals" element={<InGame><RivalRelationships /></InGame>} />
          <Route path="/stories" element={<InGame><PaddockStories /></InGame>} />
          <Route path="/politics" element={<ModeGuard route="/politics"><Politics /></ModeGuard>} />
          <Route path="/scouting" element={<ModeGuard route="/scouting"><Scouting /></ModeGuard>} />
          <Route path="/curves" element={<ModeGuard route="/curves"><DriverCurves /></ModeGuard>} />
          <Route path="/records" element={<InGame><UniverseHistory /></InGame>} />
          <Route path="/history" element={<InGame><RaceHistory /></InGame>} />
          <Route path="/weekend" element={<RaceWeekendPhaseGuard><RaceWeekend /></RaceWeekendPhaseGuard>} />
          <Route path="/live-race/:raceId" element={<LiveRaceGuard><LiveRace /></LiveRaceGuard>} />
          <Route path="/results/:raceId" element={<InGame><RaceResults /></InGame>} />
          <Route path="/season-review" element={<InGame><SeasonReview /></InGame>} />
          <Route path="/offseason" element={<ModeGuard route="/offseason"><Offseason /></ModeGuard>} />
      <Route path="/news" element={<InGame><NewsCenter /></InGame>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </HashRouter>
    </GameProvider>
  );
}
