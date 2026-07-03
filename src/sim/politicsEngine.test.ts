import { describe, it, expect } from 'vitest';
import { teams1995 } from '../data/teams/teams1995';
import { buildTeamReputations } from './expectationEngine';
import {
  computePoliticalInfluence,
  generateRegulationProposals,
  influenceByTeam,
  proposalToRegulationChange,
  resolveProposal,
  resolveRegulationVoting,
} from './politicsEngine';
import type { RegulationProposal } from '../types/politicsTypes';

const reps = buildTeamReputations(teams1995);
const topTeam = [...teams1995].sort((a, b) => b.reputation - a.reputation)[0];
const backmarker = [...teams1995].sort((a, b) => a.reputation - b.reputation)[0];

describe('politicsEngine — influence', () => {
  it('gives every team an influence in 0-100', () => {
    const inf = computePoliticalInfluence(teams1995, reps);
    expect(inf).toHaveLength(teams1995.length);
    for (const i of inf) {
      expect(i.influence).toBeGreaterThanOrEqual(0);
      expect(i.influence).toBeLessThanOrEqual(100);
    }
  });

  it('prestigious teams carry more influence than backmarkers', () => {
    const byTeam = influenceByTeam(teams1995, reps);
    expect(byTeam[topTeam.id]).toBeGreaterThan(byTeam[backmarker.id]);
  });
});

describe('politicsEngine — proposal generation', () => {
  it('generates the requested number of proposals deterministically', () => {
    const a = generateRegulationProposals(teams1995, reps, undefined, 1996, 'seed', 3);
    const b = generateRegulationProposals(teams1995, reps, undefined, 1996, 'seed', 3);
    expect(a).toHaveLength(3);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('seeds a stance for every team, effective for the right season', () => {
    const [p] = generateRegulationProposals(teams1995, reps, undefined, 1996, 'seed', 1);
    expect(p.seasonYearEffective).toBe(1996);
    for (const t of teams1995) {
      expect(p.supportByTeam[t.id]).toBeGreaterThanOrEqual(-100);
      expect(p.supportByTeam[t.id]).toBeLessThanOrEqual(100);
    }
    expect(p.playerVote).toBeUndefined();
  });

  it('gates the budget cap to the modern era', () => {
    const classic = generateRegulationProposals(teams1995, reps, undefined, 1996, 's', 99);
    expect(classic.some((p) => p.id.endsWith('budget-cap'))).toBe(false);
    const modern = generateRegulationProposals(teams1995, reps, undefined, 2015, 's', 99);
    expect(modern.some((p) => p.id.endsWith('budget-cap'))).toBe(true);
  });
});

// A proposal big teams oppose and small teams support (aero cut).
function aeroCutProposal(): RegulationProposal {
  const supportByTeam: Record<string, number> = {};
  for (const t of teams1995) supportByTeam[t.id] = t.id === topTeam.id ? -80 : 0;
  supportByTeam[backmarker.id] = 80;
  return {
    id: 'reg-1996-aero-cut',
    seasonYearEffective: 1996,
    title: 'Cut aero',
    description: 'x',
    category: 'Aero',
    effects: { aeroEfficiency: 0.85 },
    supportByTeam,
  };
}

describe('politicsEngine — vote resolution', () => {
  it('tallies weighted support and opposition', () => {
    const inf = influenceByTeam(teams1995, reps);
    const result = resolveProposal(aeroCutProposal(), inf);
    expect(result.proposalId).toBe('reg-1996-aero-cut');
    expect(result.supportWeight).toBeGreaterThan(0);
    expect(result.opposeWeight).toBeGreaterThan(0);
    expect(typeof result.passed).toBe('boolean');
  });

  it("lets the player's vote override their team's seeded stance", () => {
    const inf = influenceByTeam(teams1995, reps);
    const base = aeroCutProposal();
    const support = resolveProposal({ ...base, playerVote: 'Support' }, inf, topTeam.id);
    const oppose = resolveProposal({ ...base, playerVote: 'Oppose' }, inf, topTeam.id);
    // Supporting adds the player's influence to the support side vs opposing.
    expect(support.supportWeight).toBeGreaterThan(oppose.supportWeight);
    expect(oppose.opposeWeight).toBeGreaterThan(support.opposeWeight);
  });

  it('a high-influence player can swing a close vote', () => {
    const inf = influenceByTeam(teams1995, reps);
    // Even split among rivals so the player decides the outcome.
    const supportByTeam: Record<string, number> = {};
    teams1995.forEach((t, idx) => {
      if (t.id === topTeam.id) supportByTeam[t.id] = 0;
      else supportByTeam[t.id] = idx % 2 === 0 ? 30 : -30;
    });
    const proposal: RegulationProposal = {
      id: 'reg-1996-close',
      seasonYearEffective: 1996,
      title: 'Close call',
      description: 'x',
      category: 'Points',
      effects: {},
      supportByTeam,
    };
    const support = resolveProposal({ ...proposal, playerVote: 'Support' }, inf, topTeam.id);
    const oppose = resolveProposal({ ...proposal, playerVote: 'Oppose' }, inf, topTeam.id);
    expect(support.passed).toBe(true);
    expect(oppose.passed).toBe(false);
  });
});

describe('politicsEngine — passed effects', () => {
  it('turns a passed car proposal into a regulation change', () => {
    const change = proposalToRegulationChange(aeroCutProposal());
    expect(change).toBeDefined();
    expect(change?.affectedAreas).toContain('Aero');
    expect(change?.effects.carryoverModifiers?.aeroEfficiency).toBe(0.85);
  });

  it('returns no change for a purely political proposal', () => {
    const proposal: RegulationProposal = {
      id: 'reg-1996-points',
      seasonYearEffective: 1996,
      title: 'Points',
      description: 'x',
      category: 'Points',
      effects: {},
      supportByTeam: {},
    };
    expect(proposalToRegulationChange(proposal)).toBeUndefined();
  });

  it('only applies changes for proposals that passed', () => {
    const passing = aeroCutProposal();
    const failing: RegulationProposal = {
      ...passing,
      id: 'reg-1996-fail',
      supportByTeam: Object.fromEntries(teams1995.map((t) => [t.id, -100])),
    };
    const res = resolveRegulationVoting([passing, failing], teams1995, reps, undefined, backmarker.id);
    expect(res.results).toHaveLength(2);
    // The failing proposal contributes no regulation change.
    expect(res.regulationChanges.every((c) => !c.id.includes('fail'))).toBe(true);
    expect(res.notes).toHaveLength(2);
  });
});
