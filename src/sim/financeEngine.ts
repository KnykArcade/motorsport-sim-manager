// Finance helpers: cost conversion, salary estimation, ledger summaries and the
// projected annual running costs for the player's team. Pure and deterministic.

import type { Driver } from '../types/gameTypes';
import type { FinanceCategory, FinanceTransaction } from '../types/financeTypes';

export const MILLION = 1_000_000;

// Market/academy data stores costs in $M; convert to raw dollars.
export function toMoney(millions: number): number {
  return Math.round(millions * MILLION);
}

// A driver's annual salary in raw dollars. Seeded grid drivers have no explicit
// salary, so estimate one from their overall rating.
export function driverSalary(driver: Driver): number {
  if (driver.salary && driver.salary > 0) return toMoney(driver.salary);
  const est = Math.max(0.5, (driver.ratings.overall - 4) * 1.2); // $M
  return toMoney(est);
}

let counter = 0;
export function makeTransaction(
  season: number,
  category: FinanceCategory,
  label: string,
  amount: number,
  round?: number,
): FinanceTransaction {
  counter += 1;
  return { id: `fin-${season}-${counter}-${Math.abs(amount)}`, season, round, category, label, amount };
}

export type FinanceSummary = {
  income: number;
  expense: number;
  net: number;
  byCategory: Record<FinanceCategory, number>;
};

const EMPTY_BY_CATEGORY = (): Record<FinanceCategory, number> => ({
  'Prize Money': 0,
  Sponsorship: 0,
  'Driver Salary': 0,
  'Driver Signing': 0,
  Academy: 0,
  Staff: 0,
  Facilities: 0,
  Engine: 0,
  Development: 0,
  Scouting: 0,
  Repairs: 0,
});

export function summarize(transactions: FinanceTransaction[], season?: number): FinanceSummary {
  const byCategory = EMPTY_BY_CATEGORY();
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (season !== undefined && t.season !== season) continue;
    byCategory[t.category] += t.amount;
    if (t.amount >= 0) income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, net: income + expense, byCategory };
}

// Recurring annual running costs the player commits to (salaries + academy fees).
export function projectedAnnualCosts(
  drivers: Driver[],
  academy: { prospectId: string }[],
  academyYearlyById: Record<string, number>,
): { salaries: number; academy: number; total: number } {
  const salaries = drivers.reduce((sum, d) => sum + driverSalary(d), 0);
  const academyCost = academy.reduce(
    (sum, a) => sum + toMoney(academyYearlyById[a.prospectId] ?? 0),
    0,
  );
  return { salaries, academy: academyCost, total: salaries + academyCost };
}
