// Driver market & academy mechanics: converting market talent into full
// drivers, signing youth prospects, and progressing academy members each
// offseason. All functions are pure and deterministic (no RNG) so career
// rollovers replay identically.

import type { Driver, DriverRatings } from '../types/gameTypes';
import type {
  AcademyMember,
  MarketDriver,
  MarketSkillRatings,
  YouthProspect,
} from '../types/marketTypes';

const clamp = (v: number, lo = 1, hi = 10) => Math.max(lo, Math.min(hi, v));
const r1 = (n: number) => Math.round(n * 10) / 10;
const avg = (...xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

// Derive the full driver rating sheet from the ten core market skills. The
// market workbook only carries the core skills + overall; qualifying, race
// pace, adaptability, aggression and composure are synthesised from them.
export function synthesizeDriverRatings(
  skills: MarketSkillRatings,
  overall: number,
): DriverRatings {
  const qualifying = r1(avg(skills.cornering, skills.braking, skills.technical));
  const racePace = r1(
    avg(skills.enduranceConsistency, skills.tractionAcceleration, skills.overtakingRacecraft),
  );
  const adaptability = r1(avg(skills.technical, skills.surfaceGripBumpiness));
  const aggression = r1(clamp(avg(skills.overtakingRacecraft, 11 - skills.riskManagement)));
  const composure = r1(avg(skills.enduranceConsistency, skills.riskManagement));
  return {
    cornering: skills.cornering,
    braking: skills.braking,
    straights: skills.straights,
    tractionAcceleration: skills.tractionAcceleration,
    elevationBlindCorners: skills.elevationBlindCorners,
    technical: skills.technical,
    overtakingRacecraft: skills.overtakingRacecraft,
    surfaceGripBumpiness: skills.surfaceGripBumpiness,
    riskManagement: skills.riskManagement,
    enduranceConsistency: skills.enduranceConsistency,
    qualifying,
    racePace,
    adaptability,
    aggression,
    composure,
    overall: r1(overall),
  };
}

type Seat = { teamId: string; number: number };

function buildDriver(
  id: string,
  name: string,
  nationality: string,
  skills: MarketSkillRatings,
  overall: number,
  seat: Seat,
  salary: number,
  contractYearsRemaining: number,
): Driver {
  return {
    id,
    name,
    number: seat.number,
    nationality,
    teamId: seat.teamId,
    ratings: synthesizeDriverRatings(skills, overall),
    morale: 60,
    confidence: 60,
    contractYearsRemaining,
    salary,
    traits: [],
  };
}

// Convert a signed market driver into a runtime Driver taking over a seat.
export function marketDriverToDriver(m: MarketDriver, seat: Seat): Driver {
  return buildDriver(
    `d-${m.id}`,
    m.name,
    m.nationality,
    m.skills,
    m.overall,
    seat,
    m.salary,
    3,
  );
}

// Promote an academy member into a seat (uses their progressed ratings).
export function academyMemberToDriver(a: AcademyMember, seat: Seat): Driver {
  return buildDriver(`d-${a.id}`, a.name, a.nationality, a.skills, a.overall, seat, 1, 3);
}

// Sign an under-18 prospect into the academy, snapshotting live ratings.
export function signProspectToAcademy(p: YouthProspect, year: number): AcademyMember {
  return {
    id: `aca-${p.id}`,
    prospectId: p.id,
    name: p.name,
    nationality: p.nationality,
    skills: { ...p.skills },
    overall: p.overall,
    potential: p.potential,
    developmentRate: p.developmentRate,
    yearsUntilF1Ready: p.yearsUntilF1Ready,
    signedYear: year,
  };
}

// Advance one academy member by a single offseason: ratings grow toward the
// member's potential ceiling, scaled by development rate; readiness counts down.
export function progressAcademyMember(a: AcademyMember): AcademyMember {
  const gap = Math.max(0, a.potential - a.overall);
  const step = Math.min(gap, a.developmentRate * 0.15);
  const factor = a.overall > 0 ? (a.overall + step) / a.overall : 1;
  const skills: MarketSkillRatings = {
    cornering: r1(clamp(a.skills.cornering * factor)),
    braking: r1(clamp(a.skills.braking * factor)),
    straights: r1(clamp(a.skills.straights * factor)),
    tractionAcceleration: r1(clamp(a.skills.tractionAcceleration * factor)),
    elevationBlindCorners: r1(clamp(a.skills.elevationBlindCorners * factor)),
    technical: r1(clamp(a.skills.technical * factor)),
    overtakingRacecraft: r1(clamp(a.skills.overtakingRacecraft * factor)),
    surfaceGripBumpiness: r1(clamp(a.skills.surfaceGripBumpiness * factor)),
    riskManagement: r1(clamp(a.skills.riskManagement * factor)),
    enduranceConsistency: r1(clamp(a.skills.enduranceConsistency * factor)),
  };
  return {
    ...a,
    skills,
    overall: r1(clamp(a.overall + step)),
    yearsUntilF1Ready: Math.max(0, a.yearsUntilF1Ready - 1),
  };
}

export function isAcademyReady(a: AcademyMember): boolean {
  return a.yearsUntilF1Ready <= 0;
}
