import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TrackMapAssetPanel } from './TrackMapAssetPanel';
import type { TrackDot } from './RaceTrack2D';

const dots: TrackDot[] = [
  {
    driverId: 'driver-1',
    label: '1',
    color: '#facc15',
    isPlayer: false,
    running: true,
    inPit: false,
    rank: 1,
    trackProgress: 0.2,
    gapToLeader: 0,
    interval: 0,
  },
  {
    driverId: 'driver-2',
    label: '29',
    color: '#38bdf8',
    isPlayer: true,
    running: true,
    inPit: false,
    rank: 2,
    trackProgress: 0.18,
    gapToLeader: 1.4,
    interval: 1.4,
  },
  {
    driverId: 'driver-3',
    label: '30',
    color: '#ef4444',
    isPlayer: true,
    running: true,
    inPit: true,
    rank: 3,
    trackProgress: 0.12,
    gapToLeader: 28.2,
    interval: 26.8,
  },
];

describe('TrackMapAssetPanel', () => {
  it('renders an asset-backed map with live driver dots', () => {
    const html = renderToStaticMarkup(
      <TrackMapAssetPanel
        series="F1"
        year={1995}
        trackId="autodromo-jose-carlos-pace"
        trackName="Autodromo Jose Carlos Pace"
        dots={dots}
        rotation={0.2}
        eraTheme="f1-1990s"
        className="h-full w-full"
      />,
    );

    expect(html).toContain('data-testid="track-map-asset-panel"');
    expect(html).toContain('AUTODROMO JOSE CARLOS PACE');
    expect(html).toContain('S/F');
    expect(html).toContain('PIT');
    expect(html).toContain('29');
    expect(html).toContain('P2 car 29, 1.4s behind leader');
    expect(html).not.toContain('DRS');
  });

  it('falls back to the generic oval when no asset matches', () => {
    const html = renderToStaticMarkup(
      <TrackMapAssetPanel
        series="F1"
        year={1995}
        trackId="unknown-test-track"
        trackName="Unknown Test Track"
        dots={dots}
        rotation={0.2}
      />,
    );

    expect(html).toContain('data-testid="track-map-asset-fallback"');
    expect(html).toContain('Live track map');
  });
});
