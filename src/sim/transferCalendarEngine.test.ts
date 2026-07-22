import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import { progressTransferCalendar } from './transferCalendarEngine';

function career() {
  const base = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'transfer-calendar' });
  return {
    ...base,
    drivers: base.drivers.map((driver) => driver.teamId === base.selectedTeamId
      ? { ...driver, contractYearsRemaining: 3 }
      : { ...driver, contractYearsRemaining: 1 }),
  };
}

describe('transfer calendar engine', () => {
  it('creates deterministic rumors and rival offers once per round', () => {
    const state = career();
    const first = progressTransferCalendar(state, 1);
    expect(first).toEqual(progressTransferCalendar(state, 1));
    expect(first.transferCalendar?.stories.some((story) => story.targetType === 'GridDriver' && story.stage === 'Rumor')).toBe(true);
    expect(first.transferCalendar?.stories.some((story) => story.targetType === 'MarketDriver' && story.stage === 'Offer')).toBe(true);
    expect(progressTransferCalendar(first, 1)).toEqual(first);
  });

  it('confirms AI decisions for next season without changing the current seat', () => {
    const first = progressTransferCalendar(career(), 1);
    const rumor = first.transferCalendar!.stories.find((story) => story.targetType === 'GridDriver')!;
    const originalTeam = first.drivers.find((driver) => driver.id === rumor.targetId)?.teamId;
    const second = progressTransferCalendar(first, 2);
    expect(second.transferCalendar?.stories.find((story) => story.id === rumor.id)?.stage).toBe('Confirmed');
    expect(second.drivers.find((driver) => driver.id === rumor.targetId)?.teamId).toBe(originalTeam);
    if (rumor.outcome !== 'Release') {
      expect(second.characterInteractions?.personnelMoves.some((move) => move.targetId === rumor.targetId && move.effectiveSeason === second.seasonYear + 1)).toBe(true);
    }
  });

  it('keeps a player offer contested at the rival deadline', () => {
    const first = progressTransferCalendar(career(), 1);
    const offer = first.transferCalendar!.stories.find((story) => story.targetType === 'MarketDriver')!;
    const seat = first.drivers.find((driver) => driver.teamId === first.selectedTeamId)!;
    const withOffer = { ...first, pendingSignings: [{ seatDriverId: seat.id, source: 'market' as const, sourceId: offer.targetId, name: offer.targetName, bid: 999 }] };
    const atDeadline = progressTransferCalendar(withOffer, offer.deadlineRound);
    expect(atDeadline.transferCalendar?.stories.find((story) => story.id === offer.id)?.stage).toBe('Contested');
    expect(atDeadline.signedMarketIds ?? []).not.toContain(offer.targetId);
  });
});
