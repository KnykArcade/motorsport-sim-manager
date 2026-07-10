/// <reference types="node" />

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import designs from './f1RasterMarkerDesigns.json';

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

describe('locked F1 raster marker assets', () => {
  it.each(Object.entries(designs))('%s uses a 512px transparent layered master', (_assetId, design) => {
    expect(design.canvasSize).toBe(512);
    expect(design.forwardAxis).toBe('+x');
    expect(design.numberLocation).toBe('front nose between front tyres');
    expect(design.numberAnchor.x).toBeGreaterThan(0);
    expect(Math.abs(design.numberAnchor.y)).toBeLessThan(0.25);

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

  it('keeps all four approved authoring sources in the repository', () => {
    for (const era of ['1990s', '2000s', '2010s', '2020s']) {
      expect(existsSync(resolve(root, `artwork/f1-markers/approved/${era}.png`))).toBe(true);
    }
  });
});
