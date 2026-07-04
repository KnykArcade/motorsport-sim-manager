// Practice knowledge controls certainty, not raw performance.
//
// Before practice the team does not know exactly how good a setup is, how the
// tyres will behave, or how reliable the car is — it only has a wide estimate.
// Practice narrows those estimates. Low knowledge shows wide ranges (and hides
// exact component-fit values); high knowledge narrows the range toward an exact
// figure. Crucially, low knowledge does NOT make the car worse — it makes the
// team less certain.

import type { Estimate } from '../types/setupTypes';

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
function round(v: number): number {
  return Math.round(v);
}

// Knowledge at/above which an exact value is revealed instead of a range.
export const EXACT_KNOWLEDGE_THRESHOLD = 0.98;
// Knowledge below which per-component exact fit values are hidden entirely.
export const COMPONENT_REVEAL_THRESHOLD = 0.72;

// Build a knowledge-gated estimate around a value. `maxSpread` is the half-width
// of the range at zero knowledge; it shrinks linearly to zero as knowledge rises
// and an exact value is exposed once knowledge is high enough.
export function estimateFromKnowledge(
  value: number,
  knowledge: number,
  maxSpread: number,
  bounds?: { lo: number; hi: number },
): Estimate {
  const k = clamp01(knowledge);
  const spread = maxSpread * (1 - k);
  let low = value - spread;
  let high = value + spread;
  if (bounds) {
    low = Math.max(bounds.lo, low);
    high = Math.min(bounds.hi, high);
  }
  return {
    low: round(low),
    high: round(high),
    exact: k >= EXACT_KNOWLEDGE_THRESHOLD ? round(value) : undefined,
  };
}

// The Objective Setup Quality range shown in the workshop. Setup knowledge from
// practice narrows a ~±13 band (very wide) down toward the exact value.
export function setupQualityEstimate(quality: number, setupKnowledge: number): Estimate {
  return estimateFromKnowledge(quality, setupKnowledge, 20, { lo: 0, hi: 100 });
}

// Whether a per-component exact fit value may be shown. Below the reveal
// threshold the workshop shows a coarse range instead of the exact number.
export function canRevealComponentFit(setupKnowledge: number): boolean {
  return clamp01(setupKnowledge) >= COMPONENT_REVEAL_THRESHOLD;
}

export function componentFitEstimate(fit: number, setupKnowledge: number): Estimate {
  return estimateFromKnowledge(fit, setupKnowledge, 28, { lo: 0, hi: 100 });
}

// Predicted stint (pit) window. Tyre knowledge narrows the half-width from ~6
// laps (very uncertain) toward ~1 lap (dialled in). `center` is the best-guess
// optimal stint length.
export function stintWindowEstimate(center: number, tyreKnowledge: number): Estimate {
  const k = clamp01(tyreKnowledge);
  const half = 1 + (1 - k) * 5; // 6 at k=0 -> 1 at k=1
  return {
    low: Math.max(1, round(center - half)),
    high: round(center + half),
    exact: k >= EXACT_KNOWLEDGE_THRESHOLD ? round(center) : undefined,
  };
}

export type WarningConfidence = 'Low' | 'Medium' | 'High';

// How confident the team is in its reliability warnings. Higher reliability
// knowledge means earlier, more accurate warnings and a lower chance a hidden
// problem is missed until it fails.
export function reliabilityWarningConfidence(reliabilityKnowledge: number): WarningConfidence {
  const k = clamp01(reliabilityKnowledge);
  if (k >= 0.66) return 'High';
  if (k >= 0.33) return 'Medium';
  return 'Low';
}

// The fraction of a full warning lead-time the team gets, scaled by knowledge:
// low knowledge => warnings come late (or not at all); high knowledge => early.
export function reliabilityWarningLead(reliabilityKnowledge: number): number {
  return clamp01(0.25 + clamp01(reliabilityKnowledge) * 0.75);
}

// Tyre-strategy (pit / undercut) confidence follows tyre knowledge on the same
// three-band scale.
export function tyreStrategyConfidence(tyreKnowledge: number): WarningConfidence {
  const k = clamp01(tyreKnowledge);
  if (k >= 0.66) return 'High';
  if (k >= 0.33) return 'Medium';
  return 'Low';
}
