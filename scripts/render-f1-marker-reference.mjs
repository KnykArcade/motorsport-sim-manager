import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const designs = JSON.parse(await readFile(resolve(root, 'src/components/f1RasterMarkerDesigns.json'), 'utf8'));
const output = resolve(root, 'docs/f1-era-marker-final-design-lock.svg');

const eras = [
  ['f1_1990s', '#ef202b', '#f7f7f7', '1', 'OPEN COCKPIT · BOXY SIDEPODS · SIMPLE WINGS'],
  ['f1_2000s', '#174fc4', '#f7f7f7', '5', 'HIGH NOSE · SCULPTED SIDEPODS · BARGEBOARD ERA'],
  ['f1_2010s', '#d9dde3', '#00a6a6', '44', 'TIGHT WAIST · COMPLEX FRONT WING · NO HALO'],
  ['f1_2020s', '#00a99d', '#f7f7f7', '44', 'HALO · GROUND-EFFECT SIDEPODS · WIDE FRONT WING'],
];

const esc = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

async function dataUri(publicPath) {
  const bytes = await readFile(resolve(root, 'public', publicPath.replace(/^\//, '')));
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

for (const [key, design] of Object.entries(designs)) {
  design.embeddedMaster = await dataUri(design.assets.master);
  design.assetSymbolId = `${key}-master`;
}

function carImage(design, primary, secondary, x, y, scale, rotation = 90) {
  void primary;
  void secondary;
  return `<use href="#${design.assetSymbolId}" transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})"/>`;
}

function uprightNumber(design, number, x, y, scale, fontSize) {
  const numberY = y + design.numberAnchor.x * scale;
  return `<text x="${x}" y="${numberY + fontSize * 0.34}" text-anchor="middle" fill="#fff" stroke="#07090b" stroke-width="${Math.max(0.8, fontSize * 0.13)}" paint-order="stroke" font-family="Arial Narrow,Arial,sans-serif" font-weight="900" font-size="${fontSize}">${esc(number)}</text>`;
}

function bigCar(design, primary, secondary, number, x, y) {
  const scale = 13.6;
  return `${carImage(design, primary, secondary, x, y, scale)}${uprightNumber(design, number, x, y, scale, 26)}`;
}

function actualCar(design, primary, secondary, number, x, y) {
  const scale = 2;
  return `${carImage(design, primary, secondary, x, y, scale)}${uprightNumber(design, number, x, y, scale, 5.4)}`;
}

function card([key, primary, secondary, number, features], index) {
  const design = designs[key];
  const col = index % 2;
  const row = Math.floor(index / 2);
  const x = 28 + col * 782;
  const y = 128 + row * 407;
  const cx = x + 216;
  const cy = y + 220;
  const previewX = x + 475;
  const previewY = y + 148;

  return `<g>
    <rect x="${x}" y="${y}" width="754" height="385" rx="18" fill="#111315" stroke="#3f444a" stroke-width="2"/>
    <text x="${x + 24}" y="${y + 44}" fill="#f5c400" font-family="Arial Narrow,Arial,sans-serif" font-size="32" font-weight="900">${design.label}</text>
    <text x="${x + 24}" y="${y + 70}" fill="#8d949c" font-family="Arial Narrow,Arial,sans-serif" font-size="13" font-weight="700">${features}</text>
    ${bigCar(design, primary, secondary, number, cx, cy)}
    <text x="${x + 364}" y="${y + 112}" fill="#f7f7f7" font-family="Arial Narrow,Arial,sans-serif" font-size="14" font-weight="900">FINAL 40 PX GAME MARKER</text>
    ${actualCar(design, primary, secondary, number, previewX, previewY)}
    <rect x="${x + 520}" y="${y + 126}" width="202" height="50" rx="6" fill="#060708" stroke="#f5c400"/>
    <rect x="${x + 530}" y="${y + 136}" width="9" height="30" rx="1" fill="${primary}"/>
    <text x="${x + 548}" y="${y + 147}" fill="#fff" font-family="Arial Narrow,Arial,sans-serif" font-size="14" font-weight="900">#${number} DRIVER NAME</text>
    <text x="${x + 548}" y="${y + 164}" fill="#9ca3af" font-family="Arial Narrow,Arial,sans-serif" font-size="11" font-weight="700">TEAM NAME · P1</text>
    <text x="${x + 364}" y="${y + 225}" fill="#8d949c" font-family="Arial Narrow,Arial,sans-serif" font-size="12" font-weight="800">RUNTIME LAYER CONTRACT</text>
    <rect x="${x + 364}" y="${y + 246}" width="126" height="34" rx="5" fill="${primary}" stroke="#f7f7f7" stroke-width="1"/>
    <text x="${x + 427}" y="${y + 268}" text-anchor="middle" fill="#fff" stroke="#08090b" stroke-width="2" paint-order="stroke" font-family="Arial,sans-serif" font-size="11" font-weight="900">PRIMARY PAINT</text>
    <rect x="${x + 500}" y="${y + 246}" width="126" height="34" rx="5" fill="${secondary}" stroke="#f7f7f7" stroke-width="1"/>
    <text x="${x + 563}" y="${y + 268}" text-anchor="middle" fill="#fff" stroke="#08090b" stroke-width="2" paint-order="stroke" font-family="Arial,sans-serif" font-size="11" font-weight="900">SECONDARY</text>
    <rect x="${x + 636}" y="${y + 246}" width="86" height="34" rx="5" fill="#07090b" stroke="#f7f7f7" stroke-width="1"/>
    <text x="${x + 679}" y="${y + 268}" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="11" font-weight="900">#${number} LIVE</text>
    <text x="${x + 364}" y="${y + 326}" fill="#d0d3d7" font-family="Arial Narrow,Arial,sans-serif" font-size="12" font-weight="800">CLEAN REAR WING · FRONT-NOSE NUMBER ONLY</text>
    <text x="${x + 364}" y="${y + 365}" fill="#737a82" font-family="Arial Narrow,Arial,sans-serif" font-size="11" font-weight="700">BODY ROTATES · NUMBER UPRIGHT · HOVER ID ON DEMAND</text>
  </g>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="980" viewBox="0 0 1600 980">
  <defs>${Object.values(designs).map((design) => `<image id="${design.assetSymbolId}" href="${design.embeddedMaster}" x="-10" y="-10" width="20" height="20" preserveAspectRatio="none"/>`).join('')}</defs>
  <rect width="1600" height="980" fill="#050606"/>
  <text x="38" y="54" fill="#f5c400" font-family="Arial Narrow,Arial,sans-serif" font-size="34" font-weight="900">F1 LIVE TRACK MARKERS — FINAL DESIGN LOCK</text>
  <text x="38" y="88" fill="#d0d3d7" font-family="Arial Narrow,Arial,sans-serif" font-size="17" font-weight="800">1990s / 2000s / 2010s / 2020s · IN-GAME VERIFIED · EXACT RASTER MODELS · 40 PX · FRONT-NOSE NUMBERS ONLY</text>
  ${eras.map(card).join('')}
  <rect x="28" y="948" width="1536" height="2" fill="#f5c400" opacity=".65"/>
  <text x="38" y="971" fill="#8d949c" font-family="Arial Narrow,Arial,sans-serif" font-size="12" font-weight="700">FINAL LOCK: THE MOCKUP AND GAME LOAD THE SAME NUMBERLESS RASTER MASTER FOR EACH ERA.</text>
</svg>`;

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${svg.replace(/[ \t]+$/gm, '')}\n`);
console.log(output);
