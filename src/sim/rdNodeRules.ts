import type { Series } from '../types/gameTypes';
import type {
  RDBranchId,
  RDModifierTemplate,
  RDNodeDefinition,
  RDPrerequisiteTierCount,
  RDProjectRiskLevel,
  RDProjectStartRequest,
  TeamResearchState,
} from '../types/rdTypes';

const SERIES_BRANCH_LABELS: Record<Series, Record<RDBranchId, string>> = {
  F1: {
    engine: 'Power Unit', aero: 'Aerodynamics', reliability: 'Reliability', chassis: 'Vehicle Dynamics',
    tires: 'Tire Science', operations: 'Race Operations', manufacturing: 'Factory & Manufacturing',
    electronics: 'Electronics & Data', driver_staff: 'Driver & Staff', commercial_political: 'Commercial & Politics',
  },
  CART: {
    engine: 'Engine Program', aero: 'Aero & Speedway', reliability: 'Reliability', chassis: 'Chassis & Dampers',
    tires: 'Tire Program', operations: 'Race Operations', manufacturing: 'Race Shop',
    electronics: 'Data Systems', driver_staff: 'Driver & Crew', commercial_political: 'Commercial & Series Relations',
  },
  'Champ Car': {
    engine: 'Engine Program', aero: 'Aero & Speedway', reliability: 'Reliability', chassis: 'Chassis & Dampers',
    tires: 'Tire Program', operations: 'Race Operations', manufacturing: 'Race Shop',
    electronics: 'Data Systems', driver_staff: 'Driver & Crew', commercial_political: 'Commercial & Series Relations',
  },
  IndyCar: {
    engine: 'Engine Program', aero: 'Aero & Speedway', reliability: 'Reliability', chassis: 'Chassis & Dampers',
    tires: 'Tire Program', operations: 'Race Operations', manufacturing: 'Race Shop',
    electronics: 'Data Systems', driver_staff: 'Driver & Crew', commercial_political: 'Commercial & Series Relations',
  },
  NASCAR: {
    engine: 'Engine Shop', aero: 'Aero Platform', reliability: 'Durability', chassis: 'Chassis & Setup',
    tires: 'Tire Management', operations: 'Race Team Operations', manufacturing: 'Fabrication Shop',
    electronics: 'Data & Simulation', driver_staff: 'Driver & Crew', commercial_political: 'Sponsors & Politics',
  },
};

const SERIES_BRANCH_WEIGHTS: Record<Series, Record<RDBranchId, number>> = {
  F1: { engine: 1.05, aero: 1.1, reliability: 1, chassis: 1, tires: 1, operations: 0.95, manufacturing: 1, electronics: 1.05, driver_staff: 0.9, commercial_political: 0.9 },
  CART: { engine: 1, aero: 0.95, reliability: 1.05, chassis: 1.05, tires: 1.05, operations: 1.1, manufacturing: 0.95, electronics: 0.95, driver_staff: 1, commercial_political: 1 },
  'Champ Car': { engine: 1, aero: 0.95, reliability: 1.05, chassis: 1.05, tires: 1.05, operations: 1.1, manufacturing: 0.95, electronics: 0.95, driver_staff: 1, commercial_political: 1 },
  IndyCar: { engine: 1, aero: 0.95, reliability: 1.05, chassis: 1.05, tires: 1.05, operations: 1.1, manufacturing: 0.95, electronics: 1, driver_staff: 1, commercial_political: 1 },
  NASCAR: { engine: 1.05, aero: 0.85, reliability: 1.1, chassis: 1.15, tires: 1.15, operations: 1.1, manufacturing: 1, electronics: 0.9, driver_staff: 1, commercial_political: 1.05 },
};

const CAR_GAIN_BY_TIER = [0, 0.12, 0.18, 0.24, 0.32, 0.42];
const SUPPORT_GAIN_BY_TIER = [0, 0.008, 0.012, 0.018, 0.025, 0.035];

export function rdBranchLabelForSeries(branchId: RDBranchId, series: Series): string {
  return SERIES_BRANCH_LABELS[series][branchId];
}

export function rdBranchWeightForSeries(branchId: RDBranchId, series: Series): number {
  return SERIES_BRANCH_WEIGHTS[series][branchId];
}

export function isHybridContext(series: Series, seasonYear: number): boolean {
  return (series === 'F1' && seasonYear >= 2014) || (series === 'IndyCar' && seasonYear >= 2024);
}

function adaptedName(node: RDNodeDefinition, series: Series, seasonYear: number): string {
  const notes = node.eraNotes;
  const nonHybrid = !isHybridContext(series, seasonYear);
  if (nonHybrid && /hybrid/i.test(node.name + notes)) {
    const replacement = notes.match(/replace(?:d)? with ([^.\n;]+)/i)?.[1]?.trim();
    if (replacement) return replacement;
    return node.name.replace(/Hybrid/gi, 'Power').replace(/Energy Deployment/gi, 'Engine Mapping');
  }
  if (series === 'F1' && /oval/i.test(node.mainEffects + notes)) {
    const replacement = notes.match(/replaced by ([^.\n;]+)/i)?.[1]?.trim();
    if (replacement) return replacement;
  }
  return node.name;
}

function nodeAvailability(node: RDNodeDefinition, series: Series, seasonYear: number): Pick<RDProjectStartRequest, 'available' | 'availabilityLabel' | 'availabilityReason' | 'displayName'> {
  const hybrid = isHybridContext(series, seasonYear);
  const combined = `${node.unlockRequirement} ${node.eraNotes}`;
  const replacement = /replace(?:d)? with |older eras (?:may )?(?:use|rename|focus)|pre-hybrid years replace/i.test(combined);
  const explicitHybridOnly = /hybrid(?:-| )era(?:s)? only|hybrid\/energy rules active/i.test(combined);
  if (explicitHybridOnly && !hybrid && !replacement) {
    return {
      available: false,
      availabilityLabel: 'Unavailable in this era',
      availabilityReason: 'This concept requires an active hybrid or energy-recovery ruleset.',
      displayName: adaptedName(node, series, seasonYear),
    };
  }

  const adapted = adaptedName(node, series, seasonYear);
  const isAdapted = adapted !== node.name || (explicitHybridOnly && !hybrid);
  return {
    available: true,
    availabilityLabel: isAdapted ? 'Era-adapted concept' : 'Native era fit',
    availabilityReason: isAdapted ? `Presented as ${adapted} for ${seasonYear} ${series}.` : undefined,
    displayName: adapted,
  };
}

function riskForNode(node: RDNodeDefinition): RDProjectRiskLevel {
  const riskText = `${node.tradeoffsAndRisks} ${node.mainEffects}`.toLowerCase();
  let level = node.tier <= 1 ? 0 : node.tier === 2 ? 1 : node.tier === 3 ? 1 : node.tier === 4 ? 2 : 3;
  if (/legality|protest|failure risk|backfire|experimental|scrutiny/.test(riskText)) level += 1;
  return (['Safe', 'Standard', 'Aggressive', 'Experimental'] as const)[Math.min(3, level)];
}

function prerequisiteGroups(node: RDNodeDefinition): string[][] {
  const groups: string[][] = [];
  const idPattern = /\b([A-Z]{1,3}\d+[A-Z]?)\b/g;
  for (const clause of node.unlockRequirement.split(/[;\n]+/)) {
    const matches = [...clause.matchAll(idPattern)];
    if (matches.length === 0) continue;
    let group = [`${node.branchId}:${matches[0][1]}`];
    for (let index = 1; index < matches.length; index += 1) {
      const previous = matches[index - 1];
      const current = matches[index];
      const between = clause.slice((previous.index ?? 0) + previous[0].length, current.index ?? 0);
      if (/\bor\b/i.test(between)) {
        group.push(`${node.branchId}:${current[1]}`);
      } else {
        groups.push(group);
        group = [`${node.branchId}:${current[1]}`];
      }
    }
    groups.push(group);
  }
  return groups;
}

function prerequisiteTierCounts(node: RDNodeDefinition): RDPrerequisiteTierCount[] {
  const counts: RDPrerequisiteTierCount[] = [];
  for (const match of node.unlockRequirement.matchAll(/at least\s+(\d+)\s+(other\s+)?Tier\s+(\d+)/gi)) {
    counts.push({
      count: Number(match[1]),
      tier: Number(match[3]),
      excludeNodeIds: match[2] ? prerequisiteGroups(node).flat() : undefined,
    });
  }
  for (const match of node.unlockRequirement.matchAll(/(?:one|a)\s+Tier\s+(\d+)\s+(?:path|node)[^.;\n]*/gi)) {
    counts.push({ count: 1, tier: Number(match[1]), allowActive: /started/i.test(match[0]) });
  }
  for (const match of node.unlockRequirement.matchAll(/\b(\d+)\s+Tier\s+(\d+)\s+nodes?/gi)) {
    const candidate = { count: Number(match[1]), tier: Number(match[2]) };
    if (!counts.some((entry) => entry.count === candidate.count && entry.tier === candidate.tier)) counts.push(candidate);
  }
  return counts;
}

function primaryModifiers(node: RDNodeDefinition, seriesWeight: number): RDModifierTemplate[] {
  const carGain = Number((CAR_GAIN_BY_TIER[node.tier] * seriesWeight).toFixed(3));
  const supportGain = Number((SUPPORT_GAIN_BY_TIER[node.tier] * seriesWeight).toFixed(4));
  const description = `${node.name} (${node.path})`;
  const modifiers: RDModifierTemplate[] = [];
  switch (node.branchId) {
    case 'engine': modifiers.push({ scope: 'car', target: 'enginePower', value: carGain, description }); break;
    case 'aero': modifiers.push({ scope: 'car', target: 'aeroEfficiency', value: carGain, description }); break;
    case 'reliability': modifiers.push({ scope: 'car', target: 'reliability', value: carGain, description }); break;
    case 'chassis': modifiers.push({ scope: 'car', target: 'mechanicalGrip', value: carGain, description }); break;
    case 'tires':
      modifiers.push({ scope: 'car', target: 'mechanicalGrip', value: Number((carGain * 0.45).toFixed(3)), description });
      modifiers.push({ scope: 'race_weekend', target: 'tireKnowledge', value: supportGain, description });
      break;
    case 'operations': modifiers.push({ scope: 'car', target: 'pitCrewOperations', value: carGain, description }); break;
    case 'manufacturing': modifiers.push({ scope: 'department', target: 'manufacturingQuality', value: supportGain, description }); break;
    case 'electronics':
      modifiers.push({ scope: 'race_weekend', target: 'dataAccuracy', value: supportGain, description });
      if (/reliab|failure|health|diagnos/i.test(node.mainEffects)) modifiers.push({ scope: 'car', target: 'reliability', value: Number((carGain * 0.3).toFixed(3)), description });
      break;
    case 'driver_staff': modifiers.push({ scope: 'department', target: 'driverFeedback', value: supportGain, description }); break;
    case 'commercial_political': modifiers.push({ scope: 'finance', target: 'developmentFunding', value: supportGain, description }); break;
  }
  if (/cost|budget|funding/i.test(node.mainEffects) && node.branchId !== 'commercial_political') {
    modifiers.push({ scope: 'finance', target: 'developmentFunding', value: Number((supportGain * 0.5).toFixed(4)), description });
  }
  if (/legality|protest|scrutiny/i.test(node.tradeoffsAndRisks)) {
    modifiers.push({ scope: 'risk', target: 'legalityExposure', value: Number((supportGain * 0.5).toFixed(4)), description });
  }
  return modifiers;
}

export function buildRDProjectStartRequest(node: RDNodeDefinition, series: Series, seasonYear: number): RDProjectStartRequest {
  const availability = nodeAvailability(node, series, seasonYear);
  let seriesWeight = rdBranchWeightForSeries(node.branchId, series);
  const combined = `${node.mainEffects} ${node.eraNotes}`;
  if (/oval/i.test(combined)) seriesWeight *= series === 'F1' ? 0.75 : 1.1;
  if (/hybrid/i.test(combined)) seriesWeight *= isHybridContext(series, seasonYear) ? 1.1 : 0.85;
  seriesWeight = Number(seriesWeight.toFixed(3));
  return {
    nodeId: node.id,
    sourceId: node.sourceId,
    nodeName: node.name,
    displayName: availability.displayName,
    branchId: node.branchId,
    tier: node.tier,
    path: node.path,
    cashCostBand: node.cashCostBand,
    tppCostBand: node.tppCostBand,
    durationBand: node.durationBand,
    riskLevel: riskForNode(node),
    prerequisiteGroups: prerequisiteGroups(node),
    prerequisiteTierCounts: prerequisiteTierCounts(node),
    available: availability.available,
    availabilityLabel: availability.availabilityLabel,
    availabilityReason: availability.availabilityReason,
    seriesWeight,
    modifierTemplates: primaryModifiers(node, seriesWeight),
    contextSeries: series,
    contextSeasonYear: seasonYear,
  };
}

export function buildRDTreeRequests(nodes: readonly RDNodeDefinition[], series: Series, seasonYear: number): Record<string, RDProjectStartRequest> {
  const requests = Object.fromEntries(nodes.map((node) => [node.id, buildRDProjectStartRequest(node, series, seasonYear)]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const request of Object.values(requests)) {
      if (!request.available) continue;
      const blockedGroup = request.prerequisiteGroups.find((group) => group.length > 0 && group.every((nodeId) => requests[nodeId] && !requests[nodeId].available));
      if (!blockedGroup) continue;
      request.available = false;
      request.availabilityLabel = 'Unavailable in this era';
      request.availabilityReason = `Required concept ${blockedGroup.join(' or ')} is unavailable in this ruleset.`;
      changed = true;
    }
  }
  return requests;
}

export type RDNodeUnlockEvaluation = { unlocked: boolean; reasons: string[] };

export function evaluateRDRequestUnlock(request: RDProjectStartRequest, research: TeamResearchState): RDNodeUnlockEvaluation {
  const reasons: string[] = [];
  if (!request.available) reasons.push(request.availabilityReason ?? 'Unavailable in this series or era.');
  if (research.focus?.branchId !== request.branchId) reasons.push('Outside the current research focus.');
  const completedIds = new Set(research.completedNodes.map((node) => node.nodeId));
  for (const group of request.prerequisiteGroups) {
    if (!group.some((nodeId) => completedIds.has(nodeId))) reasons.push(`Requires ${group.join(' or ')}.`);
  }
  for (const requirement of request.prerequisiteTierCounts) {
    const excluded = new Set(requirement.excludeNodeIds ?? []);
    const completed = research.completedNodes.filter((node) => node.branchId === request.branchId && node.tier === requirement.tier && !excluded.has(node.nodeId));
    const active = requirement.allowActive
      ? research.activeProjects.filter((node) => node.branchId === request.branchId && node.tier === requirement.tier && !excluded.has(node.nodeId))
      : [];
    const count = new Set([...completed.map((node) => node.nodeId), ...active.map((node) => node.nodeId)]).size;
    if (count < requirement.count) reasons.push(`Requires ${requirement.count} completed Tier ${requirement.tier} node${requirement.count === 1 ? '' : 's'}.`);
  }
  return { unlocked: reasons.length === 0, reasons };
}
