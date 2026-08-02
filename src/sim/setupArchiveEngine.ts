import type { Car, Driver, Track } from '../types/gameTypes';
import type { SetupArchiveEntry, WeekendPractice } from '../types/practiceTypes';
import type { CarSetup } from '../types/setupTypes';

export type RankedSetupArchiveEntry = {
  entry: SetupArchiveEntry;
  relevance: number;
  reasons: string[];
  verifiedThisWeekend: false;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function carDevelopmentFingerprint(car: Car): number {
  const r = car.ratings;
  const d = car.developmentLevel;
  return (r.enginePower + r.aeroEfficiency + r.mechanicalGrip + r.reliability
    + d.enginePower + d.aeroEfficiency + d.mechanicalGrip + d.reliability) / 8;
}

export function rankSetupArchive(input: {
  archive?: SetupArchiveEntry[];
  teamId: string;
  driver: Driver;
  track: Track;
  car: Car;
  seasonYear: number;
  wet: boolean;
}): RankedSetupArchiveEntry[] {
  const currentFingerprint = carDevelopmentFingerprint(input.car);
  return (input.archive ?? [])
    .filter((entry) => entry.teamId === input.teamId)
    .map((entry) => {
      const exactLayout = entry.trackId === input.track.id;
      const similarTrack = entry.trackArchetype === input.track.archetype;
      const reasons: string[] = [];
      let relevance = exactLayout ? 1 : similarTrack ? 0.58 : 0.22;
      reasons.push(exactLayout ? 'Exact circuit layout' : similarTrack ? 'Similar circuit type' : 'Different circuit type');
      const age = Math.max(0, input.seasonYear - entry.seasonYear);
      relevance *= Math.pow(0.82, age);
      if (age > 0) reasons.push(`${age} season${age === 1 ? '' : 's'} old`);
      const carChange = Math.abs(currentFingerprint - entry.carDevelopmentFingerprint);
      relevance *= Math.max(0.45, 1 - carChange / 45);
      if (carChange >= 4) reasons.push('Car specification has changed');
      if (entry.condition.wet !== input.wet) {
        relevance *= 0.68;
        reasons.push('Different weather conditions');
      }
      if (entry.driverId !== input.driver.id) {
        relevance *= 0.82;
        reasons.push('Recorded for another driver');
      }
      if (entry.evidenceOrigin === 'PreseasonTest') {
        relevance *= 0.62;
        reasons.push('Preseason evidence requires Race 1 verification');
      }
      relevance *= 0.55 + clamp01(entry.evidenceConfidence) * 0.45;
      return { entry, relevance: clamp01(relevance), reasons, verifiedThisWeekend: false as const };
    })
    .filter((item) => item.relevance >= 0.12)
    .sort((a, b) => b.relevance - a.relevance || b.entry.seasonYear - a.entry.seasonYear);
}

export function archiveCompletedWeekend(input: {
  archive?: SetupArchiveEntry[];
  teamId: string;
  drivers: Driver[];
  raceId: string;
  track: Track;
  seasonYear: number;
  car: Car;
  engineerId?: string;
  practice?: WeekendPractice;
  setups: Record<string, CarSetup>;
  wet: boolean;
  evidenceConfidenceByDriver?: Record<string, number>;
}): SetupArchiveEntry[] {
  const existing = input.archive ?? [];
  const additions = input.drivers.flatMap((driver) => {
    const setup = input.setups[driver.id];
    if (!setup) return [];
    const knowledge = input.evidenceConfidenceByDriver?.[driver.id]
      ?? input.practice?.knowledge.setupKnowledge[driver.id]
      ?? 0;
    const laps = input.practice?.practiceLapsByDriver?.[driver.id] ?? 0;
    const condition = input.practice?.sessions.at(-1)?.condition ?? { label: input.wet ? 'Wet' : 'Dry', wet: input.wet, gripLevel: input.wet ? 0.68 : 0.95 };
    return [{
      id: `${input.teamId}-${input.raceId}-${driver.id}`,
      teamId: input.teamId,
      driverId: driver.id,
      raceId: input.raceId,
      trackId: input.track.id,
      trackName: input.track.name,
      trackArchetype: input.track.archetype,
      seasonYear: input.seasonYear,
      carId: input.car.id,
      carDevelopmentFingerprint: carDevelopmentFingerprint(input.car),
      engineerId: input.engineerId,
      condition,
      qualifyingSetup: { ...setup },
      raceSetup: { ...setup },
      evidenceConfidence: clamp01(knowledge * 0.8 + Math.min(1, laps / 24) * 0.2),
      evidenceOrigin: 'RaceWeekend',
      requiresWeekendVerification: false,
    } satisfies SetupArchiveEntry];
  });
  const replacedIds = new Set(additions.map((entry) => entry.id));
  const merged = [...existing.filter((entry) => !replacedIds.has(entry.id)), ...additions];
  const thisTeam = merged
    .filter((entry) => entry.teamId === input.teamId)
    .sort((a, b) => b.seasonYear - a.seasonYear)
    .slice(0, 80);
  const otherTeams = merged.filter((entry) => entry.teamId !== input.teamId);
  return [...otherTeams, ...thisTeam].slice(-1600);
}
