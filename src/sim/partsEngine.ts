import type { Car, CarRatings, Driver, RaceResult, Series, Team, Track } from '../types/gameTypes';
import type {
  CarPart,
  PartManufacturingOrder,
  PartsHistoryEntry,
  PartsProgressResult,
  PartType,
  TeamPartsMap,
  TeamPartsState,
} from '../types/partsTypes';
import { PART_TYPES } from '../types/partsTypes';
import type { RDBranchId, TeamResearchState } from '../types/rdTypes';

export const PART_SPECS: Record<PartType, {
  label: string;
  baseCost: number;
  buildRounds: number;
  baseWear: number;
  ratingTargets: Array<keyof CarRatings>;
  researchBranches: RDBranchId[];
}> = {
  power_unit: { label: 'Power Unit', baseCost: 1_800_000, buildRounds: 3, baseWear: 7, ratingTargets: ['enginePower', 'reliability'], researchBranches: ['engine', 'reliability'] },
  gearbox: { label: 'Gearbox', baseCost: 850_000, buildRounds: 2, baseWear: 8, ratingTargets: ['mechanicalGrip', 'reliability'], researchBranches: ['chassis', 'reliability'] },
  aero: { label: 'Aero Package', baseCost: 700_000, buildRounds: 2, baseWear: 4, ratingTargets: ['aeroEfficiency'], researchBranches: ['aero'] },
  brakes: { label: 'Brake Assembly', baseCost: 300_000, buildRounds: 1, baseWear: 7, ratingTargets: ['mechanicalGrip', 'reliability'], researchBranches: ['chassis', 'operations'] },
  suspension: { label: 'Suspension', baseCost: 450_000, buildRounds: 2, baseWear: 6, ratingTargets: ['mechanicalGrip', 'aeroEfficiency'], researchBranches: ['chassis', 'aero'] },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function activeDriverIds(team: Team, drivers: Driver[]): string[] {
  const roster = new Map(drivers.filter((driver) => driver.teamId === team.id).map((driver) => [driver.id, driver]));
  const ordered = team.driverIds
    .map((id) => roster.get(id))
    .filter((driver): driver is Driver => Boolean(driver))
    .filter((driver) => !driver.contractType || driver.contractType === 'seat');
  return ordered.slice(0, 2).map((driver) => driver.id);
}

function historyEntry(
  state: TeamPartsState,
  seasonYear: number,
  round: number,
  type: PartsHistoryEntry['type'],
  description: string,
  partId?: string,
  driverId?: string,
): PartsHistoryEntry {
  return {
    id: `${state.teamId}-${seasonYear}-${round}-${type}-${state.history.length + 1}`,
    seasonYear,
    round,
    type,
    description,
    partId,
    driverId,
  };
}

function makePart(
  state: TeamPartsState,
  type: PartType,
  seasonYear: number,
  round: number,
  status: CarPart['status'],
  driverId?: string,
  design?: Pick<PartManufacturingOrder, 'designGeneration' | 'sourceNodeIds' | 'ratingDeltas' | 'cost' | 'quantity'>,
): CarPart {
  const serial = state.nextSerial;
  const spec = PART_SPECS[type];
  return {
    id: `${state.teamId}-${seasonYear}-${type}-${serial}`,
    serial,
    teamId: state.teamId,
    type,
    name: `${spec.label} #${serial}`,
    status,
    fittedDriverId: driverId,
    condition: 100,
    maximumCondition: 100,
    racesUsed: 0,
    designGeneration: design?.designGeneration ?? 0,
    sourceNodeIds: design?.sourceNodeIds ?? [],
    ratingDeltas: design?.ratingDeltas ?? {},
    buildCost: design ? Math.round(design.cost / Math.max(1, design.quantity)) : spec.baseCost,
    createdSeasonYear: seasonYear,
    createdRound: round,
  };
}

export function createInitialTeamPartsState(
  team: Team,
  drivers: Driver[],
  seasonYear: number,
): TeamPartsState {
  let state: TeamPartsState = { teamId: team.id, nextSerial: 1, inventory: [], manufacturingQueue: [], history: [] };
  const driverIds = activeDriverIds(team, drivers);
  for (const type of PART_TYPES) {
    for (const driverId of driverIds) {
      state.inventory.push(makePart(state, type, seasonYear, 0, 'fitted', driverId));
      state = { ...state, nextSerial: state.nextSerial + 1 };
    }
    state.inventory.push(makePart(state, type, seasonYear, 0, 'spare'));
    state = { ...state, nextSerial: state.nextSerial + 1 };
  }
  return state;
}

export function createInitialTeamPartsMap(
  teams: Team[],
  drivers: Driver[],
  seasonYear: number,
): TeamPartsMap {
  return Object.fromEntries(teams.map((team) => [team.id, createInitialTeamPartsState(team, drivers, seasonYear)]));
}

export function ensureTeamPartsMap(
  existing: TeamPartsMap | undefined,
  teams: Team[],
  drivers: Driver[],
  seasonYear: number,
): TeamPartsMap {
  const map: TeamPartsMap = { ...(existing ?? {}) };
  for (const team of teams) {
    const current = map[team.id];
    if (!current || !Array.isArray(current.inventory) || current.inventory.length === 0) {
      map[team.id] = createInitialTeamPartsState(team, drivers, seasonYear);
      continue;
    }
    map[team.id] = {
      ...current,
      nextSerial: current.nextSerial ?? current.inventory.length + 1,
      manufacturingQueue: current.manufacturingQueue ?? [],
      history: current.history ?? [],
      inventory: current.inventory.map((part) => ({
        ...part,
        maximumCondition: part.maximumCondition ?? 100,
        racesUsed: part.racesUsed ?? 0,
        designGeneration: part.designGeneration ?? 0,
        sourceNodeIds: part.sourceNodeIds ?? [],
        ratingDeltas: part.ratingDeltas ?? {},
      })),
    };
  }
  return map;
}

export function rolloverTeamPartsMap(
  existing: TeamPartsMap | undefined,
  teams: Team[],
  drivers: Driver[],
  seasonYear: number,
): TeamPartsMap {
  const previous = existing ?? {};
  return Object.fromEntries(teams.map((team) => {
    const fresh = createInitialTeamPartsState(team, drivers, seasonYear);
    const history = previous[team.id]?.history ?? [];
    return [team.id, { ...fresh, history: history.slice(-100) }];
  }));
}

export function latestPartDesign(
  type: PartType,
  research: TeamResearchState | undefined,
): Pick<PartManufacturingOrder, 'designGeneration' | 'sourceNodeIds' | 'ratingDeltas'> {
  const spec = PART_SPECS[type];
  const relevant = (research?.completedNodes ?? [])
    .filter((node) => node.branchId && spec.researchBranches.includes(node.branchId))
    .sort((a, b) => (b.tier ?? 0) - (a.tier ?? 0));
  const generation = relevant.reduce((best, node) => Math.max(best, node.tier ?? 0), 0);
  const sourceNodeIds = relevant.slice(0, 4).map((node) => node.nodeId);
  const factoryQuality = (research?.modifiers ?? [])
    .filter((modifier) => modifier.scope === 'department' && modifier.target === 'manufacturingQuality')
    .reduce((total, modifier) => total + modifier.value, 0);
  const designGain = Math.min(2.5, generation * 0.3 + Math.max(0, factoryQuality) * 2);
  const ratingDeltas: Partial<CarRatings> = {};
  for (const target of spec.ratingTargets) {
    ratingDeltas[target] = target === 'reliability' ? designGain * 0.55 : designGain;
  }
  return { designGeneration: generation, sourceNodeIds, ratingDeltas };
}

export function manufacturingQuote(
  state: TeamPartsState,
  type: PartType,
  quantity: number,
  research: TeamResearchState | undefined,
  seasonYear: number,
  round: number,
): PartManufacturingOrder {
  const spec = PART_SPECS[type];
  const design = latestPartDesign(type, research);
  const factoryQuality = (research?.modifiers ?? [])
    .filter((modifier) => modifier.scope === 'department' && modifier.target === 'manufacturingQuality')
    .reduce((total, modifier) => total + modifier.value, 0);
  const totalRounds = Math.max(1, Math.ceil(spec.buildRounds * (1 - clamp(factoryQuality, 0, 0.35))));
  const safeQuantity = clamp(Math.round(quantity), 1, 4);
  const cost = Math.round(spec.baseCost * safeQuantity * (1 + design.designGeneration * 0.08));
  return {
    id: `${state.teamId}-${seasonYear}-${round}-${type}-order-${state.manufacturingQueue.length + 1}`,
    teamId: state.teamId,
    type,
    quantity: safeQuantity,
    roundsRemaining: totalRounds,
    totalRounds,
    cost,
    ...design,
    orderedSeasonYear: seasonYear,
    orderedRound: round,
  };
}

export function startPartManufacturing(
  state: TeamPartsState,
  order: PartManufacturingOrder,
): TeamPartsState {
  if (state.manufacturingQueue.length >= 3) return state;
  return { ...state, manufacturingQueue: [...state.manufacturingQueue, order] };
}

export function fitPart(
  state: TeamPartsState,
  partId: string,
  driverId: string,
  seasonYear: number,
  round: number,
): TeamPartsState {
  const selected = state.inventory.find((part) => part.id === partId);
  if (!selected || selected.status !== 'spare' || selected.condition <= 0) return state;
  const inventory = state.inventory.map((part) => {
    if (part.type === selected.type && part.fittedDriverId === driverId && part.status === 'fitted') {
      return { ...part, status: 'spare' as const, fittedDriverId: undefined };
    }
    if (part.id === partId) return { ...part, status: 'fitted' as const, fittedDriverId: driverId };
    return part;
  });
  return {
    ...state,
    inventory,
    history: [...state.history, historyEntry(state, seasonYear, round, 'fitted', `${selected.name} fitted`, partId, driverId)].slice(-100),
  };
}

export function transferFittedParts(
  state: TeamPartsState,
  fromDriverId: string,
  toDriverId: string,
): TeamPartsState {
  if (fromDriverId === toDriverId) return state;
  const hasParts = state.inventory.some((part) => part.status === 'fitted' && part.fittedDriverId === fromDriverId);
  if (!hasParts) return state;
  return {
    ...state,
    inventory: state.inventory.map((part) => part.status === 'fitted' && part.fittedDriverId === fromDriverId
      ? { ...part, fittedDriverId: toDriverId }
      : part),
  };
}

export function repairQuote(part: CarPart): { cost: number; rounds: number } {
  const damage = Math.max(0, part.maximumCondition - part.condition);
  return {
    cost: Math.max(25_000, Math.round(part.buildCost * Math.min(0.6, damage / 100 * 0.75))),
    rounds: damage >= 45 ? 2 : 1,
  };
}

export function startPartRepair(state: TeamPartsState, partId: string): TeamPartsState {
  const selected = state.inventory.find((part) => part.id === partId);
  if (!selected || selected.status !== 'spare' || selected.condition >= selected.maximumCondition - 1) return state;
  const quote = repairQuote(selected);
  return {
    ...state,
    inventory: state.inventory.map((part) => part.id === partId
      ? { ...part, status: 'repairing' as const, repairRoundsRemaining: quote.rounds, repairCost: quote.cost }
      : part),
  };
}

export function retirePart(
  state: TeamPartsState,
  partId: string,
  seasonYear: number,
  round: number,
): TeamPartsState {
  const selected = state.inventory.find((part) => part.id === partId);
  if (!selected || selected.status === 'fitted' || selected.status === 'repairing' || selected.status === 'retired') return state;
  return {
    ...state,
    inventory: state.inventory.map((part) => part.id === partId ? { ...part, status: 'retired' as const } : part),
    history: [...state.history, historyEntry(state, seasonYear, round, 'retired', `${selected.name} retired`, partId)].slice(-100),
  };
}

function trackWearMultiplier(type: PartType, track: Track): number {
  const profile = track.setupProfile;
  const demand = type === 'power_unit' ? profile.powerDemand
    : type === 'aero' ? profile.aeroDemand
      : type === 'brakes' ? profile.brakeDemand
        : type === 'suspension' ? profile.mechanicalDemand
          : (profile.powerDemand + profile.mechanicalDemand) / 2;
  return 0.75 + clamp(demand, 1, 100) / 200;
}

export function progressPartsAfterRace(
  state: TeamPartsState,
  results: RaceResult[],
  track: Track,
  seasonYear: number,
  round: number,
): PartsProgressResult {
  const resultByDriver = new Map(results.filter((result) => result.teamId === state.teamId).map((result) => [result.driverId, result]));
  const messages: string[] = [];
  const history = [...state.history];
  let inventory = state.inventory.map((part) => {
    if (part.status === 'repairing') {
      const remaining = Math.max(0, (part.repairRoundsRemaining ?? 1) - 1);
      if (remaining === 0) {
        const maximumCondition = Math.max(75, part.maximumCondition - 2);
        messages.push(`${part.name} repair completed.`);
        history.push(historyEntry(state, seasonYear, round, 'repaired', `${part.name} repaired to ${maximumCondition}%`, part.id));
        return { ...part, status: 'spare' as const, condition: maximumCondition, maximumCondition, repairRoundsRemaining: undefined, repairCost: undefined };
      }
      return { ...part, repairRoundsRemaining: remaining };
    }
    if (part.status !== 'fitted' || !part.fittedDriverId) return part;
    const result = resultByDriver.get(part.fittedDriverId);
    if (!result) return part;
    const crash = result.incidents.some((incident) => /crash|collision|contact|accident/i.test(incident));
    const mechanical = result.status === 'DNF' && result.incidents.some((incident) => /engine|gearbox|brake|suspension|mechanical|hydraulic|electrical|cooling/i.test(incident));
    let wear = PART_SPECS[part.type].baseWear * trackWearMultiplier(part.type, track);
    if (result.status === 'DNF') wear += mechanical ? 10 : 4;
    if (crash && (part.type === 'aero' || part.type === 'suspension' || part.type === 'brakes')) wear += 12;
    const condition = clamp(Math.round((part.condition - wear) * 10) / 10, 1, part.maximumCondition);
    if (condition < 25 && part.condition >= 25) messages.push(`${part.name} is now critical at ${Math.round(condition)}% condition.`);
    history.push(historyEntry(state, seasonYear, round, 'worn', `${part.name} finished the round at ${Math.round(condition)}%`, part.id, part.fittedDriverId));
    return { ...part, condition, racesUsed: part.racesUsed + 1, lastUsedRound: round };
  });

  let nextSerial = state.nextSerial;
  const queue: PartManufacturingOrder[] = [];
  for (const order of state.manufacturingQueue) {
    const roundsRemaining = Math.max(0, order.roundsRemaining - 1);
    if (roundsRemaining > 0) {
      queue.push({ ...order, roundsRemaining });
      continue;
    }
    for (let index = 0; index < order.quantity; index += 1) {
      const workingState = { ...state, inventory, nextSerial, history };
      const part = makePart(workingState, order.type, seasonYear, round, 'spare', undefined, order);
      inventory = [...inventory, part];
      history.push(historyEntry(workingState, seasonYear, round, 'manufactured', `${part.name} completed`, part.id));
      nextSerial += 1;
    }
    messages.push(`${order.quantity} ${PART_SPECS[order.type].label}${order.quantity > 1 ? 's' : ''} completed by manufacturing.`);
  }

  return {
    state: { ...state, inventory, manufacturingQueue: queue, nextSerial, history: history.slice(-100) },
    messages,
  };
}

export function fittedPartsForDriver(state: TeamPartsState | undefined, driverId: string): CarPart[] {
  return state?.inventory.filter((part) => part.status === 'fitted' && part.fittedDriverId === driverId) ?? [];
}

export function carWithFittedParts(car: Car, parts: TeamPartsState | undefined, driverId: string): Car {
  const fitted = fittedPartsForDriver(parts, driverId);
  if (fitted.length === 0) return car;
  const developmentLevel = { ...car.developmentLevel };
  for (const part of fitted) {
    const conditionPenalty = part.condition < 60 ? (60 - part.condition) * 0.06 : 0;
    for (const [key, rawValue] of Object.entries(part.ratingDeltas)) {
      const rating = key as keyof CarRatings;
      developmentLevel[rating] = (developmentLevel[rating] ?? 0) + (rawValue ?? 0);
    }
    for (const rating of PART_SPECS[part.type].ratingTargets) {
      developmentLevel[rating] = (developmentLevel[rating] ?? 0) - conditionPenalty;
    }
  }
  const condition = fitted.reduce((total, part) => total + part.condition, 0) / fitted.length;
  developmentLevel.reliability += Math.min(0, (condition - 70) * 0.12);
  const conditionFor = (type: PartType) => fitted.find((part) => part.type === type)?.condition;
  return {
    ...car,
    condition,
    developmentLevel,
    componentCondition: {
      powerUnit: conditionFor('power_unit'),
      gearbox: conditionFor('gearbox'),
      aero: conditionFor('aero'),
      brakes: conditionFor('brakes'),
      suspension: conditionFor('suspension'),
    },
  };
}

export function availableSpareParts(state: TeamPartsState, type: PartType): CarPart[] {
  return state.inventory
    .filter((part) => part.type === type && part.status === 'spare')
    .sort((a, b) => b.condition - a.condition || b.designGeneration - a.designGeneration);
}

export function partConditionLabel(condition: number): 'Fresh' | 'Good' | 'Worn' | 'Critical' {
  if (condition >= 85) return 'Fresh';
  if (condition >= 60) return 'Good';
  if (condition >= 30) return 'Worn';
  return 'Critical';
}

export function seriesPartLabel(type: PartType, series: Series): string {
  if (type === 'power_unit' && series === 'NASCAR') return 'Engine';
  if (type === 'power_unit' && (series === 'CART' || series === 'Champ Car' || series === 'IndyCar')) return 'Engine Assembly';
  return PART_SPECS[type].label;
}
