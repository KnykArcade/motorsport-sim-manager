import { describe, expect, it } from 'vitest';
import { rdNodeCatalog, rdNodesById, rdNodesForBranch } from '../data/rd/rdCatalog';
import { RD_BRANCH_IDS } from '../types/rdTypes';
import type { RDCompletedNode } from '../types/rdTypes';
import { createInitialTeamResearch, selectResearchFocus } from './rdEngine';
import { buildRDProjectStartRequest, buildRDTreeRequests, evaluateRDRequestUnlock, rdBranchLabelForSeries } from './rdNodeRules';

function completion(nodeId: string, tier: number): RDCompletedNode {
  return {
    nodeId,
    teamId: 'team-a',
    completedSeasonYear: 1998,
    completedRound: 1,
    branchId: 'engine',
    sourceId: nodeId.split(':')[1],
    tier,
  };
}

describe('complete R&D tree rules', () => {
  it('builds executable requests and effects for all 430 nodes', () => {
    for (const node of rdNodeCatalog) {
      const request = buildRDProjectStartRequest(node, 'F1', 1998);
      expect(request.nodeId).toBe(node.id);
      expect(request.modifierTemplates.length).toBeGreaterThan(0);
      expect(request.seriesWeight).toBeGreaterThan(0);
    }
  });

  it('uses series-specific branch terminology and weights', () => {
    expect(rdBranchLabelForSeries('engine', 'F1')).toBe('Power Unit');
    expect(rdBranchLabelForSeries('engine', 'NASCAR')).toBe('Engine Shop');
    const aero = rdNodesById['aero:A1'];
    expect(buildRDProjectStartRequest(aero, 'F1', 1998).seriesWeight)
      .toBeGreaterThan(buildRDProjectStartRequest(aero, 'NASCAR', 1998).seriesWeight);
  });

  it('adapts hybrid concepts with replacements and blocks unsupported concepts', () => {
    const adapted = buildRDProjectStartRequest(rdNodesById['engine:E13D'], 'F1', 1995);
    expect(adapted.available).toBe(true);
    expect(adapted.displayName).toBe('Fuel System Efficiency');
    const blocked = buildRDProjectStartRequest(rdNodesById['engine:E14D'], 'F1', 1995);
    expect(blocked.available).toBe(false);
    expect(buildRDProjectStartRequest(rdNodesById['engine:E14D'], 'F1', 2014).available).toBe(true);
  });

  it('treats workbook OR prerequisites as alternatives', () => {
    const request = buildRDProjectStartRequest(rdNodesById['engine:E27'], 'F1', 1998);
    let research = selectResearchFocus(createInitialTeamResearch('team-a', 1998), 'engine', 1998);
    expect(evaluateRDRequestUnlock(request, research).unlocked).toBe(false);
    research = { ...research, completedNodes: [completion('engine:E16B', 4)] };
    expect(evaluateRDRequestUnlock(request, research).unlocked).toBe(true);
  });

  it('requires capstones plus the requested number of other mastery nodes', () => {
    const request = buildRDProjectStartRequest(rdNodesById['engine:E28'], 'F1', 1998);
    let research = selectResearchFocus(createInitialTeamResearch('team-a', 1998), 'engine', 1998);
    research = { ...research, completedNodes: [completion('engine:E24', 5), completion('engine:E25', 5)] };
    expect(evaluateRDRequestUnlock(request, research).unlocked).toBe(false);
    research = { ...research, completedNodes: [...research.completedNodes, completion('engine:E26', 5)] };
    expect(evaluateRDRequestUnlock(request, research).unlocked).toBe(true);
  });

  it.each([
    ['F1', 1995], ['F1', 2024], ['NASCAR', 1998], ['IndyCar', 2025],
  ] as const)('keeps every available %s %i branch node reachable', (series, seasonYear) => {
    for (const branchId of RD_BRANCH_IDS) {
      const nodes = rdNodesForBranch(branchId);
      const requests = buildRDTreeRequests(nodes, series, seasonYear);
      let research = selectResearchFocus(createInitialTeamResearch('team-a', seasonYear), branchId, seasonYear);
      let changed = true;
      while (changed) {
        changed = false;
        for (const node of nodes) {
          const request = requests[node.id];
          if (!request.available || research.completedNodes.some((entry) => entry.nodeId === node.id)) continue;
          if (!evaluateRDRequestUnlock(request, research).unlocked) continue;
          research = {
            ...research,
            completedNodes: [...research.completedNodes, {
              nodeId: node.id,
              teamId: research.teamId,
              completedSeasonYear: seasonYear,
              completedRound: 1,
              branchId,
              sourceId: node.sourceId,
              tier: node.tier,
            }],
          };
          changed = true;
        }
      }
      const unreachable = nodes.filter((node) => requests[node.id].available && !research.completedNodes.some((entry) => entry.nodeId === node.id));
      expect(unreachable.map((node) => `${node.id}: ${node.unlockRequirement}`)).toEqual([]);
    }
  });
});
