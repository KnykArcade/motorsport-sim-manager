import { describe, expect, it } from 'vitest';
import { RD_BRANCH_IDS } from '../../types/rdTypes';
import { rdNodeCatalog, rdNodesById, rdNodesForBranch } from './rdCatalog';

describe('R&D alignment catalog', () => {
  it('contains 430 globally unique nodes across ten balanced branches', () => {
    expect(rdNodeCatalog).toHaveLength(430);
    expect(new Set(rdNodeCatalog.map((node) => node.id)).size).toBe(430);
    for (const branchId of RD_BRANCH_IDS) {
      expect(rdNodesForBranch(branchId)).toHaveLength(43);
    }
  });

  it('namespaces source IDs that collide between branches', () => {
    expect(rdNodesById['chassis:C1']?.name).toBe('Suspension Geometry Basics');
    expect(rdNodesById['commercial_political:C1']?.name).toBe('Commercial Baseline Audit');
  });

  it('only references prerequisite nodes that exist in the catalog', () => {
    for (const node of rdNodeCatalog) {
      for (const prerequisite of node.prerequisiteNodeIds) {
        expect(rdNodesById[prerequisite], `${node.id} -> ${prerequisite}`).toBeDefined();
      }
    }
  });

  it('normalizes every cost and duration into runtime bands', () => {
    const costBands = new Set(['Low', 'Medium', 'High', 'Very High', 'Extreme']);
    const durationBands = new Set(['Short', 'Medium', 'Long', 'Very Long', 'Season Project']);
    for (const node of rdNodeCatalog) {
      expect(costBands.has(node.cashCostBand)).toBe(true);
      expect(costBands.has(node.tppCostBand)).toBe(true);
      expect(durationBands.has(node.durationBand)).toBe(true);
    }
  });
});
