// Shared Race Engineer specialist model.
//
// Engineers interpret imperfect evidence. They may identify a useful direction,
// misread limited data, or recommend holding the current setup; they never alter
// the physical setup quality and never expose the hidden ideal value.

import { SETUP_COMPONENTS, SETUP_PARAMS } from '../data/setup/setupComponents';
import type { Car, Driver, Series, Track } from '../types/gameTypes';
import type {
  RaceEngineerAttribute,
  RaceEngineerProfile,
  StaffMember,
} from '../types/staffTypes';
import { RACE_ENGINEER_ATTRIBUTE_LABELS } from '../types/staffTypes';
import type { CarSetup, SetupComponentKey, SetupParamKey } from '../types/setupTypes';
import { idealSetup } from './setupFitEngine';
import { createSeededRandom, deriveSeed } from './random';

export type EngineeringEvidence = {
  setupKnowledge: number;
  tyreKnowledge: number;
  reliabilityKnowledge: number;
  practiceLaps: number;
  driverTechnical: number;
  engineerChemistry?: number;
  facilities?: number;
  operations?: number;
  packagePreparation?: number;
  changingConditions?: boolean;
  teammateDisagreement?: boolean;
};

export type SetupEngineeringRecommendation = {
  engineerId: string;
  engineerName: string;
  specialty: string;
  relevantAttribute: RaceEngineerAttribute;
  relevantAttributeLabel: string;
  component?: SetupComponentKey;
  componentLabel?: string;
  parameter?: SetupParamKey;
  parameterLabel?: string;
  direction: 'Increase' | 'Decrease' | 'Hold' | 'Unavailable';
  magnitude: 'Fine' | 'Moderate' | 'Major' | 'None';
  diagnosis: string;
  tradeoff: string;
  confidence: number;
  confidenceLabel: 'Low' | 'Medium' | 'High';
  evidenceQuality: number;
  evidenceLabel: 'Limited' | 'Developing' | 'Strong';
  sourceDriverId: string;
  sourceDriverName: string;
  invalidatesPracticeData: boolean;
  teammateDisagreement: boolean;
  lockedReason?: string;
};

const ATTRIBUTES: RaceEngineerAttribute[] = [
  'vehicleDynamics',
  'ovalKnowledge',
  'roadCourseKnowledge',
  'aerodynamics',
  'communication',
  'feedbackInterpretation',
  'adaptability',
  'experience',
];

const PARAM_ATTRIBUTE: Record<SetupParamKey, RaceEngineerAttribute> = {
  frontWing: 'aerodynamics',
  rearWing: 'aerodynamics',
  suspensionStiffness: 'vehicleDynamics',
  rideHeight: 'vehicleDynamics',
  gearing: 'roadCourseKnowledge',
  brakeBias: 'vehicleDynamics',
  brakeCooling: 'vehicleDynamics',
  differential: 'vehicleDynamics',
  engineCooling: 'experience',
  tyreUsage: 'feedbackInterpretation',
};

const TRADEOFF: Record<SetupParamKey, string> = {
  frontWing: 'More front grip costs straight-line efficiency; less wing protects speed but reduces turn-in support.',
  rearWing: 'More rear stability adds drag; trimming it improves speed but narrows the stability margin.',
  suspensionStiffness: 'A sharper platform can improve response but becomes less compliant over bumps and kerbs.',
  rideHeight: 'Lowering the car helps aero efficiency but increases bottoming and kerb risk.',
  gearing: 'Longer gearing protects top speed; shorter gearing improves acceleration out of slow corners.',
  brakeBias: 'The balance can improve entry confidence but may move lock-up risk to the opposite axle.',
  brakeCooling: 'More cooling controls temperature but adds drag; closing it protects speed with less thermal margin.',
  differential: 'A more aggressive differential can sharpen rotation but increases traction, tyre and mistake risk.',
  engineCooling: 'Opening cooling protects reliability at a small straight-line cost.',
  tyreUsage: 'A more aggressive tyre setting helps short-run pace but reduces stint life and consistency.',
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function rating100(value: number | undefined, fallback = 50): number {
  const resolved = value ?? fallback;
  return clamp(resolved <= 10 ? resolved * 10 : resolved);
}

function round(value: number): number {
  return Math.round(value);
}

function normalizeProfile(profile: RaceEngineerProfile): RaceEngineerProfile {
  return Object.fromEntries(ATTRIBUTES.map((attribute) => [
    attribute,
    round(clamp(profile[attribute], 1, 100)),
  ])) as RaceEngineerProfile;
}

export function deriveRaceEngineerProfile(
  member: Pick<StaffMember, 'id' | 'name' | 'rating' | 'engineeringProfile'>,
): RaceEngineerProfile {
  if (member.engineeringProfile) return normalizeProfile(member.engineeringProfile);
  const overall = rating100(member.rating);
  const rng = createSeededRandom(deriveSeed('race-engineer-profile', member.id, member.name, overall));
  const specialty = rng.int(0, 3);
  const value = (bias = 0, spread = 16) => round(clamp(overall + bias + rng.variance(spread), 20, 100));
  const profile: RaceEngineerProfile = {
    vehicleDynamics: value(specialty === 3 ? 12 : 0),
    ovalKnowledge: value(specialty === 0 ? 16 : specialty === 1 ? -10 : -2),
    roadCourseKnowledge: value(specialty === 1 ? 16 : specialty === 0 ? -10 : 1),
    aerodynamics: value(specialty === 2 ? 14 : 0),
    communication: value(0, 13),
    feedbackInterpretation: value(specialty === 3 ? 7 : 0, 13),
    adaptability: value(0, 14),
    experience: value(0, 11),
  };
  return normalizeProfile(profile);
}

export function improveRaceEngineerProfile(
  profile: RaceEngineerProfile,
  improvement = 3,
): RaceEngineerProfile {
  return normalizeProfile(Object.fromEntries(ATTRIBUTES.map((attribute) => [
    attribute,
    profile[attribute] + improvement,
  ])) as RaceEngineerProfile);
}

export function raceEngineerForRoster(staff: readonly StaffMember[] | undefined): StaffMember | undefined {
  return [...(staff ?? [])]
    .filter((member) => member.role === 'Race Engineer')
    .sort((a, b) => rating100(b.rating) - rating100(a.rating) || a.id.localeCompare(b.id))[0];
}

export function raceEngineerSpecialty(profile: RaceEngineerProfile): string {
  const disciplines: Array<[string, number]> = [
    ['Oval specialist', profile.ovalKnowledge],
    ['Road-course specialist', profile.roadCourseKnowledge],
    ['Aerodynamics specialist', profile.aerodynamics],
    ['Vehicle-dynamics specialist', profile.vehicleDynamics],
  ];
  disciplines.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return disciplines[0][0];
}

export function raceEngineerStrengths(profile: RaceEngineerProfile): {
  strongest: RaceEngineerAttribute;
  weakest: RaceEngineerAttribute;
} {
  const ordered = [...ATTRIBUTES].sort((a, b) => profile[b] - profile[a] || a.localeCompare(b));
  return { strongest: ordered[0], weakest: ordered[ordered.length - 1] };
}

export function isOvalCircuit(track: Track, series?: Series): boolean {
  const label = `${track.archetype} ${track.name} ${track.gpName}`.toLowerCase();
  if (/road|street|circuit|watkins|sonoma|riverside|mid-ohio|laguna|road america|mosport/.test(label)) return false;
  if (/oval|speedway|superspeedway|short track|darlington|martinsville|bristol|pocono|indy 500/.test(label)) return true;
  return series === 'NASCAR' && !/road|street/.test(label);
}

export function raceEngineerTrackRating(
  profile: RaceEngineerProfile,
  track: Track,
  series?: Series,
): number {
  const discipline = isOvalCircuit(track, series) ? profile.ovalKnowledge : profile.roadCourseKnowledge;
  const aeroDemand = rating100(track.setupProfile.aeroDemand);
  const mechanicalDemand = rating100(track.setupProfile.mechanicalDemand);
  const technical = profile.vehicleDynamics * (0.2 + mechanicalDemand / 500);
  const aero = profile.aerodynamics * (0.15 + aeroDemand / 500);
  const divisor = 0.7 + mechanicalDemand / 500 + aeroDemand / 500;
  return round(clamp((discipline * 0.7 + technical + aero) / divisor));
}

export function engineeringEvidenceQuality(evidence: EngineeringEvidence): number {
  const knowledge = clamp(evidence.setupKnowledge * 100) * 0.5
    + clamp(evidence.tyreKnowledge * 100) * 0.15
    + clamp(evidence.reliabilityKnowledge * 100) * 0.15;
  const running = clamp(evidence.practiceLaps / 35 * 100) * 0.2;
  const support = (rating100(evidence.facilities) + rating100(evidence.operations)) / 2;
  const packageFactor = clamp((evidence.packagePreparation ?? 1) * 100);
  return round(clamp((knowledge + running) * 0.75 + support * 0.15 + packageFactor * 0.1));
}

export function engineeringKnowledgeExtraction(
  profile: RaceEngineerProfile,
  driverTechnical: number,
  chemistry = 50,
  changingConditions = false,
): number {
  const conditions = changingConditions ? profile.adaptability : profile.experience;
  const score = profile.feedbackInterpretation * 0.36
    + profile.communication * 0.24
    + conditions * 0.16
    + rating100(driverTechnical) * 0.14
    + rating100(chemistry) * 0.1;
  return Math.max(0.68, Math.min(1.24, 0.62 + score / 165));
}

function relevantSkill(
  profile: RaceEngineerProfile,
  attribute: RaceEngineerAttribute,
  track: Track,
  series?: Series,
): number {
  const circuit = isOvalCircuit(track, series) ? profile.ovalKnowledge : profile.roadCourseKnowledge;
  return profile[attribute] * 0.62 + circuit * 0.23 + profile.experience * 0.15;
}

function labelForConfidence(value: number): 'Low' | 'Medium' | 'High' {
  if (value >= 72) return 'High';
  if (value >= 42) return 'Medium';
  return 'Low';
}

function labelForEvidence(value: number): 'Limited' | 'Developing' | 'Strong' {
  if (value >= 70) return 'Strong';
  if (value >= 38) return 'Developing';
  return 'Limited';
}

function magnitudeFor(gap: number, experience: number): 'Fine' | 'Moderate' | 'Major' {
  const restrained = gap * (1.08 - experience / 500);
  if (restrained >= 3.2) return 'Major';
  if (restrained >= 1.45) return 'Moderate';
  return 'Fine';
}

export function buildSetupEngineeringRecommendation(input: {
  seed: string;
  engineer?: StaffMember;
  driver: Driver;
  setup: CarSetup;
  practicedSetup?: CarSetup;
  track: Track;
  series?: Series;
  car?: Car;
  evidence: EngineeringEvidence;
  allowedParams?: readonly SetupParamKey[];
  lockActive?: boolean;
  lockDescription?: string;
}): SetupEngineeringRecommendation {
  const engineer = input.engineer ?? {
    id: 'engineering-department',
    name: 'Engineering Department',
    role: 'Race Engineer' as const,
    nationality: 'Team',
    rating: 50,
    salary: 0,
    signingFee: 0,
    bio: 'Team engineering department.',
  };
  const profile = deriveRaceEngineerProfile(engineer);
  const evidenceQuality = engineeringEvidenceQuality(input.evidence);
  const available = (Object.keys(input.setup) as SetupParamKey[]).filter((parameter) =>
    !input.lockActive || input.allowedParams?.includes(parameter));
  const base = {
    engineerId: engineer.id,
    engineerName: engineer.name,
    specialty: raceEngineerSpecialty(profile),
    relevantAttribute: 'experience' as RaceEngineerAttribute,
    relevantAttributeLabel: RACE_ENGINEER_ATTRIBUTE_LABELS.experience,
    direction: 'Unavailable' as const,
    magnitude: 'None' as const,
    diagnosis: 'No setup change is available under the current regulations.',
    tradeoff: 'The team must retain the validated setup until restrictions are lifted.',
    confidence: round(profile.experience * 0.55 + evidenceQuality * 0.45),
    confidenceLabel: labelForConfidence(profile.experience * 0.55 + evidenceQuality * 0.45),
    evidenceQuality,
    evidenceLabel: labelForEvidence(evidenceQuality),
    sourceDriverId: input.driver.id,
    sourceDriverName: input.driver.name,
    invalidatesPracticeData: false,
    teammateDisagreement: !!input.evidence.teammateDisagreement,
    lockedReason: input.lockDescription,
  } satisfies SetupEngineeringRecommendation;
  if (available.length === 0) return base;

  const target = idealSetup(input.track, input.driver, input.car);
  const rng = createSeededRandom(deriveSeed(
    input.seed,
    'race-engineer-recommendation',
    engineer.id,
    input.driver.id,
    input.track.id,
    ...available.map((key) => `${key}:${input.setup[key]}`),
  ));
  const candidates = available.map((parameter) => {
    const attribute = PARAM_ATTRIBUTE[parameter];
    const skill = relevantSkill(profile, attribute, input.track, input.series);
    const gap = target[parameter] - input.setup[parameter];
    const observationNoise = rng.variance(2.8 - skill / 60 - evidenceQuality / 75);
    return {
      parameter,
      attribute,
      skill,
      trueGap: gap,
      perceivedGap: gap + observationNoise,
      urgency: Math.abs(gap + observationNoise) * (0.7 + skill / 180),
    };
  }).sort((a, b) => b.urgency - a.urgency || a.parameter.localeCompare(b.parameter));
  const selected = candidates[0];
  const accuracyChance = clamp(
    0.18
      + selected.skill / 190
      + evidenceQuality / 260
      + rating100(input.evidence.driverTechnical) / 900
      + rating100(input.evidence.engineerChemistry) / 1100
      + (input.evidence.changingConditions ? (profile.adaptability - 50) / 500 : 0),
    0.22,
    0.94,
  );
  let perceivedGap = selected.perceivedGap;
  const accurateObservation = rng.chance(accuracyChance);
  if (!accurateObservation) {
    // Bounded mistake: reverse the direction or select the second-most plausible
    // diagnosis. The recommendation remains qualitative and never exposes a target.
    if (candidates[1] && rng.chance(0.55)) {
      Object.assign(selected, candidates[1]);
      perceivedGap = candidates[1].perceivedGap;
    } else {
      perceivedGap = -Math.sign(perceivedGap || selected.trueGap || 1) * Math.max(0.6, Math.abs(perceivedGap));
    }
  }
  const component = SETUP_PARAMS[selected.parameter].component;
  const componentLabel = SETUP_COMPONENTS.find((item) => item.key === component)?.name ?? component;
  const direction = Math.abs(perceivedGap) < 0.55
    ? 'Hold'
    : perceivedGap > 0 ? 'Increase' : 'Decrease';
  const confidenceRaw = clamp(
    selected.skill * 0.34
      + profile.communication * 0.2
      + profile.feedbackInterpretation * 0.15
      + evidenceQuality * 0.31
      - (input.evidence.teammateDisagreement ? 9 : 0)
      - (accurateObservation ? 0 : 12),
  );
  // Experience calibrates confidence instead of making every veteran certain.
  const confidence = round(Math.min(confidenceRaw, 58 + profile.experience * 0.42));
  const changedFromPractice = input.practicedSetup
    ? Math.abs(input.setup[selected.parameter] - input.practicedSetup[selected.parameter]) >= 0.75
    : false;
  const magnitude = direction === 'Hold' ? 'None' : magnitudeFor(Math.abs(perceivedGap), profile.experience);
  const diagnosis = direction === 'Hold'
    ? `${componentLabel} appears to be in a workable window; preserve the current direction until more evidence arrives.`
    : `${direction} ${SETUP_PARAMS[selected.parameter].label.toLowerCase()} with a ${magnitude.toLowerCase()} adjustment; the evidence points to ${componentLabel.toLowerCase()} as the leading limitation.`;

  return {
    engineerId: engineer.id,
    engineerName: engineer.name,
    specialty: raceEngineerSpecialty(profile),
    relevantAttribute: selected.attribute,
    relevantAttributeLabel: RACE_ENGINEER_ATTRIBUTE_LABELS[selected.attribute],
    component,
    componentLabel,
    parameter: selected.parameter,
    parameterLabel: SETUP_PARAMS[selected.parameter].label,
    direction,
    magnitude,
    diagnosis,
    tradeoff: TRADEOFF[selected.parameter],
    confidence,
    confidenceLabel: labelForConfidence(confidence),
    evidenceQuality,
    evidenceLabel: labelForEvidence(evidenceQuality),
    sourceDriverId: input.driver.id,
    sourceDriverName: input.driver.name,
    invalidatesPracticeData: changedFromPractice || magnitude === 'Major',
    teammateDisagreement: !!input.evidence.teammateDisagreement,
    lockedReason: input.lockActive ? input.lockDescription : undefined,
  };
}
