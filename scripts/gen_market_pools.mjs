import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = new URL('..', import.meta.url).pathname;
const MARKET_DIR = path.join(ROOT, 'src/data/market');
const PHASE0_DIR = path.join(ROOT, 'src/data/phase0/generated');

const FIRST_NAMES = [
  'Alex', 'Andrea', 'Antoine', 'Carlos', 'Daniel', 'David', 'Diego', 'Elias',
  'Emilio', 'Enzo', 'Felipe', 'Finn', 'Franco', 'Gabriel', 'Hector', 'Ignacio',
  'Javier', 'Julian', 'Kai', 'Luca', 'Marco', 'Mateo', 'Mika', 'Noah', 'Nico',
  'Oliver', 'Oscar', 'Pablo', 'Rafael', 'Sami', 'Sebastian', 'Timo', 'Victor',
  'Yuki', 'Zane', 'Adam', 'Aiden', 'Bastien', 'Bruno', 'Carter', 'Dario',
  'Edgar', 'Fabio', 'Gino', 'Henrik', 'Isak', 'Jonas', 'Kasper', 'Leon',
  'Manuel', 'Nolan', 'Pedro', 'Quinn', 'Rene', 'Sergio', 'Tadeusz', 'Ulrich',
  'Vasco', 'Wes', 'Xavier', 'Yann', 'Zack',
];

const LAST_NAMES = [
  'Bianchi', 'Costa', 'Dubois', 'Fernandez', 'Garcia', 'Hernandez', 'Ibrahim',
  'Jensen', 'Keller', 'Larsen', 'Martinez', 'Moretti', 'Nakamura', 'Olsen',
  'Petrov', 'Quintana', 'Rossi', 'Silva', 'Tanaka', 'Ulmann', 'Vega', 'Weber',
  'Xavier', 'Yamamoto', 'Zanetti', 'Andersen', 'Barrera', 'Caldwell', 'Delgado',
  'Eriksson', 'Francois', 'Gomez', 'Hansen', 'Ivanov', 'Johansson', 'Kovacs',
  'Lombardi', 'Mendez', 'Novak', 'Ortega', 'Pereira', 'Reyes', 'Sanchez',
  'Torres', 'Usman', 'Valdez', 'Walsh', 'Xu', 'Young', 'Zimmerman',
];

const NATIONALITIES = [
  'Argentina', 'Australia', 'Austria', 'Belgium', 'Brazil', 'Canada', 'Chile',
  'Colombia', 'Denmark', 'Finland', 'France', 'Germany', 'Great Britain',
  'Italy', 'Japan', 'Mexico', 'Netherlands', 'New Zealand', 'Norway', 'Portugal',
  'South Africa', 'Spain', 'Sweden', 'Switzerland', 'United States', 'Uruguay',
];

const MARKET_CONTEXTS = [
  'Feeder series / off-grid talent',
  'Former F1 / sports car option',
  'Indy ladder / open-wheel reserve',
  'CART / Champ Car prospect pool',
  'Veteran / commercial option',
  'Junior formula / low-mileage prospect',
];

const MARKET_POOLS = [
  'Senior Market',
  'Feeder/Test',
  'Veteran',
  'Development Pool',
  'Open Market',
];

const MARKET_STATUSES = [
  'Available',
  'Negotiable',
  'Watchlist',
  'Senior Market',
  'Development Target',
  'Veteran',
];

const MARKET_ROLES = [
  'Seat upgrade',
  'Development driver',
  'Long-term prospect',
  'Commercial signing',
  'Reserve option',
  'Experienced stabiliser',
];

const MARKET_NOTES = [
  'Generated stable filler market driver.',
  'Deterministic filler created for the open market pool.',
  'Synthetic off-grid entry to complete the 100-driver pool.',
  'Generated depth option for market balance.',
];

const YOUTH_LEVELS = [
  'Karting',
  'Junior formula',
  'Regional junior series',
  'Feeder series',
  'National junior championship',
];

const YOUTH_RISKS = ['Low', 'Medium', 'High'];

const YOUTH_PATHS = ['Academy', 'Junior ladder', 'Feeder series', 'Evaluation'];

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeText(filePath, content) {
  fs.writeFileSync(filePath, content.endsWith('\n') ? content : `${content}\n`);
}

function normalizeName(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function slugify(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function hashString(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function roundInt(value, min = 1) {
  return Math.max(min, Math.min(100, Math.round(value)));
}

function scaleRating(value, min = 1) {
  if (typeof value !== 'number') return value;
  return roundInt(value * 10, min);
}

function scaleMaybe(value) {
  if (typeof value !== 'number') return value;
  return roundInt(value * 10);
}

function scaleObjectRatings(entry, keys) {
  const out = { ...entry };
  for (const key of keys) {
    if (typeof out[key] === 'number') {
      out[key] = scaleMaybe(out[key]);
    }
  }
  return out;
}

function parseExpression(node, sourceFile) {
  if (ts.isSatisfiesExpression(node) || ts.isAsExpression(node)) {
    return parseExpression(node.expression, sourceFile);
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
    const inner = parseExpression(node.operand, sourceFile);
    return typeof inner === 'number' ? -inner : inner;
  }
  if (ts.isArrayLiteralExpression(node)) return node.elements.map((el) => parseExpression(el, sourceFile));
  if (ts.isObjectLiteralExpression(node)) {
    const out = {};
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const name = prop.name.getText(sourceFile).replace(/^['"]|['"]$/g, '');
      out[name] = parseExpression(prop.initializer, sourceFile);
    }
    return out;
  }
  throw new Error(`Unsupported TS node kind: ${ts.SyntaxKind[node.kind]}`);
}

function readArrayExport(filePath, exportName) {
  const sourceText = readText(filePath);
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let arrayNode = null;
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const decl of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(decl.name) &&
        decl.name.text === exportName &&
        decl.initializer &&
        (ts.isArrayLiteralExpression(decl.initializer) ||
          ts.isSatisfiesExpression(decl.initializer) ||
          ts.isAsExpression(decl.initializer))
      ) {
        arrayNode = decl.initializer;
        break;
      }
    }
    if (arrayNode) break;
  }
  if (!arrayNode) throw new Error(`Could not find export ${exportName} in ${filePath}`);
  const arr = parseExpression(arrayNode, sourceFile);
  if (!Array.isArray(arr)) throw new Error(`Export ${exportName} in ${filePath} did not resolve to an array`);
  return arr;
}

function buildNameIdMap(filePath, exportName, idField, nameField) {
  const items = readArrayExport(filePath, exportName);
  const map = new Map();
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const id = item[idField];
    const name = item[nameField];
    if (typeof id === 'string' && typeof name === 'string') {
      const key = normalizeName(name);
      if (!map.has(key)) map.set(key, { id, name });
    }
  }
  return map;
}

function seededChoice(rng, values) {
  return values[Math.floor(rng() * values.length) % values.length];
}

function makeHumanName(seedText, existingNames) {
  let attempt = 0;
  while (attempt < 1000) {
    const rng = mulberry32(hashString(`${seedText}:${attempt}`));
    const name = `${seededChoice(rng, FIRST_NAMES)} ${seededChoice(rng, LAST_NAMES)}`;
    if (!existingNames.has(normalizeName(name))) return name;
    attempt += 1;
  }
  return `Generated Name ${seedText}`;
}

function difficultyForOverall(overall) {
  if (overall >= 80) return 'Hard';
  if (overall >= 65) return 'Medium';
  return 'Light';
}

function marketContext(overall, age) {
  if (age >= 32) return 'Veteran / commercial option';
  if (overall >= 80) return 'Former F1 / sports car option';
  if (overall >= 68) return 'Indy ladder / open-wheel reserve';
  return seededChoice(mulberry32(hashString(`${overall}:${age}`)), MARKET_CONTEXTS);
}

function marketPoolFor(overall, age) {
  if (age >= 35) return 'Veteran';
  if (overall >= 78) return 'Senior Market';
  if (overall >= 66) return 'Feeder/Test';
  return seededChoice(mulberry32(hashString(`${overall}:${age}:pool`)), MARKET_POOLS);
}

function marketStatusFor(overall, age) {
  if (age >= 35) return 'Veteran';
  if (overall >= 78) return 'Senior Market';
  if (overall >= 66) return 'Negotiable';
  return seededChoice(mulberry32(hashString(`${overall}:${age}:status`)), MARKET_STATUSES);
}

function marketRoleFor(overall) {
  if (overall >= 80) return 'Seat upgrade';
  if (overall >= 70) return 'Development driver';
  return seededChoice(mulberry32(hashString(`${overall}:role`)), MARKET_ROLES);
}

function generateMarketFiller(fileKey, index) {
  const rng = mulberry32(hashString(`${fileKey}:market:${index}`));
  const age = 18 + Math.floor(rng() * 24);
  const overall = roundInt(58 + rng() * 30);
  const potential = roundInt(Math.min(100, overall + 4 + rng() * 12));
  const nationality = seededChoice(rng, NATIONALITIES);
  const name = makeHumanName(`${fileKey}:market:${index}`, new Set());
  const skillKeys = [
    'cornering', 'braking', 'straights', 'tractionAcceleration', 'elevationBlindCorners',
    'technical', 'overtakingRacecraft', 'surfaceGripBumpiness', 'riskManagement', 'enduranceConsistency',
  ];
  const skillBase = overall - 6 + rng() * 12;
  const skills = {};
  for (const key of skillKeys) {
    skills[key] = roundInt(skillBase + (rng() - 0.5) * 10);
  }
  const f1Readiness = roundInt(Math.max(20, Math.min(100, overall + (age <= 24 ? 12 : -4) + rng() * 8)));
  const salary = Math.round((overall / 100) * 3.8 * 10) / 10;
  const sponsorValue = Math.round(((overall + rng() * 10) / 100) * 5.5 * 10) / 10;
  const buyoutCost = Math.round((salary + sponsorValue * 0.35 + 0.4) * 10) / 10;
  const context = marketContext(overall, age);
  const pool = marketPoolFor(overall, age);
  const status = marketStatusFor(overall, age);
  const role = marketRoleFor(overall);
  const notes = seededChoice(rng, MARKET_NOTES);
  return {
    id: `mkt-${fileKey}-fill-${String(index + 1).padStart(2, '0')}`,
    name,
    age,
    nationality,
    context,
    marketPool: pool,
    marketStatus: status,
    primaryRole: role,
    immediateF1Eligible: age >= 18 && overall >= 65,
    skills,
    overall,
    potential,
    potentialDelta: roundInt(potential - overall),
    developmentRate: roundInt(20 + rng() * 60),
    f1Readiness,
    salary,
    sponsorValue,
    buyoutCost,
    negotiationDifficulty: difficultyForOverall(overall),
    suggestedUse: role,
    notes,
  };
}

function generateYouthFiller(fileKey, index) {
  const rng = mulberry32(hashString(`${fileKey}:youth:${index}`));
  const age = 12 + Math.floor(rng() * 6);
  const overall = roundInt(62 + rng() * 25);
  const potential = roundInt(Math.min(100, overall + 5 + rng() * 10));
  const nationality = seededChoice(rng, NATIONALITIES);
  const name = makeHumanName(`${fileKey}:youth:${index}`, new Set());
  const skillKeys = [
    'cornering', 'braking', 'straights', 'tractionAcceleration', 'elevationBlindCorners',
    'technical', 'overtakingRacecraft', 'surfaceGripBumpiness', 'riskManagement', 'enduranceConsistency',
  ];
  const skillBase = overall - 4 + rng() * 8;
  const skills = {};
  for (const key of skillKeys) {
    skills[key] = roundInt(skillBase + (rng() - 0.5) * 12);
  }
  const year = Number(fileKey.slice(0, 4));
  const yearUntilReady = Math.max(2, Math.min(8, 18 - age + Math.floor(rng() * 2)));
  const signingCost = Math.round((0.02 + (potential / 100) * 0.13) * 100) / 100;
  const yearlyAcademyCost = Math.round((0.01 + (potential / 100) * 0.09) * 100) / 100;
  const riskLevel = age <= 13 ? 'High' : age <= 15 ? 'Medium' : 'Low';
  return {
    id: `yth-${fileKey}-fill-${String(index + 1).padStart(2, '0')}`,
    name,
    age,
    birthYear: year - age,
    nationality,
    currentLevel: seededChoice(rng, YOUTH_LEVELS),
    marketPool: 'Youth',
    marketStatus: 'Prospect',
    academyEligibleNow: age <= 17,
    earliestFullAcademyYear: year,
    skills,
    overall,
    potential,
    potentialDelta: roundInt(potential - overall),
    developmentRate: roundInt(35 + rng() * 50),
    yearsUntilF1Ready: yearUntilReady,
    signingCost,
    yearlyAcademyCost,
    riskLevel,
    suggestedPath: seededChoice(rng, YOUTH_PATHS),
    notes: 'Generated stable youth filler.',
  };
}

function toTs(value, indent = 0) {
  const pad = ' '.repeat(indent);
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    const inner = value.map((item) => `${pad}  ${toTs(item, indent + 2)}`).join(',\n');
    return `[\n${inner}\n${pad}]`;
  }
  const entries = Object.entries(value);
  if (!entries.length) return '{}';
  const parts = entries.map(([key, val]) => `${pad}  ${key}: ${toTs(val, indent + 2)}`);
  return `{\n${parts.join(',\n')}\n${pad}}`;
}

function reprintMarketFile(filePath, exportName, items, kind, canonicalMap, fallbackCanonicalMap) {
  const deduped = [];
  const seen = new Set();
  const existingNames = new Set();
  for (const item of items) {
    const name = typeof item.name === 'string' ? item.name : '';
    const canonical = canonicalMap.get(normalizeName(name)) || fallbackCanonicalMap.get(normalizeName(name));
    const isFiller = typeof item.id === 'string' && /-fill-\d+$/.test(item.id);
    if (isFiller) continue;
    const normalized = normalizeName(name);
    if (!normalized || seen.has(item.id) || existingNames.has(normalized)) continue;
    const next = { ...item };
    if (canonical) {
      next.id = canonical.id;
      next.name = canonical.name;
    }
    if (kind === 'driver') {
      next.skills = scaleObjectRatings(next.skills ?? {}, ['cornering', 'braking', 'straights', 'tractionAcceleration', 'elevationBlindCorners', 'technical', 'overtakingRacecraft', 'surfaceGripBumpiness', 'riskManagement', 'enduranceConsistency']);
      for (const key of ['overall', 'potential', 'developmentRate']) {
        if (typeof next[key] === 'number') next[key] = scaleRating(next[key]);
      }
      if (typeof next.potentialDelta === 'number') {
        next.potentialDelta = scaleRating(next.potentialDelta, 0);
      }
    } else {
      next.skills = scaleObjectRatings(next.skills ?? {}, ['cornering', 'braking', 'straights', 'tractionAcceleration', 'elevationBlindCorners', 'technical', 'overtakingRacecraft', 'surfaceGripBumpiness', 'riskManagement', 'enduranceConsistency']);
      for (const key of ['overall', 'potential', 'developmentRate']) {
        if (typeof next[key] === 'number') next[key] = scaleRating(next[key]);
      }
      if (typeof next.potentialDelta === 'number') {
        next.potentialDelta = scaleRating(next.potentialDelta, 0);
      }
      if (typeof next.signingCost === 'number') {
        // Preserve the same low-cost curve while moving the potential scale to 1-100.
        next.signingCost = Math.round((0.02 + (Math.max(0, Math.min(100, next.potential ?? 0)) / 100) * 0.13) * 100) / 100;
      }
      if (typeof next.yearlyAcademyCost === 'number') {
        next.yearlyAcademyCost = Math.round((0.01 + (Math.max(0, Math.min(100, next.potential ?? 0)) / 100) * 0.09) * 100) / 100;
      }
    }
    deduped.push(next);
    seen.add(next.id);
    existingNames.add(normalized);
  }

  const fileMatch = path.basename(filePath).match(/^(driverMarket|youthProspects)(\d{4})(CART|IndyCar)?\.ts$/);
  const year = fileMatch ? fileMatch[2] : '0000';
  const suffix = fileMatch ? fileMatch[3] : undefined;
  const series = !suffix ? 'F1' : suffix === 'IndyCar' ? 'IndyCar' : Number(year) >= 2004 ? 'ChampCar' : 'CART';
  const fileKey = `${year}-${series}`;
  const needed = Math.max(0, 100 - deduped.length);
  const fillers = [];
  for (let i = 0; i < needed; i += 1) {
    fillers.push(kind === 'driver' ? generateMarketFiller(fileKey, i) : generateYouthFiller(fileKey, i));
  }
  const finalItems = deduped.concat(fillers);
  const header = `// AUTO-GENERATED by scripts/gen_market_pools.mjs for ${path.basename(filePath)}.\n`;
  const imports =
    kind === 'driver'
      ? "import type { MarketDriver } from '../../types/marketTypes';\n\n"
      : "import type { YouthProspect } from '../../types/marketTypes';\n\n";
  const arrType = kind === 'driver' ? 'MarketDriver' : 'YouthProspect';
  const body = `export const ${exportName}: ${arrType}[] = ${toTs(finalItems, 0)};\n`;
  writeText(filePath, `${header}${imports}${body}`);
  return { real: deduped.length, filler: fillers.length, total: finalItems.length };
}

function main() {
  const driverMap = buildNameIdMap(path.join(PHASE0_DIR, 'globalDrivers.ts'), 'globalDriversPhase0', 'driverId', 'name');
  const youthMap = buildNameIdMap(path.join(PHASE0_DIR, 'globalYouth.ts'), 'globalYouthPhase0', 'id', 'name');
  const fallbackMap = new Map([...driverMap.entries(), ...youthMap.entries()]);
  const driverFiles = fs
    .readdirSync(MARKET_DIR)
    .filter((file) => /^driverMarket\d{4}(?:CART|IndyCar)?\.ts$/.test(file))
    .sort();
  const youthFiles = fs
    .readdirSync(MARKET_DIR)
    .filter((file) => /^youthProspects\d{4}(?:CART|IndyCar)?\.ts$/.test(file))
    .sort();
  const summary = [];
  for (const file of driverFiles) {
    const filePath = path.join(MARKET_DIR, file);
    const exportName = file.replace(/\.ts$/, '');
    const items = readArrayExport(filePath, exportName);
    const counts = reprintMarketFile(filePath, exportName, items, 'driver', driverMap, fallbackMap);
    summary.push(`${file}: real=${counts.real} filler=${counts.filler} total=${counts.total}`);
  }
  for (const file of youthFiles) {
    const filePath = path.join(MARKET_DIR, file);
    const exportName = file.replace(/\.ts$/, '');
    const items = readArrayExport(filePath, exportName);
    const counts = reprintMarketFile(filePath, exportName, items, 'youth', youthMap, fallbackMap);
    summary.push(`${file}: real=${counts.real} filler=${counts.filler} total=${counts.total}`);
  }
  console.log(summary.join('\n'));
}

main();
