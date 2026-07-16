import { describe, expect, it } from 'vitest';
import { loadSeasonBundle } from '../../data/seasonLoader';
import { setSeasonBundles } from '../../data/registry/masterRegistry';
import { seedMarketBundleCache } from '../../data/market';
import { buildStaticMarketBundleMap } from '../../data/market/marketSeed';
import { createNewGame } from '../../game/initialCareer';
import type { StaffMember } from '../../types/staffTypes';
import { buildCharacterDossier } from './CharacterDossier';

seedMarketBundleCache(buildStaticMarketBundleMap());

async function careerState() {
  const bundle = await loadSeasonBundle(1995, 'F1');
  if (!bundle) throw new Error('1995 F1 fixture unavailable');
  setSeasonBundles({ '1995-F1': bundle });
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: bundle.teams[0].id,
    seed: 'character-dossier-audit',
    bundle,
    teamPrincipal: {
      id: 'player-principal',
      name: 'Alex Morgan',
      nationality: 'British',
      age: 41,
      background: 'engineer',
      managementStyle: 'collaborative',
      primaryStrength: 'development',
      secondaryStrength: 'strategy',
      weakness: 'commercial',
      mediaPersonality: 'measured',
      driverManagementStyle: 'supportive',
      developmentPhilosophy: 'long-term',
      raceStrategyPhilosophy: 'adaptive',
      riskTolerance: 54,
      driverManagement: 70,
      developmentFocus: 76,
      raceStrategy: 68,
      commercialSkill: 45,
      politicalSkill: 52,
      reputation: 50,
    },
  });
}

describe('character dossier models', () => {
  it.each([
    [1995, 'F1'],
    [1998, 'CART'],
    [2008, 'IndyCar'],
    [1998, 'NASCAR'],
    [2026, 'NASCAR'],
  ] as const)('loads leadership records for %s %s dossiers', async (year, series) => {
    const bundle = await loadSeasonBundle(year, series);
    if (!bundle) throw new Error(`${year} ${series} fixture unavailable`);
    setSeasonBundles({ [`${year}-${series}`]: bundle });
    if (series !== 'NASCAR') expect(bundle.principals?.length).toBeGreaterThan(0);
    const selectedTeamId = bundle!.teams[0].id;
    const state = createNewGame({ gameMode: 'Career', seasonYear: year, series, teamId: selectedTeamId, seed: `principal-${year}-${series}`, bundle });
    expect(Object.keys(state.aiPrincipals ?? {})).toHaveLength(bundle.teams.length - 1);
    if (series !== 'NASCAR') {
      const named = Object.values(state.aiPrincipals ?? {}).filter((principal) => !principal.name.endsWith('Team Principal'));
      expect(named.length).toBeGreaterThan(0);
    }
  }, 60_000);

  it('assembles the player principal as the combined team principal and crew chief', async () => {
    const state = await careerState();
    const dossier = buildCharacterDossier(state, { type: 'playerPrincipal' });
    expect(dossier.name).toBe('Alex Morgan');
    expect(dossier.role).toBe('Team Principal / Crew Chief');
    expect(dossier.metrics.some((metric) => metric.label === 'Job Security')).toBe(true);
    expect(dossier.route).toBe('/principal');
  });

  it('assembles rival principal identity, pressure, and team context', async () => {
    const state = await careerState();
    const rivalTeam = state.teams.find((team) => team.id !== state.selectedTeamId)!;
    const dossier = buildCharacterDossier(state, { type: 'aiPrincipal', teamId: rivalTeam.id });
    expect(dossier.organization).toBe(rivalTeam.name);
    expect(dossier.name).toBe(state.aiPrincipals?.[rivalTeam.id].name);
    expect(dossier.metrics.some((metric) => metric.label === 'Pressure Control')).toBe(true);
    expect(dossier.identityLabel).toBeTruthy();
    expect(dossier.facts.some((fact) => fact.label === 'Team objective')).toBe(true);
    expect(dossier.facts.some((fact) => fact.label === 'Financial health')).toBe(true);
    expect(
      state.aiTeamStates?.[rivalTeam.id].philosophy?.traits.every((trait) =>
        dossier.traits.some((label) => label.replace(/\s/g, '').toLowerCase() === trait.toLowerCase()),
      ),
    ).toBe(true);
    expect(dossier.history.some((entry) => entry.title.includes(rivalTeam.name))).toBe(true);
  });

  it('assembles ownership priorities without inventing a historical owner name', async () => {
    const state = await careerState();
    const dossier = buildCharacterDossier(state, { type: 'owner', teamId: state.selectedTeamId });
    expect(dossier.name).toContain('Ownership');
    expect(dossier.metrics.some((metric) => metric.label === 'Owner Patience')).toBe(true);
    expect(dossier.facts.some((fact) => fact.label === 'Primary objective')).toBe(true);
  });

  it('distinguishes hired staff from recruitment candidates', async () => {
    const state = await careerState();
    const member: StaffMember = {
      id: 'staff-test',
      name: 'Jordan Lee',
      role: 'Strategist',
      nationality: 'American',
      rating: 8,
      salary: 1.2,
      signingFee: 0.4,
      bio: 'A calm strategist with a strong record in changing conditions.',
    };
    const candidate = buildCharacterDossier(state, { type: 'staff', staff: member });
    const hired = buildCharacterDossier({ ...state, staff: [member] }, { type: 'staff', staff: member });
    expect(candidate.identityLabel).toBe('Recruitment Candidate');
    expect(hired.identityLabel).toBe('Current Staff Member');
    expect(hired.metrics[0].score).toBe(80);
  });
});
