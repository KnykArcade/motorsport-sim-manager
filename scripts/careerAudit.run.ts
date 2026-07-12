// CLI wrapper for the long-run Career audit. Runs a 20-season F1-1990 career
// with real races and prints a human-readable report to stdout. Run with:
//   npx tsx scripts/careerAudit.run.ts
//   AUDIT_SEASONS=20 AUDIT_SEED=career-audit-1990 npx tsx scripts/careerAudit.run.ts

import { runCareerAudit } from './careerAudit';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const seasons = Number(process.env.AUDIT_SEASONS ?? 20);
const seed = process.env.AUDIT_SEED ?? 'career-audit-1990';

const report = runCareerAudit({ seasons, seed });
const outputDir = process.env.AUDIT_OUT;
if (outputDir) {
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, 'career-simulation-report.json'), `${JSON.stringify({
    seed,
    startYear: report.seasons[0]?.year,
    endYear: report.seasons.at(-1)?.year,
    series: 'F1',
    ...report,
  }, null, 2)}\n`);
  const lines = [
    `# Career Simulation Audit`,
    '',
    `Seed: \`${seed}\`; seasons: ${seasons}; years: ${report.seasons[0]?.year ?? 'n/a'}–${report.seasons.at(-1)?.year ?? 'n/a'}`,
    '',
    '| Year | Top car | Grid avg | Driver avg | Upgrades | Reliability fixes | Setbacks | Archetypes | Financial health |',
    '|---:|---:|---:|---:|---:|---:|---:|---|---|',
    ...report.seasons.map((s) =>
      `| ${s.year} | ${s.carRating.max.toFixed(1)} | ${s.carRating.avg.toFixed(1)} | ${s.driverAverage.toFixed(1)} | ${s.aiActivity.upgrades} | ${s.aiActivity.reliabilityFixes} | ${s.aiActivity.setbacks} | ${Object.entries(s.archetypeCounts).map(([k, v]) => `${k}: ${v}`).join(', ')} | ${Object.entries(s.financialHealth).map(([k, v]) => `${k}: ${v}`).join(', ')} |`,
    ),
    '',
    `Max car rating: ${report.maxCarRating.toFixed(1)}; distinct constructor champions: ${report.distinctConstructorChampions}; top-team title share: ${report.topTeamTitleShare.toFixed(2)}`,
  ];
  writeFileSync(join(outputDir, 'career-simulation-summary.md'), `${lines.join('\n')}\n`);
}

const pad = (s: string, n: number) => s.padEnd(n).slice(0, n);
const money = (n: number) => `$${(n / 1_000_000).toFixed(0)}M`;

console.log(`\n=== Career audit — F1 1990, ${seasons} seasons (seed ${seed}) ===\n`);
console.log(
  pad('Year', 6) +
    pad('Constructor Champ', 22) +
    pad('CarRating(min/avg/max)', 24) +
    pad('Sat', 5) +
    pad('AI budget(min/avg/max)', 26),
);
for (const s of report.seasons) {
  console.log(
    pad(String(s.year), 6) +
      pad(s.constructorChampion?.name ?? '—', 22) +
      pad(`${s.carRating.min}/${s.carRating.avg}/${s.carRating.max}`, 24) +
      pad(String(s.saturatedCars), 5) +
      pad(`${money(s.budget.min)}/${money(s.budget.avg)}/${money(s.budget.max)}`, 26),
  );
}

console.log('\n--- Competitive balance ---');
console.log('Constructor titles by team:', report.constructorTitlesByTeam);
console.log('Distinct constructor champions:', report.distinctConstructorChampions);
console.log('Top-team title share:', report.topTeamTitleShare);
console.log('Max car rating over run:', report.maxCarRating, '(ever saturated:', report.everSaturated, ')');

console.log('\n--- Financial health (final season) ---');
console.log(report.seasons[report.seasons.length - 1].financialHealth);

console.log('\n--- Invariant probes (should all be empty/zero) ---');
const dupYears = report.seasons.filter((s) => s.duplicateNames.length).map((s) => s.year);
const academyYears = report.seasons.filter((s) => s.academyOver21.length).map((s) => s.year);
const tagYears = report.seasons.filter((s) => s.nameTagLeaks.length).map((s) => s.year);
const youthYears = report.seasons.filter((s) => s.youthPoolOverAge > 0).map((s) => s.year);
const seatYears = report.seasons.filter((s) => s.teamsWithoutTwoSeats.length).map((s) => s.year);
const reserveYears = report.seasons.filter((s) => s.reservesRacing > 0).map((s) => s.year);
console.log('Years with duplicate driver names:', dupYears);
console.log('Years with academy-only 21+ drivers:', academyYears);
console.log('Years with market-tag name leaks:', tagYears);
console.log('Years with 18+ in youth pool:', youthYears);
console.log('Years with a team missing two seats:', seatYears);
console.log('Years with a reserve racing:', reserveYears);
console.log('');
