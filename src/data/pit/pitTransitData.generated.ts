// Generated runtime pit transit data placeholder.
// Source workbook expected at docs/source-data/pit/PIT_DATA_TRANSIT_ONLY_COMPLETED(1).xlsx.
// Run scripts/convertPitWorkbook.mjs after placing the authoritative workbook.
import type { PitRulesBySeriesEraRecord, PitTransitRecord } from '../../types/pitTypes';

export const PIT_TRANSIT_DATA: readonly PitTransitRecord[] = [];

export const PIT_RULES_BY_SERIES_ERA = [
  {
    series: 'F1',
    startYear: 1990,
    endYear: 1993,
    refuelingAllowed: false,
    typicalTyresChanged: 'tyres only; no race refueling',
    crewOverWall: null,
    stationaryCalibrationLowSeconds: null,
    stationaryCalibrationHighSeconds: null,
    pitSpeedLimitFallback: null,
    notes: ['Historical F1 no-refueling era; workbook transit remains separate from service.'],
  },
  {
    series: 'F1',
    startYear: 1994,
    endYear: 2009,
    refuelingAllowed: true,
    typicalTyresChanged: 'tyres and fuel where strategy permits',
    crewOverWall: null,
    stationaryCalibrationLowSeconds: null,
    stationaryCalibrationHighSeconds: null,
    pitSpeedLimitFallback: null,
    notes: ['F1 refueling era; stationary service must be simulated per stop.'],
  },
  {
    series: 'F1',
    startYear: 2010,
    endYear: null,
    refuelingAllowed: false,
    typicalTyresChanged: 'tyres only; race refueling prohibited',
    crewOverWall: null,
    stationaryCalibrationLowSeconds: null,
    stationaryCalibrationHighSeconds: null,
    pitSpeedLimitFallback: null,
    notes: ['Modern F1 no-refueling era with separate transit/service accounting.'],
  },
  {
    series: 'NASCAR',
    startYear: 1990,
    endYear: null,
    refuelingAllowed: true,
    typicalTyresChanged: 'fuel, tyres, repairs, and adjustments by stop intent',
    crewOverWall: null,
    stationaryCalibrationLowSeconds: null,
    stationaryCalibrationHighSeconds: null,
    pitSpeedLimitFallback: null,
    notes: ['NASCAR pit service is generated independently from workbook transit loss.'],
  },
] as const satisfies readonly PitRulesBySeriesEraRecord[];
