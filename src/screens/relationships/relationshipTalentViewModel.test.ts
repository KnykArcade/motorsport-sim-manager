import { describe, expect, it } from 'vitest';
import { externalTalentContext } from './relationshipTalentViewModel';

describe('external talent relationship context', () => {
  it('keeps rank eight stable when the player has no recruitment context', () => {
    const context = externalTalentContext({
      preseason: false,
      openRaceSeats: 0,
      staffVacancies: 0,
      pendingDrivers: [],
      scoutedDrivers: [],
      approachedStaff: [],
    });

    expect(context).toMatchObject({ authorityRank: 8, status: 'Stable', targets: [] });
    expect(context.reasons[0]).toContain('No active scouting');
  });

  it('raises a compulsory preseason seat above ordinary recruitment monitoring', () => {
    const context = externalTalentContext({
      preseason: true,
      openRaceSeats: 1,
      staffVacancies: 0,
      pendingDrivers: [],
      scoutedDrivers: [],
      approachedStaff: [],
    });

    expect(context.status).toBe('MustActNow');
    expect(context.reasons[0]).toContain('must be filled');
  });

  it('shows only live scouting, approach, and agreement signals in priority order', () => {
    const context = externalTalentContext({
      preseason: false,
      openRaceSeats: 0,
      staffVacancies: 0,
      pendingDrivers: [{ id: 'driver-signed', name: 'Signed Driver' }],
      scoutedDrivers: [
        { id: 'driver-signed', name: 'Signed Driver', scoutingLevel: 80, accuracy: 0.8 },
        { id: 'driver-scouted', name: 'Scouted Driver', scoutingLevel: 45, accuracy: 0.61 },
      ],
      approachedStaff: [{ id: 'staff-1', name: 'Staff Candidate', interest: 40 }],
    });

    expect(context.status).toBe('WatchClosely');
    expect(context.targets.map((target) => [target.name, target.signal])).toEqual([
      ['Signed Driver', 'Signing pending'],
      ['Staff Candidate', 'Approach made'],
      ['Scouted Driver', 'Scouting active'],
    ]);
    expect(context.targets[1].detail).toContain('10% signing-fee reduction');
  });
});
