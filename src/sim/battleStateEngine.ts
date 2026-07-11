import type { CircuitSegmentSet } from '../types/circuitTypes';
import type { LiveCarState } from '../types/liveTypes';
import { classifyCarsByDistance } from './segmentRaceEngine';

export type BattlePhase = 'Setup' | 'Attacking' | 'Defending' | 'SideBySide' | 'Resolved' | 'Cooldown';
export type BattleOutcome = 'CleanPass' | 'FailedAttempt' | 'AttackerLosesTime' | 'DefenderLosesTime' | 'ContinuesSideBySide';

export type BattleState = {
  key: string;
  attackerId: string;
  defenderId: string;
  phase: BattlePhase;
  ticksInPhase: number;
  outcome: BattleOutcome | null;
  cooldownTicks: number;
};

export type BattleResolution = {
  cars: LiveCarState[];
  states: Record<string, BattleState>;
  outcomes: Array<{ attackerId: string; defenderId: string; outcome: BattleOutcome }>;
};

export function stepBattleStates(
  cars: readonly LiveCarState[],
  circuit: CircuitSegmentSet,
  previous: Record<string, BattleState> = {},
  previousCars: readonly LiveCarState[] = cars,
): BattleResolution {
  let working = classifyCarsByDistance(cars);
  const states: Record<string, BattleState> = {};
  const outcomes: BattleResolution['outcomes'] = [];

  for (const state of Object.values(previous)) {
    if (state.phase !== 'Cooldown') continue;
    const cooldownTicks = state.cooldownTicks - 1;
    if (cooldownTicks > 0) states[state.key] = { ...state, cooldownTicks };
  }

  const gated = gateUnresolvedCrossings(working, previousCars, circuit, previous);
  working = gated.cars;
  outcomes.push(...gated.outcomes);
  Object.assign(states, gated.states);

  for (let index = 1; index < working.length; index++) {
    const attacker = working[index];
    const defender = working[index - 1];
    if (!canBattle(attacker, defender, circuit)) continue;
    const key = `${attacker.driverId}>${defender.driverId}`;
    if (states[key]?.phase === 'Cooldown') continue;
    const prior = previous[key];
    if (prior?.phase === 'Cooldown') continue;

    if (!prior) {
      states[key] = battle(key, attacker.driverId, defender.driverId, 'Setup');
      continue;
    }
    if (prior.phase === 'Setup') {
      states[key] = { ...prior, phase: 'Attacking', ticksInPhase: 1 };
      continue;
    }
    if (prior.phase === 'Attacking') {
      states[key] = { ...prior, phase: 'SideBySide', ticksInPhase: 1, outcome: 'ContinuesSideBySide' };
      continue;
    }
    if (prior.phase !== 'SideBySide') continue;

    const outcome = resolveOutcome(attacker, defender, circuit);
    working = applyOutcome(working, attacker.driverId, defender.driverId, outcome, circuit);
    outcomes.push({ attackerId: attacker.driverId, defenderId: defender.driverId, outcome });
    states[key] = { ...prior, phase: 'Cooldown', ticksInPhase: 0, outcome, cooldownTicks: 2 };
  }

  return { cars: classifyCarsByDistance(working), states, outcomes };
}

function gateUnresolvedCrossings(
  cars: LiveCarState[],
  previousCars: readonly LiveCarState[],
  circuit: CircuitSegmentSet,
  previous: Record<string, BattleState>,
): Pick<BattleResolution, 'cars' | 'states' | 'outcomes'> {
  let working = cars;
  const states: Record<string, BattleState> = {};
  const outcomes: BattleResolution['outcomes'] = [];
  const currentIndex = new Map(working.map((car, index) => [car.driverId, index]));
  const priorRunning = previousCars.filter((car) => car.running && !car.pit.inPitThisLap);
  for (let index = 0; index < priorRunning.length - 1; index++) {
    const defender = priorRunning[index];
    const attacker = priorRunning[index + 1];
    if ((currentIndex.get(attacker.driverId) ?? Infinity) >= (currentIndex.get(defender.driverId) ?? -1)) continue;
    const currentAttacker = working.find((car) => car.driverId === attacker.driverId);
    const currentDefender = working.find((car) => car.driverId === defender.driverId);
    if (!currentAttacker || !currentDefender || currentAttacker.pit.inPitThisLap || currentDefender.pit.inPitThisLap) continue;
    const key = `${attacker.driverId}>${defender.driverId}`;
    const prior = previous[key];
    const segment = currentAttacker.positionState
      ? circuit.segments[currentAttacker.positionState.currentSegmentIndex]
      : null;
    if (prior?.phase === 'SideBySide' && segment?.overtakingEligible && segment.sideBySideCapacity >= 2) {
      const outcome = resolveOutcome(currentAttacker, currentDefender, circuit);
      working = applyOutcome(working, attacker.driverId, defender.driverId, outcome, circuit);
      outcomes.push({ attackerId: attacker.driverId, defenderId: defender.driverId, outcome });
      states[key] = { ...prior, phase: 'Cooldown', ticksInPhase: 0, outcome, cooldownTicks: 2 };
    } else {
      working = applyOutcome(working, attacker.driverId, defender.driverId, 'FailedAttempt', circuit);
    }
  }
  return { cars: classifyCarsByDistance(working), states, outcomes };
}

function canBattle(attacker: LiveCarState, defender: LiveCarState, circuit: CircuitSegmentSet): boolean {
  if (!attacker.running || !defender.running || !attacker.positionState || !defender.positionState) return false;
  if (attacker.pit.inPitThisLap || defender.pit.inPitThisLap) return false;
  if (attacker.positionState.trafficPhase !== 'Attacking') return false;
  const segment = circuit.segments[attacker.positionState.currentSegmentIndex];
  return Boolean(segment?.overtakingEligible && segment.sideBySideCapacity >= 2);
}

function resolveOutcome(attacker: LiveCarState, defender: LiveCarState, circuit: CircuitSegmentSet): BattleOutcome {
  const segment = circuit.segments[attacker.positionState!.currentSegmentIndex]!;
  const attackMode = attacker.paceMode === 'Attack' ? 0.25 : attacker.paceMode === 'Push' ? 0.1 : 0;
  const defendMode = defender.paceMode === 'Defend' ? 0.3 : 0;
  const tyreDelta = (defender.tire.wear - attacker.tire.wear) / 100;
  const score = attacker.liveRacePace - defender.liveRacePace + attackMode + tyreDelta - defendMode - segment.overtakingDifficulty * 0.35;
  return score >= -0.05 ? 'CleanPass' : score <= -0.65 ? 'AttackerLosesTime' : 'FailedAttempt';
}

function applyOutcome(
  cars: LiveCarState[],
  attackerId: string,
  defenderId: string,
  outcome: BattleOutcome,
  circuit: CircuitSegmentSet,
): LiveCarState[] {
  const defender = cars.find((car) => car.driverId === defenderId);
  if (!defender?.positionState) return cars;
  return cars.map((car) => {
    if (!car.positionState) return car;
    if (car.driverId === attackerId) {
      const distance = outcome === 'CleanPass'
        ? defender.positionState!.totalRaceDistanceMeters + 0.5
        : defender.positionState!.totalRaceDistanceMeters - (outcome === 'AttackerLosesTime' ? 12 : 5);
      return {
        ...car,
        positionState: reposition(
          car.positionState,
          Math.max(0, distance),
          circuit,
          outcome === 'CleanPass' ? 'RacingLine' : 'Outside',
          outcome === 'CleanPass' ? 'Recovering' : 'Following',
        ),
      };
    }
    if (car.driverId === defenderId && outcome === 'CleanPass') {
      return { ...car, positionState: { ...car.positionState, lane: 'RacingLine', trafficPhase: 'Defending' } };
    }
    return car;
  });
}

function reposition(
  position: NonNullable<LiveCarState['positionState']>,
  totalRaceDistanceMeters: number,
  circuit: CircuitSegmentSet,
  lane: NonNullable<LiveCarState['positionState']>['lane'],
  trafficPhase: NonNullable<LiveCarState['positionState']>['trafficPhase'],
): NonNullable<LiveCarState['positionState']> {
  const completedLaps = Math.floor(totalRaceDistanceMeters / circuit.lapLengthMeters);
  const lapDistance = totalRaceDistanceMeters - completedLaps * circuit.lapLengthMeters;
  let accumulated = 0;
  let currentSegmentIndex = Math.max(0, circuit.segments.length - 1);
  let progressWithinSegment = 1;
  for (const segment of circuit.segments) {
    if (lapDistance <= accumulated + segment.lengthMeters) {
      currentSegmentIndex = segment.index;
      progressWithinSegment = segment.lengthMeters > 0 ? (lapDistance - accumulated) / segment.lengthMeters : 0;
      break;
    }
    accumulated += segment.lengthMeters;
  }
  return {
    ...position,
    completedLaps,
    currentSegmentIndex,
    progressWithinSegment: clamp(progressWithinSegment, 0, 1),
    totalRaceDistanceMeters,
    normalizedLapProgress: circuit.lapLengthMeters > 0 ? lapDistance / circuit.lapLengthMeters : 0,
    lane,
    trafficPhase,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function battle(key: string, attackerId: string, defenderId: string, phase: BattlePhase): BattleState {
  return { key, attackerId, defenderId, phase, ticksInPhase: 1, outcome: null, cooldownTicks: 0 };
}
