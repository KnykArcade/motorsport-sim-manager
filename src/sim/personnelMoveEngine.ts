import type { GameState } from '../game/careerState';
import type { PersonnelMoveAgreement } from '../types/characterInteractionTypes';
import type { Driver, Team } from '../types/gameTypes';
import type { StaffMember } from '../types/staffTypes';
import { ensureCharacterInteractionState } from './characterInteractionEngine';

export type PersonnelMoveExecution = {
  drivers: Driver[];
  teams: Team[];
  aiStaff: Record<string, StaffMember[]>;
  agreements: PersonnelMoveAgreement[];
  notes: string[];
};

function isRaceSeat(driver: Driver): boolean {
  return driver.contractType !== 'third' && driver.contractType !== 'reserve' && driver.contractType !== 'test';
}

export function schedulePersonnelMove(
  state: GameState,
  agreement: Omit<PersonnelMoveAgreement, 'id' | 'status'>,
): GameState {
  const interactions = ensureCharacterInteractionState(state.characterInteractions);
  const prior = interactions.personnelMoves.find(
    (entry) => entry.targetType === agreement.targetType
      && entry.targetId === agreement.targetId
      && entry.effectiveSeason === agreement.effectiveSeason
      && entry.status === 'Pending',
  );
  const move: PersonnelMoveAgreement = prior
    ? { ...prior, ...agreement }
    : {
        ...agreement,
        id: `personnel-move-${agreement.agreedSeason}-${agreement.targetType}-${agreement.targetId}-${agreement.destinationTeamId}`,
        status: 'Pending',
      };
  return {
    ...state,
    characterInteractions: {
      ...interactions,
      personnelMoves: [
        ...interactions.personnelMoves.filter((entry) => entry.id !== move.id),
        move,
      ].slice(-200),
    },
  };
}

export function cancelPendingPersonnelMove(state: GameState, targetType: 'Driver' | 'Staff', targetId: string): GameState {
  const interactions = ensureCharacterInteractionState(state.characterInteractions);
  return {
    ...state,
    characterInteractions: {
      ...interactions,
      personnelMoves: interactions.personnelMoves.map((entry) =>
        entry.targetType === targetType && entry.targetId === targetId && entry.status === 'Pending'
          ? { ...entry, status: 'Cancelled' as const }
          : entry),
    },
  };
}

function uniqueNumber(driver: Driver, drivers: Driver[]): number {
  const used = new Set(drivers.map((entry) => entry.number));
  if (!used.has(driver.number)) return driver.number;
  let number = 1;
  while (used.has(number)) number += 1;
  return number;
}

export function executePersonnelMoves(
  state: GameState,
  drivers: Driver[],
  teams: Team[],
  nextYear: number,
  sourceDrivers: Driver[] = state.drivers,
  sourceAIStaff: Record<string, StaffMember[]> = state.aiStaff ?? {},
): PersonnelMoveExecution {
  let nextDrivers = drivers.map((driver) => ({ ...driver }));
  let nextTeams = teams.map((team) => ({ ...team, driverIds: [...team.driverIds] }));
  const aiStaff = Object.fromEntries(
    Object.entries(sourceAIStaff).map(([teamId, staff]) => [teamId, staff.map((member) => ({ ...member }))]),
  );
  const notes: string[] = [];
  const agreements = ensureCharacterInteractionState(state.characterInteractions).personnelMoves.map((entry) => ({ ...entry }));

  for (const agreement of agreements) {
    if (agreement.status !== 'Pending' || agreement.effectiveSeason !== nextYear) continue;
    const destination = nextTeams.find((team) => team.id === agreement.destinationTeamId);
    if (!destination) {
      agreement.status = 'Cancelled';
      continue;
    }

    if (agreement.targetType === 'Driver') {
      const original = sourceDrivers.find((driver) => driver.id === agreement.targetId);
      if (!original) {
        agreement.status = 'Cancelled';
        continue;
      }
      nextDrivers = nextDrivers.filter((driver) => driver.id !== original.id);
      const destinationSeats = nextDrivers
        .filter((driver) => driver.teamId === destination.id && isRaceSeat(driver))
        .sort((a, b) => a.ratings.overall - b.ratings.overall || a.id.localeCompare(b.id));
      const displaced = destinationSeats.length >= 2 ? destinationSeats[0] : undefined;
      if (displaced) nextDrivers = nextDrivers.filter((driver) => driver.id !== displaced.id);
      const transferred: Driver = {
        ...original,
        teamId: destination.id,
        number: uniqueNumber(original, nextDrivers),
        contractType: 'seat',
        contractYearsRemaining: 2,
      };
      nextDrivers.push(transferred);
      nextTeams = nextTeams.map((team) => {
        const ids = team.driverIds.filter((id) => id !== original.id && id !== displaced?.id);
        return team.id === destination.id ? { ...team, driverIds: [...ids, transferred.id] } : { ...team, driverIds: ids };
      });
      notes.push(`${original.name} completed an agreed move to ${destination.name} for ${nextYear}.`);
    } else {
      const member = (state.staff ?? []).find((entry) => entry.id === agreement.targetId);
      if (!member) {
        agreement.status = 'Cancelled';
        continue;
      }
      const destinationStaff = (aiStaff[destination.id] ?? []).filter((entry) => entry.id !== member.id && entry.role !== member.role);
      aiStaff[destination.id] = [...destinationStaff, { ...member, contractYearsRemaining: 2 }];
      notes.push(`${member.name} completed an agreed move to ${destination.name} as ${member.role} for ${nextYear}.`);
    }
    agreement.status = 'Completed';
    agreement.completedSeason = nextYear;
  }

  return { drivers: nextDrivers, teams: nextTeams, aiStaff, agreements, notes };
}
