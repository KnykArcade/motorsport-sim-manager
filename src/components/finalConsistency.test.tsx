import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { LiveCarState } from '../types/liveTypes';
import { Button } from './Button';
import { WorkspaceTabs } from './workspace/Workspace';
import { TimingTower } from '../screens/liveRace/TimingTower';
import { Modal } from '../screens/liveRace/modals';

describe('final UI consistency', () => {
  it('defaults shared buttons to non-submit controls', () => {
    expect(renderToStaticMarkup(<Button>Save</Button>)).toContain('type="button"');
    expect(renderToStaticMarkup(<Button type="submit">Confirm</Button>)).toContain('type="submit"');
  });

  it('uses one accessible tab contract for shared workspace tabs', () => {
    const html = renderToStaticMarkup(
      <WorkspaceTabs
        items={[
          { id: 'overview', label: 'Overview' },
          { id: 'locked', label: 'Locked', disabled: true, disabledReason: 'Complete the review first.' },
        ]}
        active="overview"
        onChange={vi.fn()}
        ariaLabel="Test sections"
      />,
    );
    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('title="Complete the review first."');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('aria-label="Locked. Unavailable: Complete the review first."');
  });

  it('gives the timing tower keyboard-focusable driver selection and tab semantics', () => {
    const car = {
      driverId: 'driver-1',
      teamId: 'team-1',
      isPlayer: true,
      grid: 3,
      position: 2,
      running: true,
      status: 'Running',
      lastLapTime: 90,
      gapToLeader: 1.2,
      interval: 1.2,
      lapsBehindLeader: 0,
      lapsBehindCarAhead: 0,
      tire: { compound: 'Dry', wear: 15, age: 4 },
      pit: { stopsMade: 0, plannedStops: 1, scheduledLaps: [], pitRequested: false },
      reliabilityRiskLevel: 'Low',
      crashRiskLevel: 'Low',
    } as unknown as LiveCarState;
    const html = renderToStaticMarkup(
      <TimingTower
        cars={[car]}
        nameOf={() => 'Alex Driver'}
        colorOf={() => '#ffffff'}
        selectedDriverId="driver-1"
        onSelectDriver={vi.fn()}
      />,
    );
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Focus Alex Driver"');
    expect(html).toContain('aria-pressed="true"');
  });

  it('labels shared live-race dialogs and their close control', () => {
    const html = renderToStaticMarkup(
      <Modal title="Full Event Log" onClose={vi.fn()}>
        Race events
      </Modal>,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby=');
    expect(html).toContain('aria-label="Close Full Event Log"');
  });
});
