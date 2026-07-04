// Numeric guards for Car Setup state and display.
//
// The Car Setup screen computes scores from a per-driver CarSetup. If any slider
// value is missing (e.g. a draft object built by spreading over an undefined
// entry), the downstream maths produced NaN and the UI showed "NaN–NaN / 100".
// These helpers keep the setup state fully numeric and clamp/validate every value
// so the workbench always has a valid baseline — no Reset-to-Practiced required.

import type { CarSetup } from '../types/setupTypes';
import { BALANCED_SETUP } from '../data/setup/setupComponents';

export const SETUP_MIN = 1;
export const SETUP_MAX = 10;

// A finite, non-NaN number.
export function isValidSetupValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

// Clamp a value into the valid 1-10 slider range (rounded to half-step tuning).
export function clampSetupValue(value: number, min = SETUP_MIN, max = SETUP_MAX): number {
  return Math.max(min, Math.min(max, Math.round(value * 2) / 2));
}

// A valid, clamped slider value or the fallback when the input is missing/NaN.
export function sanitizeSetupValue(value: unknown, fallback: number): number {
  if (!isValidSetupValue(value)) return clampSetupValue(fallback);
  return clampSetupValue(value);
}

// Build a complete, valid CarSetup from a (possibly partial/undefined) setup,
// filling any missing or invalid field from `fallback` (balanced by default).
export function sanitizeSetupProfile(
  setup: Partial<CarSetup> | null | undefined,
  fallback: CarSetup = BALANCED_SETUP,
): CarSetup {
  const out = {} as CarSetup;
  for (const key of Object.keys(BALANCED_SETUP) as (keyof CarSetup)[]) {
    out[key] = sanitizeSetupValue(setup?.[key], fallback[key]);
  }
  return out;
}

// Average of the finite values, or the fallback for an empty/all-invalid array.
export function safeAverage(values: number[], fallback = 0): number {
  const valid = values.filter(isValidSetupValue);
  if (valid.length === 0) return fallback;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

// A finite score or the fallback (never NaN/Infinity).
export function safeScore(value: unknown, fallback = 0): number {
  return isValidSetupValue(value) ? value : fallback;
}

// Format a single score for display; invalid values render as a placeholder.
export function formatSetupScore(value: unknown, placeholder = 'Estimating'): string {
  if (!isValidSetupValue(value)) return placeholder;
  return `${Math.round(value)}`;
}

// Format a low–high range for display. Collapses to a single value when equal
// and renders a placeholder rather than "NaN–NaN" for invalid bounds.
export function formatSetupRange(
  low: unknown,
  high: unknown,
  placeholder = 'Estimating',
): string {
  const lo = isValidSetupValue(low) ? Math.round(low) : null;
  const hi = isValidSetupValue(high) ? Math.round(high) : null;
  if (lo == null && hi == null) return placeholder;
  if (lo == null) return `${hi}`;
  if (hi == null) return `${lo}`;
  return lo === hi ? `${lo}` : `${lo}–${hi}`;
}
