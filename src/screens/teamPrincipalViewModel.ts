import type { GameState } from '../game/careerState';
import type { JobOffer } from '../types/principalTypes';

export type PrincipalCommandTab = 'standing' | 'relationships' | 'identity' | 'culture' | 'departments' | 'career';

export const PRINCIPAL_COMMAND_TABS: Array<{ id: PrincipalCommandTab; label: string; description: string }> = [
  { id: 'standing', label: 'Overview', description: 'Identity, contract, security, targets, and management attributes' },
  { id: 'relationships', label: 'Relationships', description: 'Driver trust, binding promises, and public commitments' },
  { id: 'identity', label: 'Identity', description: 'Leadership style and defining decisions' },
  { id: 'culture', label: 'Culture', description: 'The working environment shaped by your leadership' },
  { id: 'departments', label: 'Departments', description: 'Trust, alignment, and morale around the team' },
  { id: 'career', label: 'Career & Offers', description: 'Career record and rival opportunities' },
];

export const PRINCIPAL_OFFERS_PER_PAGE = 3;

export function principalJobOfferPage(offers: JobOffer[], page: number): JobOffer[] {
  const lastPage = Math.max(0, Math.ceil(offers.length / PRINCIPAL_OFFERS_PER_PAGE) - 1);
  const safePage = Math.max(0, Math.min(lastPage, page));
  return offers.slice(safePage * PRINCIPAL_OFFERS_PER_PAGE, (safePage + 1) * PRINCIPAL_OFFERS_PER_PAGE);
}

export function selectedPrincipalJobOffer(
  offers: JobOffer[],
  selectedId?: string,
): JobOffer | undefined {
  return offers.find((offer) => offer.id === selectedId) ?? offers[0];
}

export function principalTabFromQuery(value: string | null): PrincipalCommandTab {
  return PRINCIPAL_COMMAND_TABS.some((tab) => tab.id === value)
    ? value as PrincipalCommandTab
    : 'standing';
}

export type PrincipalRelationshipRow = {
  driverId: string;
  driverName: string;
  trust: number;
  morale: number;
  confidence: number;
  frustration: number;
  activePromises: number;
};

export function principalRelationshipRows(state: GameState): PrincipalRelationshipRow[] {
  return state.drivers
    .filter((driver) => driver.teamId === state.selectedTeamId)
    .map((driver) => {
      const relationship = state.driverRelationships?.[driver.id];
      return {
        driverId: driver.id,
        driverName: driver.name,
        trust: relationship?.trustInPrincipal ?? 50,
        morale: relationship?.morale ?? driver.morale,
        confidence: relationship?.selfConfidence ?? driver.confidence,
        frustration: relationship?.frustration ?? 0,
        activePromises: (state.driverPromises ?? []).filter((promise) =>
          promise.driverId === driver.id && promise.status === 'active').length,
      };
    })
    .sort((a, b) => a.trust - b.trust || b.frustration - a.frustration || a.driverName.localeCompare(b.driverName));
}

export type PrincipalCommitmentRow = {
  id: string;
  scope: 'Driver' | 'Public' | 'Department';
  title: string;
  detail: string;
  due: string;
  status: string;
};

export function principalCommitmentRows(state: GameState): PrincipalCommitmentRow[] {
  const driverIds = new Set(state.drivers
    .filter((driver) => driver.teamId === state.selectedTeamId)
    .map((driver) => driver.id));
  const driverPromises = (state.driverPromises ?? [])
    .filter((promise) => driverIds.has(promise.driverId) && promise.status === 'active')
    .map((promise): PrincipalCommitmentRow => ({
      id: `driver-${promise.id}`,
      scope: 'Driver',
      title: humanize(promise.promiseType),
      detail: state.drivers.find((driver) => driver.id === promise.driverId)?.name ?? promise.driverId,
      due: deadlineLabel(promise.dueSeason ?? promise.madeSeason, promise.dueRound),
      status: 'Active',
    }));
  const activeDriverPromiseIds = new Set((state.driverPromises ?? [])
    .filter((promise) => driverIds.has(promise.driverId) && promise.status === 'active')
    .map((promise) => promise.id));
  const publicPromises = (state.media?.publicPromises ?? [])
    .filter((promise) => promise.status === 'Active')
    .map((promise): PrincipalCommitmentRow => ({
      id: `public-${promise.id}`,
      scope: 'Public',
      title: humanize(promise.type),
      detail: promise.statement,
      due: deadlineLabel(promise.seasonYear, promise.deadlineRound),
      status: promise.status,
    }));
  const characterCommitments = (state.characterInteractions?.commitments ?? [])
    .filter((commitment) =>
      commitment.status === 'Active'
      && (!commitment.linkedPromiseId || !activeDriverPromiseIds.has(commitment.linkedPromiseId)))
    .map((commitment): PrincipalCommitmentRow => ({
      id: `department-${commitment.id}`,
      scope: commitment.kind === 'DepartmentSupport' ? 'Department' : 'Driver',
      title: commitment.title,
      detail: commitment.description,
      due: deadlineLabel(commitment.dueSeason, commitment.dueRound),
      status: commitment.status,
    }));
  return [...driverPromises, ...publicPromises, ...characterCommitments];
}

export type PrincipalCareerTimelineRow = {
  id: string;
  teamName: string;
  role: string;
  seasons: string;
  joinedReason: string;
  leftReason?: string;
  current: boolean;
};

export function principalCareerTimeline(state: GameState): PrincipalCareerTimelineRow[] {
  const principalIds = new Set([
    state.principal?.id,
    state.teamPrincipal?.id,
    'player-principal',
  ].filter((id): id is string => Boolean(id)));
  const recorded = (state.personnelCareerHistory ?? [])
    .filter((tenure) => tenure.kind === 'TeamPrincipal' && principalIds.has(tenure.personId))
    .sort((a, b) => b.startedSeason - a.startedSeason)
    .map((tenure): PrincipalCareerTimelineRow => ({
      id: tenure.id,
      teamName: tenure.teamName,
      role: tenure.role,
      seasons: tenure.endedSeason ? `${tenure.startedSeason}–${tenure.endedSeason}` : `${tenure.startedSeason}–present`,
      joinedReason: tenure.joinedReason,
      leftReason: tenure.leftReason,
      current: tenure.endedSeason == null,
    }));
  if (recorded.length > 0) return recorded;
  const currentTeam = state.teams.find((team) => team.id === state.principal?.currentTeamId);
  return currentTeam ? [{
    id: `current-${currentTeam.id}`,
    teamName: currentTeam.name,
    role: 'Team Principal',
    seasons: `${state.seasonYear}–present`,
    joinedReason: 'Current career appointment',
    current: true,
  }] : [];
}

function deadlineLabel(season: number, round?: number): string {
  return round == null ? `${season} season` : `${season} · R${round}`;
}

function humanize(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
