import { SETUP_COMPONENTS } from '../data/setup/setupComponents';
import type { CarSetup, SetupComponentKey, SetupParamKey } from '../types/setupTypes';

export type SetupParameterChange = {
  previous: number;
  current: number;
  delta: number;
  changed: boolean;
};

export function setupParameterChange(
  baseline: CarSetup,
  current: CarSetup,
  key: SetupParamKey,
): SetupParameterChange {
  const previous = baseline[key];
  const value = current[key];
  const delta = Number((value - previous).toFixed(1));
  return {
    previous,
    current: value,
    delta,
    changed: Math.abs(delta) >= 0.05,
  };
}

export function changedSetupParameters(
  baseline: CarSetup,
  current: CarSetup,
): SetupParamKey[] {
  return (Object.keys(current) as SetupParamKey[])
    .filter((key) => setupParameterChange(baseline, current, key).changed);
}

export function changedSetupComponentCount(
  baseline: CarSetup,
  current: CarSetup,
  component: SetupComponentKey,
): number {
  const metadata = SETUP_COMPONENTS.find((item) => item.key === component);
  return metadata?.params.filter((key) => setupParameterChange(baseline, current, key).changed).length ?? 0;
}

export function formatSetupDelta(delta: number): string {
  if (Math.abs(delta) < 0.05) return 'No change';
  return `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`;
}

export function setupDraftStatus(input: {
  changedCount: number;
  postQualifying: boolean;
  locked: boolean;
}): string {
  if (input.locked) {
    return input.changedCount > 0
      ? `${input.changedCount} permitted post-qualifying change${input.changedCount === 1 ? '' : 's'}`
      : 'Parc fermé restrictions active';
  }
  if (input.changedCount === 0) {
    return input.postQualifying ? 'Qualifying setup retained' : 'No draft changes';
  }
  return `${input.changedCount} draft change${input.changedCount === 1 ? '' : 's'}`;
}
