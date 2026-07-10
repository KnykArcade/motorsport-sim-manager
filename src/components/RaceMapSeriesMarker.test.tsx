import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { F1_GAMEPLAY_MARKER_SIZE, RaceMapSeriesMarker } from './RaceMapSeriesMarker';

describe('RaceMapSeriesMarker', () => {
  it.each([
    ['nascar', 'nascar_a'],
    ['f1', 'f1_1990s'],
    ['indycar', 'indycar_c'],
    ['cart', 'cart_c'],
  ] as const)('renders the approved %s finalist silhouette', (series, assetId) => {
    const html = renderToStaticMarkup(
      <RaceMapSeriesMarker
        x={0}
        y={0}
        series={series}
        number="33"
        primaryColor="#1255cc"
        accentColor="#ffcc00"
      />,
    );

    expect(html).toContain(`data-race-map-marker="${assetId}"`);
    expect(html).toContain(`data-marker-body="${assetId}"`);
    expect(html).toContain('data-layer="primary"');
    expect(html).toContain('data-layer="secondary"');
    expect(html).toContain(series === 'f1' ? 'data-layer="fixed-details"' : 'data-layer="white-keyline"');
    expect(html).toContain('data-layer="runtime-number"');
    expect(html).toContain('fill="#1255cc"');
    expect(html).toContain('#ffcc00');
    expect(html).toContain('>33<');
  });

  it('renders the NASCAR window net behind its runtime decal number', () => {
    const html = renderToStaticMarkup(
      <RaceMapSeriesMarker
        x={0}
        y={0}
        series="nascar"
        number="24"
        primaryColor="#1255cc"
        accentColor="#ffcc00"
      />,
    );

    expect(html).toContain('data-layer="window-net"');
    expect(html.indexOf('data-layer="window-net"')).toBeLessThan(html.indexOf('data-layer="runtime-number"'));
    expect(html.match(/data-layer="secondary"/g)).toHaveLength(2);
  });

  it('uses the secondary color for the F1 wings and both open-wheel nose triangles', () => {
    for (const series of ['f1', 'indycar', 'cart'] as const) {
      const html = renderToStaticMarkup(
        <RaceMapSeriesMarker
          x={0}
          y={0}
          series={series}
          number="44"
          primaryColor="#1248b5"
          accentColor="#ffe000"
        />,
      );
      expect(html).toContain('data-secondary-color="#ffe000"');
      expect(html).toMatch(/data-layer="secondary"/);
      expect(html).toContain('#ffe000');
    }
  });

  it.each([
    [1992, 'f1_1990s', '1990s'],
    [2005, 'f1_2000s', '2000s'],
    [2016, 'f1_2010s', '2010s'],
    [2024, 'f1_2020s', '2020s'],
  ] as const)('renders the locked %i F1 artwork with its number only on the front nose', (year, assetId, eraDirectory) => {
    const html = renderToStaticMarkup(
      <RaceMapSeriesMarker
        x={0}
        y={0}
        series="f1"
        year={year}
        number="44"
        primaryColor="#00a19a"
        accentColor="#f7f7f7"
      />,
    );

    expect(html).toContain(`data-race-map-marker="${assetId}"`);
    expect(html).toContain('data-f1-artwork="approved-raster"');
    expect(html).toContain('data-forward-axis="+x"');
    expect(html).toContain('data-number-location="front nose between front tyres"');
    expect(html).toContain('data-layer="front-number-plate"');
    expect(html).toContain(`href="/assets/markers/f1/${eraDirectory}/primary-shading.png"`);
    expect(html).toContain(`href="/assets/markers/f1/${eraDirectory}/secondary-shading.png"`);
    expect(html).toContain(`href="/assets/markers/f1/${eraDirectory}/fixed-details.png"`);
    expect(html).toContain(`href="/assets/markers/f1/${eraDirectory}/silhouette-mask.png"`);
    expect(html).toContain('data-layer="primary-shading"');
    expect(html).toContain('data-layer="secondary-shading"');
    expect(html).toContain('data-layer="fixed-details"');
    expect(html.match(/data-layer="runtime-number"/g)).toHaveLength(1);
    expect(html).not.toContain('data-layer="rear-number"');
  });

  it.each([
    [0, 'none', undefined],
    [9, 'none', undefined],
    [10, 'light', '#FFD400'],
    [39, 'light', '#FFD400'],
    [40, 'medium', '#FF7A00'],
    [74, 'medium', '#FF7A00'],
    [75, 'high', '#FF2A2A'],
    [100, 'high', '#FF2A2A'],
  ] as const)('maps %i%% damage to the static %s outline', (damagePercent, state, color) => {
    const html = renderToStaticMarkup(
      <RaceMapSeriesMarker
        x={0}
        y={0}
        series="indycar"
        number="60"
        primaryColor="#147a31"
        accentColor="#ffd400"
        damagePercent={damagePercent}
      />,
    );

    expect(html).toContain(`data-damage-state="${state}"`);
    if (color) {
      expect(html).toContain(`data-damage-outline="${state}"`);
      expect(html).toContain(`stroke="${color}"`);
    } else {
      expect(html).not.toContain('data-damage-outline=');
    }
    expect(html).not.toContain('critical_frame');
  });

  it('rotates body and damage with heading while the anchored number remains upright', () => {
    const html = renderToStaticMarkup(
      <RaceMapSeriesMarker
        x={12}
        y={8}
        series="f1"
        number="44"
        primaryColor="#1255cc"
        accentColor="#ffcc00"
        rotationDeg={45}
        damagePercent={80}
      />,
    );

    expect(html).toContain('transform="translate(12 8) scale(1)"');
    expect(html).toContain('transform="rotate(45)"');
    expect(html).toContain('transform="translate(6.562 0.059)"');
    expect(html).toContain('data-number-location="front nose between front tyres"');
    expect(html).toContain('fill="#FF2A2A"');
    expect(html).toContain('transform="rotate(-45)"');
    expect(html.indexOf('transform="rotate(45)"')).toBeLessThan(html.indexOf('transform="rotate(-45)"'));
  });

  it('scales the complete marker to the requested gameplay footprint', () => {
    const html = renderToStaticMarkup(
      <RaceMapSeriesMarker x={0} y={0} series="cart" number="33" primaryColor="#008c94" size={10} />,
    );
    expect(html).toContain('transform="translate(0 0) scale(0.5)"');
  });

  it('locks live F1 markers to the approved 40px gameplay footprint', () => {
    const html = renderToStaticMarkup(
      <RaceMapSeriesMarker
        x={0}
        y={0}
        series="f1"
        year={1992}
        number="5"
        primaryColor="#ef202b"
        size={F1_GAMEPLAY_MARKER_SIZE}
      />,
    );
    expect(F1_GAMEPLAY_MARKER_SIZE).toBe(40);
    expect(html).toContain('transform="translate(0 0) scale(2)"');
  });

  it('keeps the player focus cue visually separate from the damage outline', () => {
    const html = renderToStaticMarkup(
      <RaceMapSeriesMarker
        x={0}
        y={0}
        series="nascar"
        number="24"
        primaryColor="#1255cc"
        accentColor="#f7f7f7"
        selected
        damagePercent={0}
      />,
    );
    expect(html).toContain('data-selected-focus="true"');
    expect(html).not.toContain('data-damage-outline=');
    expect(html).not.toContain('#FFD400');
  });

  it('hides only the number when the runtime number is empty', () => {
    const html = renderToStaticMarkup(
      <RaceMapSeriesMarker x={0} y={0} series="f1" number="" primaryColor="#facc15" />,
    );
    expect(html).toContain('data-race-map-marker="f1_1990s"');
    expect(html).not.toContain('data-layer="runtime-number"');
  });
});
