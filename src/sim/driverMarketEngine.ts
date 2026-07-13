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
import { toLegacyRating } from './ratingScale';

const clamp = (v: number, lo = 1, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v)));
const r1 = (n: number) => Math.round(n * 10) / 10;
const avg = (...xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

// Derive the full driver rating sheet from the ten core market skills. The
// market workbook only carries the core skills + overall; qualifying, race
// pace, adaptability, aggression and composure are synthesised from them.
export function synthesizeDriverRatings(
  skills: MarketSkillRatings,
  overall: number,
): DriverRatings {
  const qualifying = r1(avg(toLegacyRating(skills.cornering), toLegacyRating(skills.braking), toLegacyRating(skills.technical)) * 10);
  const racePace = r1(
    avg(
      toLegacyRating(skills.enduranceConsistency),
      toLegacyRating(skills.tractionAcceleration),
      toLegacyRating(skills.overtakingRacecraft),
    ) * 10,
  );
  const adaptability = r1(avg(toLegacyRating(skills.technical), toLegacyRating(skills.surfaceGripBumpiness)) * 10);
  const aggression = r1(clamp(avg(toLegacyRating(skills.overtakingRacecraft), 11 - toLegacyRating(skills.riskManagement)) * 10));
  const composure = r1(avg(toLegacyRating(skills.enduranceConsistency), toLegacyRating(skills.riskManagement)) * 10);
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
    contractType: 'seat',
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

// Promote an academy member into a non-racing reserve tier (3rd/reserve/test).
// They join the team roster behind the two race seats on a cheaper deal.
export function academyMemberToReserveDriver(
  a: AcademyMember,
  teamId: string,
  role: 'third' | 'reserve' | 'test',
  number: number,
): Driver {
  const d = buildDriver(`d-${a.id}`, a.name, a.nationality, a.skills, a.overall, { teamId, number }, 0.5, 2);
  return { ...d, contractType: role };
}

// Current age of an academy member in a given year.
export function academyMemberAge(a: AcademyMember, year: number): number {
  return year - a.birthYear;
}

// Sign an under-18 prospect into the academy, snapshotting live ratings.
export function signProspectToAcademy(
  p: YouthProspect,
  year: number,
  teamId: string,
): AcademyMember {
  return {
    id: `aca-${p.id}`,
    prospectId: p.id,
    name: p.name,
    nationality: p.nationality,
    birthYear: p.birthYear,
    academyTeamId: teamId,
    seriesPreferences: p.seriesPreferences?.map((preference) => ({ ...preference })),
    skills: { ...p.skills },
    overall: p.overall,
    potential: p.potential,
    developmentRate: p.developmentRate,
    yearsUntilF1Ready: p.yearsUntilF1Ready,
    signedYear: year,
    promotionEligible: false,
  };
}

// Advance one academy member by a single offseason: ratings grow toward the
// member's potential ceiling, scaled by development rate; readiness counts down.
// `boost` (e.g. from a Driver Academy facility) accelerates the growth step.
export function progressAcademyMember(a: AcademyMember, boost = 0): AcademyMember {
  const gap = Math.max(0, a.potential - a.overall);
  const step = Math.min(gap, a.developmentRate * 0.15 * (1 + boost));
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
