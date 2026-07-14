import type { RDBranchId, RDNodeDefinition } from '../../types/rdTypes';
import { rdNodeCatalog } from './rdNodes.generated';

export const rdNodesById = Object.fromEntries(
  rdNodeCatalog.map((node) => [node.id, node]),
) as Record<string, RDNodeDefinition>;

export function rdNodesForBranch(branchId: RDBranchId): readonly RDNodeDefinition[] {
  return rdNodeCatalog.filter((node) => node.branchId === branchId);
}

export { rdNodeCatalog };
