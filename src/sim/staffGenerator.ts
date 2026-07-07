// Deterministic generator for the hireable staff market. Produces a large,
// varied pool of unique specialists per season/series so there is always ample
// talent to sign across every role. Same (year, series) always yields the same
// pool (seeded RNG), so saves replay identically.

import { createSeededRandom, deriveSeed, type Rng } from './random';
import { STAFF_ROLES, type StaffMember, type StaffRole } from '../types/staffTypes';

// How many candidates to generate per role. Four roles -> ~48 hireable staff.
const PER_ROLE = 12;

const FIRST_NAMES: { name: string; nat: string }[] = [
  { name: 'Adrian', nat: 'GB' }, { name: 'Ross', nat: 'GB' }, { name: 'Pat', nat: 'GB' },
  { name: 'James', nat: 'GB' }, { name: 'Geoff', nat: 'GB' }, { name: 'Neil', nat: 'GB' },
  { name: 'Gianni', nat: 'IT' }, { name: 'Aldo', nat: 'IT' }, { name: 'Marco', nat: 'IT' },
  { name: 'Luca', nat: 'IT' }, { name: 'Stefano', nat: 'IT' }, { name: 'Paolo', nat: 'IT' },
  { name: 'Klaus', nat: 'DE' }, { name: 'Dieter', nat: 'DE' }, { name: 'Heinz', nat: 'DE' },
  { name: 'Jürgen', nat: 'DE' }, { name: 'Frank', nat: 'DE' }, { name: 'Rudi', nat: 'DE' },
  { name: 'Jean', nat: 'FR' }, { name: 'Olivier', nat: 'FR' }, { name: 'Pierre', nat: 'FR' },
  { name: 'Henri', nat: 'FR' }, { name: 'Alain', nat: 'FR' }, { name: 'Didier', nat: 'FR' },
  { name: 'Carlos', nat: 'ES' }, { name: 'Javier', nat: 'ES' }, { name: 'Miguel', nat: 'ES' },
  { name: 'Hideki', nat: 'JP' }, { name: 'Takeo', nat: 'JP' }, { name: 'Satoru', nat: 'JP' },
  { name: 'Lars', nat: 'SE' }, { name: 'Mika', nat: 'FI' }, { name: 'Jukka', nat: 'FI' },
  { name: 'Bruno', nat: 'BR' }, { name: 'Rafael', nat: 'BR' }, { name: 'Emerson', nat: 'BR' },
  { name: 'Tom', nat: 'US' }, { name: 'Chip', nat: 'US' }, { name: 'Dale', nat: 'US' },
  { name: 'Sander', nat: 'NL' }, { name: 'Bram', nat: 'NL' }, { name: 'Erik', nat: 'NL' },
];

const LAST_NAMES: string[] = [
  'Marlowe', 'Whitcombe', 'Hargreaves', 'Pemberton', 'Calloway', 'Fairbanks', 'Ashworth',
  'Verdi', 'Bianchi', 'Lombardi', 'Ferraro', 'Moretti', 'Costa', 'Rinaldi',
  'Berger', 'Schmitt', 'Vogel', 'Brandt', 'Keller', 'Hofmann', 'Reinhardt',
  'Dubois', 'Laurent', 'Moreau', 'Girard', 'Lefevre', 'Renard', 'Marchand',
  'Navarro', 'Castro', 'Vidal', 'Romero', 'Iglesias',
  'Tanaka', 'Sato', 'Nakamura', 'Yamada', 'Kobayashi',
  'Lindqvist', 'Virtanen', 'Korhonen', 'Halonen',
  'Almeida', 'Carvalho', 'Pereira', 'Ribeiro',
  'Sullivan', 'Brewster', 'Holloway', 'Donahue',
  'Visser', 'Bakker', 'Jansen', 'Mulder',
];

const ROLE_ABBR: Record<StaffRole, string> = {
  'Technical Director': 'td',
  'Race Engineer': 're',
  'Pit Crew Chief': 'pc',
  Strategist: 'st',
};

const ROLE_BIOS: Record<StaffRole, [string, string, string]> = {
  'Technical Director': [
    'Visionary designer with a string of championship-winning cars.',
    'Methodical engineer who delivers steady, reliable upgrades.',
    'Promising up-and-comer making a name in the midfield.',
  ],
  'Race Engineer': [
    'Reads a car like a book and dials in setups others miss.',
    'Calm trackside operator trusted by every driver he works with.',
    'Sharp young engineer hungry to prove himself on the pit wall.',
  ],
  'Pit Crew Chief': [
    'Drills the crew to sub-four-second stops under any pressure.',
    'Reliable hands who rarely puts a wheel wrong in the pit lane.',
    'Energetic chief rebuilding a stop routine from the ground up.',
  ],
  Strategist: [
    'Master of the undercut who wins races from the pit wall.',
    'Data-driven planner with a feel for the safety-car gamble.',
    'Rising analyst with a knack for spotting the bold call.',
  ],
};

function tierIndex(rating: number): 0 | 1 | 2 {
  if (rating >= 80) return 0;
  if (rating >= 50) return 1;
  return 2;
}

// Spread ratings across the role's candidates: a few stars, a solid midfield and
// some cheap rookies, with small seeded jitter so each pool feels distinct.
function ratingForSlot(slot: number, total: number, rng: Rng): number {
  const t = total > 1 ? slot / (total - 1) : 0; // 0 (best) .. 1 (worst)
  const base = 100 - t * 65; // 100 down to ~35
  const jittered = base + rng.variance(6);
  return Math.max(20, Math.min(100, Math.round(jittered)));
}

export function generateStaffPool(
  year: number,
  series: string,
  perRole = PER_ROLE,
): StaffMember[] {
  const rng = createSeededRandom(deriveSeed('staff-pool', series, year));
  const usedNames = new Set<string>();
  const pool: StaffMember[] = [];

  for (const role of STAFF_ROLES) {
    for (let i = 0; i < perRole; i++) {
      const rating = ratingForSlot(i, perRole, rng);

      // Unique full name (retry a few times, then suffix to guarantee uniqueness).
      let first = rng.pick(FIRST_NAMES);
      let last = rng.pick(LAST_NAMES);
      let full = `${first.name} ${last}`;
      let attempts = 0;
      while (usedNames.has(full) && attempts < 8) {
        first = rng.pick(FIRST_NAMES);
        last = rng.pick(LAST_NAMES);
        full = `${first.name} ${last}`;
        attempts += 1;
      }
      if (usedNames.has(full)) full = `${full} ${ROLE_ABBR[role].toUpperCase()}${i}`;
      usedNames.add(full);

      const salary = Math.round((0.4 + (rating / 10 - 1) * 0.5) * 10) / 10;
      const signingFee = Math.round(salary * 0.45 * 10) / 10;

      pool.push({
        id: `staff-${series}-${year}-${ROLE_ABBR[role]}-${i + 1}`,
        name: full,
        role,
        nationality: first.nat,
        rating,
        salary,
        signingFee,
        bio: ROLE_BIOS[role][tierIndex(rating)],
      });
    }
  }

  return pool;
}
