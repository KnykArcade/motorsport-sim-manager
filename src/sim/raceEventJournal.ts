import type { RaceEvent, RaceEventCategory } from '../types/simTypes';

const CATEGORY_LIMITS: Partial<Record<RaceEventCategory, number>> = {
  status: 1,
  strategy: 1,
  weather: 1,
  battle: 1,
};

const CATEGORY_COOLDOWNS: Partial<Record<RaceEventCategory, number>> = {
  status: 5,
  strategy: 3,
  battle: 4,
};

export function categorizeRaceEvent(event: RaceEvent): RaceEventCategory {
  if (event.category) return event.category;
  const text = event.text.toLowerCase();
  if (/(safety car|pace car|full.course|pit road|free pass|restart|red flag)/.test(text)) return 'race-control';
  if (/(weather|rain|wet track|drying|track is dry)/.test(text)) return 'weather';
  if (/(retir|failure|crash|contact|accident|puncture|damage worsening|spin|collision|dnf)/.test(text)) return 'incident';
  if (/(passes|overtak|defends|holds off|battle|attacking|passing attempt)/.test(text)) return 'battle';
  if (/(pit|tyre|tire|strategy|mode|analytics|recommendation|instruction|conserv|protect engine|pushing)/.test(text)) return 'strategy';
  return 'status';
}

export function curateRaceEvents(
  incoming: readonly RaceEvent[],
  existing: readonly RaceEvent[] = [],
): RaceEvent[] {
  const counts = new Map<string, number>();
  const lastLapByCategory = new Map<RaceEventCategory, number>();
  const seen = new Set(existing.map(eventKey));
  for (const event of existing) {
    const category = categorizeRaceEvent(event);
    counts.set(`${event.lap}:${category}`, (counts.get(`${event.lap}:${category}`) ?? 0) + 1);
    lastLapByCategory.set(category, Math.max(lastLapByCategory.get(category) ?? Number.NEGATIVE_INFINITY, event.lap));
  }

  const kept: RaceEvent[] = [];
  for (const raw of incoming) {
    const category = categorizeRaceEvent(raw);
    const event = raw.category === category ? raw : { ...raw, category };
    const key = eventKey(event);
    if (seen.has(key)) continue;
    const countKey = `${event.lap}:${category}`;
    const count = counts.get(countKey) ?? 0;
    const limit = CATEGORY_LIMITS[category];
    const protectedEvent = isProtectedEvent(event);
    if (limit != null && count >= limit && !protectedEvent) continue;
    const cooldown = CATEGORY_COOLDOWNS[category];
    const lastLap = lastLapByCategory.get(category) ?? Number.NEGATIVE_INFINITY;
    if (!protectedEvent && cooldown != null && lastLap !== event.lap && event.lap - lastLap < cooldown) continue;
    kept.push(event);
    seen.add(key);
    counts.set(countKey, count + 1);
    lastLapByCategory.set(category, event.lap);
  }
  return kept;
}

function isProtectedEvent(event: RaceEvent): boolean {
  if (event.category === 'incident' || event.category === 'race-control') return true;
  return /(pit stop|pits for|makes a scheduled stop|takes the safety-car pit stop|double-stack|forced to box)/i.test(event.text);
}

function eventKey(event: RaceEvent): string {
  return `${event.lap}:${categorizeRaceEvent(event)}:${event.text.trim().replace(/\s+/g, ' ').toLowerCase()}`;
}
