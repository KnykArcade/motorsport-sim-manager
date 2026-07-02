// Team Principal Creator ("Paddock Credentials") option catalogs — Career Mode
// Phase 1. Each option carries a short description and a set of small gameplay
// modifiers (signed fractions, e.g. +0.06 = +6%). The creator aggregates the
// modifiers of all the player's choices into a single bundle.

import type { PrincipalModifierKey, PrincipalModifiers } from '../../types/principalTypes';

export type PrincipalOption = {
  id: string;
  label: string;
  description: string;
  modifiers: PrincipalModifiers;
};

export type RiskToleranceOption = {
  id: string;
  label: string;
  description: string;
  value: number; // 0-100
};

// Human-readable labels for each modifier key, used in the preview.
export const MODIFIER_LABELS: Record<PrincipalModifierKey, string> = {
  driverMorale: 'Driver Morale',
  driverDevelopment: 'Driver Development',
  research: 'Research & Development',
  setupFeedback: 'Setup Feedback',
  sponsorNegotiation: 'Sponsor Negotiation',
  budgetManagement: 'Budget Management',
  raceStrategy: 'Race Strategy',
  reliabilityDiagnosis: 'Reliability Diagnosis',
  mediaHandling: 'Media Handling',
  marketing: 'Marketing',
  academyDevelopment: 'Academy Development',
  youngDriverInterest: 'Young Driver Interest',
  veteranDriverAppeal: 'Veteran Driver Appeal',
  inRaceDecisions: 'In-Race Decisions',
  commercialSkill: 'Commercial Skill',
  politicalInfluence: 'Political Influence',
};

export const BACKGROUNDS: PrincipalOption[] = [
  {
    id: 'former-driver',
    label: 'Former Driver',
    description: 'A racer who moved to the pit wall  trusted in the garage.',
    modifiers: { driverMorale: 0.08, driverDevelopment: 0.06, sponsorNegotiation: -0.04 },
  },
  {
    id: 'race-engineer',
    label: 'Race Engineer',
    description: 'Came up through the garage; lives in the data and the setup sheet.',
    modifiers: { setupFeedback: 0.08, reliabilityDiagnosis: 0.06, marketing: -0.04 },
  },
  {
    id: 'technical-director',
    label: 'Technical Director',
    description: 'An engineering leader who drives the design office.',
    modifiers: { research: 0.08, setupFeedback: 0.05, mediaHandling: -0.04 },
  },
  {
    id: 'business-executive',
    label: 'Business Executive',
    description: 'A boardroom operator who runs the team like a company.',
    modifiers: { sponsorNegotiation: 0.07, budgetManagement: 0.07, raceStrategy: -0.04 },
  },
  {
    id: 'team-founder',
    label: 'Team Founder',
    description: 'Built the operation from nothing  a bit of everything.',
    modifiers: { politicalInfluence: 0.06, budgetManagement: 0.04, driverMorale: 0.04, research: -0.03 },
  },
  {
    id: 'data-strategist',
    label: 'Data Strategist',
    description: 'A numbers-first thinker who wins on strategy calls.',
    modifiers: { raceStrategy: 0.07, inRaceDecisions: 0.06, driverMorale: -0.04 },
  },
  {
    id: 'commercial-director',
    label: 'Sponsor / Commercial Director',
    description: 'A dealmaker who keeps the money flowing in.',
    modifiers: { commercialSkill: 0.08, marketing: 0.06, reliabilityDiagnosis: -0.04 },
  },
  {
    id: 'journalist-analyst',
    label: 'Motorsport Journalist / Analyst',
    description: 'A media insider with a sharp public profile.',
    modifiers: { mediaHandling: 0.08, marketing: 0.05, budgetManagement: -0.04 },
  },
  {
    id: 'former-team-manager',
    label: 'Former Team Manager',
    description: 'A seasoned operator who keeps the whole team running.',
    modifiers: { driverMorale: 0.05, budgetManagement: 0.05, politicalInfluence: 0.04, research: -0.03 },
  },
];

export const MANAGEMENT_STYLES: PrincipalOption[] = [
  {
    id: 'technical-builder',
    label: 'Technical Builder',
    description: 'Pours resources into the car and the design office.',
    modifiers: { research: 0.06, setupFeedback: 0.04 },
  },
  {
    id: 'driver-motivator',
    label: 'Driver Motivator',
    description: 'Gets the very best out of the drivers.',
    modifiers: { driverMorale: 0.06, driverDevelopment: 0.04 },
  },
  {
    id: 'ruthless-strategist',
    label: 'Ruthless Strategist',
    description: 'Aggressive race calls; cold with personnel.',
    modifiers: { raceStrategy: 0.06, inRaceDecisions: 0.04, driverMorale: -0.03 },
  },
  {
    id: 'financial-operator',
    label: 'Financial Operator',
    description: 'Runs a tight, sustainable budget.',
    modifiers: { budgetManagement: 0.06, sponsorNegotiation: 0.04 },
  },
  {
    id: 'youth-developer',
    label: 'Youth Developer',
    description: 'Builds the future through the academy.',
    modifiers: { academyDevelopment: 0.06, youngDriverInterest: 0.05, veteranDriverAppeal: -0.03 },
  },
  {
    id: 'political-operator',
    label: 'Political Operator',
    description: 'Wields influence in the paddock and the rule-making room.',
    modifiers: { politicalInfluence: 0.07, mediaHandling: 0.03 },
  },
  {
    id: 'raceday-tactician',
    label: 'Race-Day Tactician',
    description: 'Reads a race better than anyone.',
    modifiers: { raceStrategy: 0.06, inRaceDecisions: 0.05, commercialSkill: -0.03 },
  },
  {
    id: 'longterm-architect',
    label: 'Long-Term Architect',
    description: 'Plays the long game across many seasons.',
    modifiers: { research: 0.04, academyDevelopment: 0.04, budgetManagement: 0.03 },
  },
];

// Shared pool used for Primary Strength, Secondary Strength and Weakness. A
// strength applies its modifier as-is; a weakness applies the negative.
export const STRENGTHS: PrincipalOption[] = [
  { id: 'driver-development', label: 'Driver Development', description: 'Brings drivers along quickly.', modifiers: { driverDevelopment: 0.06, driverMorale: 0.03 } },
  { id: 'aerodynamics', label: 'Aerodynamics & Research', description: 'A strong design-office leader.', modifiers: { research: 0.06 } },
  { id: 'strategy', label: 'Strategy', description: 'Excellent on the pit wall.', modifiers: { raceStrategy: 0.05, inRaceDecisions: 0.04 } },
  { id: 'reliability', label: 'Reliability', description: 'Keeps the cars running.', modifiers: { reliabilityDiagnosis: 0.06 } },
  { id: 'commercial', label: 'Commercial', description: 'Lands the big sponsors.', modifiers: { commercialSkill: 0.05, sponsorNegotiation: 0.04 } },
  { id: 'media', label: 'Media', description: 'Commands the press room.', modifiers: { mediaHandling: 0.06, marketing: 0.03 } },
  { id: 'scouting', label: 'Scouting', description: 'A sharp eye for talent.', modifiers: { academyDevelopment: 0.05, youngDriverInterest: 0.04 } },
  { id: 'finance', label: 'Financial Control', description: 'Squeezes value from every dollar.', modifiers: { budgetManagement: 0.06 } },
  { id: 'politics', label: 'Politics', description: 'A force in the paddock.', modifiers: { politicalInfluence: 0.06 } },
];

export const MEDIA_PERSONALITIES: PrincipalOption[] = [
  { id: 'reserved', label: 'Reserved', description: 'Says little; keeps the team out of headlines.', modifiers: { mediaHandling: 0.04, marketing: -0.02 } },
  { id: 'diplomatic', label: 'Diplomatic', description: 'Smooth and measured with the press.', modifiers: { mediaHandling: 0.05, sponsorNegotiation: 0.02 } },
  { id: 'charismatic', label: 'Charismatic', description: 'A natural in front of a camera.', modifiers: { marketing: 0.05, commercialSkill: 0.03 } },
  { id: 'outspoken', label: 'Outspoken', description: 'Generates attention  and the odd controversy.', modifiers: { marketing: 0.06, politicalInfluence: -0.03 } },
  { id: 'controversial', label: 'Controversial', description: 'Box-office, but a handful for the board.', modifiers: { marketing: 0.07, mediaHandling: -0.04 } },
];

export const DRIVER_MANAGEMENT_STYLES: PrincipalOption[] = [
  { id: 'nurturing', label: 'Nurturing', description: 'Patient, supportive man-management.', modifiers: { driverMorale: 0.05, driverDevelopment: 0.03 } },
  { id: 'demanding', label: 'Demanding', description: 'High standards; drives performance hard.', modifiers: { driverDevelopment: 0.05, driverMorale: -0.03 } },
  { id: 'hands-off', label: 'Hands-Off', description: 'Lets drivers self-manage.', modifiers: { driverMorale: 0.02 } },
  { id: 'man-manager', label: 'Man-Manager', description: 'Balances egos and keeps the garage calm.', modifiers: { driverMorale: 0.04, veteranDriverAppeal: 0.03 } },
];

export const DEVELOPMENT_PHILOSOPHIES: PrincipalOption[] = [
  { id: 'aggressive-upgrades', label: 'Aggressive Upgrades', description: 'Push hard on development, accept risk.', modifiers: { research: 0.05, reliabilityDiagnosis: -0.03 } },
  { id: 'steady-iteration', label: 'Steady Iteration', description: 'Incremental, dependable progress.', modifiers: { research: 0.03, reliabilityDiagnosis: 0.02 } },
  { id: 'reliability-first', label: 'Reliability First', description: 'Finish first, first you must finish.', modifiers: { reliabilityDiagnosis: 0.05, research: -0.02 } },
  { id: 'youth-pipeline', label: 'Youth Pipeline', description: 'Develop talent over hardware.', modifiers: { academyDevelopment: 0.05, youngDriverInterest: 0.03 } },
];

export const RACE_STRATEGY_PHILOSOPHIES: PrincipalOption[] = [
  { id: 'aggressive', label: 'Aggressive', description: 'Undercuts, gambles, attacks.', modifiers: { raceStrategy: 0.05, inRaceDecisions: 0.03 } },
  { id: 'balanced', label: 'Balanced', description: 'Reacts to the race as it unfolds.', modifiers: { raceStrategy: 0.03, inRaceDecisions: 0.03 } },
  { id: 'conservative', label: 'Conservative', description: 'Protects positions and the cars.', modifiers: { reliabilityDiagnosis: 0.03, raceStrategy: 0.02 } },
  { id: 'reactive', label: 'Reactive', description: 'Lives off in-race information.', modifiers: { inRaceDecisions: 0.05 } },
];

export const RISK_TOLERANCES: RiskToleranceOption[] = [
  { id: 'cautious', label: 'Cautious', description: 'Plays it safe.', value: 25 },
  { id: 'measured', label: 'Measured', description: 'Calculated risks only.', value: 45 },
  { id: 'bold', label: 'Bold', description: 'Willing to gamble for reward.', value: 70 },
  { id: 'reckless', label: 'Reckless', description: 'High risk, high reward.', value: 90 },
];

export const NATIONALITIES: string[] = [
  'British', 'Italian', 'German', 'French', 'Austrian', 'Swiss', 'Spanish',
  'Brazilian', 'American', 'Canadian', 'Australian', 'Japanese', 'Dutch',
  'Finnish', 'Belgian', 'Argentine', 'Mexican',
];

export function optionById(list: PrincipalOption[], id: string): PrincipalOption | undefined {
  return list.find((o) => o.id === id);
}
