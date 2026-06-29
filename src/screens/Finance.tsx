import { useMemo, useState } from 'react';
import { useGame } from '../game/GameContext';
import { driversForTeam, teamById } from '../game/careerState';
import { getMarketBundle } from '../data';
import { projectedAnnualCosts, summarize } from '../sim/financeEngine';
import { totalStaffSalary } from '../sim/staffEngine';
import { Panel } from '../components/Panel';
import { formatMoney } from '../components/ui';
import type { FinanceCategory } from '../types/financeTypes';

const CATEGORY_ORDER: FinanceCategory[] = [
  'Prize Money',
  'Sponsorship',
  'Driver Salary',
  'Driver Signing',
  'Academy',
  'Staff',
  'Facilities',
  'Development',
  'Repairs',
];

export function Finance() {
  const { state } = useGame();

  const seasons = useMemo(() => {
    const set = new Set<number>((state?.finance ?? []).map((t) => t.season));
    if (state) set.add(state.seasonYear);
    return [...set].sort((a, b) => b - a);
  }, [state]);

  const [season, setSeason] = useState<number | null>(null);
  const activeSeason = season ?? state?.seasonYear ?? seasons[0];

  if (!state) return null;

  const team = teamById(state, state.selectedTeamId);
  const transactions = (state.finance ?? []).filter((t) => t.season === activeSeason);
  const summary = summarize(transactions);

  const academyYearlyById: Record<string, number> = {};
  for (const y of getMarketBundle(state.seasonYear, state.series)?.youth ?? []) {
    academyYearlyById[y.id] = y.yearlyAcademyCost;
  }
  const projected = projectedAnnualCosts(
    driversForTeam(state, state.selectedTeamId),
    state.academy ?? [],
    academyYearlyById,
  );
  const staffWages = totalStaffSalary(state.staff ?? []);
  const projectedTotal = projected.total + staffWages;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Finance</h1>
          <p className="text-sm text-neutral-400">{team?.name} · budget & ledger</p>
        </div>
        {seasons.length > 1 && (
          <select
            value={activeSeason}
            onChange={(e) => setSeason(Number(e.target.value))}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200"
          >
            {seasons.map((s) => (
              <option key={s} value={s}>
                {s} season
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Balance" value={formatMoney(team?.budget ?? 0)} />
        <Kpi label={`${activeSeason} Income`} value={formatMoney(summary.income)} tone="good" />
        <Kpi label={`${activeSeason} Expenses`} value={formatMoney(summary.expense)} tone="bad" />
        <Kpi
          label={`${activeSeason} Net`}
          value={formatMoney(summary.net)}
          tone={summary.net >= 0 ? 'good' : 'bad'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={`${activeSeason} Breakdown by Category`}>
          <div className="space-y-1.5">
            {CATEGORY_ORDER.map((c) => {
              const v = summary.byCategory[c];
              if (v === 0) return null;
              return (
                <div key={c} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-300">{c}</span>
                  <span className={`font-semibold tabular-nums ${v >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                    {v >= 0 ? '+' : '−'}
                    {formatMoney(Math.abs(v))}
                  </span>
                </div>
              );
            })}
            {transactions.length === 0 && (
              <p className="text-sm text-neutral-500">No transactions recorded for {activeSeason} yet.</p>
            )}
          </div>
        </Panel>

        <Panel title="Projected Annual Running Costs">
          <div className="space-y-1.5 text-sm">
            <Row label="Driver salaries" value={`−${formatMoney(projected.salaries)}`} />
            <Row label="Academy fees" value={`−${formatMoney(projected.academy)}`} />
            <Row label="Staff wages" value={`−${formatMoney(staffWages)}`} />
            <div className="mt-2 flex items-center justify-between border-t border-neutral-800 pt-2 font-semibold">
              <span className="text-neutral-200">Total committed / year</span>
              <span className="tabular-nums text-red-300">−{formatMoney(projectedTotal)}</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            Salaries and academy fees are charged at each season rollover. Prize money is earned per
            race; sponsorship pays guaranteed annual income plus per-race performance bonuses (see
            the Sponsors screen).
          </p>
        </Panel>
      </div>

      <Panel title={`${activeSeason} Transactions (${transactions.length})`}>
        {transactions.length === 0 ? (
          <p className="text-sm text-neutral-500">Nothing here yet.</p>
        ) : (
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-neutral-900 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="py-1.5 pr-2">Round</th>
                  <th className="py-1.5 pr-2">Category</th>
                  <th className="py-1.5 pr-2">Detail</th>
                  <th className="py-1.5 pr-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {[...transactions].reverse().map((t) => (
                  <tr key={t.id} className="border-t border-neutral-800/60">
                    <td className="py-1.5 pr-2 text-neutral-500">{t.round ?? '—'}</td>
                    <td className="py-1.5 pr-2 text-neutral-400">{t.category}</td>
                    <td className="py-1.5 pr-2 text-neutral-300">{t.label}</td>
                    <td
                      className={`py-1.5 pr-2 text-right font-semibold tabular-nums ${
                        t.amount >= 0 ? 'text-green-300' : 'text-red-300'
                      }`}
                    >
                      {t.amount >= 0 ? '+' : '−'}
                      {formatMoney(Math.abs(t.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  const color = tone === 'good' ? 'text-green-300' : tone === 'bad' ? 'text-red-300' : 'text-neutral-100';
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
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
