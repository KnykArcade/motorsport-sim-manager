import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TrackMapMarker, resolveTrackMapMarkerVariant, headingOnOval } from './TrackMapMarker';

describe('TrackMapMarker', () => {
  it('resolves era-specific variants with fallback', () => {
    expect(resolveTrackMapMarkerVariant('F1', 1995)).toBe('f1-1990s');
    expect(resolveTrackMapMarkerVariant('NASCAR', 2018)).toBe('nascar-2010s');
    expect(resolveTrackMapMarkerVariant('IndyCar', 2024)).toBe('indycar-2020s');
    expect(resolveTrackMapMarkerVariant('CART', 2015)).toBe('f1-1990s');
  });

  it('renders a rotatable bubble-roof marker with the number pod', () => {
    const html = renderToStaticMarkup(
      <svg viewBox="0 0 100 100">
        <TrackMapMarker
          x={50}
          y={50}
          headingDeg={37}
          teamColor="#2563eb"
          number={33}
          variant="indycar-2010s"
          status={{ leader: true, player: true, inPit: true, damaged: true, fastestLap: true }}
        />
      </svg>,
    );

    expect(html).toContain('data-track-map-marker-variant="indycar-2010s"');
    expect(html).toContain('rotate(37)');
    expect(html).toContain('href="/assets/track-markers/v4/tight/indycar_2010s.png"');
    expect(html).toContain('dominant-baseline="middle"');
    expect(html).toContain('33');
    expect(html).toContain('fastest lap');
  });

  it('keeps the heading upright math stable on the oval', () => {
    expect(headingOnOval(0)).toBeCloseTo(0, 5);
  });
});
