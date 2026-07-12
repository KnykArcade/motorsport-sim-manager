import type { RaceEvent, RaceEventCategory } from '../types/simTypes';

const CATEGORY_LIMITS: Partial<Record<RaceEventCategory, number>> = {
  status: 2,
  strategy: 4,
  weather: 1,
  battle: 3,
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
  const seen = new Set(existing.map(eventKey));
  for (const event of existing) {
    const category = categorizeRaceEvent(event);
    counts.set(`${event.lap}:${category}`, (counts.get(`${event.lap}:${category}`) ?? 0) + 1);
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
    if (limit != null && count >= limit && !isProtectedEvent(event)) continue;
    kept.push(event);
    seen.add(key);
    counts.set(countKey, count + 1);
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
