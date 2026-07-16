import type { FinanceTransaction } from '../types/financeTypes';

export type FinanceWorkspaceTab = 'overview' | 'commitments' | 'transactions';
export type FinanceTransactionFilter = 'all' | 'income' | 'expenses';

export const FINANCE_WORKSPACE_TABS: ReadonlyArray<{
  id: FinanceWorkspaceTab;
  label: string;
}> = [
  { id: 'overview', label: 'Season Overview' },
  { id: 'commitments', label: 'Commitments' },
  { id: 'transactions', label: 'Transactions' },
];

export const FINANCE_TRANSACTION_PAGE_SIZE = 8;

export function filterFinanceTransactions(
  transactions: FinanceTransaction[],
  filter: FinanceTransactionFilter,
) {
  if (filter === 'income') return transactions.filter((transaction) => transaction.amount >= 0);
  if (filter === 'expenses') return transactions.filter((transaction) => transaction.amount < 0);
  return transactions;
}

export function financeTransactionPageCount(totalTransactions: number) {
  return Math.max(1, Math.ceil(totalTransactions / FINANCE_TRANSACTION_PAGE_SIZE));
}

export function financeTransactionPage(transactions: FinanceTransaction[], requestedPage: number) {
  const pageCount = financeTransactionPageCount(transactions.length);
  const page = Math.max(0, Math.min(requestedPage, pageCount - 1));
  const start = page * FINANCE_TRANSACTION_PAGE_SIZE;
  return transactions.slice(start, start + FINANCE_TRANSACTION_PAGE_SIZE);
}
