import { describe, expect, it } from 'vitest';
import { defaultPaddockTab, paddockEventDestination } from './paddockAgendaViewModel';

describe('paddockAgendaViewModel', () => {
  it('opens required operations in the focused decisions agenda', () => {
    const destination = paddockEventDestination({
      id: 'ops/event',
      weekId: 'week-1',
      season: 1995,
      series: 'F1',
      round: 1,
      category: 'general_team',
      title: 'Operations decision',
      description: 'Choose a plan.',
      severity: 'critical',
      isRequiredDecision: true,
      options: [{ id: 'approve', label: 'Approve', description: 'Approve it.' }],
      effectsApplied: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(destination.route).toBe('/paddock?tab=decisions&focus=ops%2Fevent');
    expect(destination.routeLabel).toBe('Open Operations Agenda');
  });

  it('opens character decisions in the people attention agenda', () => {
    const destination = paddockEventDestination({
      id: 'people-event',
      weekId: 'week-1',
      season: 1995,
      series: 'F1',
      round: 1,
      category: 'driver_morale',
      title: 'Driver request',
      description: 'A driver needs a response.',
      severity: 'critical',
      isRequiredDecision: true,
      options: [{ id: 'listen', label: 'Listen', description: 'Listen.' }],
      effectsApplied: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      characterRequest: {
        targetType: 'Driver',
        targetId: 'driver-1',
        targetName: 'Driver One',
        requestKind: 'DriverConcern',
      },
    });
    expect(destination.route).toBe('/paddock?tab=people&section=attention&focus=people-event');
  });

  it('prioritizes decisions until blockers and race package work are complete', () => {
    expect(defaultPaddockTab(true, true)).toBe('decisions');
    expect(defaultPaddockTab(false, false)).toBe('decisions');
    expect(defaultPaddockTab(false, true)).toBe('people');
  });
});
