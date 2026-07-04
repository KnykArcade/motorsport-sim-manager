import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { GameState } from '../../../game/careerState';
import type { Race, Track } from '../../../types/gameTypes';
import type { WeekendForecast } from '../../../sim/weatherEngine';

export type RaceWeekendHubPhase =
  | 'briefing'
  | 'practice'
  | 'setup'
  | 'quali-run'
  | 'quali-review'
  | 'race-strategy'
  | 'race-instructions';

export type RaceWeekendHubAction =
  | { type: 'phase'; phase: RaceWeekendHubPhase }
  | { type: 'route'; to: string };

export type RaceWeekendHubCallbacks = {
  onPhase: Dispatch<SetStateAction<RaceWeekendHubPhase | 'hub'>>;
  onRoute: (to: string) => void;
  onExit: () => void;
};

export type RaceWeekendHubProps = {
  state: GameState;
  race: Race;
  track: Track;
  forecast: WeekendForecast;
  isMinPackage: boolean;
  hasQualifyingResults: boolean;
  activePhase?: RaceWeekendHubPhase | 'hub';
  moduleTitle?: string;
  moduleContent?: ReactNode;
  onPhase: Dispatch<SetStateAction<RaceWeekendHubPhase | 'hub'>>;
  onRoute: (to: string) => void;
  onExit: () => void;
};

export type WeekendScheduleStatus = 'completed' | 'current' | 'upcoming' | 'locked';

export type WeekendScheduleItem = {
  id: string;
  day: 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  label: string;
  time: string;
  status: WeekendScheduleStatus;
  action?: RaceWeekendHubAction;
  lockedReason?: string;
};

export type GarageHotspot = {
  id: string;
  label: string;
  description: string;
  x: number;
  y: number;
  action: RaceWeekendHubAction;
  lockedReason?: string;
};

export type QuickAction = {
  id: string;
  label: string;
  action: RaceWeekendHubAction;
  count?: number;
};

export type NextSessionAction = {
  sessionName: string;
  detail: string;
  primaryLabel: string;
  action?: RaceWeekendHubAction;
  disabledReason?: string;
};
