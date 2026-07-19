import type { CarRatings } from './gameTypes';

export const PART_TYPES = ['power_unit', 'gearbox', 'aero', 'brakes', 'suspension'] as const;

export type PartType = (typeof PART_TYPES)[number];
export type PartStatus = 'fitted' | 'spare' | 'repairing' | 'retired';

export type CarPart = {
  id: string;
  serial: number;
  teamId: string;
  type: PartType;
  name: string;
  status: PartStatus;
  fittedDriverId?: string;
  condition: number;
  maximumCondition: number;
  racesUsed: number;
  designGeneration: number;
  sourceNodeIds: string[];
  ratingDeltas: Partial<CarRatings>;
  buildCost: number;
  repairRoundsRemaining?: number;
  repairCost?: number;
  createdSeasonYear: number;
  createdRound: number;
  lastUsedRound?: number;
};

export type PartManufacturingOrder = {
  id: string;
  teamId: string;
  type: PartType;
  quantity: number;
  roundsRemaining: number;
  totalRounds: number;
  cost: number;
  designGeneration: number;
  sourceNodeIds: string[];
  ratingDeltas: Partial<CarRatings>;
  orderedSeasonYear: number;
  orderedRound: number;
};

export type PartsHistoryEntry = {
  id: string;
  seasonYear: number;
  round: number;
  type: 'manufactured' | 'fitted' | 'repaired' | 'retired' | 'worn';
  description: string;
  partId?: string;
  driverId?: string;
};

export type TeamPartsState = {
  teamId: string;
  nextSerial: number;
  inventory: CarPart[];
  manufacturingQueue: PartManufacturingOrder[];
  history: PartsHistoryEntry[];
};

export type TeamPartsMap = Record<string, TeamPartsState>;

// Player factory delegation toggles. All default to off.
export type PartsAutomationSettings = {
  autoRepair: boolean;
  autoRestock: boolean;
  autoFit: boolean;
};

export type PartsProgressResult = {
  state: TeamPartsState;
  messages: string[];
};
