import type { GameState } from '../game/careerState';
import type { StaffRole } from '../types/staffTypes';

export type StaffRecommendationKind = 'recruitment' | 'contract';
export type StaffRecommendationConfidence = 'Low' | 'Normal' | 'High';

export type StaffRecommendation = {
  id: string;
  kind: StaffRecommendationKind;
  responsibility: 'staff-recruitment' | 'staff-contracts';
  owner: string;
  target: string;
  role: StaffRole;
  rating: number;
  confidence: StaffRecommendationConfidence;
  recommendation: string;
  whyItMatters: string;
  expectedBenefit: string;
  consequence: string;
  route: string;
  routeLabel: string;
};

export function staffRecommendations(state: GameState): StaffRecommendation[] {
  void state;
  return [];
}
