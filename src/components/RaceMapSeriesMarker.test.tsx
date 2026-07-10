import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RaceMapSeriesMarker } from './RaceMapSeriesMarker';

describe('RaceMapSeriesMarker', () => {
  it.each([
    ['nascar', 'nascar_a'],
    ['f1', 'f1_a'],
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
    expect(html).toContain('data-layer="white-keyline"');
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

  it('uses the secondary color for the F1 band and both open-wheel nose triangles', () => {
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
    expect(html).toContain('transform="translate(3.25 0)"');
    expect(html).toContain('transform="rotate(-45)"');
    expect(html.indexOf('transform="rotate(45)"')).toBeLessThan(html.indexOf('transform="rotate(-45)"'));
  });

  it('scales the complete vector marker to the requested gameplay footprint', () => {
    const html = renderToStaticMarkup(
      <RaceMapSeriesMarker x={0} y={0} series="cart" number="33" primaryColor="#008c94" size={10} />,
    );
    expect(html).toContain('transform="translate(0 0) scale(0.5)"');
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
    expect(html).toContain('data-race-map-marker="f1_a"');
    expect(html).not.toContain('data-layer="runtime-number"');
  });
});
