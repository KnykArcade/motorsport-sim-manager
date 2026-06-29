import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { GameProvider, useGame } from '../game/GameContext';
import { Layout } from '../components/Layout';
import { MainMenu } from '../screens/MainMenu';
import { NewCareer } from '../screens/NewCareer';
import { TeamHQ } from '../screens/TeamHQ';
import { Calendar } from '../screens/Calendar';
import { Standings } from '../screens/Standings';
import { Drivers } from '../screens/Drivers';
import { DriverMarket } from '../screens/DriverMarket';
import { Development } from '../screens/Development';
import { Finance } from '../screens/Finance';
import { DataViewer } from '../screens/DataViewer';
import { Settings } from '../screens/Settings';
import { RaceWeekend } from '../screens/RaceWeekend';
import { LiveRace } from '../screens/LiveRace';
import { RaceResults } from '../screens/RaceResults';
import { SeasonReview } from '../screens/SeasonReview';
import { Offseason } from '../screens/Offseason';

// Wrap in-game screens with the dashboard layout and redirect to the menu when
// there is no active game.
function InGame({ children }: { children: ReactNode }) {
  const { state } = useGame();
  if (!state) return <Navigate to="/" replace />;
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

          <Route path="/hq" element={<InGame><TeamHQ /></InGame>} />
          <Route path="/calendar" element={<InGame><Calendar /></InGame>} />
          <Route path="/standings" element={<InGame><Standings /></InGame>} />
          <Route path="/drivers" element={<InGame><Drivers /></InGame>} />
          <Route path="/market" element={<InGame><DriverMarket /></InGame>} />
          <Route path="/development" element={<InGame><Development /></InGame>} />
          <Route path="/finance" element={<InGame><Finance /></InGame>} />
          <Route path="/weekend" element={<InGame><RaceWeekend /></InGame>} />
          <Route path="/live-race/:raceId" element={<InGame><LiveRace /></InGame>} />
          <Route path="/results/:raceId" element={<InGame><RaceResults /></InGame>} />
          <Route path="/season-review" element={<InGame><SeasonReview /></InGame>} />
          <Route path="/offseason" element={<InGame><Offseason /></InGame>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </GameProvider>
  );
}
