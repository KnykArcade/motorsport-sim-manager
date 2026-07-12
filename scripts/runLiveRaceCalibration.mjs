import { spawnSync } from 'node:child_process';

const mapping = { '--series': 'CAL_SERIES', '--year': 'CAL_YEAR', '--track': 'CAL_TRACK', '--sims': 'CAL_SIMS', '--seed-start': 'CAL_SEED_START' };
const env = { ...process.env };
for (let index = 2; index < process.argv.length;) {
  const argument = process.argv[index];
  if (argument === '--assert-targets') {
    env.CAL_ASSERT_TARGETS = '1';
    index += 1;
    continue;
  }
  const key = mapping[argument];
  const value = process.argv[index + 1];
  if (!key || value == null) throw new Error(`Unknown or incomplete argument: ${argument}`);
  env[key] = value;
  index += 2;
}
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'scripts/liveRaceCalibration.test.ts', '--disableConsoleIntercept'], {
  cwd: process.cwd(), env, stdio: 'inherit',
});
process.exit(result.status ?? 1);
