import { HashRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { GameProvider, useGame } from '../game/GameContext';
import { canEnterRaceWeekend } from '../game/rosterEnforcement';
import { currentRace } from '../game/careerState';
import { Layout } from '../components/Layout';
import { MainMenu } from '../screens/MainMenu';
import { NewCareer } from '../screens/NewCareer';
import { TeamHQ } from '../screens/TeamHQ';
import { Calendar } from '../screens/Calendar';
import { Standings } from '../screens/Standings';
import { TeamOverview } from '../screens/TeamOverview';
import { Drivers } from '../screens/Drivers';
import { DriverMarket } from '../screens/DriverMarket';
import { Development } from '../screens/Development';
import { Finance } from '../screens/Finance';
import { Sponsors } from '../screens/Sponsors';
import { Staff } from '../screens/Staff';
import { RaceHistory } from '../screens/RaceHistory';
import { DataViewer } from '../screens/DataViewer';
import { Facilities } from '../screens/Facilities';
import { EngineSupplier } from '../screens/EngineSupplier';
import { TeamPrincipal } from '../screens/TeamPrincipal';
import { Relationships } from '../screens/Relationships';
import { Politics } from '../screens/Politics';
import { Scouting } from '../screens/Scouting';
import { DriverCurves } from '../screens/DriverCurves';
import { UniverseHistory } from '../screens/UniverseHistory';
import { Settings } from '../screens/Settings';
import { RaceWeekend } from '../screens/RaceWeekend';
import { LiveRace } from '../screens/LiveRace';
import { RaceResults } from '../screens/RaceResults';
import { SeasonReview } from '../screens/SeasonReview';
import { Offseason } from '../screens/Offseason';
import { PostRaceReview } from '../screens/PostRaceReview';
import { PaddockWeek } from '../screens/PaddockWeek';
import { PreRaceBriefing } from '../screens/PreRaceBriefing';
import { PreSeasonSetup } from '../screens/PreSeasonSetup';
import { getCareerPhase } from '../game/careerPhaseEngine';

// Wrap in-game screens with the dashboard layout and redirect to the menu when
// there is no active game.
function InGame({ children }: { children: ReactNode }) {
  const { state } = useGame();
  if (!state) return <Navigate to="/" replace />;
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
          <Route path="/calendar" element={<InGame><Calendar /></InGame>} />
          <Route path="/standings" element={<InGame><Standings /></InGame>} />
          <Route path="/teams" element={<InGame><TeamOverview /></InGame>} />
          <Route path="/drivers" element={<InGame><Drivers /></InGame>} />
          <Route path="/market" element={<InGame><DriverMarket /></InGame>} />
          <Route path="/development" element={<InGame><Development /></InGame>} />
          <Route path="/finance" element={<InGame><Finance /></InGame>} />
          <Route path="/sponsors" element={<InGame><Sponsors /></InGame>} />
          <Route path="/staff" element={<InGame><Staff /></InGame>} />
          <Route path="/facilities" element={<InGame><Facilities /></InGame>} />
          <Route path="/engine" element={<InGame><EngineSupplier /></InGame>} />
          <Route path="/principal" element={<InGame><TeamPrincipal /></InGame>} />
          <Route path="/relationships" element={<InGame><Relationships /></InGame>} />
          <Route path="/politics" element={<InGame><Politics /></InGame>} />
          <Route path="/scouting" element={<InGame><Scouting /></InGame>} />
          <Route path="/curves" element={<InGame><DriverCurves /></InGame>} />
          <Route path="/records" element={<InGame><UniverseHistory /></InGame>} />
          <Route path="/history" element={<InGame><RaceHistory /></InGame>} />
          <Route path="/weekend" element={<RaceWeekendPhaseGuard><RaceWeekend /></RaceWeekendPhaseGuard>} />
          <Route path="/live-race/:raceId" element={<LiveRaceGuard><LiveRace /></LiveRaceGuard>} />
          <Route path="/results/:raceId" element={<InGame><RaceResults /></InGame>} />
          <Route path="/season-review" element={<InGame><SeasonReview /></InGame>} />
          <Route path="/offseason" element={<InGame><Offseason /></InGame>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </GameProvider>
  );
}
