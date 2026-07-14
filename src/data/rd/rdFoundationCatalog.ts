import type { RDBranchId, RDModifierScope } from '../../types/rdTypes';

export type RDBranchMetadata = {
  id: RDBranchId;
  label: string;
  shortLabel: string;
  description: string;
};

export type RDFoundationProjectDefinition = {
  nodeId: string;
  sourceId: string;
  branchId: RDBranchId;
  name: string;
  modifier: {
    scope: RDModifierScope;
    target: string;
    value: number;
    description: string;
  };
};

export const rdBranchMetadata: readonly RDBranchMetadata[] = [
  { id: 'engine', label: 'Engine / Power Unit', shortLabel: 'Engine', description: 'Power delivery, acceleration, efficiency, and engine systems.' },
  { id: 'aero', label: 'Aerodynamics', shortLabel: 'Aero', description: 'Downforce, drag efficiency, balance, and technical-track speed.' },
  { id: 'reliability', label: 'Reliability', shortLabel: 'Reliability', description: 'Durability, failure prevention, component life, and race completion.' },
  { id: 'chassis', label: 'Chassis', shortLabel: 'Chassis', description: 'Mechanical grip, braking stability, traction, and driver confidence.' },
  { id: 'tires', label: 'Tires', shortLabel: 'Tires', description: 'Warmup, degradation, stint length, and variable-condition performance.' },
  { id: 'operations', label: 'Race Operations', shortLabel: 'Operations', description: 'Setup extraction, strategy, pit work, logistics, and execution.' },
  { id: 'manufacturing', label: 'Manufacturing', shortLabel: 'Manufacturing', description: 'Build speed, quality, repair capability, and upgrade delivery.' },
  { id: 'electronics', label: 'Electronics / Data', shortLabel: 'Electronics', description: 'Telemetry, simulation, diagnosis, and car-system intelligence.' },
  { id: 'driver_staff', label: 'Driver / Staff', shortLabel: 'People', description: 'Feedback, communication, morale, training, and staff performance.' },
  { id: 'commercial_political', label: 'Commercial / Political', shortLabel: 'Commercial', description: 'Funding, stakeholder support, influence, and development protection.' },
] as const;

export const rdFoundationProjects: readonly RDFoundationProjectDefinition[] = [
  { nodeId: 'engine:E1', sourceId: 'E1', branchId: 'engine', name: 'Engine Mapping Basics', modifier: { scope: 'car', target: 'enginePower', value: 0.35, description: '+0.35 engine power development' } },
  { nodeId: 'aero:A1', sourceId: 'A1', branchId: 'aero', name: 'Aero Mapping Basics', modifier: { scope: 'car', target: 'aeroEfficiency', value: 0.35, description: '+0.35 aero efficiency development' } },
  { nodeId: 'reliability:R1', sourceId: 'R1', branchId: 'reliability', name: 'Failure Logging Basics', modifier: { scope: 'car', target: 'reliability', value: 0.35, description: '+0.35 reliability development' } },
  { nodeId: 'chassis:C1', sourceId: 'C1', branchId: 'chassis', name: 'Suspension Geometry Basics', modifier: { scope: 'car', target: 'mechanicalGrip', value: 0.35, description: '+0.35 mechanical grip development' } },
  { nodeId: 'tires:TR1', sourceId: 'TR1', branchId: 'tires', name: 'Tire Data Baseline', modifier: { scope: 'race_weekend', target: 'tireKnowledge', value: 0.03, description: '+3% tire-knowledge effectiveness' } },
  { nodeId: 'operations:OP1', sourceId: 'OP1', branchId: 'operations', name: 'Race Weekend Process Basics', modifier: { scope: 'car', target: 'pitCrewOperations', value: 0.35, description: '+0.35 pit-crew operations development' } },
  { nodeId: 'manufacturing:MF1', sourceId: 'MF1', branchId: 'manufacturing', name: 'Factory Process Baseline', modifier: { scope: 'department', target: 'manufacturingQuality', value: 0.03, description: '+3% manufacturing quality' } },
  { nodeId: 'electronics:EL1', sourceId: 'EL1', branchId: 'electronics', name: 'Sensor Package Baseline', modifier: { scope: 'race_weekend', target: 'dataAccuracy', value: 0.03, description: '+3% race-weekend data accuracy' } },
  { nodeId: 'driver_staff:D1', sourceId: 'D1', branchId: 'driver_staff', name: 'Driver Feedback Baseline', modifier: { scope: 'department', target: 'driverFeedback', value: 0.03, description: '+3% driver-feedback effectiveness' } },
  { nodeId: 'commercial_political:C1', sourceId: 'C1', branchId: 'commercial_political', name: 'Commercial Baseline Audit', modifier: { scope: 'finance', target: 'developmentFunding', value: 0.03, description: '+3% development-funding effectiveness' } },
] as const;

export const rdFoundationProjectById = Object.fromEntries(
  rdFoundationProjects.map((project) => [project.nodeId, project]),
) as Record<string, RDFoundationProjectDefinition>;

export function foundationProjectForBranch(branchId: RDBranchId): RDFoundationProjectDefinition {
  const project = rdFoundationProjects.find((candidate) => candidate.branchId === branchId);
  if (!project) throw new Error(`Missing R&D foundation project for ${branchId}`);
  return project;
}
