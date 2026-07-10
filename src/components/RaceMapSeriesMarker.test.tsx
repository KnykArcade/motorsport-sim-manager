import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GAMEPLAY_MARKER_SIZE, RaceMapSeriesMarker } from './RaceMapSeriesMarker';

describe('RaceMapSeriesMarker', () => {
  it.each([
    ['nascar', 1995, 'nascar_1990s', 'nascar', '1990s'],
    ['nascar', 2007, 'nascar_2000s', 'nascar', '2000s'],
    ['nascar', 2018, 'nascar_2010s', 'nascar', '2010s'],
    ['nascar', 2026, 'nascar_2020s', 'nascar', '2020s'],
    ['indycar', 1997, 'indycar_1990s', 'indycar', '1990s'],
    ['indycar', 2008, 'indycar_2000s', 'indycar', '2000s'],
    ['indycar', 2017, 'indycar_2010s', 'indycar', '2010s'],
    ['indycar', 2025, 'indycar_2020s', 'indycar', '2020s'],
    ['cart', 1998, 'cart_1990s', 'cart', '1990s'],
    ['cart', 2003, 'cart_2000s', 'cart', '2000s'],
  ] as const)('renders the locked %s %i numberless raster', (series, year, assetId, directory, era) => {
    const html = renderToStaticMarkup(
      <RaceMapSeriesMarker
        x={0}
        y={0}
        series={series}
        year={year}
        number="123"
        primaryColor="#1255cc"
        accentColor="#ffcc00"
      />,
    );

    expect(html).toContain(`data-race-map-marker="${assetId}"`);
    expect(html).toContain(`data-marker-body="${assetId}"`);
    expect(html).toContain('data-raster-artwork="approved-raster"');
    expect(html).toContain('data-forward-axis="+x"');
    expect(html).toContain('data-identification="hover and keyboard focus only"');
    expect(html).toContain(`href="/assets/markers/${directory}/${era}/primary-shading.png"`);
    expect(html).toContain(`href="/assets/markers/${directory}/${era}/secondary-shading.png"`);
    expect(html).toContain(`href="/assets/markers/${directory}/${era}/fixed-details.png"`);
    expect(html).toContain(`href="/assets/markers/${directory}/${era}/silhouette-mask.png"`);
    expect(html).toContain('data-layer="primary"');
    expect(html).toContain('data-layer="secondary"');
    expect(html).toContain('data-layer="fixed-details"');
    expect(html).not.toContain('data-layer="runtime-number"');
    expect(html).not.toContain('>123<');
  });

  it.each([
    [1992, 'f1_1990s', '1990s'],
    [2005, 'f1_2000s', '2000s'],
    [2016, 'f1_2010s', '2010s'],
    [2024, 'f1_2020s', '2020s'],
  ] as const)('preserves the locked %i F1 artwork and front-nose number', (year, assetId, era) => {
    const html = renderToStaticMarkup(
      <RaceMapSeriesMarker x={0} y={0} series="f1" year={year} number="44" primaryColor="#00a19a" accentColor="#f7f7f7" />,
    );
    expect(html).toContain(`data-race-map-marker="${assetId}"`);
    expect(html).toContain('data-f1-artwork="approved-raster"');
    expect(html).toContain('data-number-location="front nose between front tyres"');
    expect(html).toContain(`href="/assets/markers/f1/${era}/fixed-details.png"`);
    expect(html.match(/data-layer="runtime-number"/g)).toHaveLength(1);
    expect(html).toContain('>44<');
  });

  it.each([
    [0, 'none', undefined],
    [10, 'light', '#FFD400'],
    [40, 'medium', '#FF7A00'],
    [75, 'high', '#FF2A2A'],
  ] as const)('uses the true raster silhouette for %i%% damage', (damagePercent, state, color) => {
    const html = renderToStaticMarkup(
      <RaceMapSeriesMarker x={0} y={0} series="indycar" year={2025} number="27" primaryColor="#147a31" damagePercent={damagePercent} />,
    );
    expect(html).toContain(`data-damage-state="${state}"`);
    if (color) {
      expect(html).toContain(`data-damage-outline="${state}"`);
      expect(html).toContain(`fill="${color}"`);
      expect(html).toContain('/assets/markers/indycar/2020s/silhouette-mask.png');
    } else {
      expect(html).not.toContain('data-damage-outline=');
    }
  });

  it('rotates numberless body and damage with the live heading', () => {
    const html = renderToStaticMarkup(
      <RaceMapSeriesMarker x={12} y={8} series="cart" year={2003} number="12" primaryColor="#1255cc" rotationDeg={45} damagePercent={80} />,
    );
    expect(html).toContain('transform="translate(12 8) scale(2)"');
    expect(html).toContain('transform="rotate(45)"');
    expect(html).not.toContain('data-number-counter-rotation');
    expect(html).not.toContain('data-layer="runtime-number"');
  });

  it('locks all live marker families to the approved 40px footprint', () => {
    expect(GAMEPLAY_MARKER_SIZE).toBe(40);
    for (const series of ['nascar', 'f1', 'indycar', 'cart'] as const) {
      const html = renderToStaticMarkup(
        <RaceMapSeriesMarker x={0} y={0} series={series} year={2024} number="5" primaryColor="#ef202b" size={GAMEPLAY_MARKER_SIZE} />,
      );
      expect(html).toContain('transform="translate(0 0) scale(2)"');
    }
  });

  it('keeps the player focus cue separate from the damage outline', () => {
    const html = renderToStaticMarkup(
      <RaceMapSeriesMarker x={0} y={0} series="nascar" year={1995} number="24" primaryColor="#1255cc" selected damagePercent={0} />,
    );
    expect(html).toContain('data-selected-focus="true"');
    expect(html).not.toContain('data-damage-outline=');
  });
});
