import { spawnSync } from 'node:child_process';

const mapping = { '--series': 'CAL_SERIES', '--year': 'CAL_YEAR', '--track': 'CAL_TRACK', '--sims': 'CAL_SIMS', '--seed-start': 'CAL_SEED_START' };
const env = { ...process.env };
for (let index = 2; index < process.argv.length; index += 2) {
  const key = mapping[process.argv[index]];
  const value = process.argv[index + 1];
  if (!key || value == null) throw new Error(`Unknown or incomplete argument: ${process.argv[index]}`);
  env[key] = value;
}
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'scripts/liveRaceCalibration.test.ts', '--disableConsoleIntercept'], {
  cwd: process.cwd(), env, stdio: 'inherit',
});
process.exit(result.status ?? 1);
