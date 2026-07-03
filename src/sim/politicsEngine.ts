// Regulation voting / political system (Living Universe Phase 8).
//
// Teams lobby and vote on the next season's rule changes. Each team carries a
// political weight (influence) derived from its prestige and engine-supplier
// standing — big teams and works manufacturers swing votes. Proposals are
// generated for the upcoming season, the player casts a vote, and at the
// offseason the votes resolve by weighted support: passed proposals become real
// RegulationChangeEvents that feed next year's car carryover, and every outcome
// is recorded for the universe history. Pure and deterministic.

import type { CarRatings, RegulationChangeEvent, Series, Team, NewsItem, NewsCategory, NewsPriority } from '../types/gameTypes';
import type { TeamReputation } from '../types/expectationTypes';
import type { EngineState } from '../types/engineTypes';
import type {
  PoliticalInfluence,
  RegulationCategory,
  RegulationProposal,
  RegulationVote,
  RegulationVoteResult,
} from '../types/politicsTypes';
import type { TeamPhilosophyTrait } from '../types/aiTeamTypes';
import { createSeededRandom, deriveSeed, type Rng } from './random';

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}
function clampStance(n: number): number {
  return Math.max(-100, Math.min(100, n));
}

const CAR_KEYS: (keyof CarRatings)[] = [
  'enginePower',
  'aeroEfficiency',
  'mechanicalGrip',
  'reliability',
  'pitCrewOperations',
];

function teamPrestige(team: Team, reputations?: Record<string, TeamReputation>): number {
  return reputations?.[team.id]?.reputation ?? team.reputation;
}

// How "works"-aligned a team is on engine matters: +1 a full manufacturer
// (Works / Factory-Backed), -1 a budget customer, 0 in between or unknown.
function worksFactor(teamId: string, engine?: EngineState): number {
  const deal = engine?.deals?.[teamId];
  if (!deal) return 0;
  if (deal.dealType === 'Works' || deal.dealType === 'FactoryBacked') return 1;
  if (deal.dealType === 'BudgetCustomer') return -1;
  if (deal.dealType === 'Customer') return -0.5;
  return 0;
}

// ---------------------------------------------------------------------------
// Political influence
// ---------------------------------------------------------------------------

// A team's lobbying weight (0-100): mostly prestige, lifted by the political
// influence its engine deal confers (works suppliers carry real clout).
export function computePoliticalInfluence(
  teams: Team[],
  reputations?: Record<string, TeamReputation>,
  engine?: EngineState,
): PoliticalInfluence[] {
  return teams.map((team) => {
    const prestige = teamPrestige(team, reputations);
    const deal = engine?.deals?.[team.id];
    const engineInfluence = deal ? deal.politicalInfluence : prestige * 0.4;
    const influence = clamp(Math.round(prestige * 0.6 + engineInfluence * 0.4));
    return { teamId: team.id, influence };
  });
}

export function influenceByTeam(
  teams: Team[],
  reputations?: Record<string, TeamReputation>,
  engine?: EngineState,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of computePoliticalInfluence(teams, reputations, engine)) {
    out[i.teamId] = i.influence;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Proposal catalog
// ---------------------------------------------------------------------------

type ProposalTemplate = {
  key: string;
  category: RegulationCategory;
  title: string;
  description: string;
  // Display + mechanical effects. Keys matching CarRatings are multiplicative
  // carryover factors applied to next year's car if the proposal passes;
  // 'reliabilityRequirement' is a minimum-reliability delta. Other keys are
  // descriptive only.
  effects: Record<string, number>;
  // Stance model. A team's stance (-100..100) is:
  //   baseStance + bignessBias*bigness*100 + worksBias*worksFactor + noise
  // where bigness = (prestige-50)/50. Positive bignessBias = big teams favour.
  baseStance: number;
  bignessBias: number;
  worksBias?: number;
  minYear?: number;
  series?: Series[];
};

const TEMPLATES: ProposalTemplate[] = [
  {
    key: 'budget-cap',
    category: 'Budget',
    title: 'Introduce a championship-wide budget cap',
    description:
      'Cap annual team spending to level the field. Big-budget teams lose their financial advantage; smaller teams welcome the lifeline.',
    effects: { enginePower: 0.98, aeroEfficiency: 0.97 },
    baseStance: 0,
    bignessBias: -0.8,
    minYear: 2007,
  },
  {
    key: 'testing-limit',
    category: 'Testing',
    title: 'Restrict in-season testing',
    description:
      'Slash the mileage teams may run between races to cut costs. Well-funded teams that exploit testing push back hardest.',
    effects: { aeroEfficiency: 0.96, mechanicalGrip: 0.97 },
    baseStance: 0,
    bignessBias: -0.7,
  },
  {
    key: 'aero-cut',
    category: 'Aero',
    title: 'Cut aerodynamic downforce allowances',
    description:
      'Trim bodywork and wing freedoms to rein in cornering speeds. Teams with the strongest aero departments stand to lose the most.',
    effects: { aeroEfficiency: 0.85 },
    baseStance: 0,
    bignessBias: -0.6,
  },
  {
    key: 'engine-freeze',
    category: 'Engine',
    title: 'Freeze engine development to cut costs',
    description:
      'Lock engine specifications for the season. Customer teams love the cost saving; works manufacturers resent losing their development edge.',
    effects: { enginePower: 0.9 },
    baseStance: 5,
    bignessBias: -0.2,
    worksBias: -35,
  },
  {
    key: 'engine-token',
    category: 'Engine',
    title: 'Allow an extra engine upgrade per season',
    description:
      'Permit one additional power-unit specification each year. Manufacturers welcome the chance to out-develop rivals; customers fear the cost.',
    effects: { enginePower: 1.06 },
    baseStance: -5,
    bignessBias: 0.2,
    worksBias: 35,
  },
  {
    key: 'safety-chassis',
    category: 'Safety',
    title: 'Mandate stronger chassis safety standards',
    description:
      'Require tougher crash structures and cockpit protection. Broadly supported across the paddock, with a small development cost.',
    effects: { reliability: 0.97, reliabilityRequirement: 1 },
    baseStance: 48,
    bignessBias: 0.1,
  },
  {
    key: 'points-top10',
    category: 'Points',
    title: 'Expand points to the top ten finishers',
    description:
      'Reward more of the field with championship points. Midfield and smaller teams gain the most chances to score.',
    effects: {},
    baseStance: 12,
    bignessBias: -0.45,
  },
  {
    key: 'quali-knockout',
    category: 'Qualifying',
    title: 'Switch to a three-part knockout qualifying',
    description:
      'Replace the single timed session with an elimination format. Opinions split across the grid on the sporting merits.',
    effects: {},
    baseStance: 0,
    bignessBias: 0.1,
  },
  {
    key: 'calendar-expand',
    category: 'Calendar',
    title: 'Expand the calendar with new flyaway races',
    description:
      'Add lucrative overseas rounds. Bigger teams welcome the exposure and revenue; smaller teams worry about the logistics bill.',
    effects: {},
    baseStance: 0,
    bignessBias: 0.5,
  },
  {
    key: 'tyre-control',
    category: 'Tires',
    title: 'Adopt a single control tyre supplier',
    description:
      'Move the whole grid onto one spec tyre to cut costs and even out grip. Smaller teams favour the savings.',
    effects: { mechanicalGrip: 0.96 },
    baseStance: 10,
    bignessBias: -0.3,
  },
];

// Philosophy-trait stance modifiers: each trait shifts a team's position on
// certain regulation categories, giving AI teams identity-driven voting patterns
// beyond just prestige and engine deals.
const TRAIT_STANCE_MOD: Partial<Record<TeamPhilosophyTrait, Partial<Record<RegulationCategory, number>>>> = {
  TechnicalInnovator: { Engine: 15, Aero: 10, Testing: -10, Budget: -15 },
  Traditionalist: { Qualifying: -15, Calendar: -10, Budget: 5, Safety: 10 },
  RiskTaker: { Engine: 10, Aero: 10, Budget: -20, Testing: -10 },
  PeopleFirst: { Safety: 15, Budget: 5, Testing: 5 },
  DataDriven: { Aero: 5, Engine: 5, Budget: 10, Testing: -5 },
  Maverick: { Qualifying: 15, Calendar: 10, Engine: 5, Budget: -10 },
  Disciplined: { Budget: 15, Testing: 10, Safety: 5, Engine: -5 },
  StarMaker: { Testing: 10, Safety: 5, Budget: -5 },
};

function philosophyStanceMod(traits: TeamPhilosophyTrait[] | undefined, category: RegulationCategory): number {
  if (!traits) return 0;
  let mod = 0;
  for (const trait of traits) {
    mod += TRAIT_STANCE_MOD[trait]?.[category] ?? 0;
  }
  return mod;
}

function teamStance(
  template: ProposalTemplate,
  team: Team,
  prestige: number,
  engine: EngineState | undefined,
  rng: Rng,
  philosophyTraits?: TeamPhilosophyTrait[],
): number {
  const bigness = (prestige - 50) / 50; // -1..1
  let stance = template.baseStance + template.bignessBias * bigness * 100;
  if (template.worksBias) stance += template.worksBias * worksFactor(team.id, engine);
  stance += philosophyStanceMod(philosophyTraits, template.category);
  stance += rng.variance(14);
  return Math.round(clampStance(stance));
}

// Generate the regulation proposals up for a vote, effective in
// `seasonYearEffective`. Each team's stance is seeded deterministically.
export function generateRegulationProposals(
  teams: Team[],
  reputations: Record<string, TeamReputation> | undefined,
  engine: EngineState | undefined,
  seasonYearEffective: number,
  seed: string,
  count = 3,
  series?: Series,
  aiTeamStates?: Record<string, import('../types/aiTeamTypes').AITeamState>,
): RegulationProposal[] {
  const eligible = TEMPLATES.filter(
    (t) =>
      (t.minYear === undefined || seasonYearEffective >= t.minYear) &&
      (!t.series || !series || t.series.includes(series)),
  );

  // Deterministically shuffle and take `count`.
  const pickRng = createSeededRandom(deriveSeed(seed, 'regpick', seasonYearEffective));
  const shuffled = [...eligible]
    .map((t) => ({ t, r: pickRng.next() }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.t);
  const chosen = shuffled.slice(0, Math.min(count, shuffled.length));

  return chosen.map((template) => {
    const rng = createSeededRandom(deriveSeed(seed, 'regstance', seasonYearEffective, template.key));
    const supportByTeam: Record<string, number> = {};
    for (const team of teams) {
      const traits = aiTeamStates?.[team.id]?.philosophy?.traits;
      supportByTeam[team.id] = teamStance(template, team, teamPrestige(team, reputations), engine, rng, traits);
    }
    return {
      id: `reg-${seasonYearEffective}-${template.key}`,
      seasonYearEffective,
      title: template.title,
      description: template.description,
      category: template.category,
      effects: { ...template.effects },
      supportByTeam,
      playerVote: undefined,
    };
  });
}

// ---------------------------------------------------------------------------
// Vote resolution
// ---------------------------------------------------------------------------

const VOTE_STANCE: Record<RegulationVote, number> = { Support: 100, Oppose: -100, Abstain: 0 };

// Resolve a single proposal into a pass/fail outcome, weighting each team's
// stance by its political influence. The player's explicit vote overrides their
// team's seeded stance.
export function resolveProposal(
  proposal: RegulationProposal,
  influence: Record<string, number>,
  playerTeamId?: string,
): RegulationVoteResult {
  let supportWeight = 0;
  let opposeWeight = 0;
  for (const teamId of Object.keys(proposal.supportByTeam)) {
    const isPlayer = playerTeamId !== undefined && teamId === playerTeamId;
    const stance =
      isPlayer && proposal.playerVote
        ? VOTE_STANCE[proposal.playerVote]
        : proposal.supportByTeam[teamId];
    const contribution = (stance / 100) * (influence[teamId] ?? 0);
    if (contribution >= 0) supportWeight += contribution;
    else opposeWeight += -contribution;
  }
  return {
    proposalId: proposal.id,
    passed: supportWeight > opposeWeight,
    supportWeight: Math.round(supportWeight),
    opposeWeight: Math.round(opposeWeight),
    seasonYearEffective: proposal.seasonYearEffective,
  };
}

const CATEGORY_AREA: Record<RegulationCategory, RegulationChangeEvent['affectedAreas'][number]> = {
  Engine: 'Engine',
  Aero: 'Aero',
  Safety: 'Reliability',
  Testing: 'Testing',
  Budget: 'Budget',
  Points: 'Points',
  Qualifying: 'Qualifying',
  Calendar: 'Budget',
  Tires: 'Mechanical',
};

// Convert a passed proposal into a concrete RegulationChangeEvent that feeds the
// existing offseason car-carryover. Returns undefined for purely political
// proposals (Points / Qualifying / Calendar) that carry no car-rating effect.
export function proposalToRegulationChange(proposal: RegulationProposal): RegulationChangeEvent | undefined {
  const carryoverModifiers: Partial<CarRatings> = {};
  for (const key of CAR_KEYS) {
    const v = proposal.effects[key];
    if (typeof v === 'number') carryoverModifiers[key] = v;
  }
  const reliabilityRequirementChange =
    typeof proposal.effects.reliabilityRequirement === 'number'
      ? proposal.effects.reliabilityRequirement
      : undefined;

  const hasCarryover = Object.keys(carryoverModifiers).length > 0;
  if (!hasCarryover && reliabilityRequirementChange === undefined) return undefined;

  // Severity from the largest carryover deviation from neutral (1.0).
  const maxDev = Object.values(carryoverModifiers).reduce(
    (m, v) => Math.max(m, Math.abs(1 - (v ?? 1))),
    0,
  );
  const severity: RegulationChangeEvent['severity'] =
    maxDev >= 0.12 ? 'Major' : maxDev >= 0.06 ? 'Moderate' : maxDev > 0 ? 'Minor' : 'Stable';

  return {
    id: `regchg-${proposal.id}`,
    name: proposal.title,
    description: proposal.description,
    severity,
    affectedAreas: [CATEGORY_AREA[proposal.category]],
    effects: {
      ...(hasCarryover ? { carryoverModifiers } : {}),
      ...(reliabilityRequirementChange !== undefined ? { reliabilityRequirementChange } : {}),
    },
  };
}

export type RegulationVotingResolution = {
  results: RegulationVoteResult[];
  regulationChanges: RegulationChangeEvent[];
  notes: string[];
  news: NewsItem[];
};

function makeRegNews(
  id: string,
  headline: string,
  priority: NewsPriority,
  body: string,
): NewsItem {
  return {
    id,
    headline,
    body,
    timestamp: new Date().toISOString(),
    category: 'regulation' as NewsCategory,
    priority,
    careerPhase: 'offseason',
  };
}

// Resolve every proposal effective for the upcoming season: tally the votes,
// turn passed proposals into car-affecting regulation changes, and produce a
// human-readable note per outcome (flagging how the player voted).
export function resolveRegulationVoting(
  proposals: RegulationProposal[],
  teams: Team[],
  reputations: Record<string, TeamReputation> | undefined,
  engine: EngineState | undefined,
  playerTeamId?: string,
): RegulationVotingResolution {
  const influence = influenceByTeam(teams, reputations, engine);
  const results: RegulationVoteResult[] = [];
  const regulationChanges: RegulationChangeEvent[] = [];
  const notes: string[] = [];
  const news: NewsItem[] = [];

  for (const proposal of proposals) {
    const result = resolveProposal(proposal, influence, playerTeamId);
    results.push(result);

    const outcome = result.passed ? 'passed' : 'was rejected';
    let note = `Regulation vote: "${proposal.title}" ${outcome}.`;
    if (proposal.playerVote && proposal.playerVote !== 'Abstain') {
      const aligned = result.passed === (proposal.playerVote === 'Support');
      note += aligned ? ' The vote went your way.' : ' The vote went against you.';
    }
    notes.push(note);

    const priority: NewsPriority = result.passed ? 'high' : 'normal';
    const newsBody = result.passed
      ? `The proposal "${proposal.title}" has been approved for ${proposal.seasonYearEffective}. Support: ${result.supportWeight}, Opposition: ${result.opposeWeight}.`
      : `The proposal "${proposal.title}" was rejected. Support: ${result.supportWeight}, Opposition: ${result.opposeWeight}.`;
    news.push(makeRegNews(
      `news-reg-${proposal.id}`,
      result.passed
        ? `Regulation passed: ${proposal.title}`
        : `Regulation rejected: ${proposal.title}`,
      priority,
      newsBody,
    ));

    if (result.passed) {
      const change = proposalToRegulationChange(proposal);
      if (change) regulationChanges.push(change);
    }
  }

  return { results, regulationChanges, notes, news };
}
