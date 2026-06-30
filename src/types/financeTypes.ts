// Team finance / budget types (Phase D). Amounts are raw dollars; positive
// values are income, negative values are expenses. The running balance lives on
// `Team.budget`; this ledger records how it got there for the player's team.

export type FinanceCategory =
  | 'Prize Money'
  | 'Sponsorship'
  | 'Driver Salary'
  | 'Driver Signing'
  | 'Academy'
  | 'Staff'
  | 'Facilities'
  | 'Engine'
  | 'Development'
  | 'Repairs';

export type FinanceTransaction = {
  id: string;
  season: number;
  round?: number;
  category: FinanceCategory;
  label: string;
  amount: number; // + income / - expense, in raw dollars
};
