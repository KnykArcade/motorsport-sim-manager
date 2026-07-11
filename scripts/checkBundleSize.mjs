import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const assetsDir = fileURLToPath(new URL('../dist/assets/', import.meta.url));
const maxChunkBytes = 2_500_000;
const entries = await readdir(assetsDir);
const chunks = [];

for (const entry of entries) {
  if (!entry.endsWith('.js')) continue;
  const info = await stat(join(assetsDir, entry));
  chunks.push({ entry, bytes: info.size });
}

chunks.sort((a, b) => b.bytes - a.bytes);
const oversized = chunks.filter(({ bytes }) => bytes > maxChunkBytes);
if (oversized.length) {
  for (const { entry, bytes } of oversized) {
    console.error(`${entry}: ${(bytes / 1_000_000).toFixed(2)} MB exceeds 2.50 MB`);
  }
  process.exit(1);
}

const largest = chunks[0];
console.log(`Bundle budget passed. Largest JS chunk: ${largest.entry} (${(largest.bytes / 1_000_000).toFixed(2)} MB)`);
