export type TransferCalendarStory = {
  id: string;
  targetType: 'GridDriver' | 'MarketDriver';
  targetId: string;
  targetName: string;
  sourceTeamId?: string;
  sourceTeamName?: string;
  destinationTeamId: string;
  destinationTeamName: string;
  outcome: 'Renewal' | 'Transfer' | 'Release' | 'RivalOffer';
  stage: 'Rumor' | 'Offer' | 'Confirmed' | 'Contested';
  startedRound: number;
  deadlineRound: number;
  offeredBid?: number;
};

export type TransferCalendarState = {
  lastProcessedRound: number;
  stories: TransferCalendarStory[];
};
