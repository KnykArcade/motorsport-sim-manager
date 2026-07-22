import type { GameState, MarketContractNegotiation, StaffContractNegotiation } from '../game/careerState';
import { getStaffPool } from '../data';
import { careerMarketBundle } from '../sim/careerMarketEngine';
import { toMoney } from '../sim/financeEngine';
import { recruitmentSigningDiscount } from '../sim/characterInteractionEngine';
import { staffEmployer, staffPoachingCompensation } from '../sim/aiStaffRosterEngine';
import { staffExtensionSigningFee, staffReleaseCost } from '../sim/staffEngine';

export type NegotiationReadout = {
  label: 'Likely to accept' | 'Close — expects more' | 'Wants substantially more';
  tone: 'positive' | 'warning' | 'negative';
  canSubmit: boolean;
  disabledReason?: string;
  immediateCost: number;
};

function readout(score: number): Pick<NegotiationReadout, 'label' | 'tone'> {
  return score >= 58 ? { label: 'Likely to accept', tone: 'positive' }
    : score >= 43 ? { label: 'Close — expects more', tone: 'warning' }
      : { label: 'Wants substantially more', tone: 'negative' };
}

export function marketNegotiationView(state: GameState, negotiation: MarketContractNegotiation): NegotiationReadout {
  const driver = careerMarketBundle(state).drivers.find((entry) => entry.id === negotiation.marketId);
  const seat = state.drivers.find((entry) => entry.id === negotiation.seatDriverId && entry.teamId === state.selectedTeamId);
  const immediateCost = toMoney(negotiation.offeredBid);
  let disabledReason: string | undefined;
  if (!driver) disabledReason = 'This driver is no longer available.';
  else if (!seat) disabledReason = 'The replacement seat is no longer available.';
  else if (immediateCost > (state.teams.find((team) => team.id === state.selectedTeamId)?.budget ?? 0)) disabledReason = 'The compensation bid exceeds the available budget.';
  else if (negotiation.attemptsRemaining === 0) disabledReason = 'The agent has ended negotiations.';
  return { ...readout(negotiation.acceptanceLikelihood), canSubmit: !disabledReason, disabledReason, immediateCost };
}

export function staffNegotiationView(state: GameState, negotiation: StaffContractNegotiation): NegotiationReadout {
  const member = [...(state.staff ?? []), ...getStaffPool(state.seasonYear, state.series)].find((entry) => entry.id === negotiation.staffId);
  const current = (state.staff ?? []).find((entry) => entry.id === negotiation.staffId);
  const replacement = member ? (state.staff ?? []).find((entry) => entry.role === member.role && entry.id !== member.id) : undefined;
  const employerTeamId = member ? staffEmployer(state.aiStaff, member.id) : undefined;
  const racesRemaining = Math.max(1, state.calendar.length - state.currentRaceIndex);
  const immediateCost = !member ? 0 : current
    ? staffExtensionSigningFee(member, negotiation.years, racesRemaining, state.calendar.length, negotiation.offerMultiplier)
    : Math.round(toMoney(member.signingFee) * negotiation.offerMultiplier * (1 - recruitmentSigningDiscount(state, member.id)))
      + (employerTeamId ? staffPoachingCompensation(member) : 0)
      + (replacement ? staffReleaseCost(replacement) : 0);
  let disabledReason: string | undefined;
  if (!member) disabledReason = 'This specialist is no longer available.';
  else if (state.seasonComplete) disabledReason = 'Staff negotiations close after the season.';
  else if (immediateCost > (state.teams.find((team) => team.id === state.selectedTeamId)?.budget ?? 0)) disabledReason = 'The package exceeds the available budget.';
  else if (negotiation.attemptsRemaining === 0) disabledReason = 'The representative has ended negotiations.';
  return { ...readout(negotiation.acceptanceLikelihood), canSubmit: !disabledReason, disabledReason, immediateCost };
}
