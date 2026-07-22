import { getStaffPool } from '../data';
import type { GameState } from '../game/careerState';
import { careerMarketBundle } from '../sim/careerMarketEngine';
import { effectiveAccuracy } from '../sim/scoutingEngine';
import type { ScoutedEntityType } from '../types/scoutingTypes';

export type RecruitmentDecisionDesk = {
  entityId: string;
  entityType: ScoutedEntityType;
  name: string;
  knowledgePercentage: number;
  status: 'Unscouted' | 'Scouting in progress' | 'Full report ready' | 'Shortlisted';
  recommendation: string;
  nextAction: {
    label: string;
    route: string;
  };
};

function targetName(state: GameState, entityId: string, entityType: ScoutedEntityType): string | undefined {
  if (entityType === 'Staff') return getStaffPool(state.seasonYear, state.series).find((staff) => staff.id === entityId)?.name;
  const bundle = careerMarketBundle(state);
  return entityType === 'Driver'
    ? bundle.drivers.find((driver) => driver.id === entityId)?.name
    : bundle.youth.find((prospect) => prospect.id === entityId)?.name;
}

function targetType(state: GameState, entityId: string): ScoutedEntityType | undefined {
  const scouting = state.scouting;
  const report = scouting?.reports[entityId];
  if (report) return report.entityType;
  if (careerMarketBundle(state).drivers.some((driver) => driver.id === entityId)) return 'Driver';
  if (careerMarketBundle(state).youth.some((prospect) => prospect.id === entityId)) return 'YouthProspect';
  if (getStaffPool(state.seasonYear, state.series).some((staff) => staff.id === entityId)) return 'Staff';
  return undefined;
}

export function recruitmentDecisionDesk(state: GameState, entityId: string): RecruitmentDecisionDesk | null {
  const scouting = state.scouting;
  if (!scouting) return null;
  const entityType = targetType(state, entityId);
  if (!entityType) return null;
  const report = scouting.reports[entityId];
  const assignment = (scouting.activeAssignments ?? []).some(
    (entry) => entry.entityId === entityId && entry.entityType === entityType,
  );
  const shortlisted = (scouting.shortlist ?? []).some(
    (entry) => entry.entityId === entityId && entry.entityType === entityType,
  );
  const knowledgePercentage = report
    ? Math.round(effectiveAccuracy(report.scoutingLevel, scouting.networkAccuracy) * 100)
    : 0;
  const status = shortlisted
    ? 'Shortlisted'
    : report?.scoutingLevel === 100
      ? 'Full report ready'
      : assignment
        ? 'Scouting in progress'
        : 'Unscouted';
  const tab = entityType === 'YouthProspect' ? 'youth' : entityType === 'Staff' ? 'staff' : 'senior';
  const scoutingRoute = `/scouting?tab=${tab}&target=${encodeURIComponent(entityId)}`;
  const marketRoute = `/market?target=${encodeURIComponent(entityId)}`;
  const action = entityType === 'Driver'
    ? report?.scoutingLevel === 100 || shortlisted
      ? { label: 'Review Market Target', route: marketRoute }
      : { label: 'Continue Scouting', route: scoutingRoute }
    : entityType === 'Staff'
      ? report?.scoutingLevel === 100 || shortlisted
        ? { label: 'Review Staff Negotiation', route: `/staff/${encodeURIComponent(entityId)}/negotiate` }
        : { label: 'Continue Scouting', route: scoutingRoute }
      : report?.scoutingLevel === 100 || shortlisted
        ? { label: 'Review Youth Target', route: scoutingRoute }
        : { label: 'Continue Scouting', route: scoutingRoute };

  return {
    entityId,
    entityType,
    name: targetName(state, entityId, entityType) ?? entityId,
    knowledgePercentage,
    status,
    recommendation: report?.scoutingLevel === 100
      ? 'The report is ready for a player-led recruitment decision.'
      : assignment
        ? 'Keep building knowledge before committing budget or a contract.'
        : 'Assign scouting coverage before treating this target as decision-ready.',
    nextAction: action,
  };
}
