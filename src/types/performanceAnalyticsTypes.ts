export type AnalyticsEvidenceLevel = 'High' | 'Medium' | 'Low' | 'Unavailable';

export type RaceDriverAnalytics = {
  driverId: string;
  teamId: string;
  qualifyingPosition?: number;
  gridPosition: number;
  finishPosition: number | null;
  positionsGained: number;
  status: 'Finished' | 'DNF' | 'DNS' | 'DSQ';
  points: number;
  performanceRating?: number;
  dnfCause?: 'Mechanical' | 'Crash' | 'TyreDamage' | 'Other';
  pitStops?: number;
  representativePitStopSeconds?: number;
  finalTireWear?: number;
  tireDegRate?: number;
  setupQuality?: number;
};

export type RaceTeamAnalytics = {
  teamId: string;
  bestGrid?: number;
  bestFinish?: number;
  points: number;
  netPositions: number;
  classifiedCars: number;
  starters: number;
  averagePitStopSeconds?: number;
  averageTireDegRate?: number;
  averageSetupQuality?: number;
};

export type RaceAnalyticsSnapshot = {
  raceId: string;
  season: number;
  round: number;
  trackId: string;
  trackName: string;
  trackArchetype: string;
  source: 'Historical results' | 'Quick simulation' | 'Live telemetry';
  drivers: RaceDriverAnalytics[];
  teams: RaceTeamAnalytics[];
};

export type LiveRaceAnalyticsInput = {
  drivers: Record<string, {
    pitStops: number;
    representativePitStopSeconds?: number;
    finalTireWear: number;
    tireDegRate: number;
  }>;
};

export type PerformanceAnalyticsState = {
  snapshots: RaceAnalyticsSnapshot[];
};
