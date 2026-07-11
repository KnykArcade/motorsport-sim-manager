import type { Track } from '../../types/gameTypes';
import type { CircuitSegmentSet } from '../../types/circuitTypes';
import { CIRCUIT_SEGMENT_SETS } from './circuitSegments.generated';
import { generateFallbackSegments } from './fallbackSegmentGenerator';

export type CircuitLookupRequest = {
  track: Track;
  year: number;
  series: string;
  totalLaps?: number;
};

export function getCircuitSegmentsForRace(request: CircuitLookupRequest): CircuitSegmentSet {
  const authored = CIRCUIT_SEGMENT_SETS.find((set) => {
    if (set.trackId !== request.track.id) return false;
    if (set.series && set.series !== request.series) return false;
    if (set.startYear != null && request.year < set.startYear) return false;
    if (set.endYear != null && request.year > set.endYear) return false;
    return true;
  });
  return authored ?? generateFallbackSegments(request.track, request.totalLaps);
}
