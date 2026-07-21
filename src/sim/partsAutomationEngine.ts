// Player parts automation: opt-in factory delegation, applied in the same
// post-race step where the player's parts inventory advances. Uses the exact
// engine functions the manual buttons use, so costs, queue limits, and part
// lifecycle behave identically to acting by hand. All toggles default off.

import type { Driver } from '../types/gameTypes';
import type { PartsAutomationSettings, TeamPartsState } from '../types/partsTypes';
import { PART_TYPES } from '../types/partsTypes';
import type { TeamTechnicalState } from '../types/technicalTypes';
import {
  availableSpareParts,
  fitPart,
  fittedPartsForDriver,
  manufacturingQuote,
  repairQuote,
  startPartManufacturing,
  startPartRepair,
} from './partsEngine';

export const AUTO_REPAIR_CONDITION_THRESHOLD = 40;
export const DEFAULT_PARTS_AUTOMATION_BUDGET_CAP = 250_000;

export type PartsAutomationResult = {
  parts: TeamPartsState;
  spend: number;
  decisions: string[];
};

/**
 * Applies the enabled automation toggles to the player's parts inventory.
 * Pure: returns the updated inventory, total cash spent, and a human-readable
 * decision log. The caller charges the budget and records finance entries.
 */
export function runPartsAutomation(args: {
  settings: PartsAutomationSettings;
  parts: TeamPartsState;
  drivers: Driver[];
  technical: TeamTechnicalState | undefined;
  budget: number;
  budgetCap?: number;
  seasonYear: number;
  round: number;
}): PartsAutomationResult {
  const { settings, drivers, technical, seasonYear, round } = args;
  let working = args.parts;
  let spend = 0;
  const decisions: string[] = [];
  const cap = Math.max(0, args.budgetCap ?? settings.budgetCap ?? args.budget);
  let deferredByCeiling = false;
  const remaining = () => Math.max(0, Math.min(args.budget, cap) - spend);

  // Fit before repairing: swapping a worn fitted part for a fresher spare
  // returns the worn one to the spares pool where it can then be repaired
  // (parts can only be repaired while they are spares).
  if (settings.autoFit) {
    for (const driver of drivers) {
      for (const type of PART_TYPES) {
        const fitted = fittedPartsForDriver(working, driver.id).find((part) => part.type === type);
        const spare = availableSpareParts(working, type)[0];
        if (!spare) continue;
        if (fitted && !(fitted.condition < AUTO_REPAIR_CONDITION_THRESHOLD && spare.condition >= fitted.condition + 8)) continue;
        working = fitPart(working, spare.id, driver.id, seasonYear, round);
        decisions.push(`Auto-fit: ${spare.name} fitted to ${driver.name}'s car.`);
      }
    }
  }

  if (settings.autoRepair) {
    const candidates = working.inventory
      .filter((part) => part.status === 'spare' && part.condition < AUTO_REPAIR_CONDITION_THRESHOLD)
      .sort((a, b) => a.condition - b.condition);
    for (const part of candidates) {
      const quote = repairQuote(part);
      if (quote.cost > remaining()) {
        if (args.budget - spend >= quote.cost && cap - spend < quote.cost) deferredByCeiling = true;
        continue;
      }
      const repaired = startPartRepair(working, part.id);
      if (repaired === working) continue;
      working = repaired;
      spend += quote.cost;
      decisions.push(`Auto-repair: ${part.name} sent for repair at ${Math.round(part.condition)}% condition.`);
    }
  }

  if (settings.autoRestock) {
    for (const type of PART_TYPES) {
      if (working.manufacturingQueue.length >= 3) break;
      if (availableSpareParts(working, type).length > 0) continue;
      if (working.manufacturingQueue.some((order) => order.type === type)) continue;
      const order = manufacturingQuote(working, type, 1, technical, seasonYear, round);
      if (order.cost > remaining()) {
        if (args.budget - spend >= order.cost && cap - spend < order.cost) deferredByCeiling = true;
        continue;
      }
      const queued = startPartManufacturing(working, order);
      if (queued === working) continue;
      working = queued;
      spend += order.cost;
      decisions.push(`Auto-restock: ordered a spare ${type.replace(/_/g, ' ')}.`);
    }
  }

  if (deferredByCeiling) decisions.push(`Routine factory work deferred at the $${Math.round(cap / 1000)}k automation ceiling.`);
  return { parts: working, spend, decisions };
}
