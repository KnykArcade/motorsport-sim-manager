// Race decision engine.
//
// Builds the player-facing decision prompts that pause the live race, and
// applies a chosen option's effects to the relevant car. Prompts are only
// raised for the player's cars; the AI handles the equivalent situations
// silently via the AI strategy engine.

import type {
  LiveCarState,
  RaceDecisionEffects,
  RaceDecisionOption,
  RaceDecisionPrompt,
} from '../types/liveTypes';
import { startStint } from './strategyStint';

let promptCounter = 0;
function promptId(driverId: string, lap: number): string {
  promptCounter += 1;
  return `prompt-${driverId}-${lap}-${promptCounter}`;
}

// --- Prompt builders --------------------------------------------------------

export function rivalPitPrompt(car: LiveCarState, lap: number, rivalName: string): RaceDecisionPrompt {
  return {
    id: promptId(car.driverId, lap),
    driverId: car.driverId,
    category: 'Pit',
    lap,
    title: 'Rival pits early',
    description: `${rivalName} has pitted from just behind. Cover the undercut, stay out, or extend the stint?`,
    options: [
      {
        id: 'cover',
        label: 'Cover — pit now',
        detail: 'Fresh tyres to defend the undercut, but you lose track position briefly.',
        effects: { pitNow: true, note: 'covers the undercut and pits' },
      },
      {
        id: 'stay',
        label: 'Stay out',
        detail: 'Hold track position; vulnerable if their fresh tyres come alive.',
        effects: { paceMode: 'Push', tireWearDelta: 6, note: 'stays out to hold track position' },
      },
      {
        id: 'extend',
        label: 'Extend the stint',
        detail: 'Bank tyre life for a later, stronger stop. Slower for now.',
        effects: { paceMode: 'Conservative', note: 'extends the stint to fight back later' },
      },
    ],
  };
}

export function safetyCarPrompt(car: LiveCarState, lap: number): RaceDecisionPrompt {
  return {
    id: promptId(car.driverId, lap),
    driverId: car.driverId,
    category: 'SafetyCar',
    lap,
    title: 'Safety car deployed',
    description: 'The safety car is out and a stop is cheap right now. Pit, or keep track position?',
    options: [
      {
        id: 'pit',
        label: 'Pit now (cheap stop)',
        detail: 'Take the discounted stop and rejoin close to the field.',
        effects: { pitNow: true, note: 'takes the cheap safety-car stop' },
      },
      {
        id: 'hold',
        label: 'Keep track position',
        detail: 'Stay out and gamble that track position outweighs fresher tyres.',
        effects: { note: 'stays out to keep track position under the safety car' },
      },
    ],
  };
}

export function reliabilityPrompt(car: LiveCarState, lap: number, issueLabel: string): RaceDecisionPrompt {
  return {
    id: promptId(car.driverId, lap),
    driverId: car.driverId,
    category: 'Reliability',
    lap,
    title: 'Reliability warning',
    description: `Driver reports ${issueLabel.toLowerCase()}. Nurse the car or push on?`,
    options: [
      {
        id: 'nurse',
        label: 'Nurse the car',
        detail: 'Back off to protect the car. Lower failure risk, slower pace.',
        effects: { paceMode: 'ProtectEngine', resolveIssue: true, reliabilityRiskDelta: -0.03, note: 'nurses the car to manage the issue' },
      },
      {
        id: 'manage',
        label: 'Manage it',
        detail: 'Ease off slightly and monitor. Balanced risk.',
        effects: { paceMode: 'Conservative', resolveIssue: true, reliabilityRiskDelta: -0.015, note: 'manages the issue at reduced pace' },
      },
      {
        id: 'push',
        label: 'Push on',
        detail: 'Ignore it and keep racing. Higher pace, higher DNF risk.',
        effects: { paceMode: 'Push', reliabilityRiskDelta: 0.03, repairCostRisk: 0.4, note: 'pushes on despite the warning' },
      },
    ],
  };
}

export function rainPrompt(car: LiveCarState, lap: number, heavy: boolean): RaceDecisionPrompt {
  return {
    id: promptId(car.driverId, lap),
    driverId: car.driverId,
    category: 'Weather',
    lap,
    title: heavy ? 'Heavy rain arriving' : 'Light rain beginning',
    description: 'Spots of rain are appearing. Pit for wet tyres, wait a lap, or gamble on it passing?',
    options: [
      {
        id: 'wets',
        label: 'Pit for wets',
        detail: 'Safe call if the rain sticks. Costs time if it stays dry.',
        effects: { pitNow: true, switchCompound: 'Wet', note: 'pits for wet tyres' },
      },
      {
        id: 'wait',
        label: 'Wait a lap',
        detail: 'See if it develops before committing.',
        effects: { paceMode: 'Conservative', note: 'waits a lap before deciding on tyres' },
      },
      {
        id: 'gamble',
        label: 'Gamble it passes',
        detail: 'Stay out on slicks and hope the shower blows through.',
        effects: { paceMode: 'Balanced', tireWearDelta: 4, note: 'gambles on staying out on slicks' },
      },
    ],
  };
}

export function pitWindowPrompt(car: LiveCarState, lap: number): RaceDecisionPrompt {
  const close = car.pit.window?.close ?? lap;
  return {
    id: promptId(car.driverId, lap),
    driverId: car.driverId,
    category: 'Pit',
    lap,
    title: 'Pit window open',
    description: `Your strategist's pit window is open (through lap ${close}). Box this lap for fresh tyres, or stay out and run longer?`,
    options: [
      {
        id: 'box',
        label: 'Box this lap',
        detail: 'Take the planned stop now for fresh tyres.',
        effects: { pitNow: true, note: 'boxes in the pit window' },
      },
      {
        id: 'stay',
        label: 'Stay out',
        detail: 'Run longer — you can still box later in the window.',
        effects: { note: 'stays out and runs longer' },
      },
    ],
  };
}

export function tyreWearPrompt(car: LiveCarState, lap: number): RaceDecisionPrompt {
  return {
    id: promptId(car.driverId, lap),
    driverId: car.driverId,
    category: 'Tires',
    lap,
    title: 'Tyre wear worse than expected',
    description: 'The tyres are falling away faster than planned. Pit early or manage the pace?',
    options: [
      {
        id: 'pit',
        label: 'Pit early',
        detail: 'Fresh rubber now. Lose track position but regain pace.',
        effects: { pitNow: true, note: 'pits early for fresh tyres' },
      },
      {
        id: 'manage',
        label: 'Manage the pace',
        detail: 'Nurse the tyres to the planned window.',
        effects: { paceMode: 'Conservative', tireWearDelta: -8, note: 'manages tyre wear to extend the stint' },
      },
    ],
  };
}

export function teammateBattlePrompt(car: LiveCarState, lap: number, teammateName: string): RaceDecisionPrompt {
  return {
    id: promptId(car.driverId, lap),
    driverId: car.driverId,
    category: 'TeamOrders',
    lap,
    title: 'Teammate battle',
    description: `${car.driverId} is fighting ${teammateName} on track. Let them race or issue team orders?`,
    options: [
      {
        id: 'race',
        label: 'Let them race',
        detail: 'Fair fight — but risk of contact and lost time.',
        effects: { paceMode: 'Push', tireWearDelta: 4, note: 'is allowed to race the teammate' },
      },
      {
        id: 'orders',
        label: 'Issue team orders',
        detail: 'Hold station to protect both cars and the result.',
        effects: { paceMode: 'Balanced', note: 'holds station on team orders' },
      },
    ],
  };
}

export function damagePrompt(car: LiveCarState, lap: number): RaceDecisionPrompt {
  return {
    id: promptId(car.driverId, lap),
    driverId: car.driverId,
    category: 'Damage',
    lap,
    title: 'Damaged front wing',
    description: 'Contact has damaged the front wing. Pit for repairs or stay out?',
    options: [
      {
        id: 'repair',
        label: 'Pit for repairs',
        detail: 'New nose restores pace. Costs a stop.',
        effects: { pitNow: true, note: 'pits to repair front wing damage' },
      },
      {
        id: 'stay',
        label: 'Stay out',
        detail: 'Keep position with a compromised car. Slower and risky.',
        effects: { paceMode: 'Conservative', reliabilityRiskDelta: 0.01, note: 'stays out with a damaged car' },
      },
    ],
  };
}

// --- Applying a chosen option ----------------------------------------------

export function findOption(prompt: RaceDecisionPrompt, optionId: string): RaceDecisionOption | undefined {
  return prompt.options.find((o) => o.id === optionId);
}

// Apply a decision's effects to a car, returning a new car state. `pitNow` is
// represented by scheduling a stop on the next lap; the tick engine executes it.
export function applyDecisionEffects(
  car: LiveCarState,
  effects: RaceDecisionEffects,
  currentLap: number,
): LiveCarState {
  let next: LiveCarState = { ...car };

  if (effects.paceMode && effects.paceMode !== car.paceMode) {
    next.paceMode = effects.paceMode;
    // Reset the stint counter immediately so the card reflects the mode a
    // race decision (weather / safety car / reliability / team order) just imposed.
    next.strategyStint = startStint(effects.paceMode, car.paceMode, currentLap, 'auto');
  } else if (effects.paceMode) {
    next.paceMode = effects.paceMode;
  }

  if (effects.tireWearDelta != null) {
    next.tire = { ...next.tire, wear: clamp(next.tire.wear + effects.tireWearDelta, 0, 100) };
  }

  if (effects.reliabilityRiskDelta != null) {
    next.reliabilityRisk = clamp(next.reliabilityRisk + effects.reliabilityRiskDelta, 0, 0.5);
  }

  if (effects.resolveIssue && next.reliabilityIssue) {
    next.reliabilityIssue = { ...next.reliabilityIssue, managed: true };
  }

  if (effects.pitNow) {
    // Flag the car to box on the next lap; the tick engine executes the stop.
    next.pit = { ...next.pit, pitRequested: true };
  }

  if (effects.retire) {
    next = { ...next, running: false, status: 'DNF', position: null, retiredOnLap: currentLap, lastIncident: effects.note ?? 'Retired' };
  }

  return next;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
