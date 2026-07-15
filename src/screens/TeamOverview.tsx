import { Fragment, useMemo, useState } from 'react';
import { useGame } from '../game/GameContext';
import { Panel } from '../components/Panel';
import { RatingBadge } from '../components/RatingBadge';
import { DriverDossierButton } from '../components/driverCards/DriverDossier';
import { CharacterDossierButton } from '../components/characterCards/CharacterDossier';
import { formatMoney, ratingColor } from '../components/ui';
import {
  buildTeamOverview,
  buildTeamOverviewDetail,
  HEALTH_LABELS,
  HEALTH_ORDER,
  TREND_LABELS,
  type TeamOverviewRow,
  type TeamTrend,
} from '../sim/teamOverviewEngine';
import type { AIFinancialHealth } from '../types/aiTeamTypes';
import { ARCHETYPE_SPECS, TRAIT_LABELS } from '../sim/aiTeamEngine';

type SortKey =
  | 'championshipPosition'
  | 'overallRating'
  | 'carRating'
  | 'driverRating'
  | 'developmentRating'
  | 'facilitiesRating'
  | 'staffRating'
  | 'engineRating'
  | 'academyRating'
  | 'raceOpsRating'
  | 'pitCrewRating'
  | 'reliabilityRating'
  | 'reputationRating'
  | 'financeRating'
  | 'budget'
  | 'sponsorIncome'
  | 'financialHealth';

type Filter = 'all' | 'rivals' | 'player';

const HEALTH_COLOR: Record<AIFinancialHealth, string> = {
  Excellent: '#22c55e',
  Stable: '#84cc16',
  Tight: '#eab308',
  AtRisk: '#f97316',
  Critical: '#ef4444',
};

const TREND_STYLE: Record<TeamTrend, { color: string; icon: string }> = {
  TitlePush: { color: '#f59e0b', icon: '▲' },
  Rising: { color: '#22c55e', icon: '↗' },
  Stable: { color: '#9ca3af', icon: '→' },
  Falling: { color: '#f97316', icon: '↘' },
  Rebuilding: { color: '#38bdf8', icon: '⟳' },
  FinancialTrouble: { color: '#ef4444', icon: '⚠' },
};

const RATING_COLUMNS: { key: SortKey; label: string; field: keyof TeamOverviewRow }[] = [
  { key: 'overallRating', label: 'Overall', field: 'overallRating' },
  { key: 'carRating', label: 'Car', field: 'carRating' },
  { key: 'driverRating', label: 'Drivers', field: 'driverRating' },
  { key: 'developmentRating', label: 'Dev', field: 'developmentRating' },
  { key: 'facilitiesRating', label: 'Facil.', field: 'facilitiesRating' },
  { key: 'staffRating', label: 'Staff', field: 'staffRating' },
  { key: 'engineRating', label: 'Engine', field: 'engineRating' },
  { key: 'academyRating', label: 'Acad.', field: 'academyRating' },
  { key: 'raceOpsRating', label: 'Ops', field: 'raceOpsRating' },
  { key: 'pitCrewRating', label: 'Pit', field: 'pitCrewRating' },
  { key: 'reliabilityRating', label: 'Rel.', field: 'reliabilityRating' },
  { key: 'reputationRating', label: 'Rep.', field: 'reputationRating' },
];

function sortValue(row: TeamOverviewRow, key: SortKey): number {
  if (key === 'championshipPosition') return row.championshipPosition ?? 999;
  if (key === 'financialHealth') return HEALTH_ORDER.indexOf(row.financialHealth);
  return row[key] as number;
}

export function TeamOverview() {
  const { state } = useGame();
  const [sortKey, setSortKey] = useState<SortKey>('championshipPosition');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo(() => (state ? buildTeamOverview(state) : []), [state]);
  const detail = useMemo(
    () => (state && selectedId ? buildTeamOverviewDetail(state, selectedId) : undefined),
    [state, selectedId],
  );

  if (!state) return null;

  const filtered = rows.filter((r) => {
    if (filter === 'player') return r.isPlayer;
    if (filter === 'rivals') return !r.isPlayer;
    return true;
  });
  const ascending = sortKey === 'championshipPosition';
  const sorted = [...filtered].sort((a, b) => {
    const d = sortValue(a, sortKey) - sortValue(b, sortKey);
    return ascending ? d : -d;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Team Overview</h1>
          <p className="text-sm text-neutral-500">
            Compare every {state.series} team across finances, car, staff and form.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterTabs filter={filter} onChange={setFilter} />
          <label className="flex items-center gap-2 text-xs text-neutral-400">
            Sort by
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-200"
            >
              <option value="championshipPosition">Championship</option>
              <option value="overallRating">Overall Rating</option>
              <option value="carRating">Car Rating</option>
              <option value="driverRating">Driver Rating</option>
              <option value="developmentRating">Development</option>
              <option value="facilitiesRating">Facilities</option>
              <option value="staffRating">Staff</option>
              <option value="engineRating">Engine</option>
              <option value="academyRating">Academy</option>
              <option value="financeRating">Financial Rating</option>
              <option value="financialHealth">Financial Health</option>
              <option value="budget">Budget</option>
              <option value="sponsorIncome">Sponsor Income</option>
            </select>
          </label>
        </div>
      </div>

      <Panel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-[11px] uppercase tracking-wide text-neutral-500">
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">Team</th>
                <th className="px-2 py-2">Health</th>
                <th className="px-2 py-2 text-right">Budget</th>
                <th className="px-2 py-2 text-right">Sponsor</th>
                {RATING_COLUMNS.map((c) => (
                  <th key={c.key} className="px-2 py-2 text-center">
                    {c.label}
                  </th>
                ))}
                <th className="px-2 py-2">Trend</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <Fragment key={row.teamId}>
                  <tr
                    onClick={() => setSelectedId(selectedId === row.teamId ? null : row.teamId)}
                    className={`cursor-pointer border-b border-neutral-900 transition-colors hover:bg-neutral-800/40 ${
                      row.isPlayer ? 'bg-amber-500/5' : ''
                    } ${selectedId === row.teamId ? 'bg-neutral-800/60' : ''}`}
                  >
                    <td className="px-2 py-2 tabular-nums text-neutral-500">
                      {row.championshipPosition ?? i + 1}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <span className="h-4 w-1.5 rounded-sm" style={{ backgroundColor: row.color }} />
                        <span className="font-medium text-neutral-100">{row.name}</span>
                        {row.isPlayer && (
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                            YOU
                          </span>
                        )}
                      </div>
                      {row.archetypeLabel && (
                        <div className="text-[11px] text-neutral-500">{row.archetypeLabel}</div>
                      )}
                      {row.philosophyLabel && (
                        <div className="text-[10px] text-neutral-600">{row.philosophyLabel}</div>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className="rounded px-1.5 py-0.5 text-xs font-semibold"
                        style={{
                          color: HEALTH_COLOR[row.financialHealth],
                          backgroundColor: `${HEALTH_COLOR[row.financialHealth]}22`,
                        }}
                      >
                        {HEALTH_LABELS[row.financialHealth]}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-neutral-300">
                      {formatMoney(row.budget)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-neutral-400">
                      {formatMoney(row.sponsorIncome)}
                    </td>
                    {RATING_COLUMNS.map((c) => (
                      <td key={c.key} className="px-2 py-2 text-center">
                        <RatingBadge value={row[c.field] as number} />
                      </td>
                    ))}
                    <td className="px-2 py-2">
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium"
                        style={{ color: TREND_STYLE[row.trend].color }}
                      >
                        {TREND_STYLE[row.trend].icon} {TREND_LABELS[row.trend]}
                      </span>
                    </td>
                  </tr>
                  {selectedId === row.teamId && detail && (
                    <tr className="border-b border-neutral-800 bg-neutral-950/50">
                      <td colSpan={18} className="px-3 py-4">
                        <TeamDetail detail={detail} onClose={() => setSelectedId(null)} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function FilterTabs({ filter, onChange }: { filter: Filter; onChange: (f: Filter) => void }) {
  const tabs: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'rivals', label: 'Rivals' },
    { id: 'player', label: 'My Team' },
  ];
  return (
    <div className="flex rounded-md border border-neutral-700 p-0.5">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
            filter === t.id ? 'bg-neutral-700 text-neutral-100' : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function TeamDetail({
  detail,
  onClose,
}: {
  detail: NonNullable<ReturnType<typeof buildTeamOverviewDetail>>;
  onClose: () => void;
}) {
  const { state } = useGame();
  const { row } = detail;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel
        title={row.name}
        actions={
          <div className="flex flex-wrap items-center gap-1">
            {state && (
              <>
                <CharacterDossierButton
                  state={state}
                  subject={row.isPlayer ? { type: 'playerPrincipal' } : { type: 'aiPrincipal', teamId: row.teamId }}
                >
                  Principal Card
                </CharacterDossierButton>
                <CharacterDossierButton state={state} subject={{ type: 'owner', teamId: row.teamId }}>
                  Owner Card
                </CharacterDossierButton>
              </>
            )}
            <button onClick={onClose} className="text-xs text-neutral-500 hover:text-neutral-200">
              ✕ Close
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span
              className="rounded px-2 py-0.5 text-xs font-semibold"
              style={{
                color: HEALTH_COLOR[row.financialHealth],
                backgroundColor: `${HEALTH_COLOR[row.financialHealth]}22`,
              }}
            >
              {HEALTH_LABELS[row.financialHealth]}
            </span>
            <span
              className="inline-flex items-center gap-1 text-xs font-medium"
              style={{ color: TREND_STYLE[row.trend].color }}
            >
              {TREND_STYLE[row.trend].icon} {TREND_LABELS[row.trend]}
            </span>
            {row.championshipPosition && (
              <span className="text-xs text-neutral-400">Championship P{row.championshipPosition}</span>
            )}
          </div>

          {(row.archetypeLabel || row.goalLabel || row.philosophyLabel) && (
            <div className="space-y-3">
              <div className="text-sm text-neutral-400">
                {row.archetypeLabel && (
                  <span>
                    Management: <span className="text-neutral-200">{row.archetypeLabel}</span>
                  </span>
                )}
                {row.goalLabel && (
                  <span className="ml-3">
                    Goal: <span className="text-neutral-200">{row.goalLabel}</span>
                  </span>
                )}
                {row.philosophyLabel && (
                  <span className="ml-3">
                    Identity: <span className="text-neutral-200">{row.philosophyLabel}</span>
                  </span>
                )}
              </div>
              {(() => {
                const ai = state?.aiTeamStates?.[row.teamId];
                if (!ai) return null;
                const spec = ARCHETYPE_SPECS[ai.archetype];
                return (
                  <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3 space-y-2">
                    {spec && (
                      <div className="text-xs text-neutral-400">
                        <span className="font-semibold text-neutral-300">{spec.label}</span> — {spec.description}
                      </div>
                    )}
                    {ai.philosophy && (
                      <div className="space-y-1">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Team Philosophy</div>
                        <div className="text-xs text-neutral-400">{ai.philosophy.description}</div>
                        {ai.philosophy.traits.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {ai.philosophy.traits.map((trait) => (
                              <span key={trait} className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-300">
                                {TRAIT_LABELS[trait]}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {ai.seasonsInTrouble > 0 && (
                      <div className="text-[11px] text-red-400">
                        ⚠ {ai.seasonsInTrouble} season{ai.seasonsInTrouble === 1 ? '' : 's'} in financial trouble
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <Line label="Budget" value={formatMoney(row.budget)} />
            <Line label="Sponsor income" value={formatMoney(row.sponsorIncome)} />
            <Line label="Points" value={String(row.points)} />
            <Line label="Wins" value={String(row.wins)} />
            {detail.engineSupplier && (
              <Line
                label="Engine"
                value={`${detail.engineSupplier}${detail.engineDealType ? ` (${detail.engineDealType})` : ''}`}
              />
            )}
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Technical program
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <Line label="R&D focus" value={detail.technicalProgram.focus?.replace('_', ' ') ?? 'Not selected'} />
              <Line label="Active projects" value={String(detail.technicalProgram.activeProjects)} />
              <Line label="Completed projects" value={String(detail.technicalProgram.completedProjects)} />
              <Line label="Factory orders" value={String(detail.technicalProgram.factoryOrders)} />
              <Line label="Technical spend" value={formatMoney(detail.technicalProgram.spend)} />
              <Line label="Critical fitted parts" value={String(detail.technicalProgram.criticalParts)} />
            </div>
            {detail.technicalProgram.lastDecision && (
              <div className="mt-2 text-xs text-neutral-400">
                Latest: <span className="text-neutral-200">{detail.technicalProgram.lastDecision}</span>
              </div>
            )}
          </div>

          <div>
            <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Strengths</div>
            <div className="flex flex-wrap gap-2">
              {detail.strengths.map((s) => (
                <span key={s.label} className="text-xs" style={{ color: ratingColor(s.value) }}>
                  {s.label} {s.value.toFixed(1)}
                </span>
              ))}
            </div>
            <div className="mb-1 mt-3 text-xs uppercase tracking-wide text-neutral-500">Weaknesses</div>
            <div className="flex flex-wrap gap-2">
              {detail.weaknesses.map((s) => (
                <span key={s.label} className="text-xs" style={{ color: ratingColor(s.value) }}>
                  {s.label} {s.value.toFixed(1)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <div className="space-y-6">
        <Panel title="Ratings">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            <RatingRow label="Car" value={row.carRating} />
            <RatingRow label="Drivers" value={row.driverRating} />
            <RatingRow label="Development" value={row.developmentRating} />
            <RatingRow label="Facilities" value={row.facilitiesRating} />
            <RatingRow label="Staff" value={row.staffRating} />
            <RatingRow label="Engine" value={row.engineRating} />
            <RatingRow label="Academy" value={row.academyRating} />
            <RatingRow label="Race Ops" value={row.raceOpsRating} />
            <RatingRow label="Pit Crew" value={row.pitCrewRating} />
            <RatingRow label="Reliability" value={row.reliabilityRating} />
            <RatingRow label="Finance" value={row.financeRating} />
            <RatingRow label="Reputation" value={row.reputationRating} />
          </div>
        </Panel>

        <Panel title="Lineup & Academy">
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wide text-neutral-500">Race drivers</div>
              {detail.raceDrivers.length ? (
                detail.raceDrivers.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2">
                    <span className="text-neutral-200">{d.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums text-neutral-400">{d.ratings.overall.toFixed(1)}</span>
                      {state && (
                        <DriverDossierButton
                          state={state}
                          subject={{ type: 'driver', driver: d }}
                          context={`${row.name} - race driver`}
                          focus={row.isPlayer ? 'relationship' : 'identity'}
                        />
                      )}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-neutral-600">No race drivers.</div>
              )}
            </div>
            {detail.reserveDrivers.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wide text-neutral-500">Reserve / test</div>
                {detail.reserveDrivers.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2">
                    <span className="text-neutral-300">
                      {d.name}
                      {d.contractType && d.contractType !== 'seat' && (
                        <span className="ml-1 text-[10px] uppercase text-neutral-500">{d.contractType}</span>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums text-neutral-500">{d.ratings.overall.toFixed(1)}</span>
                      {state && (
                        <DriverDossierButton
                          state={state}
                          subject={{ type: 'driver', driver: d }}
                          context={`${row.name} - reserve driver`}
                          focus="development"
                        />
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div>
              <div className="text-xs uppercase tracking-wide text-neutral-500">Academy prospects</div>
              {detail.academyProspectNames.length ? (
                <div className="text-neutral-300">{detail.academyProspectNames.join(', ')}</div>
              ) : (
                <div className="text-neutral-600">No academy prospects.</div>
              )}
            </div>
          </div>
        </Panel>

        {detail.recentMoves.length > 0 && (
          <Panel title="Recent Offseason Moves">
            <ul className="space-y-1 text-sm text-neutral-300">
              {detail.recentMoves.map((m, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-neutral-600">•</span>
                  {m}
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-neutral-500">{label}</span>
      <span className="text-neutral-200">{value}</span>
    </div>
  );
}

function RatingRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-neutral-400">{label}</span>
      <RatingBadge value={value} />
    </div>
  );
}
