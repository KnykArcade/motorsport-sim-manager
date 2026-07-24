// Team Principal Creator logic — Career Mode Phase 1.
//
// Turns the player's "Paddock Credentials" selections into a TeamPrincipal,
// deriving the 0-100 trait scores from the aggregated gameplay modifiers, and
// recomputes those modifiers from a saved principal for display/use elsewhere.

import {
  BACKGROUNDS,
  DEVELOPMENT_PHILOSOPHIES,
  DRIVER_MANAGEMENT_STYLES,
  MANAGEMENT_STYLES,
  MEDIA_PERSONALITIES,
  RACE_STRATEGY_PHILOSOPHIES,
  RISK_TOLERANCES,
  STRENGTHS,
  optionById,
  type PrincipalOption,
} from '../data/principal/principalOptions';
import type {
  PrincipalModifierKey,
  PrincipalModifiers,
  TeamPrincipal,
} from '../types/principalTypes';

// The raw selections captured by the creator UI (option ids + free fields).
export type PrincipalDraft = {
  name: string;
  nationality?: string;
  age?: number;
  background: string;
  managementStyle: string;
  primaryStrength: string;
  secondaryStrength: string;
  weakness: string;
  mediaPersonality: string;
  driverManagementStyle: string;
  developmentPhilosophy: string;
  raceStrategyPhilosophy: string;
  riskTolerance: string; // RiskToleranceOption id
};

export function defaultPrincipalDraft(): PrincipalDraft {
  return {
    name: '',
    nationality: 'British',
    age: 42,
    background: BACKGROUNDS[0].id,
    managementStyle: MANAGEMENT_STYLES[0].id,
    primaryStrength: STRENGTHS[0].id,
    secondaryStrength: STRENGTHS[2].id,
    weakness: STRENGTHS[4].id,
    mediaPersonality: MEDIA_PERSONALITIES[1].id,
    driverManagementStyle: DRIVER_MANAGEMENT_STYLES[0].id,
    developmentPhilosophy: DEVELOPMENT_PHILOSOPHIES[1].id,
    raceStrategyPhilosophy: RACE_STRATEGY_PHILOSOPHIES[1].id,
    riskTolerance: RISK_TOLERANCES[1].id,
  };
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

function addModifiers(into: PrincipalModifiers, from: PrincipalModifiers, sign = 1): void {
  for (const key of Object.keys(from) as PrincipalModifierKey[]) {
    into[key] = round2((into[key] ?? 0) + (from[key] ?? 0) * sign);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function modsOf(list: PrincipalOption[], id: string): PrincipalModifiers {
  return optionById(list, id)?.modifiers ?? {};
}

// Aggregate every selection's modifiers into one bundle. The weakness applies
// its modifier as a penalty (negated).
function aggregate(
  background: string,
  managementStyle: string,
  primaryStrength: string,
  secondaryStrength: string,
  weakness: string,
  mediaPersonality: string,
  driverManagementStyle: string,
  developmentPhilosophy: string,
  raceStrategyPhilosophy: string,
): PrincipalModifiers {
  const out: PrincipalModifiers = {};
  addModifiers(out, modsOf(BACKGROUNDS, background));
  addModifiers(out, modsOf(MANAGEMENT_STYLES, managementStyle));
  addModifiers(out, modsOf(STRENGTHS, primaryStrength));
  // Secondary strength contributes at half weight.
  addModifiers(out, halve(modsOf(STRENGTHS, secondaryStrength)));
  addModifiers(out, modsOf(STRENGTHS, weakness), -1);
  addModifiers(out, modsOf(MEDIA_PERSONALITIES, mediaPersonality));
  addModifiers(out, modsOf(DRIVER_MANAGEMENT_STYLES, driverManagementStyle));
  addModifiers(out, modsOf(DEVELOPMENT_PHILOSOPHIES, developmentPhilosophy));
  addModifiers(out, modsOf(RACE_STRATEGY_PHILOSOPHIES, raceStrategyPhilosophy));
  // Drop keys that cancelled to zero so the preview stays clean.
  for (const key of Object.keys(out) as PrincipalModifierKey[]) {
    if (Math.abs(out[key] ?? 0) < 0.005) delete out[key];
  }
  return out;
}

function halve(m: PrincipalModifiers): PrincipalModifiers {
  const out: PrincipalModifiers = {};
  for (const key of Object.keys(m) as PrincipalModifierKey[]) out[key] = (m[key] ?? 0) / 2;
  return out;
}

// Re-derive the modifier bundle from a saved principal's stored choices.
export function computePrincipalModifiers(tp: TeamPrincipal): PrincipalModifiers {
  return aggregate(
    tp.background,
    tp.managementStyle,
    tp.primaryStrength,
    tp.secondaryStrength,
    tp.weakness,
    tp.mediaPersonality,
    tp.driverManagementStyle,
    tp.developmentPhilosophy,
    tp.raceStrategyPhilosophy,
  );
}

function sum(m: PrincipalModifiers, keys: PrincipalModifierKey[]): number {
  return keys.reduce((acc, k) => acc + (m[k] ?? 0), 0);
}

// Map the modifier bundle onto the 0-100 trait scores around a neutral 50.
function deriveTraits(m: PrincipalModifiers): {
  driverManagement: number;
  developmentFocus: number;
  raceStrategy: number;
  commercialSkill: number;
  politicalSkill: number;
} {
  const trait = (keys: PrincipalModifierKey[]) => clamp(Math.round(50 + sum(m, keys) * 100));
  return {
    driverManagement: trait(['driverMorale', 'driverDevelopment', 'youngDriverInterest', 'veteranDriverAppeal']),
    developmentFocus: trait(['driverDevelopment', 'research', 'reliabilityDiagnosis', 'setupFeedback', 'academyDevelopment']),
    raceStrategy: trait(['raceStrategy', 'inRaceDecisions']),
    commercialSkill: trait(['sponsorNegotiation', 'marketing', 'mediaHandling', 'commercialSkill']),
    politicalSkill: trait(['politicalInfluence', 'mediaHandling']),
  };
}

// Build a finished TeamPrincipal from the creator's draft.
export function buildTeamPrincipal(draft: PrincipalDraft): TeamPrincipal {
  const modifiers = aggregate(
    draft.background,
    draft.managementStyle,
    draft.primaryStrength,
    draft.secondaryStrength,
    draft.weakness,
    draft.mediaPersonality,
    draft.driverManagementStyle,
    draft.developmentPhilosophy,
    draft.raceStrategyPhilosophy,
  );
  const traits = deriveTraits(modifiers);
  const riskTolerance =
    RISK_TOLERANCES.find((o) => o.id === draft.riskTolerance)?.value ?? RISK_TOLERANCES[1].value;
  // A rookie principal's starting personal brand, nudged by commercial/political pull.
  const reputation = clamp(
    Math.round(42 + (traits.commercialSkill - 50) * 0.15 + (traits.politicalSkill - 50) * 0.1),
  );
  return {
    id: 'team-principal',
    name: draft.name.trim() || 'Team Principal',
    nationality: draft.nationality,
    age: draft.age,
    background: draft.background,
    managementStyle: draft.managementStyle,
    primaryStrength: draft.primaryStrength,
    secondaryStrength: draft.secondaryStrength,
    weakness: draft.weakness,
    mediaPersonality: draft.mediaPersonality,
    driverManagementStyle: draft.driverManagementStyle,
    developmentPhilosophy: draft.developmentPhilosophy,
    raceStrategyPhilosophy: draft.raceStrategyPhilosophy,
    riskTolerance,
    ...traits,
    reputation,
    skillAttributes: {
      mediaImage: traits.commercialSkill,
      boardConfidence: traits.politicalSkill,
      financialDiscipline: traits.commercialSkill,
      driverManagement: traits.driverManagement,
      development: traits.developmentFocus,
      strategy: traits.raceStrategy,
    },
  };
}
