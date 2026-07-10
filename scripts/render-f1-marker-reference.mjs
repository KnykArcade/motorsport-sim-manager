import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const designs = JSON.parse(await readFile(resolve(root, 'src/components/f1MarkerDesigns.json'), 'utf8'));
const output = resolve(root, 'docs/f1-era-marker-reference.svg');

const eras = [
  ['f1_1990s', '#ef202b', '#f7f7f7', '5', 'OPEN COCKPIT · BOXY SIDEPODS · SIMPLE WINGS'],
  ['f1_2000s', '#174fc4', '#f7f7f7', '12', 'HIGH NOSE · SCULPTED SIDEPODS · BARGEBOARD ERA'],
  ['f1_2010s', '#d9dde3', '#00a6a6', '44', 'TIGHT WAIST · COMPLEX FRONT WING · NO HALO'],
  ['f1_2020s', '#00a99d', '#f7f7f7', '81', 'HALO · GROUND-EFFECT SIDEPODS · WIDE FRONT WING'],
];

const esc = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

function carLayers(key, design, primary, accent) {
  const wheels = design.wheels.map((w) =>
    `<g><rect x="${w.x}" y="${w.y}" width="${w.width}" height="${w.height}" rx="${w.rx}" fill="#08090b" stroke="#f7f7f7" stroke-width=".24"/><path d="M${w.x + w.width * 0.34} ${w.y + 0.16}V${w.y + w.height - 0.16}M${w.x + w.width * 0.68} ${w.y + 0.16}V${w.y + w.height - 0.16}" fill="none" stroke="#3f444a" stroke-width=".18"/></g>`,
  ).join('');
  const suspension = design.detailPaths.map((d, index) =>
    `<path d="${d}" fill="none" stroke="${index === 0 ? '#111519' : '#5f6872'}" stroke-width="${index === 0 ? '.44' : '.18'}" stroke-linecap="round" opacity="${index === 0 ? '1' : '.75'}"/>`,
  ).join('');
  const accents = design.accentPaths.map((d, index) =>
    `<path d="${d}" fill="${index < 3 ? (index < design.accentFillCount ? accent : primary) : 'none'}" stroke="${index < 3 ? '#07090b' : accent}" stroke-width="${index < 3 ? '.28' : '.38'}" stroke-linecap="round" stroke-linejoin="round"/>`,
  ).join('');
  const wingColor = design.wingColor === 'primary' ? primary : accent;
  const aero = design.aeroPaths.map((d) =>
    `<path d="${d}" fill="#101317" stroke="#c9ced4" stroke-width=".2" stroke-linejoin="round"/>`,
  ).join('');
  const intakes = design.intakePaths.map((d) =>
    `<path d="${d}" fill="#050607" stroke="#d5d8dc" stroke-width=".16"/>`,
  ).join('');
  const highlights = design.highlightPaths.map((d) =>
    `<path d="${d}" fill="none" stroke="#f7f7f7" stroke-width=".22" stroke-linecap="round" opacity=".72"/>`,
  ).join('');
  const wingDetails = design.wingDetailPaths.map((d, index) =>
    `<path d="${d}" fill="none" stroke="${index === 0 ? '#07090b' : '#14181c'}" stroke-width="${index === 0 ? '.34' : '.28'}" stroke-linecap="round"/>`,
  ).join('');
  const halo = design.haloPath
    ? `<path d="${design.haloPath}" fill="none" stroke="#07090b" stroke-width=".92" stroke-linecap="round" stroke-linejoin="round"/><path d="${design.haloPath}" fill="none" stroke="#f7f7f7" stroke-width=".2" stroke-linecap="round" stroke-linejoin="round"/>`
    : '';

  return `<g data-design="${key}">
    <path d="${design.outerPath}" fill="none" stroke="#07090b" stroke-width=".52" stroke-linejoin="round"/>
    ${wheels}${suspension}
    <path d="${design.floorPath}" fill="${primary}" stroke="#07090b" stroke-width=".34" stroke-linejoin="round"/>
    <path d="${design.rearWingPath}" fill="${wingColor}" stroke="#f7f7f7" stroke-width=".3" stroke-linejoin="round"/>
    <path d="${design.bodyPath}" fill="${primary}" stroke="#f7f7f7" stroke-width=".28" stroke-linejoin="round"/>
    <path d="${design.sidepodPath}" fill="${primary}" stroke="#f7f7f7" stroke-width=".24" stroke-linejoin="round"/>
    ${accents}
    ${aero}${intakes}
    <path d="${design.nosePath}" fill="${primary}" stroke="#f7f7f7" stroke-width=".24" stroke-linejoin="round"/>
    <ellipse cx="${design.cockpit.cx}" cy="${design.cockpit.cy}" rx="${design.cockpit.rx}" ry="${design.cockpit.ry}" fill="#080a0d" stroke="#f7f7f7" stroke-width=".28"/>
    <ellipse cx="${design.cockpit.cx - 0.2}" cy="${design.cockpit.cy}" rx="${design.cockpit.rx * 0.56}" ry="${design.cockpit.ry * 0.58}" fill="#20252a" stroke="#050607" stroke-width=".24"/>
    ${halo}
    <path d="${design.frontWingPath}" fill="${wingColor}" stroke="#f7f7f7" stroke-width=".3" stroke-linejoin="round"/>
    ${wingDetails}${highlights}
    <rect x="${design.numberPlate.x}" y="${design.numberPlate.y}" width="${design.numberPlate.width}" height="${design.numberPlate.height}" rx="${design.numberPlate.rx}" fill="#07090b" stroke="#f7f7f7" stroke-width=".3"/>
  </g>`;
}

function uprightNumber(design, number, x, y, scale, fontSize) {
  return `<text x="${x}" y="${y + design.numberAnchor.x * scale + fontSize * 0.35}" text-anchor="middle" fill="#fff" stroke="#07090b" stroke-width="${Math.max(1.1, fontSize * 0.16)}" paint-order="stroke" font-family="Arial Narrow,Arial,sans-serif" font-weight="900" font-size="${fontSize}">${esc(number)}</text>`;
}

function bigCar(key, design, primary, accent, number, x, y) {
  const scale = 13.2;
  return `<g transform="translate(${x} ${y}) rotate(90) scale(${scale})">${carLayers(key, design, primary, accent)}</g>
    ${uprightNumber(design, number, x, y, scale, 28)}`;
}

function actualCar(key, design, primary, accent, number, x, y) {
  const scale = 2;
  return `<g transform="translate(${x} ${y}) rotate(90) scale(${scale})">${carLayers(key, design, primary, accent)}</g>
    ${uprightNumber(design, number, x, y, scale, 7.2)}`;
}

function card([key, primary, accent, number, features], index) {
  const design = designs[key];
  const col = index % 2;
  const row = Math.floor(index / 2);
  const x = 28 + col * 782;
  const y = 128 + row * 407;
  const cx = x + 216;
  const cy = y + 220;
  const sampleY = y + 334;
  const variantColors = ['#22c55e', '#facc15', '#e11d48'];
  const variants = variantColors.map((color, i) => actualCar(key, design, color, i === 1 ? '#151515' : '#f7f7f7', String([27, 12, 5][i]), x + 414 + i * 72, sampleY)).join('');

  return `<g>
    <rect x="${x}" y="${y}" width="754" height="385" rx="18" fill="#111315" stroke="#3f444a" stroke-width="2"/>
    <text x="${x + 24}" y="${y + 44}" fill="#f5c400" font-family="Arial Narrow,Arial,sans-serif" font-size="32" font-weight="900">${design.label}</text>
    <text x="${x + 24}" y="${y + 70}" fill="#8d949c" font-family="Arial Narrow,Arial,sans-serif" font-size="13" font-weight="700">${features}</text>
    ${bigCar(key, design, primary, accent, number, cx, cy)}
    <text x="${x + 364}" y="${y + 112}" fill="#f7f7f7" font-family="Arial Narrow,Arial,sans-serif" font-size="14" font-weight="900">40 PX · FRONT NOSE NUMBER</text>
    ${actualCar(key, design, primary, accent, number, x + 472, y + 150)}
    <rect x="${x + 520}" y="${y + 126}" width="202" height="50" rx="6" fill="#060708" stroke="#f5c400"/>
    <rect x="${x + 530}" y="${y + 136}" width="9" height="30" rx="1" fill="${primary}"/>
    <text x="${x + 548}" y="${y + 147}" fill="#fff" font-family="Arial Narrow,Arial,sans-serif" font-size="14" font-weight="900">#${number} DRIVER NAME</text>
    <text x="${x + 548}" y="${y + 164}" fill="#9ca3af" font-family="Arial Narrow,Arial,sans-serif" font-size="11" font-weight="700">TEAM NAME · P1</text>
    <text x="${x + 364}" y="${y + 223}" fill="#8d949c" font-family="Arial Narrow,Arial,sans-serif" font-size="12" font-weight="800">REPAINT / RENUMBER VARIANTS</text>
    ${variants}
    <text x="${x + 364}" y="${y + 365}" fill="#737a82" font-family="Arial Narrow,Arial,sans-serif" font-size="11" font-weight="700">BODY ROTATES · NUMBER UPRIGHT · HOVER ID ON DEMAND</text>
  </g>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="980" viewBox="0 0 1600 980">
  <rect width="1600" height="980" fill="#050606"/>
  <text x="38" y="54" fill="#f5c400" font-family="Arial Narrow,Arial,sans-serif" font-size="34" font-weight="900">F1 LIVE TRACK MARKERS — FINAL DESIGN LOCK</text>
  <text x="38" y="88" fill="#d0d3d7" font-family="Arial Narrow,Arial,sans-serif" font-size="17" font-weight="800">1990s / 2000s / 2010s / 2020s · 40 PX · DETAILED VECTOR BODYWORK · FRONT-NOSE NUMBER BETWEEN TIRES</text>
  ${eras.map(card).join('')}
  <rect x="28" y="948" width="1536" height="2" fill="#f5c400" opacity=".65"/>
  <text x="38" y="971" fill="#8d949c" font-family="Arial Narrow,Arial,sans-serif" font-size="12" font-weight="700">LOCKED REFERENCE: ONE SILHOUETTE PER F1 ERA. TEAM COLORS AND CAR NUMBERS ARE APPLIED BY THE GAME AT RUNTIME.</text>
</svg>`;

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${svg.replace(/[ \t]+$/gm, '')}\n`);
console.log(output);
