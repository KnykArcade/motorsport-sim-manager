export type CircuitSegmentType =
  | 'StartFinish'
  | 'Straight'
  | 'BrakingZone'
  | 'SlowCorner'
  | 'MediumCorner'
  | 'FastCorner'
  | 'AccelerationZone'
  | 'OvertakingZone'
  | 'PitEntry'
  | 'PitLane'
  | 'PitBox'
  | 'PitExit';

export type CircuitSegment = {
  id: string;
  index: number;
  name: string;
  startProgress: number;
  endProgress: number;
  lengthMeters: number;
  type: CircuitSegmentType;
  representativeTimeSeconds: number;
  powerSensitivity: number;
  aeroSensitivity: number;
  mechanicalGripSensitivity: number;
  brakingSensitivity: number;
  driverSkillSensitivity: number;
  tyreStress: number;
  brakeStress: number;
  fuelDemand: number;
  overtakingEligible: boolean;
  overtakingDifficulty: number;
  sideBySideCapacity: number;
  dirtyAirSeverity: number;
  draftStrength: number;
  wallProximity: number;
  incidentRisk: number;
  wetWeatherSensitivity: number;
  localYellowApplies: boolean;
  sector: 1 | 2 | 3;
  timingLine?: 'StartFinish' | 'Sector1' | 'Sector2';
  mapAnchorProgress?: number;
  pitPath?: boolean;
};

export type CircuitSegmentSet = {
  id: string;
  trackId: string;
  trackName: string;
  series?: string;
  startYear?: number;
  endYear?: number;
  lapLengthMeters: number;
  baselineLapTimeSeconds: number;
  sectors: 3;
  inferred: boolean;
  source: 'authored' | 'fallback';
  segments: CircuitSegment[];
};
