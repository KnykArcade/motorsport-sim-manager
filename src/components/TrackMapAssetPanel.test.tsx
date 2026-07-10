import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TrackMapAssetPanel } from './TrackMapAssetPanel';
import type { TrackDot } from './RaceTrack2D';

const dots: TrackDot[] = [
  {
    driverId: 'driver-1',
    label: '1',
    color: '#facc15',
    year: 1995,
    driverName: 'Ayrton Senna',
    teamName: 'McLaren Honda',
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
    year: 1995,
    driverName: 'Nigel Mansell',
    teamName: 'Williams Renault',
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
    year: 1995,
    driverName: 'Alain Prost',
    teamName: 'Ferrari',
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
    expect(html).toContain('PIT');
    expect(html).toContain('29');
    expect(html).toContain('#29 Nigel Mansell, Williams Renault · P2, 1.4s behind leader');
    expect(html).toContain('data-marker-tooltip="true"');
    expect(html).toContain('data-race-map-marker="f1_1990s"');
    expect(html).not.toContain('S/F');
    expect(html).not.toContain('S1');
    expect(html).not.toContain('S2');
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
    expect(html).toContain('#29 Nigel Mansell, Williams Renault · P2');
    expect(html).toContain('data-marker-tooltip="true"');
  });

  it('renders historic Kyalami with a wide 2.5D racing surface and close-racing offsets', () => {
    const kyalamiDots: TrackDot[] = [
      { ...dots[0], driverId: 'mansell', label: '5', year: 1992, trackProgress: 0.2, rank: 1 },
      { ...dots[1], driverId: 'patrese', label: '6', year: 1992, trackProgress: 0.207, rank: 2 },
    ];
    const html = renderToStaticMarkup(
      <TrackMapAssetPanel
        series="F1"
        year={1992}
        trackId="kyalami-grand-prix-circuit-1992"
        trackName="Kyalami Grand Prix Circuit"
        dots={kyalamiDots}
        rotation={0.2}
        eraTheme="f1-1990s"
      />,
    );

    expect(html).toContain('data-track-style="historic-kyalami-2.5d"');
    expect(html).toContain('data-track-surface-width="38"');
    expect(html).toContain('data-track-layer="drop-shadow"');
    expect(html).toContain('data-track-layer="racing-surface"');
    expect(html).toContain('data-close-racing-lane-offset="7"');
    expect(html).toContain('data-race-map-marker="f1_1990s"');
    expect(html).toContain('data-marker-year="1992"');
  });
});
