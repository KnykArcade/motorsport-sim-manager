/// <reference types="node" />

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import designs from './seriesRasterMarkerDesigns.json';

const root = resolve(import.meta.dirname, '../..');

function pngHeader(publicPath: string) {
  const bytes = readFileSync(resolve(root, 'public', publicPath.replace(/^\//, '')));
  return {
    signature: bytes.subarray(1, 4).toString('ascii'),
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes[24],
    colorType: bytes[25],
  };
}

describe('locked NASCAR, IndyCar and CART raster assets', () => {
  it('contains every approved series and era without combining or omitting one', () => {
    expect(Object.keys(designs)).toEqual([
      'nascar_1990s', 'nascar_2000s', 'nascar_2010s', 'nascar_2020s',
      'indycar_1990s', 'indycar_2000s', 'indycar_2010s', 'indycar_2020s',
      'cart_1990s', 'cart_2000s',
    ]);
  });

  it.each(Object.entries(designs))('%s uses a 512px transparent numberless layer kit', (_assetId, design) => {
    expect(design.canvasSize).toBe(512);
    expect(design.forwardAxis).toBe('+x');
    expect(design.gameplayFootprint).toBe(40);
    expect(design.numberDecal).toBe(false);
    expect(design.identification).toBe('hover and keyboard focus only');

    for (const publicPath of Object.values(design.assets)) {
      expect(existsSync(resolve(root, 'public', publicPath.replace(/^\//, '')))).toBe(true);
      expect(pngHeader(publicPath)).toEqual({
        signature: 'PNG',
        width: 512,
        height: 512,
        bitDepth: 8,
        colorType: 6,
      });
    }
  });

  it('keeps the approved large-design review source in the repository', () => {
    expect(existsSync(resolve(root, 'artwork/series-markers/approved/gate1-large-design-review.png'))).toBe(true);
  });
});
