// Small presentation helpers shared across components.

// Map a 1-10 rating to a traffic-light color.
export function ratingColor(value: number): string {
  if (value >= 8) return '#22c55e'; // green
  if (value >= 6) return '#84cc16'; // lime
  if (value >= 4) return '#eab308'; // yellow
  if (value >= 2.5) return '#f97316'; // orange
  return '#ef4444'; // red
}

export function ratingTextColor(value: number): string {
  return ratingColor(value);
}

export function formatMoney(amount: number): string {
  const millions = amount / 1_000_000;
  if (Math.abs(millions) >= 1) {
    return `$${millions.toFixed(1)}M`;
  }
  return `$${Math.round(amount / 1000)}K`;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
