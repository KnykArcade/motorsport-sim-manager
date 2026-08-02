import { describe, expect, it } from 'vitest';
import { cars1995 } from '../data/cars/cars1995';
import { drivers1995 } from '../data/drivers/drivers1995';
import { BALANCED_SETUP } from '../data/setup/setupComponents';
import { tracks1995 } from '../data/tracks/tracks1995';
import type { DriverRelationship } from '../types/relationshipTypes';
import type { SetupArchiveEntry, SetupWeekendDebrief, WeekendPractice } from '../types/practiceTypes';
import type { ScoreBreakdown } from '../types/simTypes';
import {
  applyDebriefToSetupArchive,
  buildSetupWeekendDebrief,
  resolveSetupDebriefDecision,
} from './setupDebriefEngine';
import { carDevelopmentFingerprint } from './setupArchiveEngine';

const driver = drivers1995[0];
const secondDriver = { ...driver, id: `${driver.id}-second`, name: 'Second Driver' };
const car = cars1995.find((candidate) => candidate.teamId === driver.teamId) ?? cars1995[0];
const track = tracks1995[0];

function practice(): WeekendPractice {
  return {
    raceId: 'race-1',
    sessions: [{
      id: 'practice-1',
      raceId: 'race-1',
      kind: 'RaceSimulation',
      assignments: [],
      completed: true,
      condition: { label: 'Dry', wet: false, gripLevel: 0.95 },
    }],
    knowledge: {
      raceId: 'race-1',
      setupKnowledge: { [driver.id]: 0.82, [secondDriver.id]: 0.82 },
      tireKnowledge: {},
      reliabilityKnowledge: {},
      confidenceDelta: {},
    },
    setupRevisionsByDriver: {
      [driver.id]: [{ id: 'r1', driverId: driver.id, sequence: 1, setup: BALANCED_SETUP, firstTestedSessionId: 'practice-1', changeMagnitude: 0, evidenceRelevance: 1 }],
      [secondDriver.id]: [{ id: 'r2', driverId: secondDriver.id, sequence: 1, setup: BALANCED_SETUP, firstTestedSessionId: 'practice-1', changeMagnitude: 0, evidenceRelevance: 1 }],
    },
  };
}

const breakdown: ScoreBreakdown = {
  driverId: driver.id,
  driverBase: 7,
  carBase: 8,
  trackFit: 0,
  setupFit: -0.2,
  reliabilityRisk: 0,
  mistakeRisk: 0,
  variance: 0,
  finalScore: 14.8,
};

function build(overrides: Partial<Parameters<typeof buildSetupWeekendDebrief>[0]> = {}): SetupWeekendDebrief {
  return buildSetupWeekendDebrief({
    seed: 'phase-8-test',
    raceId: 'race-1',
    round: 1,
    teamId: driver.teamId,
    drivers: [driver, secondDriver],
    car,
    allCars: cars1995,
    track,
    setups: { [driver.id]: BALANCED_SETUP, [secondDriver.id]: BALANCED_SETUP },
    qualifyingResults: [
      { position: 4, driverId: driver.id, teamId: driver.teamId, qualifyingScore: 10, gapText: '+0.2', runPlan: 'Standard', setupChoice: 'Tuned', notes: [] },
      { position: 7, driverId: secondDriver.id, teamId: secondDriver.teamId, qualifyingScore: 9, gapText: '+0.4', runPlan: 'Standard', setupChoice: 'Tuned', notes: [] },
    ],
    results: [
      { position: 3, driverId: driver.id, teamId: driver.teamId, gridPosition: 4, status: 'Finished', lapsCompleted: 60, points: 4, raceScore: 10, gapText: '+10s', incidents: [] },
      { position: null, driverId: secondDriver.id, teamId: secondDriver.teamId, gridPosition: 7, status: 'DNF', lapsCompleted: 8, points: 0, raceScore: 4, gapText: 'DNF', incidents: ['Engine failure'] },
    ],
    breakdowns: { [driver.id]: breakdown, [secondDriver.id]: { ...breakdown, driverId: secondDriver.id } },
    practice: practice(),
    raceWet: false,
    engineerId: 'engineer-1',
    engineerName: 'Alex Engineer',
    engineerSkill: 82,
    ...overrides,
  });
}

function relationship(driverId: string): DriverRelationship {
  return {
    driverId,
    teamId: driver.teamId,
    teamLoyalty: 50,
    engineerChemistry: 50,
    teammateRelationship: 50,
    morale: 50,
    frustration: 20,
    numberOneExpectation: false,
    selfConfidence: 50,
    trustInCar: 50,
    trustInTeam: 50,
    trustInPrincipal: 50,
    teamTrustInDriver: 50,
    ego: 50,
    personalityTraits: [],
    wants: [],
  };
}

describe('post-race setup debrief', () => {
  it('creates driver-specific verdicts and keeps a DNF inconclusive', () => {
    const debrief = build();
    expect(debrief.drivers).toHaveLength(2);
    expect(debrief.drivers[0].grade).not.toBe('Inconclusive');
    expect(debrief.drivers[1].grade).toBe('Inconclusive');
    expect(debrief.drivers[1].confidence).toBe('Low');
    expect(debrief.drivers[0].attribution.join(' ')).toContain('Strategy, traffic, reliability');
  });

  it('does not expose the hidden physical quality score in persisted verdicts', () => {
    const verdict = build().drivers[0];
    expect(verdict).not.toHaveProperty('objectiveQuality');
    expect(verdict).not.toHaveProperty('setupScore');
    expect(verdict.summary).not.toMatch(/\b\d{2,3}\s*\/\s*100\b/);
  });

  it('feeds competition learning back into the matching archive record', () => {
    const debrief = build({ drivers: [driver] });
    const archive: SetupArchiveEntry[] = [{
      id: 'archive-1',
      teamId: driver.teamId,
      driverId: driver.id,
      raceId: 'race-1',
      trackId: track.id,
      trackName: track.name,
      trackArchetype: track.archetype,
      seasonYear: 1995,
      carId: car.id,
      carDevelopmentFingerprint: carDevelopmentFingerprint(car),
      condition: { label: 'Dry', wet: false, gripLevel: 0.95 },
      qualifyingSetup: BALANCED_SETUP,
      raceSetup: BALANCED_SETUP,
      evidenceConfidence: 0.7,
    }];
    const updated = applyDebriefToSetupArchive(archive, debrief, 82)!;
    expect(updated[0].postRaceOutcome?.grade).toBe(debrief.drivers[0].grade);
    expect(updated[0].evidenceConfidence).toBeGreaterThan(archive[0].evidenceConfidence);
  });

  it('lets stronger engineering departments learn more from the same accurate evidence', () => {
    const debrief = build({ drivers: [driver] });
    const archive: SetupArchiveEntry[] = [{
      id: 'archive-1', teamId: driver.teamId, driverId: driver.id, raceId: 'race-1',
      trackId: track.id, trackName: track.name, trackArchetype: track.archetype,
      seasonYear: 1995, carId: car.id, carDevelopmentFingerprint: carDevelopmentFingerprint(car),
      condition: { label: 'Dry', wet: false, gripLevel: 0.95 },
      qualifyingSetup: BALANCED_SETUP, raceSetup: BALANCED_SETUP, evidenceConfidence: 0.5,
    }];
    const weak = applyDebriefToSetupArchive(archive, debrief, 30)![0].evidenceConfidence;
    const strong = applyDebriefToSetupArchive(archive, debrief, 90)![0].evidenceConfidence;
    expect(strong).toBeGreaterThan(weak);
  });

  it('records a proportional one-time principal decision consequence', () => {
    const debrief = build({ drivers: [driver] });
    const relationships = { [driver.id]: relationship(driver.id) };
    const first = resolveSetupDebriefDecision(debrief, 'TakeResponsibility', relationships);
    expect(first.debrief.decision).toBe('TakeResponsibility');
    expect(first.relationships?.[driver.id].trustInPrincipal).toBe(52);
    expect(first.relationships?.[driver.id].engineerChemistry).toBe(51);
    const second = resolveSetupDebriefDecision(first.debrief, 'SupportDriverInterpretation', first.relationships);
    expect(second.debrief.decision).toBe('TakeResponsibility');
    expect(second.relationships).toEqual(first.relationships);
  });
});
