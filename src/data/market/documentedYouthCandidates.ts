import type { YouthProspect } from '../../types/marketTypes';

type DocumentedYouthCandidate = {
  id: string;
  name: string;
  birthYear: number;
  nationality: string;
  firstAvailableYear: number;
  levelByYear: Record<number, string>;
  overall: number;
  potential: number;
  source: string;
};

// Real junior drivers are defined once here and projected into only the seasons
// in which they are both documented competitors and 12-17 years old. This
// avoids copying the same identity into separate series/year seed files.
const DOCUMENTED_YOUTH_CANDIDATES: DocumentedYouthCandidate[] = [
  {
    id: 'real-youth-freddie-slater',
    name: 'Freddie Slater',
    birthYear: 2008,
    nationality: 'Great Britain',
    firstAvailableYear: 2023,
    levelByYear: { 2023: 'Ginetta Junior', 2024: 'Formula 4', 2025: 'Formula Regional' },
    overall: 62,
    potential: 91,
    source: 'https://www.fiaformula3.com/Drivers/1476/Freddie-Slater',
  },
  {
    id: 'real-youth-rashid-al-dhaheri',
    name: 'Rashid Al Dhaheri',
    birthYear: 2008,
    nationality: 'United Arab Emirates',
    firstAvailableYear: 2023,
    levelByYear: { 2023: 'Formula 4', 2024: 'Formula 4', 2025: 'Formula Regional' },
    overall: 58,
    potential: 84,
    source: 'https://www.mercedesamgf1.com/drivers/junior-driver/rashid-al-dhaheri',
  },
  {
    id: 'real-youth-alex-powell',
    name: 'Alex Powell',
    birthYear: 2007,
    nationality: 'Jamaica/USA',
    firstAvailableYear: 2024,
    levelByYear: { 2024: 'Formula 4' },
    overall: 58,
    potential: 83,
    source: 'https://www.mercedesamgf1.com/news/alex-powell-junior-driver-announces-2024-racing-plans',
  },
  {
    id: 'real-youth-ugo-ugochukwu',
    name: 'Ugo Ugochukwu',
    birthYear: 2007,
    nationality: 'USA',
    firstAvailableYear: 2023,
    levelByYear: { 2023: 'Formula 4', 2024: 'Formula Regional' },
    overall: 59,
    potential: 86,
    source: 'https://ugougochukwu.com/',
  },
  {
    id: 'real-youth-enzo-tarnvanichkul',
    name: 'Enzo Tarnvanichkul',
    birthYear: 2009,
    nationality: 'Thailand',
    firstAvailableYear: 2022,
    levelByYear: { 2022: 'OK-Junior Karting', 2023: 'Senior Karting', 2024: 'Formula 4', 2025: 'Eurocup-3', 2026: 'Eurocup-3' },
    overall: 57,
    potential: 86,
    source: 'https://www.fia.com/news/fia-karting-brazilian-morgatto-and-thailands-tarnvanichkul-crowned-world-champions',
  },
  {
    id: 'real-youth-dries-van-langendonck',
    name: 'Dries Van Langendonck',
    birthYear: 2010,
    nationality: 'Belgium',
    firstAvailableYear: 2024,
    levelByYear: { 2024: 'Senior Karting', 2025: 'Senior Karting', 2026: 'Formula 4' },
    overall: 55,
    potential: 88,
    source: 'https://www.rodinmotorsport.com/drivers/dries-van-langendonck',
  },
  {
    id: 'real-youth-christian-costoya',
    name: 'Christian Costoya',
    birthYear: 2010,
    nationality: 'Spain',
    firstAvailableYear: 2023,
    levelByYear: { 2023: 'OK-Junior Karting', 2024: 'Senior Karting', 2025: 'Senior Karting', 2026: 'Formula 4' },
    overall: 56,
    potential: 89,
    source: 'https://premaracing.com/en/driver/64-christian-costoya',
  },
  {
    id: 'real-youth-noah-baglin',
    name: 'Noah Baglin',
    birthYear: 2012,
    nationality: 'Great Britain',
    firstAvailableYear: 2024,
    levelByYear: { 2024: 'OK-Junior Karting', 2025: 'OK-Junior Karting', 2026: 'Senior Karting' },
    overall: 50,
    potential: 87,
    source: 'https://www.ferrari.com/en-EN/fda/noah-baglin',
  },
];

function skills(overall: number): YouthProspect['skills'] {
  return {
    cornering: overall + 2,
    braking: overall,
    straights: overall,
    tractionAcceleration: overall + 1,
    elevationBlindCorners: overall - 1,
    technical: overall + 1,
    overtakingRacecraft: overall,
    surfaceGripBumpiness: overall - 1,
    riskManagement: overall - 2,
    enduranceConsistency: overall - 1,
  };
}

export function documentedYouthForYear(year: number): YouthProspect[] {
  return DOCUMENTED_YOUTH_CANDIDATES.flatMap((candidate) => {
    const age = year - candidate.birthYear;
    if (year < candidate.firstAvailableYear || age < 12 || age > 17) return [];
    const developmentYears = year - candidate.firstAvailableYear;
    const overall = Math.min(candidate.potential - 8, candidate.overall + developmentYears * 2);
    return [{
      id: candidate.id,
      name: candidate.name,
      age,
      birthYear: candidate.birthYear,
      nationality: candidate.nationality,
      currentLevel: candidate.levelByYear[year] ?? 'Documented junior competition',
      marketPool: 'Shared Motorsport Youth Market',
      marketStatus: 'Academy Prospect',
      seriesPreferences: [
        { series: 'F1', weight: 100 },
        { series: 'IndyCar', weight: 45 },
        { series: 'NASCAR', weight: 30 },
      ],
      academyEligibleNow: true,
      earliestFullAcademyYear: year,
      skills: skills(overall),
      overall,
      potential: candidate.potential,
      potentialDelta: candidate.potential - overall,
      developmentRate: 75,
      yearsUntilF1Ready: Math.max(1, 19 - age),
      signingCost: 0.1,
      yearlyAcademyCost: 0.06,
      riskLevel: age <= 14 ? 'High' : 'Medium',
      suggestedPath: 'Shared academy development',
      notes: `Documented real junior prospect. Source: ${candidate.source}`,
    } satisfies YouthProspect];
  });
}
