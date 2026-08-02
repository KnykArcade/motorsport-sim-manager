import type { Series } from '../../types/gameTypes';
import type { PreseasonTestingRuleProfile } from '../../types/phase18Types';

const FIA_2026 = 'https://api.fia.com/system/files/documents/fia_2026_f1_regulations_-_section_b_sporting_-_iss_06_-_2026-04-28.pdf';
const FIA_ARCHIVE = 'https://www.fia.com/regulation/category/110';
const INDYCAR_2026 = 'https://www.indycar.com/news/2026/01/01-13-testing-primer';
const NASCAR_2026 = 'https://www.nascar.com/news-media/2026/01/11/cup-series-2026-north-wilkesboro-preseason-organizational-test-preview/';

// Historical entries deliberately identify conservative gameplay caps where a
// complete event-by-event rulebook is not publicly available. Those caps are
// not presented as verbatim historical limits.
export const PRESEASON_TESTING_RULES: readonly PreseasonTestingRuleProfile[] = [
  {
    id: 'f1-1990-2008-private', series: 'F1', startYear: 1990, endYear: 2008,
    testType: 'Private', days: 4, sessionsPerDay: 2, maxCarsPerSession: 2,
    mileageLimitKm: 3200, tyreSets: null,
    driverPolicy: 'Race and test drivers may share the programme.',
    description: 'Private testing is available, represented by a conservative four-day management window.',
    source: { title: 'FIA Formula One regulations archive', url: FIA_ARCHIVE, confidence: 'GameplayFallback', note: 'Era availability is historical; the playable cap is conservative rather than an asserted exact season limit.' },
  },
  {
    id: 'f1-2009-2025-collective', series: 'F1', startYear: 2009, endYear: 2025,
    testType: 'Collective', days: 3, sessionsPerDay: 2, maxCarsPerSession: 1,
    mileageLimitKm: 1800, tyreSets: 18,
    driverPolicy: 'One current car runs at a time; race, reserve and eligible young drivers may be allocated.',
    description: 'Restricted collective preseason running with one current car per team.',
    source: { title: 'FIA Formula One regulations archive', url: FIA_ARCHIVE, confidence: 'High', note: 'Exact venues and day counts varied; the profile uses the common three-day modern format.' },
  },
  {
    id: 'f1-2026-collective', series: 'F1', startYear: 2026, endYear: 2026,
    testType: 'Collective', days: 3, sessionsPerDay: 2, maxCarsPerSession: 1,
    mileageLimitKm: 1800, tyreSets: 18,
    driverPolicy: 'One current car may run on each declared team day.',
    description: 'Three declared team running days inside the five-day private collective test, followed by public collective opportunities.',
    source: { title: 'FIA 2026 Formula 1 Sporting Regulations', url: FIA_2026, section: 'B11.2.7(a-b)', confidence: 'Official' },
  },
  {
    id: 'nascar-1990-2012-private', series: 'NASCAR', startYear: 1990, endYear: 2012,
    testType: 'Private', days: 3, sessionsPerDay: 2, maxCarsPerSession: 2,
    mileageLimitKm: 2200, tyreSets: null,
    driverPolicy: 'Race and reserve drivers may share team cars.',
    description: 'Private preseason preparation represented by a conservative three-day programme.',
    source: { title: 'NASCAR competition archive fallback', url: 'https://www.nascar.com/news-media/category/nascar-competition/', confidence: 'GameplayFallback', note: 'Public historical rule detail is incomplete; no exact real-world allowance is asserted.' },
  },
  {
    id: 'nascar-2013-2026-organizational', series: 'NASCAR', startYear: 2013, endYear: 2026,
    testType: 'Organizational', days: 1, sessionsPerDay: 2, maxCarsPerSession: 1,
    mileageLimitKm: 700, tyreSets: 8,
    driverPolicy: 'One car per organization; the organization chooses its driver allocation.',
    description: 'A defined organizational test focused on sanctioned technical objectives.',
    source: { title: 'NASCAR 2026 North Wilkesboro organizational test', url: NASCAR_2026, confidence: 'Official', note: 'The 2026 one-car organizational format anchors the modern profile; earlier seasons use the same conservative gameplay window.' },
  },
  {
    id: 'indycar-2008-2026-open', series: 'IndyCar', startYear: 2008, endYear: 2026,
    testType: 'Open', days: 2, sessionsPerDay: 2, maxCarsPerSession: 2,
    mileageLimitKm: 1200, tyreSets: 12,
    driverPolicy: 'Race drivers may share open-test running; rookie and evaluation allocations are separately eligible.',
    description: 'Sanctioned open testing with finite tyres and optional rookie/evaluation running.',
    source: { title: 'INDYCAR 2026 testing primer', url: INDYCAR_2026, confidence: 'Official', note: 'The primer confirms two team test days, separate open tests, rookie/evaluation days and limited Firestone tyres.' },
  },
  {
    id: 'cart-1990-2003-private', series: 'CART', startYear: 1990, endYear: 2003,
    testType: 'Private', days: 3, sessionsPerDay: 2, maxCarsPerSession: 2,
    mileageLimitKm: 2200, tyreSets: null,
    driverPolicy: 'Race and test drivers may share the programme.',
    description: 'Private preseason running represented by a conservative three-day programme.',
    source: { title: 'Historical CART gameplay fallback', url: 'https://www.indycar.com/News', confidence: 'GameplayFallback', note: 'No exact season-wide public test allowance is asserted.' },
  },
  {
    id: 'champcar-2004-2007-private', series: 'Champ Car', startYear: 2004, endYear: 2007,
    testType: 'Private', days: 3, sessionsPerDay: 2, maxCarsPerSession: 2,
    mileageLimitKm: 2200, tyreSets: null,
    driverPolicy: 'Race and test drivers may share the programme.',
    description: 'Private preseason running represented by a conservative three-day programme.',
    source: { title: 'Historical Champ Car gameplay fallback', url: 'https://www.indycar.com/News', confidence: 'GameplayFallback', note: 'No exact season-wide public test allowance is asserted.' },
  },
];

export function selectPreseasonTestingRule(series: Series, year: number): PreseasonTestingRuleProfile {
  const exact = PRESEASON_TESTING_RULES.find((rule) => rule.series === series && year >= rule.startYear && year <= rule.endYear);
  if (exact) return exact;
  const sameSeries = PRESEASON_TESTING_RULES.filter((rule) => rule.series === series);
  const nearest = sameSeries.sort((a, b) => Math.abs(year - a.endYear) - Math.abs(year - b.endYear))[0];
  if (nearest) return { ...nearest, id: `${nearest.id}-fallback-${year}`, source: { ...nearest.source, confidence: 'GameplayFallback', note: 'Nearest documented series profile used as a deterministic fallback.' } };
  return { ...PRESEASON_TESTING_RULES[0], id: `generic-${series}-${year}`, series, startYear: year, endYear: year, source: { ...PRESEASON_TESTING_RULES[0].source, confidence: 'GameplayFallback' } };
}
