import { describe, expect, it } from 'vitest';
import type { FinanceTransaction } from '../types/financeTypes';
import {
  FINANCE_TRANSACTION_PAGE_SIZE,
  FINANCE_WORKSPACE_TABS,
  filterFinanceTransactions,
  financeTransactionPage,
  financeTransactionPageCount,
} from './financeViewModel';

function transaction(id: number, amount: number): FinanceTransaction {
  return {
    id: `transaction-${id}`,
    season: 1998,
    amount,
    category: amount >= 0 ? 'Prize Money' : 'Operations',
    label: `Transaction ${id}`,
  };
}

describe('finance view model', () => {
  it('exposes the three compact finance workspaces', () => {
    expect(FINANCE_WORKSPACE_TABS.map((tab) => tab.id)).toEqual([
      'overview',
      'commitments',
      'transactions',
    ]);
  });

  it('filters income and expenses by transaction direction', () => {
    const entries = [transaction(1, 200), transaction(2, -100), transaction(3, 0)];

    expect(filterFinanceTransactions(entries, 'all')).toHaveLength(3);
    expect(filterFinanceTransactions(entries, 'income').map((entry) => entry.id)).toEqual([
      'transaction-1',
      'transaction-3',
    ]);
    expect(filterFinanceTransactions(entries, 'expenses').map((entry) => entry.id)).toEqual([
      'transaction-2',
    ]);
  });

  it('paginates eight transactions at a time and clamps an invalid page', () => {
    const entries = Array.from({ length: 18 }, (_, index) => transaction(index + 1, index + 1));

    expect(FINANCE_TRANSACTION_PAGE_SIZE).toBe(8);
    expect(financeTransactionPageCount(entries.length)).toBe(3);
    expect(financeTransactionPage(entries, 0)).toHaveLength(8);
    expect(financeTransactionPage(entries, 99).map((entry) => entry.id)).toEqual([
      'transaction-17',
      'transaction-18',
    ]);
  });
});
