import { expect, test } from 'vitest';
import { seasonBundles } from '../src/data/seasonData';
import { getTrackById, getMaxQualifiers } from '../src/data';
import { getPointsSystem } from '../src/data/pointsSystems/pointsSystems';
import { setupOptionsById } from '../src/data/setupOptions/setupOptions';
import { autoSetupOptionsForTrack } from '../src/sim/autoSetup';
import { raceStrategiesById } from '../src/data/decisions/raceStrategies';
import { driverInstructionsById } from '../src/data/decisions/driverInstructions';
import { qualifyingRunPlansById } from '../src/data/decisions/qualifyingRunPlans';
import { aiRaceDecision, aiQualifyingDecision } from '../src/game/ai';
import { simulateQualifying, qualifyingFormatFor } from '../src/sim/qualifyingEngine';
import { createLiveRace, type LiveRaceMeta } from '../src/sim/liveRaceEngine';
import { resolvePromptDefault, stepLiveRace } from '../src/sim/raceTickEngine';
import { aggregateLiveRaceCalibration, measureLiveRaceCalibrationRun } from '../src/sim/calibration/liveRaceCalibration';
import { assessLiveRaceCalibration, selectLiveRaceCalibrationTargets } from '../src/sim/calibration/liveRaceCalibrationTargets';
import type { Entrant, QualifyingContext, RaceContext } from '../src/types/simTypes';
import type { Series } from '../src/types/gameTypes';

test('deterministic live race calibration', () => {
  const series = (process.env.CAL_SERIES ?? 'F1') as Series;
  const year = Number(process.env.CAL_YEAR ?? 1995);
  const sims = Math.max(1, Number(process.env.CAL_SIMS ?? 1));
  const seedStart = Number(process.env.CAL_SEED_START ?? 1);
  const bundle = seasonBundles[`${year}-${series}`];
  if (!bundle) throw new Error(`Unknown season ${year}-${series}`);
  const race = bundle.season.calendar.find((candidate) => {
    const filter = process.env.CAL_TRACK?.toLowerCase();
    return !filter || candidate.trackId.toLowerCase() === filter || candidate.trackName.toLowerCase().includes(filter);
  });
  if (!race) throw new Error(`No matching track for ${process.env.CAL_TRACK}`);
  const track = getTrackById(race.trackId);
  if (!track) throw new Error(`Track ${race.trackId} is not registered`);

  const carByTeam = new Map(bundle.cars.map((car) => [car.teamId, car]));
  const entrants: Entrant[] = bundle.drivers.flatMap((driver) => {
    const car = carByTeam.get(driver.teamId);
    return car ? [{ driver, car }] : [];
  });
  const teamReputation = Object.fromEntries(bundle.teams.map((team) => [team.id, team.reputation]));
  const teamRaceOps = Object.fromEntries(bundle.teams.map((team) => [team.id, team.raceOperations]));
  const driverNames = Object.fromEntries(bundle.drivers.map((driver) => [driver.id, driver.name]));
  const teamNames = Object.fromEntries(bundle.teams.map((team) => [team.id, team.name]));
  const setupOptions = { ...setupOptionsById, ...autoSetupOptionsForTrack(track) };
  const runs = [];
  let maxStopsByCar = 0;

  for (let index = 0; index < sims; index++) {
    const seed = `live-calibration-${year}-${series}-${seedStart + index}`;
    const qDecisions: QualifyingContext['decisions'] = {};
    entrants.forEach((entrant) => (qDecisions[entrant.driver.id] = aiQualifyingDecision(entrant.driver.id, track)));
    const qualifying = simulateQualifying({
      track, entrants, decisions: qDecisions, setupOptions, runPlans: qualifyingRunPlansById, seed,
      maxQualifiers: getMaxQualifiers(series), format: qualifyingFormatFor(year, series), teamReputation, teamRaceOps,
    });
    const qualifiedIds = new Set(qualifying.results.filter((result) => !result.dnq).map((result) => result.driverId));
    const raceEntrants = entrants.filter((entrant) => qualifiedIds.has(entrant.driver.id));
    const decisions: RaceContext['decisions'] = {};
    raceEntrants.forEach((entrant) => (decisions[entrant.driver.id] = aiRaceDecision(entrant.driver.id, track)));
    const context: RaceContext = {
      track, entrants: raceEntrants, qualifyingResults: qualifying.results.filter((result) => !result.dnq), decisions,
      setupOptions, strategies: raceStrategiesById, instructions: driverInstructionsById,
      pointsByPosition: getPointsSystem(bundle.season.pointsSystemId).pointsByPosition,
      seed, year, teamReputation, teamRaceOps,
    };
    const playerTeamId = raceEntrants[0]!.driver.teamId;
    const meta: LiveRaceMeta = { track, driverNames, teamNames, playerTeamId, year, series };
    let state = createLiveRace(context, {
      raceId: race.id, playerTeamId, totalLaps: race.laps, driverNames, teamReputation, teamRaceOps, year, series,
    });
    let modeChanges = 0;
    let recommendationAppearances = 0;
    let priorRecommendations = new Set<string>();
    let guard = 0;
    while (state.phase !== 'finished' && guard < race.laps + 10) {
      if (state.pendingPrompt) state = resolvePromptDefault(state, meta);
      const priorModes = new Map(state.cars.map((car) => [car.driverId, car.paceMode]));
      state = stepLiveRace(state, meta);
      modeChanges += state.cars.filter((car) => priorModes.get(car.driverId) !== car.paceMode).length;
      const currentRecommendations = new Set(state.recommendations.map((recommendation) => recommendation.id));
      recommendationAppearances += [...currentRecommendations].filter((id) => !priorRecommendations.has(id)).length;
      priorRecommendations = currentRecommendations;
      guard += 1;
    }
    maxStopsByCar = Math.max(maxStopsByCar, ...state.cars.map((car) => car.pit.stopsMade));
    runs.push(measureLiveRaceCalibrationRun(seed, state, modeChanges, recommendationAppearances));
  }

  const report = aggregateLiveRaceCalibration(runs, maxStopsByCar);
  const targetAssessment = assessLiveRaceCalibration(report, selectLiveRaceCalibrationTargets(series, year));
  console.log(JSON.stringify({ season: `${year}-${series}`, track: race.trackName, ...report, targetAssessment }, null, 2));
  expect(report.runs).toBe(sims);
  expect(report.pitCallReconciliationFailures).toBe(0);
  if (process.env.CAL_ASSERT_TARGETS === '1') expect(targetAssessment.withinTargets).toBe(true);
}, 120_000);
