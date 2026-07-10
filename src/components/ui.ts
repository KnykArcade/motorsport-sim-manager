// Small presentation helpers shared across components.

// Map a 0-100 rating to a continuous traffic-light color.
export function ratingColor(value: number): string {
  const clamped = Math.max(0, Math.min(100, value));
  // Hue stops: red (0) -> orange (30) -> yellow (60) -> lime (90) -> green (120).
  let hue: number;
  if (clamped <= 25) {
    hue = (clamped / 25) * 30; // 0..30
  } else if (clamped <= 50) {
    hue = 30 + ((clamped - 25) / 25) * 30; // 30..60
  } else if (clamped <= 75) {
    hue = 60 + ((clamped - 50) / 25) * 30; // 60..90
  } else {
    hue = 90 + ((clamped - 75) / 25) * 30; // 90..120
  }
  return `hsl(${hue}, 80%, 50%)`;
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
