import fs from 'node:fs/promises';
import path from 'node:path';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const repoRoot = process.env.MASTER_ARCHIVE_REPO_ROOT;
if (!repoRoot) throw new Error('MASTER_ARCHIVE_REPO_ROOT is required. Use npm run archive:workbook.');

const archiveDir = path.join(repoRoot, 'artifacts', 'master-archive', 'current');
const previewDir = path.join(repoRoot, 'artifacts', 'master-archive', 'previews');
const outputDir = path.join(repoRoot, 'docs', 'master-data');
const outputPath = path.join(outputDir, 'Motorsport_Sim_Manager_FINAL_MASTER_ARCHIVE_1990_2026.xlsx');
const source = JSON.parse(await fs.readFile(path.join(archiveDir, 'master-archive.json'), 'utf8'));

await fs.mkdir(previewDir, { recursive: true });
await fs.mkdir(outputDir, { recursive: true });

const driverColumns = [
  ['Driver ID', 'driverId'], ['Display Name', 'displayName'], ['Canonical Name', 'canonicalName'],
  ['Nationality', 'nationality'], ['Birth Year', 'birthYear'], ['First Seen', 'firstSeenYear'],
  ['Last Seen', 'lastSeenYear'], ['First Active', 'firstActiveYear'], ['Last Active', 'lastActiveYear'],
  ['First Adult Market', 'firstAdultMarketYear'], ['Last Adult Market', 'lastAdultMarketYear'],
  ['First Youth Market', 'firstYouthMarketYear'], ['Last Youth Market', 'lastYouthMarketYear'],
  ['Roles', 'roles'], ['Preferred Series', 'preferredSeries'], ['Series Interests', 'seriesInterests'],
  ['F1 Seasons', 'f1Seasons'], ['CART Seasons', 'cartSeasons'], ['Champ Car Seasons', 'champCarSeasons'],
  ['IndyCar Seasons', 'indyCarSeasons'], ['NASCAR Seasons', 'nascarSeasons'], ['Latest Overall', 'latestOverall'],
  ['Maximum Potential', 'maximumPotential'], ['Switch Willingness', 'switchWillingness'],
  ['Latest Salary ($M)', 'latestSalary'], ['Latest Market Value ($M)', 'latestMarketValue'],
  ['Cornering', 'cornering'], ['Braking', 'braking'], ['Straights', 'straights'],
  ['Traction / Acceleration', 'tractionAcceleration'], ['Elevation / Blind Corners', 'elevationBlindCorners'],
  ['Technical', 'technical'], ['Overtaking / Racecraft', 'overtakingRacecraft'],
  ['Surface / Grip / Bumpiness', 'surfaceGripBumpiness'], ['Risk Management', 'riskManagement'],
  ['Endurance / Consistency', 'enduranceConsistency'], ['Source Record Count', 'uniqueSourceIds'],
];

const historyColumns = [
  ['Driver ID', 'driverId'], ['Driver Name', 'name'], ['Year', 'year'], ['Series', 'series'],
  ['Record Type', 'recordType'], ['Source ID', 'sourceId'], ['Nationality', 'nationality'], ['Age', 'age'],
  ['Birth Year', 'birthYear'], ['Team', 'team'], ['Car Number', 'carNumber'], ['Context', 'context'],
  ['Series Preferences', (row) => (row.seriesPreferences ?? []).map((p) => `${p.series} (${p.weight})`).join('; ')],
  ['Overall', 'overall'], ['Potential', 'potential'], ['Salary ($M)', 'salary'], ['Market Value ($M)', 'marketValue'],
  ['Cornering', (row) => row.skills?.cornering], ['Braking', (row) => row.skills?.braking],
  ['Straights', (row) => row.skills?.straights], ['Traction / Acceleration', (row) => row.skills?.tractionAcceleration],
  ['Elevation / Blind Corners', (row) => row.skills?.elevationBlindCorners], ['Technical', (row) => row.skills?.technical],
  ['Overtaking / Racecraft', (row) => row.skills?.overtakingRacecraft],
  ['Surface / Grip / Bumpiness', (row) => row.skills?.surfaceGripBumpiness],
  ['Risk Management', (row) => row.skills?.riskManagement],
  ['Endurance / Consistency', (row) => row.skills?.enduranceConsistency], ['Notes / Source', 'notes'],
];

const seasonColumns = [
  ['Year', 'year'], ['Series', 'series'], ['Catalog Label', 'label'], ['Season ID', 'seasonId'],
  ['Season Name', 'seasonName'], ['Generated', 'generated'], ['Rounds', 'rounds'], ['Teams', 'teams'],
  ['Drivers', 'drivers'], ['Cars', 'cars'], ['First Race Date', 'firstRaceDate'], ['Last Race Date', 'lastRaceDate'],
  ['Points System ID', 'pointsSystemId'], ['Points System', 'pointsSystemName'],
  ['Regulation Set ID', 'regulationSetId'], ['Era', 'eraLabel'], ['Qualifying Format', 'qualifyingFormat'],
  ['Weekend Format', 'raceWeekendFormat'], ['Refueling', 'refuelingAllowed'], ['DRS', 'drsEnabled'],
  ['Sprint Support', 'sprintSupport'], ['Push to Pass', 'pushToPass'], ['Budget Cap', 'budgetCap'],
];

const valuesFor = (rows, columns) => rows.map((row) => columns.map(([, accessor]) => {
  const value = typeof accessor === 'function' ? accessor(row) : row[accessor];
  return value ?? '';
}));

function columnName(index) {
  let result = '';
  for (let n = index; n > 0; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + ((n - 1) % 26)) + result;
  return result;
}

const navy = '#17324D';
const teal = '#0F766E';
const pale = '#E8F1F5';
const gold = '#D4A72C';
const border = '#C9D6DE';
const workbook = Workbook.create();
const summary = workbook.worksheets.add('Archive Summary');

function addDataSheet(name, title, columns, rows, tableName) {
  const sheet = workbook.worksheets.add(name);
  const lastCol = columnName(columns.length);
  const lastRow = rows.length + 2;
  sheet.showGridLines = false;
  sheet.getRange(`A1:${lastCol}1`).merge();
  sheet.getRange('A1').values = [[title]];
  sheet.getRange(`A1:${lastCol}1`).format = {
    fill: navy, font: { bold: true, color: '#FFFFFF', size: 16 }, verticalAlignment: 'center', rowHeight: 30,
  };
  sheet.getRange(`A2:${lastCol}2`).values = [columns.map(([header]) => header)];
  sheet.getRange(`A2:${lastCol}2`).format = {
    fill: teal, font: { bold: true, color: '#FFFFFF' }, wrapText: true,
    verticalAlignment: 'center', rowHeight: 34, borders: { preset: 'outside', style: 'thin', color: border },
  };
  sheet.getRange(`A3:${lastCol}${lastRow}`).values = valuesFor(rows, columns);
  const table = sheet.tables.add(`A2:${lastCol}${lastRow}`, true, tableName);
  table.style = 'TableStyleMedium2';
  table.showFilterButton = true;
  sheet.freezePanes.freezeRows(2);
  sheet.freezePanes.freezeColumns(2);
  return { sheet, lastRow };
}

const { sheet: drivers, lastRow: driverLastRow } = addDataSheet(
  'Master Drivers', 'Final Master Driver List - 1990-2026', driverColumns, source.masterDrivers, 'MasterDriversTable',
);
drivers.getRange(`E3:M${driverLastRow}`).format.numberFormat = '0';
drivers.getRange(`Q3:U${driverLastRow}`).format.numberFormat = '0';
drivers.getRange(`V3:X${driverLastRow}`).format.numberFormat = '0.0';
drivers.getRange(`Y3:Z${driverLastRow}`).format.numberFormat = '0.00';
drivers.getRange(`AA3:AJ${driverLastRow}`).format.numberFormat = '0.0';
for (const col of ['A', 'B', 'C', 'D', 'N', 'O']) drivers.getRange(`${col}:${col}`).format.columnWidth = 19;
drivers.getRange('P:P').format.columnWidth = 30;
for (const col of ['E','F','G','H','I','J','K','L','M','Q','R','S','T','U','V','W','X','Y','Z','AA','AB','AC','AD','AE','AF','AG','AH','AI','AJ','AK']) drivers.getRange(`${col}:${col}`).format.columnWidth = 13;

const { sheet: history, lastRow: historyLastRow } = addDataSheet(
  'Driver History', 'Driver History - Active Rosters, Adult Markets, and Youth Markets',
  historyColumns, source.driverHistory, 'DriverHistoryTable',
);
history.getRange(`C3:C${historyLastRow}`).format.numberFormat = '0';
history.getRange(`H3:K${historyLastRow}`).format.numberFormat = '0';
history.getRange(`N3:Q${historyLastRow}`).format.numberFormat = '0.00';
history.getRange(`R3:AA${historyLastRow}`).format.numberFormat = '0.0';
for (const col of ['A','B','D','E','F','G','J','L']) history.getRange(`${col}:${col}`).format.columnWidth = 18;
history.getRange('M:M').format.columnWidth = 28;
history.getRange('AB:AB').format.columnWidth = 52;

const { sheet: seasons, lastRow: seasonLastRow } = addDataSheet(
  'Master Seasons', 'Final Master Season List - All Playable Championships',
  seasonColumns, source.seasons, 'MasterSeasonsTable',
);
seasons.getRange(`A3:A${seasonLastRow}`).format.numberFormat = '0';
seasons.getRange(`G3:J${seasonLastRow}`).format.numberFormat = '0';
seasons.getRange(`W3:W${seasonLastRow}`).format.numberFormat = '$#,##0';
for (const col of ['A','F','G','H','I','J','S','T','U','V','W']) seasons.getRange(`${col}:${col}`).format.columnWidth = 12;
for (const col of ['B','D','K','L','M','O']) seasons.getRange(`${col}:${col}`).format.columnWidth = 18;
for (const col of ['C','E','N','P','Q','R']) seasons.getRange(`${col}:${col}`).format.columnWidth = 30;

summary.showGridLines = false;
summary.getRange('A1:H2').merge();
summary.getRange('A1').values = [['Motorsport Sim Manager - Final Master Archive']];
summary.getRange('A1:H2').format = { fill: navy, font: { bold: true, color: '#FFFFFF', size: 20 }, verticalAlignment: 'center' };
summary.getRange('A4:B4').values = [['Archive Metric', 'Value']];
summary.getRange('A5:A10').values = [['Unique master drivers'], ['Driver history records'], ['Playable seasons'], ['First season year'], ['Last season year'], ['Source commit']];
summary.getRange('B5:B9').formulas = [
  [`=COUNTA('Master Drivers'!$A$3:$A$${driverLastRow})`], [`=COUNTA('Driver History'!$A$3:$A$${historyLastRow})`],
  [`=COUNTA('Master Seasons'!$A$3:$A$${seasonLastRow})`], [`=MIN('Master Seasons'!$A$3:$A$${seasonLastRow})`],
  [`=MAX('Master Seasons'!$A$3:$A$${seasonLastRow})`],
];
summary.getRange('B10').values = [[source.sourceCommit]];
summary.getRange('D4:E4').values = [['Series', 'Playable Seasons']];
const seriesNames = ['F1', 'CART', 'Champ Car', 'IndyCar', 'NASCAR'];
summary.getRange('D5:D9').values = seriesNames.map((name) => [name]);
summary.getRange('E5:E9').formulas = seriesNames.map((_, index) => [`=COUNTIF('Master Seasons'!$B$3:$B$${seasonLastRow},D${index + 5})`]);
summary.getRange('G4:H4').values = [['Driver Record Type', 'Records']];
const recordTypes = ['Active roster', 'Adult market', 'Youth market'];
summary.getRange('G5:G7').values = recordTypes.map((name) => [name]);
summary.getRange('H5:H7').formulas = recordTypes.map((_, index) => [`=COUNTIF('Driver History'!$E$3:$E$${historyLastRow},G${index + 5})`]);
for (const range of ['A4:B4', 'D4:E4', 'G4:H4']) summary.getRange(range).format = { fill: teal, font: { bold: true, color: '#FFFFFF' } };
for (const range of ['A4:B10', 'D4:E9', 'G4:H7']) summary.getRange(range).format.borders = { preset: 'all', style: 'thin', color: border };
summary.getRange('A13:H13').merge();
summary.getRange('A13').values = [['What this archive preserves']];
summary.getRange('A13:H13').format = { fill: gold, font: { bold: true, color: navy } };
summary.getRange('A14:H17').merge(true);
summary.getRange('A14:A17').values = [
  ['One normalized identity for every real driver in the final active rosters, adult markets, or youth markets.'],
  ['Every year-specific roster and market record, including ratings, team assignment, preferences, and source notes.'],
  ['Every playable season registered by the game, including rules, points systems, eras, and roster/calendar counts.'],
  ['Generated prospects and duplicate active-market identities are rejected by the archive safeguard before export.'],
];
summary.getRange('A14:H17').format = { fill: pale, wrapText: true, verticalAlignment: 'center', rowHeight: 30 };
summary.getRange('A:A').format.columnWidth = 28;
summary.getRange('B:B').format.columnWidth = 48;
summary.getRange('C:C').format.columnWidth = 4;
summary.getRange('D:D').format.columnWidth = 18;
summary.getRange('E:E').format.columnWidth = 16;
summary.getRange('F:F').format.columnWidth = 4;
summary.getRange('G:G').format.columnWidth = 22;
summary.getRange('H:H').format.columnWidth = 14;
summary.freezePanes.freezeRows(2);

for (const [sheetName, range, fileName] of [
  ['Archive Summary', 'A1:H17', 'summary.png'], ['Master Drivers', 'A1:AK24', 'master-drivers.png'],
  ['Driver History', 'A1:AB24', 'driver-history.png'], ['Master Seasons', 'A1:W24', 'master-seasons.png'],
]) {
  const preview = await workbook.render({ sheetName, range, scale: 1.2, format: 'png' });
  await fs.writeFile(path.join(previewDir, fileName), new Uint8Array(await preview.arrayBuffer()));
}

const errors = await workbook.inspect({
  kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 100 }, summary: 'formula error scan',
});
if (errors.ndjson.includes('"matchCount":') && !errors.ndjson.includes('"matchCount":0')) throw new Error(errors.ndjson);

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
await fs.rm(`${outputPath}.inspect.ndjson`, { force: true });
console.log(JSON.stringify({ outputPath, masterDrivers: source.masterDrivers.length, driverHistory: source.driverHistory.length, seasons: source.seasons.length }));
