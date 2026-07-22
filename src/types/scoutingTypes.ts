// Scouting / fog of war (Living Universe Phase 1 — types only).
//
// Ratings are not perfectly known up front. A scouting report exposes ratings at
// an accuracy that depends on scouting level (and the ScoutingNetwork facility),
// with potential expressed as a range until a prospect is well scouted.

export type ScoutedEntityType = 'Driver' | 'YouthProspect' | 'Staff';

// A rating value as seen through fog of war: either a (possibly noisy) number or
// explicitly unknown until enough scouting has been done.
export type VisibleRating = number | [number, number] | 'Unknown';

export type ScoutingReport = {
  entityId: string;
  entityType: ScoutedEntityType;
  scoutingLevel: number; // 0-100 effort/coverage on this entity
  accuracy: number; // 0-1 how close visible ratings are to true values
  visibleRatings: Record<string, VisibleRating>;
  potentialRange?: [number, number]; // shown instead of an exact potential
  notes: string[];
  lastUpdated: string; // ISO date
};

export type ScoutingTargetReference = {
  entityId: string;
  entityType: ScoutedEntityType;
};

// The player team's scouting state, persisted in career mode.
export type ScoutingState = {
  teamId: string;
  // Base accuracy from the scouting network, before per-entity effort.
  networkAccuracy: number; // 0-1
  reports: Record<string, ScoutingReport>; // entityId -> report
  // Optional for saves created before the recruitment workflow was connected.
  activeAssignments?: ScoutingTargetReference[];
  shortlist?: ScoutingTargetReference[];
};
