import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BALANCED_SETUP } from '../data/setup/setupComponents';
import { drivers1995 } from '../data/drivers/drivers1995';
import { tracks1995 } from '../data/tracks/tracks1995';
import { SetupWorkshop } from './SetupWorkshop';
import type { StaffMember } from '../types/staffTypes';

const raceEngineer: StaffMember = {
  id: 'workshop-engineer',
  name: 'Alex Morgan',
  role: 'Race Engineer',
  nationality: 'GB',
  rating: 78,
  salary: 2,
  signingFee: 0.5,
  bio: 'Setup specialist.',
};

describe('SetupWorkshop', () => {
  it('renders a single full-height adjustment workspace with visible setup deltas', () => {
    const drivers = drivers1995.slice(0, 2);
    const baselineSetups = Object.fromEntries(drivers.map((driver) => [driver.id, BALANCED_SETUP]));
    const setups = {
      ...baselineSetups,
      [drivers[0].id]: { ...BALANCED_SETUP, frontWing: 6 },
    };
    const html = renderToStaticMarkup(
      <SetupWorkshop
        track={tracks1995[0]}
        drivers={drivers}
        setups={setups}
        baselineSetups={baselineSetups}
        engineer={raceEngineer}
        onChangeParam={() => undefined}
        onApplySetup={() => undefined}
        onCopy={() => undefined}
        onConfirm={() => undefined}
      />,
    );

    expect(html).toContain('data-testid="setup-workshop"');
    expect(html).toContain('data-testid="setup-param-frontWing"');
    expect(html).toContain('5.0 → 6.0 (+1.0)');
    expect(html).toContain('1 changed');
    expect(html).toContain('Revert component');
    expect(html).toContain('Revert driver');
    expect(html).toContain('Alex Morgan');
    expect(html).toContain('Engineer confidence');
    expect(html).toContain('Evidence quality');
    expect(html.match(/Confirm setup/g)).toHaveLength(1);
    expect(html).not.toContain('max-h-[28rem]');
  });

  it('shows post-qualifying and parc ferme context without hiding locked reasons', () => {
    const driver = drivers1995[0];
    const html = renderToStaticMarkup(
      <SetupWorkshop
        track={tracks1995[0]}
        drivers={[driver]}
        setups={{ [driver.id]: BALANCED_SETUP }}
        baselineSetups={{ [driver.id]: BALANCED_SETUP }}
        engineer={raceEngineer}
        stage="PostQualifying"
        setupLock={{
          active: true,
          label: 'Parc fermé active',
          description: 'Only permitted adjustments remain available.',
          allowedParams: ['frontWing'],
        }}
        onChangeParam={() => undefined}
        onApplySetup={() => undefined}
        onCopy={() => undefined}
      />,
    );

    expect(html).toContain('Post-qualifying setup review');
    expect(html).toContain('Parc fermé active');
    expect(html).toContain('Only permitted adjustments remain available.');
    expect(html).toContain('Increase Front Wing');
  });
});
