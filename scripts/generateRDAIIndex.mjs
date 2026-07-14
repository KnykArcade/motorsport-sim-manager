import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sourcePath = resolve('src/data/rd/rdNodes.generated.ts');
const outputPath = resolve('src/data/rd/rdAIIndex.generated.ts');
const source = readFileSync(sourcePath, 'utf8');
const startMarker = 'export const rdNodeCatalog = ';
const start = source.indexOf(startMarker);
const end = source.lastIndexOf('] as const satisfies readonly RDNodeDefinition[];');
if (start < 0 || end < 0) throw new Error('Unable to locate generated R&D catalog array.');

const json = source.slice(start + startMarker.length, end + 1);
const nodes = JSON.parse(json);
const compact = nodes.map((node) => {
  const hybridOnly = /hybrid[- ]only/i.test(`${node.eraNotes} ${node.mainEffects}`);
  return [node.id, node.name, node.tier, hybridOnly ? 1 : 0];
});

const output = `// Generated compact runtime index for AI technical directors.\n// Keeps the complete 430-node identity/tier map out of the large workbook catalog.\n\nexport const AI_RD_NODE_INDEX = ${JSON.stringify(compact, null, 2)} as const;\n`;
writeFileSync(outputPath, output);
console.log(`Generated ${compact.length} compact AI R&D nodes.`);
