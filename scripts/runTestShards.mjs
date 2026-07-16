import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const vitestEntry = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url));
const forwardedArgs = process.argv.slice(2);
const hasShard = forwardedArgs.some((arg) => arg.startsWith('--shard='));
const hasWorkerLimit = forwardedArgs.some(
  (arg) => arg.startsWith('--maxWorkers=') || arg.startsWith('--max-workers='),
);
const workerArgs = hasWorkerLimit ? [] : ['--maxWorkers=2'];

function runVitest(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [vitestEntry, 'run', ...workerArgs, ...args], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`Vitest was terminated by ${signal}.`));
        return;
      }
      resolve(code ?? 1);
    });
  });
}

if (hasShard) {
  process.exitCode = await runVitest(forwardedArgs);
} else {
  const shardCount = Math.max(1, Number(process.env.TEST_SHARDS ?? 4));
  const concurrency = Math.max(1, Math.min(shardCount, Number(process.env.TEST_SHARD_CONCURRENCY ?? 2)));
  let nextShard = 1;
  let failed = false;

  async function runLane() {
    while (!failed && nextShard <= shardCount) {
      const shard = nextShard++;
      const code = await runVitest([`--shard=${shard}/${shardCount}`, ...forwardedArgs]);
      if (code !== 0) {
        failed = true;
        process.exitCode = code;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => runLane()));
}
