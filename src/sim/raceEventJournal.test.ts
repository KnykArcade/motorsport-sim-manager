import { describe, expect, it } from 'vitest';
import type { RaceEvent } from '../types/simTypes';
import { categorizeRaceEvent, curateRaceEvents } from './raceEventJournal';

describe('race event journal curation', () => {
  it('assigns explicit categories to legacy uncategorized events', () => {
    expect(categorizeRaceEvent({ lap: 5, text: 'Safety car deployed.' })).toBe('race-control');
    expect(categorizeRaceEvent({ lap: 5, text: 'Rain begins to fall.' })).toBe('weather');
    expect(categorizeRaceEvent({ lap: 5, text: 'Driver retires with engine failure.' })).toBe('incident');
    expect(categorizeRaceEvent({ lap: 5, text: 'Driver passes rival for P4.' })).toBe('battle');
    expect(categorizeRaceEvent({ lap: 5, text: 'Analytics recommends a pit stop.' })).toBe('strategy');
  });

  it('deduplicates identical events and respects existing events from the same lap', () => {
    const existing: RaceEvent[] = [{ lap: 8, text: 'Routine update one.', category: 'status' }];
    const kept = curateRaceEvents([
      { lap: 8, text: 'Routine update one.' },
      { lap: 8, text: 'Routine update two.' },
      { lap: 8, text: 'Routine update three.' },
    ], existing);
    expect(kept).toHaveLength(0);
  });

  it('caps routine categories while preserving incidents and race-control messages', () => {
    const events: RaceEvent[] = [
      ...Array.from({ length: 5 }, (_, index) => ({ lap: 10, text: `Status ${index}.`, category: 'status' as const })),
      ...Array.from({ length: 4 }, (_, index) => ({ lap: 10, text: `Driver ${index} retires.`, category: 'incident' as const })),
      ...Array.from({ length: 3 }, (_, index) => ({ lap: 10, text: `Race-control notice ${index}.`, category: 'race-control' as const })),
    ];
    const kept = curateRaceEvents(events);
    expect(kept.filter((event) => event.category === 'status')).toHaveLength(1);
    expect(kept.filter((event) => event.category === 'incident')).toHaveLength(4);
    expect(kept.filter((event) => event.category === 'race-control')).toHaveLength(3);
  });

  it('spaces routine status updates across laps', () => {
    const existing: RaceEvent[] = [{ lap: 10, text: 'Previous status.', category: 'status' }];
    expect(curateRaceEvents([{ lap: 11, text: 'Too soon.' }], existing)).toHaveLength(0);
    expect(curateRaceEvents([{ lap: 15, text: 'Useful update.' }], existing)).toHaveLength(1);
  });

  it('preserves physical pit events even when the strategy budget is full', () => {
    const events: RaceEvent[] = [
      ...Array.from({ length: 4 }, (_, index) => ({ lap: 12, text: `Strategy note ${index}.`, category: 'strategy' as const })),
      { lap: 12, text: 'Driver makes a scheduled stop.', category: 'strategy' as const },
    ];
    expect(curateRaceEvents(events).at(-1)?.text).toBe('Driver makes a scheduled stop.');
  });
});
