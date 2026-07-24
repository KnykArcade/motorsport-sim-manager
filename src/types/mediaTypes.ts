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
  challengeMemoryId?: string;
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
  crisisId?: string;
};

export type JournalistMemory = {
  id: string;
  topic: MediaQuestionTopic;
  style: MediaResponseStyle;
  statement: string;
  seasonYear: number;
  round: number;
  sessionId: string;
  questionId: string;
};

export type PublicMediaPromiseType =
  | 'Results'
  | 'Reliability'
  | 'DriverSupport'
  | 'SponsorResolution'
  | 'BoardTarget';

export type PublicMediaPromise = {
  id: string;
  type: PublicMediaPromiseType;
  statement: string;
  seasonYear: number;
  createdRound: number;
  deadlineRound: number;
  status: 'Active' | 'Kept' | 'Broken' | 'Expired';
  sourceSessionId: string;
  sourceQuestionId: string;
  driverId?: string;
  outcome?: string;
};

export type MediaStoryCategory =
  | 'Contradiction'
  | 'Scandal'
  | 'InternalLeak'
  | 'SponsorDispute'
  | 'DriverConflict'
  | 'Reliability'
  | 'PerformanceRumor';

export type MediaStoryThread = {
  id: string;
  scope: 'Player' | 'AI';
  teamId: string;
  category: MediaStoryCategory;
  headline: string;
  summary: string;
  stage: 'Emerging' | 'Escalating' | 'Flashpoint' | 'Cooling' | 'Resolved';
  pressure: number;
  status: 'Active' | 'Resolved';
  createdSeasonYear: number;
  createdRound: number;
  updatedSeasonYear: number;
  updatedRound: number;
  sourceIds: string[];
  lastStakeholderReactionSeasonYear?: number;
  lastStakeholderReactionRound?: number;
};

export type MediaCrisisKind =
  | 'Scandal'
  | 'InternalLeak'
  | 'SponsorDispute'
  | 'DriverConflict';

export type MediaCrisis = {
  id: string;
  kind: MediaCrisisKind;
  headline: string;
  detail: string;
  seasonYear: number;
  round: number;
  status: 'Open' | 'Resolved';
  linkedDriverId?: string;
  linkedSponsorId?: string;
  resolution?: 'TransparentBriefing' | 'PrivateInvestigation' | 'DenyAndDeflect';
  outcome?: string;
};

export type MediaState = {
  sessions: MediaSession[];
  declinedDuties: number;
  journalistMemory?: JournalistMemory[];
  publicPromises?: PublicMediaPromise[];
  storyThreads?: MediaStoryThread[];
  crises?: MediaCrisis[];
  managementStanding?: number;
};
