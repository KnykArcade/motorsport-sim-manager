import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IsometricTrackMap } from './IsometricTrackMap';
import type { TrackDot } from './RaceTrack2D';
import type { TrackMapGeometry } from '../data/trackMaps/trackMapGeometry';

const geometry: TrackMapGeometry = {
  id: 'test-circuit',
  name: 'Test Circuit',
  series: 'F1',
  year: 2023,
  svgFile: 'test.svg',
  bounds: { minX: 0, minY: 0, width: 1, height: 1 },
  points: [
    [0.2, 0.2],
    [0.5, 0.1],
    [0.8, 0.2],
    [0.9, 0.5],
    [0.8, 0.8],
    [0.5, 0.9],
    [0.2, 0.8],
    [0.1, 0.5],
  ],
};

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
  },
  {
    driverId: 'driver-2',
    label: '29',
    color: '#38bdf8',
    accentColor: '#ffffff',
    isPlayer: true,
    running: true,
    inPit: false,
    rank: 2,
    trackProgress: 0.18,
  },
  {
    driverId: 'driver-3',
    label: '3',
    color: '#ef4444',
    isPlayer: false,
    running: false,
    retired: true,
    inPit: false,
    rank: 3,
    trackProgress: 0.12,
  },
];

describe('IsometricTrackMap', () => {
  it('renders the isometric track map with a path and cars', () => {
    const html = renderToStaticMarkup(<IsometricTrackMap geometry={geometry} dots={dots} rotation={0} />);

    expect(html).toContain('data-isometric-track-map="test-circuit"');
    expect(html).toContain('ISOMETRIC PROTOTYPE');
    expect(html).toContain('TEST CIRCUIT');
    expect(html).toContain('data-isometric-car="driver-1"');
    expect(html).toContain('data-isometric-car="driver-2"');
    expect(html).toContain('RETIRED');
  });

  it('renders pit cars in the pit lane strip', () => {
    const pitDots: TrackDot[] = [
      ...dots,
      {
        driverId: 'driver-4',
        label: '4',
        color: '#22c55e',
        isPlayer: false,
        running: true,
        inPit: true,
        rank: 4,
      },
    ];
    const html = renderToStaticMarkup(<IsometricTrackMap geometry={geometry} dots={pitDots} rotation={0} />);

    expect(html).toContain('PIT');
    expect(html).toContain('data-isometric-side-car="driver-4"');
  });
});
