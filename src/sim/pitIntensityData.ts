import type { PitIntensity } from '../types/liveTypes';
import type { Series } from '../types/gameTypes';

type PitIntensitySeries = Series | 'NASCAR';

export const PIT_INTENSITY_ORDER: PitIntensity[] = ['Conservative', 'Standard', 'Aggressive', 'AllOut'];

export type PitIntensitySpec = {
  stationaryDelta: number;
  botchChanceDelta: number;
  severityDelta: number;
  label: string;
};

export const PIT_INTENSITY_SPECS: Record<PitIntensity, PitIntensitySpec> = {
  Conservative: {
    label: 'Conservative',
    stationaryDelta: 0.35,
    botchChanceDelta: -0.02,
    severityDelta: -0.1,
  },
  Standard: {
    label: 'Standard',
    stationaryDelta: 0,
    botchChanceDelta: 0,
    severityDelta: 0,
  },
  Aggressive: {
    label: 'Aggressive',
    stationaryDelta: -0.55,
    botchChanceDelta: 0.035,
    severityDelta: 0.14,
  },
  AllOut: {
    label: 'All-Out',
    stationaryDelta: -1.05,
    botchChanceDelta: 0.075,
    severityDelta: 0.28,
  },
};

export function pitIntensitySpec(intensity: PitIntensity): PitIntensitySpec {
  return PIT_INTENSITY_SPECS[intensity];
}

export function pitIntensityStationaryFloor(series?: PitIntensitySeries): number {
  // Tiny safety floor so high-intensity calls can never collapse the stop to an
  // implausible zero. Heavy machinery / NASCAR stops are given a slightly
  // higher floor than open-wheel stops.
  if (series === 'NASCAR') return 5.4;
  if (series === 'IndyCar' || series === 'CART' || series === 'Champ Car') return 3.4;
  return 2.8;
}

export function pitIntensityPenaltySeconds(series?: PitIntensitySeries): number {
  if (series === 'NASCAR') return 16.5;
  if (series === 'IndyCar') return 13.5;
  if (series === 'CART' || series === 'Champ Car') return 14;
  return 12.5;
}

export function pitIntensityBaseRisk(intensity: PitIntensity): number {
  switch (intensity) {
    case 'Conservative':
      return 0.018;
    case 'Standard':
      return 0.045;
    case 'Aggressive':
      return 0.085;
    case 'AllOut':
      return 0.128;
  }
}

export function pitIntensityBaseSeverity(intensity: PitIntensity): number {
  switch (intensity) {
    case 'Conservative':
      return 0.14;
    case 'Standard':
      return 0.24;
    case 'Aggressive':
      return 0.39;
    case 'AllOut':
      return 0.55;
  }
}

export function pitIntensityBotchRisk(
  intensity: PitIntensity,
  pitCrewOperations: number,
  driverComposure: number,
  driverRiskManagement: number,
  opsForm: number,
  safetyCarActive: boolean,
): number {
  const skillBlend = pitCrewOperations * 0.46 + driverComposure * 0.27 + driverRiskManagement * 0.27;
  return clamp(
    pitIntensityBaseRisk(intensity) +
      PIT_INTENSITY_SPECS[intensity].botchChanceDelta -
      (skillBlend - 50) * 0.0014 -
      opsForm * 0.006 -
      (safetyCarActive ? 0.01 : 0),
    0.01,
    0.28,
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
