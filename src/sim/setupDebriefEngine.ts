import type { Car, Driver, QualifyingResult, RaceResult, Track } from '../types/gameTypes';
import type {
  SetupArchiveEntry,
  SetupDebriefConfidence,
  SetupDebriefDecision,
  SetupDriverDebrief,
  SetupPredictionVerdict,
  SetupVerdictGrade,
  SetupWeekendDebrief,
  WeekendPractice,
} from '../types/practiceTypes';
import type { DriverRelationship } from '../types/relationshipTypes';
import type { CarSetup } from '../types/setupTypes';
import type { ScoreBreakdown } from '../types/simTypes';
import { objectiveSetupQuality } from './setupFitEngine';
import { setupVerificationStatus } from './practiceEvidenceEngine';
import { driverSetupComfort } from './driverComfortEngine';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clamp100(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function deterministicUnit(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function setupGrade(quality: number, conclusive: boolean): SetupVerdictGrade {
  if (!conclusive) return 'Inconclusive';
  if (quality >= 88) return 'Excellent';
  if (quality >= 76) return 'Strong';
  if (quality >= 62) return 'Workable';
  if (quality >= 46) return 'Compromised';
  return 'Poor';
}

function confidenceFor(input: {
  knowledge: number;
  result?: RaceResult;
  incidentCount: number;
  conditionMatched: boolean;
}): SetupDebriefConfidence {
  if (!input.result || input.result.status === 'DNS' || input.result.status === 'DSQ') return 'Low';
  if (input.result.status === 'DNF' || input.incidentCount > 1 || !input.conditionMatched) return 'Low';
  if (input.knowledge >= 0.68 && input.incidentCount === 0) return 'High';
  return 'Medium';
}

function predictionVerdict(input: {
  seed: string;
  knowledge: number;
  engineerSkill: number;
  conclusive: boolean;
  setupVerified: boolean;
}): SetupPredictionVerdict {
  if (!input.conclusive) return 'Inconclusive';
  const evidence = clamp01(input.knowledge * 0.68 + input.engineerSkill * 0.32);
  const roll = deterministicUnit(input.seed);
  if (evidence >= 0.72 && input.setupVerified) return 'Accurate';
  if (evidence < 0.34 && roll > evidence + 0.28) return 'Misleading';
  if (evidence >= 0.5 || roll < evidence) return 'Accurate';
  return 'Mixed';
}

function carPotentialRank(car: Car, allCars: Car[]): { rank: number; total: number } {
  const score = (candidate: Car) => {
    const ratings = candidate.ratings;
    const development = candidate.developmentLevel;
    return ratings.enginePower + ratings.aeroEfficiency + ratings.mechanicalGrip + ratings.reliability
      + development.enginePower + development.aeroEfficiency + development.mechanicalGrip + development.reliability;
  };
  const ordered = [...allCars].sort((a, b) => score(b) - score(a));
  return { rank: Math.max(1, ordered.findIndex((candidate) => candidate.id === car.id) + 1), total: ordered.length };
}

function expectationText(grade: SetupVerdictGrade, verified: boolean, raceWet: boolean): string[] {
  const quality = grade === 'Excellent' || grade === 'Strong'
    ? 'Engineering expected the car to operate close to its available setup window.'
    : grade === 'Workable'
      ? 'Engineering expected a usable compromise with some pace left inaccessible.'
      : 'Engineering expected the setup compromise to restrict at least one part of the weekend.';
  return [
    quality,
    verified
      ? 'The final specification had relevant on-track verification.'
      : 'The final changes were not fully verified before competition.',
    raceWet
      ? 'Wet conditions increased uncertainty around balance and tyre behavior.'
      : 'Dry conditions made the qualifying and long-run comparison more representative.',
  ];
}

function raceAssessment(result: RaceResult | undefined, breakdown: ScoreBreakdown | undefined): string {
  if (!result) return 'No race result was available for setup attribution.';
  if (result.status === 'DNS') return 'The car did not start, so race behavior could not be assessed.';
  if (result.status === 'DSQ') return 'Disqualification prevented a reliable competitive verdict.';
  if (result.status === 'DNF') return `The retirement after ${result.lapsCompleted} laps left only partial race evidence.`;
  const places = result.gridPosition - (result.position ?? result.gridPosition);
  const trajectory = places > 0 ? `gained ${places} place${places === 1 ? '' : 's'}` : places < 0 ? `lost ${Math.abs(places)} place${places === -1 ? '' : 's'}` : 'held its grid position';
  if (breakdown && breakdown.setupFit < -1.5) return `The car ${trajectory}, but the stored race model identifies a meaningful setup limitation.`;
  return `The car ${trajectory} and completed enough running for a representative long-run comparison.`;
}

function tyreAssessment(quality: ReturnType<typeof objectiveSetupQuality>, result?: RaceResult): string {
  if (!result || result.status !== 'Finished') return 'Tyre behavior remains only partially resolved because the car did not complete a representative race distance.';
  const tyre = quality.snapshot?.sessions.lateStint.tyreWearDelta ?? quality.effects.tyreWear;
  const consistency = quality.snapshot?.sessions.lateStint.consistencyLoss ?? 0;
  if (tyre <= -0.2 && consistency < 0.8) return 'The setup protected the tyres and retained a stable late-stint platform.';
  if (tyre > 0.7 || consistency > 1.5) return 'The setup exposed the car to elevated tyre use or late-stint inconsistency.';
  return 'Tyre behavior was broadly consistent with a balanced race compromise.';
}

export function buildSetupWeekendDebrief(input: {
  seed: string;
  raceId: string;
  round: number;
  teamId: string;
  drivers: Driver[];
  car: Car;
  allCars: Car[];
  track: Track;
  setups: Record<string, CarSetup>;
  results: RaceResult[];
  qualifyingResults: QualifyingResult[];
  breakdowns: Record<string, ScoreBreakdown>;
  practice?: WeekendPractice;
  knowledgeByDriver?: Record<string, number>;
  verifiedByDriver?: Record<string, boolean>;
  raceWet: boolean;
  engineerId?: string;
  engineerName?: string;
  engineerSkill?: number;
}): SetupWeekendDebrief {
  const engineerSkill = clamp01((input.engineerSkill ?? 50) / 100);
  const potential = carPotentialRank(input.car, input.allCars);
  const conditionMatched = input.practice?.sessions.at(-1)?.condition?.wet == null
    || input.practice.sessions.at(-1)?.condition?.wet === input.raceWet;
  const verdicts = input.drivers.flatMap((driver): SetupDriverDebrief[] => {
    const setup = input.setups[driver.id];
    if (!setup) return [];
    const result = input.results.find((item) => item.driverId === driver.id);
    const qualifying = input.qualifyingResults.find((item) => item.driverId === driver.id);
    const breakdown = input.breakdowns[driver.id];
    const knowledge = input.knowledgeByDriver?.[driver.id]
      ?? input.practice?.knowledge.setupKnowledge[driver.id]
      ?? 0;
    const revisions = input.practice?.setupRevisionsByDriver?.[driver.id];
    const verified = input.verifiedByDriver?.[driver.id]
      ?? setupVerificationStatus(setup, revisions) === 'Verified';
    const incidentCount = (result?.incidents.length ?? 0) + (qualifying?.incident && qualifying.incident.type !== 'None' ? 1 : 0);
    const conclusive = Boolean(result && result.status === 'Finished' && result.lapsCompleted > 0 && incidentCount <= 1);
    const quality = objectiveSetupQuality(setup, input.track, input.car);
    const grade = setupGrade(quality.quality, conclusive);
    const confidence = confidenceFor({ knowledge, result, incidentCount, conditionMatched });
    const prediction = predictionVerdict({
      seed: `${input.seed}-${input.raceId}-${driver.id}`,
      knowledge,
      engineerSkill,
      conclusive: confidence !== 'Low' || (result?.status === 'Finished' && incidentCount === 0),
      setupVerified: verified,
    });
    const qualifyingAssessment = !qualifying
      ? 'No qualifying evidence was stored.'
      : qualifying.incident && qualifying.incident.type !== 'None'
        ? `${qualifying.incident.type} reduced the value of the qualifying comparison.`
        : `Qualifying P${qualifying.position} supplied a clean one-lap reference.`;
    const raceText = raceAssessment(result, breakdown);
    const tyreText = tyreAssessment(quality, result);
    const assignments = input.practice?.sessions.flatMap((session) => session.assignments) ?? [];
    const practiceResults = input.practice?.sessions.flatMap((session) => session.results ?? []) ?? [];
    const comfort = driverSetupComfort({
      driver,
      currentSetup: setup,
      practicedSetup: input.practice?.practicedSetupByDriver?.[driver.id],
      practiceLaps: input.practice?.practiceLapsByDriver?.[driver.id] ?? 0,
      setupKnowledge: knowledge,
      ranQualiSim: assignments.some((item) => item.driverId === driver.id && item.program === 'QualifyingSimulation'),
      ranRacePace: assignments.some((item) => item.driverId === driver.id && item.program === 'RacePaceRun'),
      ranWetPrep: assignments.some((item) => item.driverId === driver.id && item.program === 'WetWeatherPreparation'),
      raceWet: input.raceWet,
      hadIncident: practiceResults.some((item) => item.driverId === driver.id && item.incident),
    });
    const comfortText = comfort.label === 'Unknown'
      ? 'Driver comfort remained unresolved because no representative setup familiarity was stored.'
      : `Driver comfort was ${comfort.label.toLowerCase()}; ${comfort.stale ? 'late changes made earlier feedback partly stale.' : 'the competition setup remained relevant to the practiced baseline.'}`;
    const observed = [qualifyingAssessment, raceText, tyreText, comfortText];
    const carTier = potential.rank <= Math.max(1, Math.ceil(potential.total / 3))
      ? 'The car package ranked among the stronger available baselines, so setup losses were less easily hidden.'
      : potential.rank > Math.ceil(potential.total * 0.66)
        ? 'Underlying car potential limited the result independently of setup quality.'
        : 'Car potential was competitive enough to separate setup influence from the basic package.';
    const external = incidentCount > 0
      ? 'Incidents reduced confidence in attributing the final classification to setup.'
      : input.raceWet && !conditionMatched
        ? 'The condition change weakened direct comparison with practice.'
        : 'No major incident signal obscured the stored setup comparison.';
    const relationshipRisk = prediction === 'Misleading'
      ? 'Driver confidence in the Race Engineer may fall if the explanation ignores the misleading recommendation.'
      : (grade === 'Poor' || grade === 'Compromised') && !verified
        ? 'The driver may question why unverified changes were carried into competition.'
        : undefined;
    return [{
      driverId: driver.id,
      driverName: driver.name,
      grade,
      predictionVerdict: prediction,
      confidence,
      summary: grade === 'Inconclusive'
        ? 'The weekend did not produce enough clean competition evidence for a definitive setup verdict.'
        : grade === 'Excellent' || grade === 'Strong'
          ? 'The setup allowed the driver to access most of the car’s available performance.'
          : grade === 'Workable'
            ? 'The setup was usable but required a visible qualifying or race compromise.'
            : 'The setup left meaningful performance inaccessible and needs a different baseline next time.',
      qualifyingAssessment,
      raceAssessment: raceText,
      tyreAssessment: tyreText,
      learnedAtRound: input.round,
      expectedHandling: expectationText(grade, verified, input.raceWet),
      observedHandling: observed,
      attribution: [carTier, external, 'Strategy, traffic, reliability and driver execution remain separate from this setup verdict.'],
      compromiseAssessment: quality.effects.qualifyingPaceCeiling > quality.effects.racePaceCeiling + 0.2
        ? 'The final compromise favored qualifying more than sustained race pace.'
        : quality.effects.racePaceCeiling > quality.effects.qualifyingPaceCeiling + 0.2
          ? 'The final compromise favored race consistency over one-lap performance.'
          : 'The final specification was a broadly even qualifying and race compromise.',
      archiveLesson: prediction === 'Accurate'
        ? 'Retain this record with increased confidence when selecting a future circuit baseline.'
        : prediction === 'Misleading'
          ? 'Reduce confidence in this record until a cleaner revisit verifies the same behavior.'
          : prediction === 'Inconclusive'
            ? 'Keep the record as unresolved evidence rather than treating it as a proven answer.'
            : 'Retain the baseline with caution; part of the practice prediction matched competition.',
      relationshipRisk,
    }];
  });

  return {
    raceId: input.raceId,
    teamId: input.teamId,
    engineerId: input.engineerId,
    engineerName: input.engineerName ?? 'Race Engineering Department',
    generatedAtRound: input.round,
    drivers: verdicts,
  };
}

export function applyDebriefToSetupArchive(
  archive: SetupArchiveEntry[] | undefined,
  debrief: SetupWeekendDebrief,
  engineerSkill = 50,
): SetupArchiveEntry[] | undefined {
  if (!archive) return archive;
  const skill = clamp01(engineerSkill / 100);
  const byDriver = new Map(debrief.drivers.map((verdict) => [verdict.driverId, verdict]));
  return archive.map((entry) => {
    if (entry.teamId !== debrief.teamId || entry.raceId !== debrief.raceId) return entry;
    const verdict = byDriver.get(entry.driverId);
    if (!verdict) return entry;
    const confidenceWeight = verdict.confidence === 'High' ? 1 : verdict.confidence === 'Medium' ? 0.65 : 0.3;
    const delta = verdict.predictionVerdict === 'Accurate'
      ? (0.035 + skill * 0.045) * confidenceWeight
      : verdict.predictionVerdict === 'Misleading'
        ? -(0.045 + (1 - skill) * 0.035) * confidenceWeight
        : verdict.predictionVerdict === 'Inconclusive'
          ? -0.008
          : 0.005 * confidenceWeight;
    return {
      ...entry,
      evidenceConfidence: clamp01(entry.evidenceConfidence + delta),
      postRaceOutcome: {
        grade: verdict.grade,
        predictionVerdict: verdict.predictionVerdict,
        confidence: verdict.confidence,
        summary: verdict.summary,
        qualifyingAssessment: verdict.qualifyingAssessment,
        raceAssessment: verdict.raceAssessment,
        tyreAssessment: verdict.tyreAssessment,
        learnedAtRound: verdict.learnedAtRound,
      },
    };
  });
}

export function applyAutomaticSetupRelationshipLearning(
  relationships: Record<string, DriverRelationship> | undefined,
  debrief: SetupWeekendDebrief,
): Record<string, DriverRelationship> | undefined {
  if (!relationships) return relationships;
  const updated = { ...relationships };
  for (const verdict of debrief.drivers) {
    const current = updated[verdict.driverId];
    if (!current) continue;
    const chemistryDelta = verdict.predictionVerdict === 'Accurate' && verdict.confidence !== 'Low'
      ? 1
      : verdict.predictionVerdict === 'Misleading'
        ? -1
        : 0;
    const carTrustDelta = verdict.grade === 'Poor' ? -1 : verdict.grade === 'Excellent' ? 1 : 0;
    updated[verdict.driverId] = {
      ...current,
      engineerChemistry: clamp100(current.engineerChemistry + chemistryDelta),
      trustInCar: clamp100(current.trustInCar + carTrustDelta),
    };
  }
  return updated;
}

export function resolveSetupDebriefDecision(
  debrief: SetupWeekendDebrief,
  decision: SetupDebriefDecision,
  relationships: Record<string, DriverRelationship> | undefined,
): { debrief: SetupWeekendDebrief; relationships: Record<string, DriverRelationship> | undefined } {
  if (debrief.decision) return { debrief, relationships };
  const summaries: Record<SetupDebriefDecision, string> = {
    AcceptEngineerExplanation: 'The Team Principal accepted the Race Engineer’s explanation and kept the technical chain of command intact.',
    SupportDriverInterpretation: 'The Team Principal backed the drivers’ interpretation and asked engineering to reconsider the evidence.',
    RequestInvestigation: 'The Team Principal requested a deeper data review before drawing a definitive conclusion.',
    TakeResponsibility: 'The Team Principal took responsibility for the final qualifying and race compromise.',
    AvoidDefinitiveBlame: 'The Team Principal kept the review open because the available evidence did not support definitive blame.',
  };
  if (!relationships) return { debrief: { ...debrief, decision, decisionSummary: summaries[decision] }, relationships };
  const updated = { ...relationships };
  for (const verdict of debrief.drivers) {
    const current = updated[verdict.driverId];
    if (!current) continue;
    const accurate = verdict.predictionVerdict === 'Accurate';
    const inconclusive = verdict.predictionVerdict === 'Inconclusive' || verdict.confidence === 'Low';
    let chemistry = 0;
    let principalTrust = 0;
    let teamTrust = 0;
    if (decision === 'AcceptEngineerExplanation') {
      chemistry = accurate ? 1 : verdict.predictionVerdict === 'Misleading' ? -1 : 0;
      principalTrust = verdict.predictionVerdict === 'Misleading' ? -1 : 0;
    } else if (decision === 'SupportDriverInterpretation') {
      chemistry = accurate ? -1 : 1;
      principalTrust = 1;
    } else if (decision === 'RequestInvestigation') {
      teamTrust = 1;
    } else if (decision === 'TakeResponsibility') {
      chemistry = 1;
      principalTrust = 2;
    } else if (decision === 'AvoidDefinitiveBlame') {
      chemistry = inconclusive ? 1 : 0;
      principalTrust = inconclusive ? 1 : 0;
    }
    updated[verdict.driverId] = {
      ...current,
      engineerChemistry: clamp100(current.engineerChemistry + chemistry),
      trustInPrincipal: clamp100(current.trustInPrincipal + principalTrust),
      trustInTeam: clamp100(current.trustInTeam + teamTrust),
    };
  }
  return {
    debrief: { ...debrief, decision, decisionSummary: summaries[decision] },
    relationships: updated,
  };
}
