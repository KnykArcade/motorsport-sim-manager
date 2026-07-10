import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RaceMapSeriesMarker } from './RaceMapSeriesMarker';

describe('RaceMapSeriesMarker', () => {
  it('renders the base marker PNG for the requested series', () => {
    const html = renderToStaticMarkup(
      <RaceMapSeriesMarker x={0} y={0} series="nascar" number="33" primaryColor="#ff0000" rotationDeg={0} />,
    );
    expect(html).toContain('/assets/markers/base/20px/nascar_a.png');
    expect(html).toContain('>33<');
    expect(html).toContain('flood-color="#ff0000"');
  });

  it('rotates the base marker and counter-rotates the number plate', () => {
    const html = renderToStaticMarkup(
      <RaceMapSeriesMarker x={0} y={0} series="f1" number="1" primaryColor="#ff0000" rotationDeg={45} />,
    );
    expect(html).toContain('rotate(45)');
    expect(html).toContain('rotate(-45)');
    expect(html).toContain('>1<');
  });

  it('renders the light damage overlay for moderate damage', () => {
    const html = renderToStaticMarkup(
      <RaceMapSeriesMarker x={0} y={0} series="f1" number="5" primaryColor="#ff0000" damagePercent={25} />,
    );
    expect(html).toContain('/assets/markers/damage/20px/f1_a_light.png');
    expect(html).not.toContain('critical_frame');
  });

  it('renders the critical frame animation for heavy damage', () => {
    const html = renderToStaticMarkup(
      <RaceMapSeriesMarker x={0} y={0} series="indycar" number="7" primaryColor="#ff0000" damagePercent={90} />,
    );
    expect(html).toContain('/assets/markers/critical/20px/indycar_b_critical_frame_');
  });

  it('hides the number plate when the number is empty', () => {
    const html = renderToStaticMarkup(
      <RaceMapSeriesMarker x={0} y={0} series="f1" number="" primaryColor="#facc15" />,
    );
    expect(html).not.toContain('>33<');
  });
});
