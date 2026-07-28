import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const nodeVersion = (await readFile(new URL('../.nvmrc', import.meta.url), 'utf8')).trim();
const packageJson = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
);
const devcontainer = JSON.parse(
  await readFile(new URL('../.devcontainer/devcontainer.json', import.meta.url), 'utf8'),
);
const workflowUrls = [
  new URL('../.github/workflows/ci.yml', import.meta.url),
  new URL('../.github/workflows/master-data-release.yml', import.meta.url),
];
const workflows = await Promise.all(workflowUrls.map((url) => readFile(url, 'utf8')));

assert.match(nodeVersion, /^22\.\d+\.\d+$/, '.nvmrc must pin an exact Node 22 release');
assert.equal(
  packageJson.packageManager,
  'npm@10.9.8',
  'packageManager must pin the supported npm release',
);
assert.equal(
  packageJson.engines?.node,
  '>=22.22.0 <23',
  'package.json must reject unsupported Node releases',
);
assert.equal(
  packageJson.engines?.npm,
  '>=10 <11',
  'package.json must reject unsupported npm releases',
);
assert.match(
  devcontainer.image,
  /javascript-node:1-22-/,
  'Codespaces must use the Node 22 devcontainer image',
);
assert.equal(
  devcontainer.postCreateCommand,
  'npm ci',
  'Codespaces must install the locked dependency tree',
);
assert.ok(
  devcontainer.forwardPorts?.includes(5173),
  'Codespaces must forward the Vite development port',
);
assert.equal(
  devcontainer.portsAttributes?.['5173']?.onAutoForward,
  'openBrowser',
  'Codespaces must open the forwarded game preview',
);

for (const workflow of workflows) {
  const setupNodeCount = workflow.match(/actions\/setup-node@/g)?.length ?? 0;
  const versionFileCount = workflow.match(/node-version-file:\s*\.nvmrc/g)?.length ?? 0;

  assert.ok(setupNodeCount > 0, 'Each Node workflow must configure Node explicitly');
  assert.equal(
    versionFileCount,
    setupNodeCount,
    'Every setup-node step must read the version from .nvmrc',
  );
  assert.doesNotMatch(
    workflow,
    /node-version:\s*[^\n]+/,
    'Workflows must not duplicate the Node version outside .nvmrc',
  );
}

console.log(`Runtime configuration is aligned on Node ${nodeVersion} and npm 10.9.8.`);
