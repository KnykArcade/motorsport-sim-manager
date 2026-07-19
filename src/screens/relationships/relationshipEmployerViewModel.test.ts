import { describe, expect, it } from 'vitest';
import type { GameState } from '../../game/careerState';
import type { JobOffer, TeamPrincipalProfile } from '../../types/principalTypes';
import type { Team } from '../../types/gameTypes';
import { currentPotentialEmployerStanding } from './relationshipEmployerViewModel';

const principal = {
  id: 'principal-player',
  name: 'Alex Morgan',
  reputation: 70,
  currentTeamId: 'current',
  contractYearsRemaining: 2,
  jobSecurity: 60,
  attributes: {},
  careerStats: {},
  xp: 0,
  level: 1,
  skillPoints: 0,
  spentSkillPoints: {},
} as TeamPrincipalProfile;

const teams = [
  { id: 'current', name: 'Current Team' },
  { id: 'future', name: 'Future Racing' },
  { id: 'stretch', name: 'Stretch Motorsport' },
] as Team[];

function offer(id: string, teamId: string, kind: JobOffer['kind'], prestige: number): JobOffer {
  return {
    id,
    teamId,
    seasonYear: 1995,
    contractYears: 2,
    objective: 'Move the team forward',
    prestige,
    budgetTier: 'Competitive',
    kind,
    expiresSeasonYear: 1996,
  };
}

function state(jobOffers: JobOffer[] = []): Pick<GameState, 'principal' | 'jobOffers' | 'acceptedJobOfferId' | 'teams' | 'teamReputations'> {
  return {
    principal,
    jobOffers,
    teams,
    teamReputations: {
      future: {
        teamId: 'future', reputation: 65, financialStability: 70, ownerPatience: 70,
        ownerPersonality: 'PatientBuilder', fanExpectation: 65, sponsorConfidence: 65,
        historicalPrestige: 65, currentCompetitiveness: 65,
      },
      stretch: {
        teamId: 'stretch', reputation: 75, financialStability: 80, ownerPatience: 45,
        ownerPersonality: 'WinNowTycoon', fanExpectation: 75, sponsorConfidence: 75,
        historicalPrestige: 75, currentCompetitiveness: 75,
      },
    },
  };
}

describe('potential employer relationship view model', () => {
  it('keeps other owners in the background when there is no active approach', () => {
    const standing = currentPotentialEmployerStanding(state());

    expect(standing?.marketStanding).toBe(67);
    expect(standing?.status).toBe('Stable');
    expect(standing?.reasons).toContain('Market standing is 67/100: 70% reputation (70) and 30% current job security (60).');
  });

  it('explains firm and informal interest using standing, prestige, and owner motivation', () => {
    const standing = currentPotentialEmployerStanding(state([
      offer('firm', 'future', 'Offer', 65),
      offer('rumor', 'stretch', 'Rumor', 75),
    ]));

    expect(standing?.status).toBe('WatchClosely');
    expect(standing?.firmOffers).toBe(1);
    expect(standing?.rumors).toBe(1);
    expect(standing?.opportunities[0]).toMatchObject({
      teamName: 'Future Racing',
      ownerLabel: 'Patient Builder',
    });
    expect(standing?.opportunities[0].interestReason).toContain('meets this team’s prestige bar');
    expect(standing?.opportunities[1].interestReason).toContain('8 points below');
  });

  it('puts an accepted next-season relationship first', () => {
    const input = state([
      offer('higher', 'stretch', 'Offer', 80),
      offer('accepted', 'future', 'Offer', 60),
    ]);
    input.acceptedJobOfferId = 'accepted';

    const standing = currentPotentialEmployerStanding(input);

    expect(standing?.opportunities[0].offer.id).toBe('accepted');
    expect(standing?.opportunities[0].accepted).toBe(true);
    expect(standing?.reasons[0]).toContain('next-season move to Future Racing is accepted');
  });
});
