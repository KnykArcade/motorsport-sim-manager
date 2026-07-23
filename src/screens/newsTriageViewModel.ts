import type { GameState } from '../game/careerState';
import type { NewsCategory, NewsItem } from '../types/gameTypes';

export type NewsTriage = {
  owner: string;
  recommendation: string;
  whyItMatters: string;
  consequence: string;
  route: string;
  routeLabel: string;
};

const CATEGORY_TRIAGE: Partial<Record<NewsCategory, Omit<NewsTriage, 'owner'>>> = {
  financial: {
    recommendation: 'Review the financial report before committing new spending.',
    whyItMatters: 'Cash flow determines which technical and personnel plans are sustainable.',
    consequence: 'Ignoring pressure can restrict future operating choices.',
    route: '/finance',
    routeLabel: 'Open Finance',
  },
  sponsor: {
    recommendation: 'Review the commercial update and its effect on team income.',
    whyItMatters: 'Commercial confidence affects the budget available for the next management cycle.',
    consequence: 'A missed commercial signal can leave the team underfunded later.',
    route: '/sponsors?tab=objectives',
    routeLabel: 'Open Sponsor Objectives',
  },
  development: {
    recommendation: 'Review the technical update against the current programme priorities.',
    whyItMatters: 'Development choices determine pace, reliability, and future capacity.',
    consequence: 'The next technical decision may become harder if this signal is ignored.',
    route: '/technical',
    routeLabel: 'Open Technical Center',
  },
  paddock: {
    recommendation: 'Review the paddock story for a decision or follow-up opportunity.',
    whyItMatters: 'Paddock developments can change morale, trust, and team options.',
    consequence: 'A missed response can close off a useful relationship or intelligence route.',
    route: '/paddock',
    routeLabel: 'Open Paddock Week',
  },
  driver_market: {
    recommendation: 'Review the driver-market signal before your next personnel decision.',
    whyItMatters: 'Market timing affects future seat options and negotiation leverage.',
    consequence: 'Waiting may reduce the available shortlist or increase the eventual cost.',
    route: '/drivers',
    routeLabel: 'Open Drivers',
  },
  regulation: {
    recommendation: 'Review the regulation update and any open team vote.',
    whyItMatters: 'Regulation changes can alter the value of current technical plans.',
    consequence: 'A missed vote or rule change can invalidate an otherwise sound plan.',
    route: '/politics',
    routeLabel: 'Open Regulations',
  },
  youth_academy: {
    recommendation: 'Review the academy report and decide whether follow-up is needed.',
    whyItMatters: 'Academy signals shape the team’s long-term driver pipeline.',
    consequence: 'Delaying attention can allow a promising option to cool or leave.',
    route: '/market',
    routeLabel: 'Open Driver Market',
  },
};

function ownerFor(category: NewsCategory | undefined, state: GameState): string {
  const role = category === 'development' ? 'Technical Director'
    : category === 'driver_market' || category === 'youth_academy' ? 'People Operations'
      : category === 'paddock' ? 'Paddock desk'
        : category === 'financial' || category === 'sponsor' ? 'Team leadership'
          : category === 'regulation' ? 'Team Principal'
            : 'Performance desk';
  const staff = state.staff?.find((member) => member.role === role);
  return staff ? `${staff.name} · ${role}` : role;
}

export function newsTriage(state: GameState, item: NewsItem): NewsTriage | undefined {
  if (item.priority !== 'critical' && item.priority !== 'high') return undefined;
  const details = CATEGORY_TRIAGE[item.category ?? 'general'];
  if (!details) return undefined;
  return { ...details, owner: ownerFor(item.category, state) };
}
