import { useMemo, useState } from 'react';
import { useGame } from '../game/GameContext';
import { driversForTeam, teamById } from '../game/careerState';
import { careerMarketBundle } from '../sim/careerMarketEngine';
import { projectedAnnualCosts, summarize } from '../sim/financeEngine';
import { totalStaffSalary } from '../sim/staffEngine';
import { Panel } from '../components/Panel';
import { formatMoney } from '../components/ui';
import type { FinanceCategory } from '../types/financeTypes';
import {
  FINANCE_WORKSPACE_TABS,
  filterFinanceTransactions,
  financeTransactionPage,
  financeTransactionPageCount,
  type FinanceTransactionFilter,
  type FinanceWorkspaceTab,
} from './financeViewModel';

const CATEGORY_ORDER: FinanceCategory[] = [
  'Prize Money',
  'Sponsorship',
  'Driver Salary',
  'Driver Signing',
  'Academy',
  'Staff',
  'Facilities',
  'Engine',
  'Development',
  'Scouting',
  'Repairs',
  'Operations',
];

const CATEGORY_DESCRIPTIONS: Record<FinanceCategory, string> = {
  'Prize Money': 'Race results and championship rewards',
  Sponsorship: 'Guaranteed partner income and performance bonuses',
  'Driver Salary': 'Contracted wages paid at season rollover',
  'Driver Signing': 'Up-front fees for new driver contracts',
  Academy: 'Annual development fees for academy drivers',
  Staff: 'Contracted wages for team personnel',
  Facilities: 'Construction and facility upgrade spending',
  Engine: 'Power-unit supply and engine programme costs',
  Development: 'Research, design, manufacturing, and upgrades',
  Scouting: 'Driver and staff evaluation assignments',
  Repairs: 'Damage repair and replacement parts',
  Operations: 'General race-team operating expenses',
};

export function Finance() {
  const { state } = useGame();
  const [season, setSeason] = useState<number | null>(null);
  const [tab, setTab] = useState<FinanceWorkspaceTab>('overview');
  const [transactionFilter, setTransactionFilter] = useState<FinanceTransactionFilter>('all');
  const [transactionPage, setTransactionPage] = useState(0);

  const seasons = useMemo(() => {
    const set = new Set<number>((state?.finance ?? []).map((transaction) => transaction.season));
    if (state) set.add(state.seasonYear);
    return [...set].sort((a, b) => b - a);
  }, [state]);

  const activeSeason = season ?? state?.seasonYear ?? seasons[0];
  if (!state) return null;

  const team = teamById(state, state.selectedTeamId);
  const transactions = (state.finance ?? []).filter(
    (transaction) => transaction.season === activeSeason,
  );
  const summary = summarize(transactions);
  const orderedTransactions = [...transactions].reverse();
  const filteredTransactions = filterFinanceTransactions(orderedTransactions, transactionFilter);
  const transactionPageCount = financeTransactionPageCount(filteredTransactions.length);
  const safeTransactionPage = Math.min(transactionPage, transactionPageCount - 1);
  const visibleTransactions = financeTransactionPage(filteredTransactions, safeTransactionPage);

  const academyYearlyById: Record<string, number> = {};
  for (const youthDriver of careerMarketBundle(state).youth) {
    academyYearlyById[youthDriver.id] = youthDriver.yearlyAcademyCost;
  }
  const projected = projectedAnnualCosts(
    driversForTeam(state, state.selectedTeamId),
    state.academy ?? [],
    academyYearlyById,
  );
  const staffWages = totalStaffSalary(state.staff ?? []);
  const projectedTotal = projected.total + staffWages;
  const annualCoverage = projectedTotal > 0 ? (team?.budget ?? 0) / projectedTotal : null;

  const incomeCategories = CATEGORY_ORDER.filter((category) => summary.byCategory[category] > 0);
  const expenseCategories = CATEGORY_ORDER.filter((category) => summary.byCategory[category] < 0);

  function selectTransactionFilter(filter: FinanceTransactionFilter) {
    setTransactionFilter(filter);
    setTransactionPage(0);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Finance</h1>
          <p className="text-sm text-neutral-400">{team?.name} · budget and ledger</p>
        </div>
        {seasons.length > 1 && (
          <select
            aria-label="Finance season"
            value={activeSeason}
            onChange={(event) => {
              setSeason(Number(event.target.value));
              setTransactionPage(0);
            }}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200"
          >
            {seasons.map((availableSeason) => (
              <option key={availableSeason} value={availableSeason}>
                {availableSeason} season
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Balance" value={formatMoney(team?.budget ?? 0)} />
        <Kpi label={`${activeSeason} Income`} value={formatMoney(summary.income)} tone="good" />
        <Kpi label={`${activeSeason} Expenses`} value={formatMoney(summary.expense)} tone="bad" />
        <Kpi
          label={`${activeSeason} Net`}
          value={formatMoney(summary.net)}
          tone={summary.net >= 0 ? 'good' : 'bad'}
        />
      </div>

      <nav aria-label="Finance workspaces" className="flex gap-1 rounded-xl border border-neutral-800 bg-neutral-900/50 p-1">
        {FINANCE_WORKSPACE_TABS.map((workspace) => (
          <button
            key={workspace.id}
            type="button"
            aria-current={tab === workspace.id ? 'page' : undefined}
            onClick={() => setTab(workspace.id)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              tab === workspace.id
                ? 'bg-sky-500/20 text-sky-200'
                : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
            }`}
          >
            {workspace.label}
            {workspace.id === 'transactions' ? ` (${transactions.length})` : ''}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <Panel title={`${activeSeason} Income and Expenses`}>
          {transactions.length === 0 ? (
            <p className="text-sm text-neutral-500">No transactions recorded for {activeSeason} yet.</p>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              <CategoryGroup
                title="Income Sources"
                categories={incomeCategories}
                byCategory={summary.byCategory}
              />
              <CategoryGroup
                title="Expense Sources"
                categories={expenseCategories}
                byCategory={summary.byCategory}
              />
            </div>
          )}
        </Panel>
      )}

      {tab === 'commitments' && (
        <Panel title="Projected Annual Commitments">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(250px,0.75fr)]">
            <div className="space-y-1.5 text-sm">
              <Row label="Driver salaries" value={`−${formatMoney(projected.salaries)}`} />
              <Row label="Academy fees" value={`−${formatMoney(projected.academy)}`} />
              <Row label="Staff wages" value={`−${formatMoney(staffWages)}`} />
              <div className="mt-2 flex items-center justify-between border-t border-neutral-800 pt-2 font-semibold">
                <span className="text-neutral-200">Total committed per year</span>
                <span className="tabular-nums text-red-300">−{formatMoney(projectedTotal)}</span>
              </div>
            </div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-3">
              <div className="text-xs uppercase tracking-wide text-neutral-500">Current budget coverage</div>
              <div className="mt-1 text-xl font-bold text-neutral-100">
                {annualCoverage === null ? 'No recurring costs' : `${annualCoverage.toFixed(1)} seasons`}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                This compares cash on hand with known annual driver, academy, and staff commitments.
                It is not a full cash forecast: engine, development, repairs, facilities, and future
                income vary during the season.
              </p>
            </div>
          </div>
        </Panel>
      )}

      {tab === 'transactions' && (
        <Panel
          title={`${activeSeason} Transactions`}
          actions={
            <div className="flex gap-1" aria-label="Transaction filters">
              {(['all', 'income', 'expenses'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={transactionFilter === filter}
                  onClick={() => selectTransactionFilter(filter)}
                  className={`rounded-md px-2 py-1 text-xs font-semibold capitalize ${
                    transactionFilter === filter
                      ? 'bg-sky-500/20 text-sky-200'
                      : 'text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          }
        >
          {filteredTransactions.length === 0 ? (
            <p className="text-sm text-neutral-500">
              {transactions.length === 0
                ? 'Nothing here yet.'
                : `No ${transactionFilter} transactions recorded for this season.`}
            </p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="pb-1.5 pr-2">Round</th>
                    <th className="pb-1.5 pr-2">Category</th>
                    <th className="pb-1.5 pr-2">Detail</th>
                    <th className="pb-1.5 pr-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTransactions.map((transaction) => (
                    <tr key={transaction.id} className="border-t border-neutral-800/60">
                      <td className="py-1.5 pr-2 text-neutral-500">{transaction.round ?? '—'}</td>
                      <td className="py-1.5 pr-2 text-neutral-400">{transaction.category}</td>
                      <td className="py-1.5 pr-2 text-neutral-300">{transaction.label}</td>
                      <td
                        className={`py-1.5 pr-2 text-right font-semibold tabular-nums ${
                          transaction.amount >= 0 ? 'text-green-300' : 'text-red-300'
                        }`}
                      >
                        {transaction.amount >= 0 ? '+' : '−'}
                        {formatMoney(Math.abs(transaction.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <FinancePagination
                page={safeTransactionPage}
                pageCount={transactionPageCount}
                total={filteredTransactions.length}
                onPageChange={setTransactionPage}
              />
            </>
          )}
        </Panel>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  const color = tone === 'good' ? 'text-green-300' : tone === 'bad' ? 'text-red-300' : 'text-neutral-100';
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-0.5 text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function CategoryGroup({
  title,
  categories,
  byCategory,
}: {
  title: string;
  categories: FinanceCategory[];
  byCategory: Record<FinanceCategory, number>;
}) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</h3>
      {categories.length === 0 ? (
        <p className="text-sm text-neutral-500">No entries in this group yet.</p>
      ) : (
        <div className="space-y-2">
          {categories.map((category) => {
            const value = byCategory[category];
            return (
              <div key={category} className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm text-neutral-300">{category}</div>
                  <div className="text-xs text-neutral-600">{CATEGORY_DESCRIPTIONS[category]}</div>
                </div>
                <span
                  className={`shrink-0 font-semibold tabular-nums ${
                    value >= 0 ? 'text-green-300' : 'text-red-300'
                  }`}
                >
                  {value >= 0 ? '+' : '−'}{formatMoney(Math.abs(value))}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function FinancePagination({
  page,
  pageCount,
  total,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="mt-2 flex items-center justify-between border-t border-neutral-800 pt-2 text-xs text-neutral-500">
      <span>{total} matching transactions · Page {page + 1} of {pageCount}</span>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
          className="rounded-md border border-neutral-700 px-2 py-1 text-neutral-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= pageCount - 1}
          onClick={() => onPageChange(page + 1)}
          className="rounded-md border border-neutral-700 px-2 py-1 text-neutral-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-neutral-300">{label}</span>
      <span className="tabular-nums text-neutral-400">{value}</span>
    </div>
  );
}
