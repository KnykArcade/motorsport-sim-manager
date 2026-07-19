import { getStaffPool } from '../../data';
import {
  activeDriversForTeam,
  maxRaceDriversForSeries,
  type GameState,
} from '../../game/careerState';
import { isPreseason } from '../../game/rosterEnforcement';
import { careerMarketBundle } from '../../sim/careerMarketEngine';
import type { RelationshipAttentionStatus } from '../../sim/relationshipAttentionEngine';
import { STAFF_ROLES } from '../../types/staffTypes';

export type ExternalTalentTarget = {
  id: string;
  name: string;
  kind: 'Driver' | 'Staff';
  signal: string;
  strength: number;
  detail: string;
};

export type ExternalTalentContext = {
  authorityRank: 8;
  authorityLabel: string;
  status: RelationshipAttentionStatus;
  openRaceSeats: number;
  staffVacancies: number;
  targets: ExternalTalentTarget[];
  reasons: string[];
};

type TalentContextInput = {
  preseason: boolean;
  openRaceSeats: number;
  staffVacancies: number;
  pendingDrivers: Array<{ id: string; name: string }>;
  scoutedDrivers: Array<{ id: string; name: string; scoutingLevel: number; accuracy: number }>;
  approachedStaff: Array<{ id: string; name: string; interest: number }>;
};

export function externalTalentContext(input: TalentContextInput): ExternalTalentContext {
  const targetsByKey = new Map<string, ExternalTalentTarget>();

  input.scoutedDrivers.forEach((driver) => {
    targetsByKey.set(`Driver:${driver.id}`, {
      id: driver.id,
      name: driver.name,
      kind: 'Driver',
      signal: 'Scouting active',
      strength: driver.scoutingLevel,
      detail: `${driver.scoutingLevel}/100 scouting coverage · ${Math.round(driver.accuracy * 100)}% report accuracy`,
    });
  });
  input.pendingDrivers.forEach((driver) => {
    targetsByKey.set(`Driver:${driver.id}`, {
      id: driver.id,
      name: driver.name,
      kind: 'Driver',
      signal: 'Signing pending',
      strength: 200,
      detail: 'A seat agreement is queued for the next roster update.',
    });
  });
  input.approachedStaff.forEach((staff) => {
    targetsByKey.set(`Staff:${staff.id}`, {
      id: staff.id,
      name: staff.name,
      kind: 'Staff',
      signal: 'Approach made',
      strength: 100 + staff.interest,
      detail: `${staff.interest}/100 recruitment interest · up to ${Math.min(15, Math.floor(staff.interest / 4))}% signing-fee reduction`,
    });
  });

  const targets = [...targetsByKey.values()]
    .sort((a, b) => b.strength - a.strength || a.name.localeCompare(b.name))
    .slice(0, 4);
  const reasons: string[] = [];
  if (input.preseason && input.openRaceSeats > 0) {
    reasons.push(`${input.openRaceSeats} race seat${input.openRaceSeats === 1 ? '' : 's'} must be filled before the season starts.`);
  } else if (input.openRaceSeats > 0) {
    reasons.push(`${input.openRaceSeats} race seat${input.openRaceSeats === 1 ? '' : 's'} remain open for the next signing window.`);
  }
  if (input.staffVacancies > 0) {
    reasons.push(`${input.staffVacancies} specialist role${input.staffVacancies === 1 ? ' is' : 's are'} vacant.`);
  }
  if (input.pendingDrivers.length > 0) {
    reasons.push(`${input.pendingDrivers.length} external driver signing${input.pendingDrivers.length === 1 ? ' is' : 's are'} pending.`);
  }
  if (targets.length > 0) {
    reasons.push(`${targets.length} live recruitment target${targets.length === 1 ? ' is' : 's are'} shown from scouting, approaches, and agreements.`);
  }
  if (reasons.length === 0) {
    reasons.push('No active scouting, approach, vacancy, or signing makes external talent a current relationship priority.');
  }

  return {
    authorityRank: 8,
    authorityLabel: 'External talent — contextual recruitment priority only',
    status: input.preseason && input.openRaceSeats > 0
      ? 'MustActNow'
      : targets.length > 0 || input.openRaceSeats > 0 || input.staffVacancies > 0
        ? 'WatchClosely'
        : 'Stable',
    openRaceSeats: input.openRaceSeats,
    staffVacancies: input.staffVacancies,
    targets,
    reasons,
  };
}

export function currentExternalTalentContext(state: GameState): ExternalTalentContext {
  const market = careerMarketBundle(state);
  const driverById = new Map([
    ...market.drivers.map((driver) => [driver.id, driver.name] as const),
    ...market.youth.map((driver) => [driver.id, driver.name] as const),
  ]);
  const staffById = new Map([
    ...getStaffPool(state.seasonYear, state.series).map((staff) => [staff.id, staff.name] as const),
    ...Object.values(state.aiStaff ?? {}).flat().map((staff) => [staff.id, staff.name] as const),
  ]);
  const currentStaffIds = new Set((state.staff ?? []).map((staff) => staff.id));
  const pendingDrivers = (state.pendingSignings ?? [])
    .filter((signing) => signing.source === 'market')
    .map((signing) => ({ id: signing.sourceId, name: signing.name }));
  const scoutedDrivers = Object.values(state.scouting?.reports ?? {})
    .filter((report) => report.entityType === 'Driver' || report.entityType === 'YouthProspect')
    .map((report) => ({
      id: report.entityId,
      name: driverById.get(report.entityId) ?? report.entityId,
      scoutingLevel: report.scoutingLevel,
      accuracy: report.accuracy,
    }));
  const approachedStaff = Object.entries(state.characterInteractions?.recruitmentInterest ?? {})
    .filter(([id, interest]) => interest > 0 && !currentStaffIds.has(id))
    .map(([id, interest]) => ({ id, name: staffById.get(id) ?? id, interest }));
  const filledStaffRoles = new Set((state.staff ?? []).map((staff) => staff.role));

  return externalTalentContext({
    preseason: isPreseason(state),
    openRaceSeats: Math.max(0, maxRaceDriversForSeries(state.series) - activeDriversForTeam(state, state.selectedTeamId).length),
    staffVacancies: STAFF_ROLES.filter((role) => !filledStaffRoles.has(role)).length,
    pendingDrivers,
    scoutedDrivers,
    approachedStaff,
  });
}
