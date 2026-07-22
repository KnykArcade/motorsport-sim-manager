import type { DriverContractNegotiation, GameState } from '../game/careerState';
import { driverExtensionSigningFee } from '../sim/contractEngine';
import { negotiationOfferMultiplier } from '../sim/driverContractNegotiationEngine';

export type ContractNegotiationView = {
  likelihoodLabel: 'Likely to accept' | 'Close — expects more' | 'Wants substantially more';
  tone: 'positive' | 'warning' | 'negative';
  signingFee: number;
  canSubmit: boolean;
  disabledReason?: string;
  maxAddedYears: number;
};

export function contractNegotiationView(
  state: GameState,
  negotiation: DriverContractNegotiation,
): ContractNegotiationView {
  const driver = state.drivers.find((entry) => entry.id === negotiation.driverId);
  const team = state.teams.find((entry) => entry.id === state.selectedTeamId);
  const currentYears = driver?.contractYearsRemaining ?? 1;
  const maxAddedYears = Math.max(0, Math.min(3, 5 - currentYears));
  const multiplier = driver ? negotiationOfferMultiplier(driver, negotiation.years, negotiation.offeredSalary) : 1;
  const racesRemaining = Math.max(1, state.calendar.length - state.currentRaceIndex);
  const signingFee = driver
    ? Math.round(driverExtensionSigningFee(driver, negotiation.years, racesRemaining, state.calendar.length) * multiplier)
    : 0;
  let disabledReason: string | undefined;
  if (!driver || driver.teamId !== state.selectedTeamId) disabledReason = 'Driver is not under contract with your team.';
  else if (state.gameMode === 'SingleSeason') disabledReason = 'Contract negotiations are unavailable in Single Season.';
  else if (state.seasonComplete) disabledReason = 'Contract negotiations close after the season.';
  else if (maxAddedYears === 0 || negotiation.years > maxAddedYears) disabledReason = 'This offer would exceed the five-year contract maximum.';
  else if (signingFee > (team?.budget ?? 0)) disabledReason = 'The signing fee exceeds the available team budget.';

  const likelihoodLabel = negotiation.acceptanceLikelihood >= 58
    ? 'Likely to accept'
    : negotiation.acceptanceLikelihood >= 45
      ? 'Close — expects more'
      : 'Wants substantially more';
  return {
    likelihoodLabel,
    tone: negotiation.acceptanceLikelihood >= 58 ? 'positive' : negotiation.acceptanceLikelihood >= 45 ? 'warning' : 'negative',
    signingFee,
    canSubmit: !disabledReason,
    disabledReason,
    maxAddedYears,
  };
}
