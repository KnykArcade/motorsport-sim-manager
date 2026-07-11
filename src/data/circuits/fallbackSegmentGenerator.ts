import type { Track } from '../../types/gameTypes';
import type { CircuitSegment, CircuitSegmentSet, CircuitSegmentType } from '../../types/circuitTypes';

const DEFAULT_LAP_LENGTH_METERS = 5000;
const DEFAULT_BASELINE_LAP_SECONDS = 90;

const ROAD_PATTERN: CircuitSegmentType[] = [
  'StartFinish',
  'Straight',
  'BrakingZone',
  'SlowCorner',
  'AccelerationZone',
  'MediumCorner',
  'Straight',
  'BrakingZone',
  'OvertakingZone',
  'FastCorner',
  'Straight',
  'MediumCorner',
  'AccelerationZone',
  'SlowCorner',
  'Straight',
  'FastCorner',
  'BrakingZone',
  'MediumCorner',
  'AccelerationZone',
  'Straight',
  'SlowCorner',
  'FastCorner',
  'Straight',
  'MediumCorner',
];

const OVAL_PATTERN: CircuitSegmentType[] = [
  'StartFinish',
  'Straight',
  'OvertakingZone',
  'BrakingZone',
  'MediumCorner',
  'AccelerationZone',
  'Straight',
  'OvertakingZone',
  'BrakingZone',
  'MediumCorner',
  'AccelerationZone',
  'Straight',
  'FastCorner',
  'Straight',
  'FastCorner',
  'AccelerationZone',
  'Straight',
  'OvertakingZone',
  'FastCorner',
  'AccelerationZone',
];

export function generateFallbackSegments(track: Track, totalLaps?: number): CircuitSegmentSet {
  const lapLengthMeters = inferLapLengthMeters(track, totalLaps);
  const baselineLapTimeSeconds = inferTrackBaselineLapTime(track, lapLengthMeters);
  const pattern = isOvalLike(track) ? OVAL_PATTERN : ROAD_PATTERN;
  const totalWeight = pattern.reduce((sum, type) => sum + weightFor(type), 0);
  let cursor = 0;
  const segments: CircuitSegment[] = pattern.map((type, index) => {
    const fraction = weightFor(type) / totalWeight;
    const startProgress = cursor;
    const endProgress = index === pattern.length - 1 ? 1 : cursor + fraction;
    cursor = endProgress;
    const lengthMeters = lapLengthMeters * (endProgress - startProgress);
    return buildSegment(track, type, index, startProgress, endProgress, lengthMeters, baselineLapTimeSeconds * fraction);
  });

  return {
    id: `${track.id}:fallback-segments`,
    trackId: track.id,
    trackName: track.name,
    lapLengthMeters,
    baselineLapTimeSeconds,
    sectors: 3,
    inferred: true,
    source: 'fallback',
    segments,
  };
}

export function inferLapLengthMeters(track: Track, totalLaps?: number): number {
  const raceDistanceKm = typeof totalLaps === 'number' && totalLaps > 0 ? undefined : undefined;
  void raceDistanceKm;
  const fromName = /\b(\d(?:\.\d+)?)\s*(?:km|kilometer)/i.exec(track.ratingNotes)?.[1];
  if (fromName) return Number(fromName) * 1000;
  return DEFAULT_LAP_LENGTH_METERS;
}

export function inferTrackBaselineLapTime(track: Track, lapLengthMeters = DEFAULT_LAP_LENGTH_METERS): number {
  const speedKph = isOvalLike(track) ? 250 : track.archetype.includes('High-Speed') ? 220 : 190;
  const seconds = (lapLengthMeters / 1000 / speedKph) * 3600;
  return Math.max(45, Math.min(140, seconds || DEFAULT_BASELINE_LAP_SECONDS));
}

function buildSegment(
  track: Track,
  type: CircuitSegmentType,
  index: number,
  startProgress: number,
  endProgress: number,
  lengthMeters: number,
  representativeTimeSeconds: number,
): CircuitSegment {
  const sector = (startProgress < 1 / 3 ? 1 : startProgress < 2 / 3 ? 2 : 3) as 1 | 2 | 3;
  return {
    id: `${track.id}:seg-${String(index + 1).padStart(2, '0')}`,
    index,
    name: segmentName(type, index),
    startProgress: round4(startProgress),
    endProgress: round4(endProgress),
    lengthMeters: round1(lengthMeters),
    type,
    representativeTimeSeconds: round3(representativeTimeSeconds),
    powerSensitivity: sensitivity(type, 'power'),
    aeroSensitivity: sensitivity(type, 'aero'),
    mechanicalGripSensitivity: sensitivity(type, 'mechanical'),
    brakingSensitivity: sensitivity(type, 'braking'),
    driverSkillSensitivity: sensitivity(type, 'driver'),
    tyreStress: stress(type, 'tyre'),
    brakeStress: stress(type, 'brake'),
    fuelDemand: stress(type, 'fuel'),
    overtakingEligible: type === 'Straight' || type === 'BrakingZone' || type === 'OvertakingZone',
    overtakingDifficulty: type === 'OvertakingZone' ? 0.25 : type === 'BrakingZone' ? 0.45 : 0.65,
    sideBySideCapacity: type === 'OvertakingZone' ? 2 : type === 'Straight' ? 1.5 : 1,
    dirtyAirSeverity: type.includes('Corner') ? 0.8 : 0.35,
    draftStrength: type === 'Straight' || type === 'OvertakingZone' ? 0.85 : 0.15,
    wallProximity: track.attributes.riskWallProximity / 100,
    incidentRisk: Math.max(0.02, track.attributes.riskWallProximity / 140),
    wetWeatherSensitivity: type.includes('Corner') || type === 'BrakingZone' ? 0.8 : 0.45,
    localYellowApplies: true,
    sector,
    timingLine: index === 0 ? 'StartFinish' : startProgress < 1 / 3 && endProgress >= 1 / 3 ? 'Sector1' : startProgress < 2 / 3 && endProgress >= 2 / 3 ? 'Sector2' : undefined,
    mapAnchorProgress: round4((startProgress + endProgress) / 2),
  };
}

function isOvalLike(track: Track): boolean {
  const text = `${track.name} ${track.gpName} ${track.archetype}`.toLowerCase();
  return text.includes('speedway') || text.includes('oval') || text.includes('superspeedway');
}

function weightFor(type: CircuitSegmentType): number {
  if (type === 'Straight' || type === 'OvertakingZone') return 1.4;
  if (type === 'StartFinish') return 1.1;
  if (type === 'BrakingZone' || type === 'AccelerationZone') return 0.8;
  if (type === 'SlowCorner') return 0.7;
  if (type === 'MediumCorner') return 0.9;
  if (type === 'FastCorner') return 1;
  return 1;
}

function sensitivity(type: CircuitSegmentType, kind: 'power' | 'aero' | 'mechanical' | 'braking' | 'driver'): number {
  const table: Record<CircuitSegmentType, [number, number, number, number, number]> = {
    StartFinish: [0.8, 0.2, 0.1, 0.1, 0.3],
    Straight: [1, 0.25, 0.05, 0.05, 0.25],
    BrakingZone: [0.35, 0.35, 0.35, 1, 0.75],
    SlowCorner: [0.2, 0.25, 1, 0.7, 0.9],
    MediumCorner: [0.25, 0.65, 0.75, 0.45, 0.85],
    FastCorner: [0.35, 1, 0.45, 0.35, 0.9],
    AccelerationZone: [0.75, 0.2, 0.75, 0.1, 0.65],
    OvertakingZone: [0.85, 0.3, 0.3, 0.85, 0.9],
    PitEntry: [0.1, 0.1, 0.4, 0.8, 0.5],
    PitLane: [0.1, 0.1, 0.2, 0.2, 0.3],
    PitBox: [0, 0, 0, 0, 0],
    PitExit: [0.4, 0.1, 0.5, 0.1, 0.45],
  };
  const idx = ['power', 'aero', 'mechanical', 'braking', 'driver'].indexOf(kind);
  return table[type][idx];
}

function stress(type: CircuitSegmentType, kind: 'tyre' | 'brake' | 'fuel'): number {
  const tyre = type.includes('Corner') ? 0.8 : type === 'AccelerationZone' ? 0.55 : 0.3;
  const brake = type === 'BrakingZone' || type === 'SlowCorner' ? 0.9 : 0.25;
  const fuel = type === 'Straight' || type === 'AccelerationZone' || type === 'OvertakingZone' ? 0.85 : 0.45;
  return kind === 'tyre' ? tyre : kind === 'brake' ? brake : fuel;
}

function segmentName(type: CircuitSegmentType, index: number): string {
  return `${type.replace(/([A-Z])/g, ' $1').trim()} ${index + 1}`;
}

function round1(value: number): number { return Math.round(value * 10) / 10; }
function round3(value: number): number { return Math.round(value * 1000) / 1000; }
function round4(value: number): number { return Math.round(value * 10000) / 10000; }
