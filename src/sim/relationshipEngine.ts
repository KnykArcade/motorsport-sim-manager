// Driver relationships & team orders (Living Universe Phase 7).
//
// Models the human side of a team: team loyalty, engineer chemistry, teammate
// rivalry, morale, frustration and number-one status. During a race the player
// can issue team orders (hold, swap, protect, sacrifice, block, priority pit)
// that actually move on-track positions/pace; afterwards those orders ripple
// into morale, loyalty and the teammate relationship — with extra fallout when a
// number-one driver is asked to yield. Pure and deterministic.

import type { Driver, Team } from '../types/gameTypes';
import type { TeamReputation } from '../types/expectationTypes';
import type {
  DriverRelationship,
  RelationshipConsequence,
  TeamOrder,
  TeamOrderDecision,
} from '../types/relationshipTypes';
import type { LiveCarState, LiveRaceState } from '../types/liveTypes';
import { createSeededRandom, deriveSeed, type Rng } from './random';

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function teamPrestige(team: Team, reputations?: Record<string, TeamReputation>): number {
  return reputations?.[team.id]?.reputation ?? team.reputation;
}

// Order the team's drivers by their roster slot (race seats first, reserves last).
function orderRoster(team: Team, teamDrivers: Driver[]): Driver[] {
  const order = new Map(team.driverIds.map((id, i) => [id, i] as const));
  return [...teamDrivers].sort((x, y) => (order.get(x.id) ?? 99) - (order.get(y.id) ?? 99));
}

function seedRelationship(
  driver: Driver,
  teammate: Driver | undefined,
  team: Team,
  isNumberOne: boolean,
  rng: Rng,
): DriverRelationship {
  const v = () => rng.variance(8);
  const loyalty = clamp(Math.round(48 + (driver.contractYearsRemaining ?? 1) * 4 + v()));
  const chemistry = clamp(Math.round(50 + (driver.ratings.adaptability - 5) * 2 + v()));

  let teammateRel = 62 + rng.variance(8);
  // Two highly-rated drivers in the same garage breed rivalry.
  if (teammate && driver.ratings.overall >= 7 && teammate.ratings.overall >= 7) teammateRel -= 18;
  if (driver.ratings.aggression >= 7) teammateRel -= 8;

  return {
    driverId: driver.id,
    teamId: team.id,
    teammateId: teammate?.id,
    teamLoyalty: loyalty,
    engineerChemistry: chemistry,
    teammateRelationship: clamp(Math.round(teammateRel)),
    morale: clamp(Math.round(driver.morale ?? 60)),
    frustration: clamp(Math.round(18 + v())),
    numberOneExpectation: isNumberOne,
  };
}

// Seed a relationship for every driver on the grid, keyed by driver id. The two
// race-seat drivers of each team are paired as teammates; the stronger one on a
// credible team carries a number-one expectation.
export function createDriverRelationships(
  teams: Team[],
  drivers: Driver[],
  reputations: Record<string, TeamReputation> | undefined,
  seed: string,
): Record<string, DriverRelationship> {
  const byTeam = new Map<string, Driver[]>();
  for (const d of drivers) {
    const arr = byTeam.get(d.teamId) ?? [];
    arr.push(d);
    byTeam.set(d.teamId, arr);
  }

  const rels: Record<string, DriverRelationship> = {};
  for (const team of teams) {
    const roster = orderRoster(team, byTeam.get(team.id) ?? []);
    const active = roster.slice(0, 2);
    const prestige = teamPrestige(team, reputations);
    const lead = active.reduce<Driver | undefined>(
      (best, d) => (!best || d.ratings.overall > best.ratings.overall ? d : best),
      undefined,
    );
    const gap = active.length === 2 ? Math.abs(active[0].ratings.overall - active[1].ratings.overall) : 1;

    roster.forEach((d, i) => {
      const teammate = i === 0 ? active[1] : i === 1 ? active[0] : undefined;
      const isNumberOne =
        i < 2 && !!lead && d.id === lead.id && prestige >= 40 && (gap >= 0.5 || d.ratings.overall >= 8.3);
      const rng = createSeededRandom(deriveSeed(seed, 'relationship', d.id));
      rels[d.id] = seedRelationship(d, teammate, team, isNumberOne, rng);
    });
  }
  return rels;
}

// Carry relationships into a new season: slow-moving loyalty drifts toward
// neutral, another year together builds chemistry, morale/frustration recover,
// and teammate links + number-one status are recomputed for the new line-up.
export function rolloverRelationships(
  prev: Record<string, DriverRelationship> | undefined,
  teams: Team[],
  drivers: Driver[],
  reputations: Record<string, TeamReputation> | undefined,
  seed: string,
): Record<string, DriverRelationship> {
  const reseeded = createDriverRelationships(teams, drivers, reputations, seed);
  const merged: Record<string, DriverRelationship> = {};
  for (const d of drivers) {
    const fresh = reseeded[d.id];
    const before = prev?.[d.id];
    if (before && before.teamId === d.teamId) {
      merged[d.id] = {
        ...fresh,
        teamLoyalty: clamp(Math.round(before.teamLoyalty * 0.85 + 50 * 0.15)),
        engineerChemistry: clamp(before.engineerChemistry + 4),
        morale: clamp(Math.round(before.morale * 0.5 + 60 * 0.5)),
        frustration: clamp(Math.round(before.frustration * 0.6)),
      };
    } else {
      merged[d.id] = fresh;
    }
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Team orders
// ---------------------------------------------------------------------------

export type TeamOrderSpec = {
  order: TeamOrder;
  label: string;
  description: string;
  // Whether the order benefits one nominated driver over the other.
  needsFavored: boolean;
};

export const TEAM_ORDER_SPECS: TeamOrderSpec[] = [
  { order: 'LetThemRace', label: 'Let them race', description: 'Drivers are free to race each other.', needsFavored: false },
  { order: 'HoldPosition', label: 'Hold position', description: 'Maintain the current order and protect the cars.', needsFavored: false },
  { order: 'SwapPositions', label: 'Swap positions', description: 'Give track position to the chosen driver.', needsFavored: true },
  { order: 'ProtectLeadDriver', label: 'Protect lead driver', description: 'The teammate backs the chosen driver and will not attack.', needsFavored: true },
  { order: 'BlockRival', label: 'Block rival', description: 'The chosen driver defends hard against the car behind.', needsFavored: true },
  { order: 'SacrificeSecondDriver', label: 'Sacrifice teammate', description: 'The other driver backs off to aid the chosen driver.', needsFavored: true },
  { order: 'PriorityPitStop', label: 'Priority pit stop', description: 'The chosen driver gets pit-crew priority (quicker stops).', needsFavored: true },
];

// How strongly each favouring order strains the disadvantaged driver.
const FAVOR_SEVERITY: Partial<Record<TeamOrder, number>> = {
  SwapPositions: 1.3,
  SacrificeSecondDriver: 1.15,
  ProtectLeadDriver: 0.9,
  PriorityPitStop: 0.6,
};

function reorder(cars: LiveCarState[]): LiveCarState[] {
  const running = cars.filter((c) => c.running).sort((a, b) => a.totalTime - b.totalTime);
  const retired = cars.filter((c) => !c.running);
  running.forEach((c, i) => {
    c.position = i + 1;
    c.gapToLeader = i === 0 ? 0 : round1(c.totalTime - running[0].totalTime);
    c.interval = i === 0 ? 0 : round1(c.totalTime - running[i - 1].totalTime);
  });
  return [...running, ...retired];
}

// Apply a team order to the live race, moving on-track position/pace immediately.
// Returns the new state plus a human-readable note, or null if the order cannot
// be carried out (e.g. an intra-team order with fewer than two cars running).
export function applyTeamOrderToLive(
  state: LiveRaceState,
  order: TeamOrder,
  favoredDriverId: string | undefined,
  nameOf: (id: string) => string,
): { state: LiveRaceState; note: string } | null {
  const playerRunning = state.cars
    .filter((c) => c.isPlayer && c.running)
    .sort((a, b) => a.totalTime - b.totalTime);
  if (playerRunning.length === 0) return null;

  const needsTwo = order === 'SwapPositions' || order === 'HoldPosition' || order === 'LetThemRace';
  if (needsTwo && playerRunning.length < 2) return null;
  if (TEAM_ORDER_SPECS.find((s) => s.order === order)?.needsFavored && !favoredDriverId) return null;

  // Work on fresh copies so the original state is untouched.
  let cars = state.cars.map((c) => ({ ...c, pit: { ...c.pit }, tire: { ...c.tire } }));
  const get = (id: string) => cars.find((c) => c.driverId === id);
  const setPace = (id: string, mode: LiveCarState['paceMode']) => {
    const c = get(id);
    if (c) c.paceMode = mode;
  };

  const leadCar = playerRunning[0];
  const otherCar = playerRunning[1];
  const favored = favoredDriverId ? get(favoredDriverId) : undefined;
  const disadvantaged =
    favored && otherCar
      ? favored.driverId === leadCar.driverId
        ? otherCar
        : leadCar
      : undefined;
  let note = '';

  switch (order) {
    case 'LetThemRace':
      setPace(leadCar.driverId, 'Balanced');
      if (otherCar) setPace(otherCar.driverId, 'Balanced');
      note = 'Drivers told they are free to race.';
      break;
    case 'HoldPosition':
      setPace(leadCar.driverId, 'Conservative');
      if (otherCar) {
        setPace(otherCar.driverId, 'Conservative');
        const trail = get(otherCar.driverId)!;
        trail.totalTime = Math.max(trail.totalTime, leadCar.totalTime + 0.4);
      }
      note = 'Hold position — maintain the gap and bring the cars home.';
      break;
    case 'SwapPositions':
      if (favored && disadvantaged) {
        const ft = favored.totalTime;
        favored.totalTime = Math.min(ft, disadvantaged.totalTime) - 0.2;
        disadvantaged.totalTime = Math.max(ft, disadvantaged.totalTime);
        setPace(favored.driverId, 'Balanced');
        note = `Positions swapped in favour of ${nameOf(favored.driverId)}.`;
      }
      break;
    case 'ProtectLeadDriver':
      if (favored && disadvantaged) {
        setPace(disadvantaged.driverId, 'Conservative');
        setPace(favored.driverId, 'Balanced');
        if (favored.totalTime > disadvantaged.totalTime) {
          const ft = favored.totalTime;
          favored.totalTime = disadvantaged.totalTime - 0.2;
          disadvantaged.totalTime = ft;
        }
        note = `${nameOf(disadvantaged.driverId)} to protect ${nameOf(favored.driverId)}.`;
      }
      break;
    case 'BlockRival':
      if (favored) {
        setPace(favored.driverId, 'Push');
        note = `${nameOf(favored.driverId)} to defend track position.`;
      }
      break;
    case 'SacrificeSecondDriver':
      if (favored && disadvantaged) {
        setPace(disadvantaged.driverId, 'ProtectEngine');
        favored.totalTime -= 0.6;
        note = `${nameOf(disadvantaged.driverId)} sacrificed to aid ${nameOf(favored.driverId)}.`;
      }
      break;
    case 'PriorityPitStop':
      if (favored) {
        favored.pitLossBase = round1(favored.pitLossBase * 0.85);
        note = `${nameOf(favored.driverId)} given pit-crew priority.`;
      }
      break;
  }

  if (!note) return null;
  cars = reorder(cars);
  return { state: { ...state, cars, events: [...state.events, { lap: state.currentLap, text: note }] }, note };
}

// Build the record of a team-order call, tagging the favoured driver and the
// teammate it disadvantages so the consequences can be resolved post-race.
export function recordTeamOrder(
  raceId: string,
  order: TeamOrder,
  favoredDriverId: string | undefined,
  playerActiveIds: string[],
  lap: number,
): TeamOrderDecision {
  const disadvantagedDriverId =
    favoredDriverId && playerActiveIds.length === 2
      ? playerActiveIds.find((id) => id !== favoredDriverId)
      : undefined;
  return {
    id: `order-${raceId}-${order}-${lap}-${favoredDriverId ?? 'none'}`,
    raceId,
    order,
    favoredDriverId,
    disadvantagedDriverId,
    lap,
  };
}

// ---------------------------------------------------------------------------
// Consequences
// ---------------------------------------------------------------------------

export type TeamOrderResolution = {
  relationships: Record<string, DriverRelationship>;
  consequences: RelationshipConsequence[];
  news: string[];
};

function applyDelta(
  rel: DriverRelationship,
  c: { moraleDelta: number; loyaltyDelta: number; teammateRelationshipDelta: number; frustrationDelta?: number },
): DriverRelationship {
  return {
    ...rel,
    morale: clamp(rel.morale + c.moraleDelta),
    teamLoyalty: clamp(rel.teamLoyalty + c.loyaltyDelta),
    teammateRelationship: clamp(rel.teammateRelationship + c.teammateRelationshipDelta),
    frustration: clamp(rel.frustration + (c.frustrationDelta ?? 0)),
  };
}

// Resolve the fallout of a race's team orders into the relationship map. Favoured
// drivers feel backed (small lift, slight teammate tension); disadvantaged ones
// lose morale/loyalty and gain frustration — much more so for a number-one
// driver asked to yield, which also draws a media reaction.
export function resolveTeamOrderConsequences(
  orders: TeamOrderDecision[],
  relationships: Record<string, DriverRelationship>,
  nameOf: (id: string) => string,
): TeamOrderResolution {
  let rels = { ...relationships };
  const consequences: RelationshipConsequence[] = [];
  const news: string[] = [];

  const record = (driverId: string, c: Omit<RelationshipConsequence, 'driverId'>) => {
    const rel = rels[driverId];
    if (!rel) return;
    rels = {
      ...rels,
      [driverId]: applyDelta(rel, {
        moraleDelta: c.moraleDelta,
        loyaltyDelta: c.loyaltyDelta,
        teammateRelationshipDelta: c.teammateRelationshipDelta,
      }),
    };
    consequences.push({ driverId, ...c });
    if (c.mediaReaction) news.push(c.mediaReaction);
  };

  for (const order of orders) {
    if (order.order === 'LetThemRace') {
      for (const id of [order.favoredDriverId, order.disadvantagedDriverId]) {
        if (id) record(id, { moraleDelta: 1, loyaltyDelta: 0, teammateRelationshipDelta: 3 });
      }
      continue;
    }
    if (order.order === 'HoldPosition') {
      if (order.disadvantagedDriverId)
        record(order.disadvantagedDriverId, { moraleDelta: -2, loyaltyDelta: 0, teammateRelationshipDelta: 0 });
      continue;
    }

    const sev = FAVOR_SEVERITY[order.order];
    if (sev == null || !order.favoredDriverId) continue;
    const favName = nameOf(order.favoredDriverId);

    record(order.favoredDriverId, {
      moraleDelta: 3,
      loyaltyDelta: 1,
      teammateRelationshipDelta: -Math.round(3 * sev),
    });

    const dis = order.disadvantagedDriverId;
    if (!dis) continue;
    const disRel = rels[dis];
    const isNo1 = disRel?.numberOneExpectation ?? false;
    const mult = isNo1 ? 2 : 1;
    const disName = nameOf(dis);
    record(dis, {
      moraleDelta: -Math.round(8 * sev * mult),
      loyaltyDelta: -Math.round((isNo1 ? 6 : 4) * sev),
      teammateRelationshipDelta: -Math.round(8 * sev),
      mediaReaction: isNo1
        ? `${disName} openly questions the team after being told to give best position to ${favName}.`
        : undefined,
    });
    // Frustration tracks the morale hit on the disadvantaged side.
    const updated = rels[dis];
    if (updated) {
      rels = { ...rels, [dis]: { ...updated, frustration: clamp(updated.frustration + Math.round(10 * sev * mult)) } };
    }
  }

  return { relationships: rels, consequences, news };
}
