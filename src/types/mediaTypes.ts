export type MediaSessionType =
  | 'Preseason'
  | 'PreRace'
  | 'PostQualifying'
  | 'PostRace'
  | 'Crisis';

export type MediaQuestionTopic =
  | 'Expectations'
  | 'Performance'
  | 'Reliability'
  | 'TeamOrders'
  | 'Contracts'
  | 'Sponsors'
  | 'BoardPressure'
  | 'DriverSupport'
  | 'Rivalry';

export type MediaResponseStyle =
  | 'Diplomatic'
  | 'Protective'
  | 'Demanding'
  | 'Confrontational'
  | 'Evasive';

export type MediaQuestion = {
  id: string;
  topic: MediaQuestionTopic;
  prompt: string;
  context: string;
  driverId?: string;
  teamId?: string;
};

export type MediaAnswer = {
  questionId: string;
  style: MediaResponseStyle;
  response: string;
  reaction: string;
};

export type MediaSessionStatus = 'Pending' | 'Completed' | 'Declined';

export type MediaSession = {
  id: string;
  type: MediaSessionType;
  seasonYear: number;
  round: number;
  raceId?: string;
  title: string;
  trigger: string;
  status: MediaSessionStatus;
  questions: MediaQuestion[];
  answers: MediaAnswer[];
  consequenceSummary?: string;
};

export type MediaState = {
  sessions: MediaSession[];
  declinedDuties: number;
};
