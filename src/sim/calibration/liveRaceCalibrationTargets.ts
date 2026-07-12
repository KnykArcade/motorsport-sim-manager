import type { Series } from '../../types/gameTypes';
import type { LiveRaceCalibrationReport } from './liveRaceCalibration';

export type CalibrationBand = { min: number; max: number };

export type LiveRaceCalibrationTargetProfile = {
  id: string;
  series: Series;
  startYear: number;
  endYear: number | null;
  bands: {
    pitStopsPerCar: CalibrationBand;
    threePlusStopRatePct: CalibrationBand;
    modeChangesPerCar: CalibrationBand;
    recommendationsPerPlayerCar: CalibrationBand;
    safetyCarDeployments: CalibrationBand;
  };
};

export type LiveRaceCalibrationAssessment = {
  profileId: string;
  withinTargets: boolean;
  metrics: Record<keyof LiveRaceCalibrationTargetProfile['bands'], CalibrationBand & { actual: number; within: boolean }>;
};

const openWheelBands = {
  pitStopsPerCar: { min: 1.5, max: 5.5 },
  threePlusStopRatePct: { min: 20, max: 95 },
  modeChangesPerCar: { min: 3, max: 18 },
  recommendationsPerPlayerCar: { min: 2, max: 18 },
  safetyCarDeployments: { min: 0, max: 10 },
};

export const LIVE_RACE_CALIBRATION_TARGETS: readonly LiveRaceCalibrationTargetProfile[] = [
  {
    id: 'f1-historical', series: 'F1', startYear: 1990, endYear: 2009,
    bands: {
      pitStopsPerCar: { min: 0.5, max: 2.2 }, threePlusStopRatePct: { min: 0, max: 15 },
      modeChangesPerCar: { min: 1, max: 9 }, recommendationsPerPlayerCar: { min: 1, max: 14 },
      safetyCarDeployments: { min: 0, max: 5 },
    },
  },
  {
    id: 'f1-modern', series: 'F1', startYear: 2010, endYear: null,
    bands: {
      pitStopsPerCar: { min: 0.5, max: 2.3 }, threePlusStopRatePct: { min: 0, max: 30 },
      modeChangesPerCar: { min: 1, max: 9 }, recommendationsPerPlayerCar: { min: 1, max: 12 },
      safetyCarDeployments: { min: 0, max: 5 },
    },
  },
  { id: 'cart', series: 'CART', startYear: 1990, endYear: 2003, bands: openWheelBands },
  { id: 'champ-car', series: 'Champ Car', startYear: 2004, endYear: 2007, bands: openWheelBands },
  { id: 'indycar', series: 'IndyCar', startYear: 1996, endYear: null, bands: openWheelBands },
  {
    id: 'nascar', series: 'NASCAR', startYear: 1990, endYear: null,
    bands: {
      pitStopsPerCar: { min: 3, max: 12 }, threePlusStopRatePct: { min: 50, max: 100 },
      modeChangesPerCar: { min: 5, max: 35 }, recommendationsPerPlayerCar: { min: 2, max: 30 },
      safetyCarDeployments: { min: 2, max: 18 },
    },
  },
];

export function selectLiveRaceCalibrationTargets(series: Series, year: number): LiveRaceCalibrationTargetProfile {
  const profile = LIVE_RACE_CALIBRATION_TARGETS.find((candidate) =>
    candidate.series === series
    && year >= candidate.startYear
    && (candidate.endYear == null || year <= candidate.endYear));
  if (!profile) throw new Error(`No live-race calibration targets for ${year}-${series}`);
  return profile;
}

export function assessLiveRaceCalibration(
  report: LiveRaceCalibrationReport,
  profile: LiveRaceCalibrationTargetProfile,
): LiveRaceCalibrationAssessment {
  const actuals = {
    pitStopsPerCar: report.rates.pitStopsPerCar,
    threePlusStopRatePct: report.rates.threePlusStopRatePct,
    modeChangesPerCar: report.rates.modeChangesPerCar,
    recommendationsPerPlayerCar: report.rates.recommendationsPerPlayerCar,
    safetyCarDeployments: report.averages.safetyCarDeployments,
  };
  const metrics = Object.fromEntries(Object.entries(profile.bands).map(([key, band]) => {
    const actual = actuals[key as keyof typeof actuals];
    return [key, { ...band, actual, within: actual >= band.min && actual <= band.max }];
  })) as LiveRaceCalibrationAssessment['metrics'];
  return {
    profileId: profile.id,
    withinTargets: Object.values(metrics).every((metric) => metric.within),
    metrics,
  };
}
