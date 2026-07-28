import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import {
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';
import {
  FmKeyValue,
  FmListButton,
  FmPane,
  FmPaneBody,
  FmPaneHeader,
  FmWorkspaceGrid,
} from '../components/workspace/FmPane';
import {
  TEAM_DETAIL_TABS,
  TEAM_OVERVIEW_PAGE_SIZE,
  selectedTeamOverviewRow,
  teamOverviewPage,
  teamOverviewPageCount,
  type TeamDetailTab,
} from './teamOverviewViewModel';
import { EntityBrowseControls } from '../components/EntityBrowseControls';

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

function sortValue(row: TeamOverviewRow, key: SortKey): number {
  if (key === 'championshipPosition') return row.championshipPosition ?? 999;
  if (key === 'financialHealth') return HEALTH_ORDER.indexOf(row.financialHealth);
  return row[key] as number;
}

export function TeamOverview() {
  const { state } = useGame();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedFilter = searchParams.get('filter');
  const filter: Filter = requestedFilter === 'player' || requestedFilter === 'rivals'
    ? requestedFilter
    : 'all';
  const requestedSort = searchParams.get('sort') as SortKey | null;
  const sortKey: SortKey = requestedSort && [
    'championshipPosition', 'overallRating', 'carRating', 'driverRating',
    'developmentRating', 'facilitiesRating', 'staffRating', 'engineRating',
    'academyRating', 'raceOpsRating', 'pitCrewRating', 'reliabilityRating',
    'reputationRating', 'financeRating', 'budget', 'sponsorIncome', 'financialHealth',
  ].includes(requestedSort)
    ? requestedSort
    : 'championshipPosition';
  const selectedId = searchParams.get('team');
  const requestedPage = Math.max(0, Number(searchParams.get('page') ?? 0) || 0);
  const requestedDetailTab = searchParams.get('detail');
  const detailTab: TeamDetailTab = requestedDetailTab === 'personnel'
    || requestedDetailTab === 'performance'
    || requestedDetailTab === 'operations'
    || requestedDetailTab === 'finance'
    || requestedDetailTab === 'identity'
    || requestedDetailTab === 'history'
    ? requestedDetailTab
    : 'overview';

  const rows = useMemo(() => (state ? buildTeamOverview(state) : []), [state]);

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
  const pageCount = teamOverviewPageCount(sorted.length);
  const requestedTeamIndex = selectedId
    ? sorted.findIndex((row) => row.teamId === selectedId)
    : -1;
  const exactTeamPage = requestedTeamIndex >= 0
    ? Math.floor(requestedTeamIndex / TEAM_OVERVIEW_PAGE_SIZE)
    : requestedPage;
  const safePage = Math.min(exactTeamPage, pageCount - 1);
  const visibleRows = teamOverviewPage(sorted, safePage);
  const selectedRow = selectedTeamOverviewRow(sorted, selectedId);
  const detail = selectedRow ? buildTeamOverviewDetail(state, selectedRow.teamId) : undefined;
  const playerRow = rows.find((row) => row.isPlayer);
  const fieldAverage = rows.length
    ? rows.reduce((total, row) => total + row.overallRating, 0) / rows.length
    : 0;
  const financiallyPressed = rows.filter(
    (row) => row.financialHealth === 'AtRisk' || row.financialHealth === 'Critical',
  ).length;
  const leader = rows.find((row) => row.championshipPosition === 1) ?? rows[0];
  const selectedIndex = selectedRow
    ? sorted.findIndex((row) => row.teamId === selectedRow.teamId)
    : -1;

  const updateQuery = (patch: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) next.delete(key);
      else next.set(key, String(value));
    }
    setSearchParams(next, { replace: true });
  };

  const selectTeam = (teamId: string) => {
    const index = sorted.findIndex((row) => row.teamId === teamId);
    updateQuery({
      team: teamId,
      page: index >= 0 ? Math.floor(index / TEAM_OVERVIEW_PAGE_SIZE) : safePage,
    });
  };

  const browseTeam = (offset: number) => {
    if (!sorted.length || selectedIndex < 0) return;
    const nextIndex = (selectedIndex + offset + sorted.length) % sorted.length;
    selectTeam(sorted[nextIndex].teamId);
  };

  return (
    <WorkspaceScreen className="era-feature-screen era-team-overview ui-team-people-screen">
      <WorkspaceHeader
        eyebrow="Team universe"
        title="Organization Profiles"
        subtitle={`Compare every ${state.series} team across performance, personnel, operations and finance.`}
      />

      <WorkspaceTabs
        items={[
          { id: 'all' as const, label: 'All Teams' },
          { id: 'rivals' as const, label: 'Rivals' },
          { id: 'player' as const, label: 'My Team' },
        ]}
        active={filter}
        onChange={(next) => {
          updateQuery({
            filter: next === 'all' ? undefined : next,
            page: undefined,
            team: undefined,
          });
        }}
        ariaLabel="Organization list filters"
      />

      <WorkspaceBody className="overflow-hidden">
        <FmWorkspaceGrid columns="three">
          <FmPane>
            <FmPaneHeader
              title="Organizations"
              meta={`${sorted.length} teams · ${state.seasonYear}`}
            />
            <div className="ui-team-list-tools">
              <label>
                Sort
                <select
                  value={sortKey}
                  onChange={(event) => {
                    updateQuery({
                      sort: event.target.value,
                      page: undefined,
                      team: undefined,
                    });
                  }}
                >
                  <option value="championshipPosition">Championship</option>
                  <option value="overallRating">Overall rating</option>
                  <option value="carRating">Car rating</option>
                  <option value="driverRating">Driver rating</option>
                  <option value="developmentRating">Development</option>
                  <option value="facilitiesRating">Facilities</option>
                  <option value="staffRating">Staff</option>
                  <option value="engineRating">Engine</option>
                  <option value="academyRating">Academy</option>
                  <option value="financeRating">Financial rating</option>
                  <option value="financialHealth">Financial health</option>
                  <option value="budget">Budget</option>
                </select>
              </label>
            </div>
            <FmPaneBody className="overflow-auto">
              {visibleRows.map((row, index) => {
                const position = row.championshipPosition ?? safePage * TEAM_OVERVIEW_PAGE_SIZE + index + 1;
                return (
                  <FmListButton
                    key={row.teamId}
                    active={selectedRow?.teamId === row.teamId}
                    onClick={() => selectTeam(row.teamId)}
                  >
                    <span className="ui-news-list-source">
                      P{position} · {HEALTH_LABELS[row.financialHealth]}
                    </span>
                    <strong>
                      <i style={{ backgroundColor: row.color }} />{row.name}{row.isPlayer ? ' · You' : ''}
                    </strong>
                    <span>{row.overallRating.toFixed(1)} overall · {formatMoney(row.budget)}</span>
                    <small>{TREND_LABELS[row.trend]} · {row.archetypeLabel ?? 'Team profile'}</small>
                  </FmListButton>
                );
              })}
            </FmPaneBody>
            <div className="ui-team-list-pagination">
              <button type="button" onClick={() => updateQuery({ page: Math.max(0, safePage - 1), team: undefined })} disabled={safePage === 0}>Previous</button>
              <span>{safePage + 1} / {pageCount}</span>
              <button type="button" onClick={() => updateQuery({ page: Math.min(pageCount - 1, safePage + 1), team: undefined })} disabled={safePage >= pageCount - 1}>Next</button>
            </div>
          </FmPane>

          <FmPane className="ui-team-profile-pane">
            {detail && selectedRow ? (
              <>
                <FmPaneHeader
                  title={selectedRow.name}
                  meta={`${selectedRow.championshipPosition ? `P${selectedRow.championshipPosition}` : 'Unranked'} · ${selectedRow.points} points`}
                  actions={(
                    <EntityBrowseControls
                      position={Math.max(0, selectedIndex)}
                      total={sorted.length}
                      noun="teams"
                      onPrevious={() => browseTeam(-1)}
                      onNext={() => browseTeam(1)}
                    />
                  )}
                />
                <TeamDetail
                  detail={detail}
                  tab={detailTab}
                  onTab={(next) => updateQuery({ detail: next })}
                />
              </>
            ) : (
              <FmPaneBody className="ui-inbox-empty">No organization is available.</FmPaneBody>
            )}
          </FmPane>

          <FmPane>
            <FmPaneHeader title="Organization Context" meta={`${state.series} field`} />
            <FmPaneBody className="ui-team-context-pane overflow-auto">
              {selectedRow && (
                <>
                  <section>
                    <h3>Selected team</h3>
                    <FmKeyValue label="Overall" value={selectedRow.overallRating.toFixed(1)} />
                    <FmKeyValue label="Car" value={selectedRow.carRating.toFixed(1)} />
                    <FmKeyValue label="Drivers" value={selectedRow.driverRating.toFixed(1)} />
                    <FmKeyValue label="Development" value={selectedRow.developmentRating.toFixed(1)} />
                    <FmKeyValue label="Financial health" value={HEALTH_LABELS[selectedRow.financialHealth]} />
                  </section>
                  <section>
                    <h3>Field comparison</h3>
                    <FmKeyValue label="Leader" value={leader?.name ?? 'Not established'} />
                    <FmKeyValue label="Field average" value={fieldAverage.toFixed(1)} />
                    <FmKeyValue label="Under pressure" value={financiallyPressed} />
                    <FmKeyValue label="My team" value={playerRow?.championshipPosition ? `P${playerRow.championshipPosition}` : 'Not ranked'} />
                  </section>
                  <section>
                    <h3>Current direction</h3>
                    <p>{TREND_LABELS[selectedRow.trend]} · {selectedRow.philosophyLabel ?? selectedRow.archetypeLabel ?? 'No philosophy recorded'}</p>
                  </section>
                </>
              )}
            </FmPaneBody>
          </FmPane>
        </FmWorkspaceGrid>
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}

function TeamDetail({
  detail,
  tab,
  onTab,
}: {
  detail: NonNullable<ReturnType<typeof buildTeamOverviewDetail>>;
  tab: TeamDetailTab;
  onTab: (tab: TeamDetailTab) => void;
}) {
  const { state } = useGame();
  const { row } = detail;
  return (
    <>
        <WorkspaceTabs items={TEAM_DETAIL_TABS} active={tab} onChange={onTab} ariaLabel="Team dossier sections" />
        <div className="ui-team-profile-body min-h-0 flex-1 overflow-y-auto p-3">
          {tab === 'overview' && (
            <Panel
              title={row.name}
              actions={
                <div className="flex flex-wrap items-center gap-1">
                  {state && (
                    <>
                      <CharacterDossierButton
                        state={state}
                        subject={
                          row.isPlayer
                            ? { type: 'playerPrincipal' }
                            : { type: 'aiPrincipal', teamId: row.teamId }
                        }
                      >
                        Principal Card
                      </CharacterDossierButton>
                      <CharacterDossierButton state={state} subject={{ type: 'owner', teamId: row.teamId }}>
                        Owner Card
                      </CharacterDossierButton>
                    </>
                  )}
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

          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <Line label="Budget" value={formatMoney(row.budget)} />
            <Line label={row.isPlayer ? 'Sponsor income' : 'Estimated sponsor income'} value={formatMoney(row.sponsorIncome)} />
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
          )}

      {tab === 'identity' && (
        <Panel title="Identity & Strategy">
          {detail.identityProfile ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-4">
                <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Management posture</div>
                  <h3 className="mt-1 text-lg font-bold text-neutral-100">{detail.identityProfile.archetype}</h3>
                  <p className="mt-1 text-sm text-neutral-400">{detail.identityProfile.archetypeDescription}</p>
                  <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 text-sm">
                    <Line label="Season goal" value={detail.identityProfile.goal} />
                    <Line label="Risk appetite" value={`${detail.identityProfile.riskLabel} (${detail.identityProfile.riskScore})`} />
                    <Line label="Projected cash" value={formatMoney(detail.identityProfile.projectedCash)} />
                    <Line label="Protected reserve" value={formatMoney(detail.identityProfile.reserveTarget)} />
                  </div>
                </section>
                <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Performance memory</div>
                  <div className="mt-2 grid grid-cols-2 gap-x-5 gap-y-2 text-sm">
                    <Line label="Long-term trend" value={detail.identityProfile.trendLabel} />
                    <Line label="Tracked seasons" value={String(detail.identityProfile.seasonsTracked)} />
                    <Line label="Average finish" value={detail.identityProfile.averageFinish ? `P${detail.identityProfile.averageFinish}` : 'Not established'} />
                    <Line label="Best finish" value={detail.identityProfile.bestFinish ? `P${detail.identityProfile.bestFinish}` : 'Not established'} />
                    <Line label="Seasons since win" value={String(detail.identityProfile.seasonsSinceWin)} />
                    <Line label="Seasons since podium" value={String(detail.identityProfile.seasonsSincePodium)} />
                  </div>
                  {detail.identityProfile.latestEvolution && (
                    <div className="mt-3 rounded border border-amber-900/50 bg-amber-950/15 p-3 text-xs text-neutral-300">
                      <div className="font-semibold text-amber-300">Latest identity change · {detail.identityProfile.latestEvolution.seasonYear}</div>
                      <p className="mt-1 text-neutral-400">{detail.identityProfile.latestEvolution.note}</p>
                    </div>
                  )}
                </section>
              </div>
              <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Team philosophy</div>
                <p className="mt-2 text-sm text-neutral-300">{detail.identityProfile.philosophyDescription}</p>
                <div className="mt-4 space-y-3">
                  {detail.identityProfile.traits.map((trait) => (
                    <article key={trait.label} className="rounded border border-neutral-800 bg-neutral-950/60 p-3">
                      <h4 className="text-sm font-semibold text-neutral-100">{trait.label}</h4>
                      <p className="mt-1 text-xs leading-relaxed text-neutral-400">{trait.effect}</p>
                    </article>
                  ))}
                </div>
                <p className="mt-4 text-xs leading-relaxed text-neutral-500">
                  These traits directly influence development targets, driver recruitment, academy investment, spending priorities, and strategic risk. They can evolve after sustained improvement, decline, or stagnation.
                </p>
              </section>
            </div>
          ) : (
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-5 text-sm text-neutral-400">
              This is your team. Its identity is created by your technical, financial, personnel, and race-weekend decisions.
            </div>
          )}
        </Panel>
      )}

      {tab === 'performance' && (
        <Panel title="Competitive Performance">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            <RatingRow label="Overall" value={row.overallRating} />
            <RatingRow label="Car" value={row.carRating} />
            <RatingRow label="Drivers" value={row.driverRating} />
            <RatingRow label="Development" value={row.developmentRating} />
            <RatingRow label="Race Ops" value={row.raceOpsRating} />
            <RatingRow label="Reliability" value={row.reliabilityRating} />
            <RatingRow label="Reputation" value={row.reputationRating} />
          </div>
          <MechanicImpact>
            Overall combines car (28%), drivers (16%), development (12%), facilities (10%), staff (10%), finance (9%), race operations (8%), and reliability (7%). Driver strength weights the lead seat 60% and the second seat 40%.
          </MechanicImpact>
        </Panel>
      )}

      {tab === 'personnel' && (
        <Panel
          title="Personnel & Driver Pathway"
          actions={state && (
            <div className="flex items-center gap-1">
              <CharacterDossierButton
                state={state}
                subject={row.isPlayer ? { type: 'playerPrincipal' } : { type: 'aiPrincipal', teamId: row.teamId }}
              >
                Principal Card
              </CharacterDossierButton>
              <CharacterDossierButton state={state} subject={{ type: 'owner', teamId: row.teamId }}>
                Owner Card
              </CharacterDossierButton>
            </div>
          )}
        >
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wide text-neutral-500">Race drivers</div>
              {detail.raceDrivers.length ? (
                detail.raceDrivers.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2">
                    <span className="text-neutral-200">{d.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold tabular-nums" style={{ color: ratingColor(d.ratings.overall) }}>{d.ratings.overall.toFixed(1)}</span>
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
                      <span className="font-semibold tabular-nums" style={{ color: ratingColor(d.ratings.overall) }}>{d.ratings.overall.toFixed(1)}</span>
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
            <MechanicImpact>
              Driver strength feeds the competitive rating. Academy strength represents the organization’s prospect pipeline; development and facilities determine how effectively that potential can be converted into future performance.
            </MechanicImpact>
          </div>
        </Panel>
      )}

      {tab === 'operations' && (
        <Panel title="Facilities & Operations">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              <RatingRow label="Facilities" value={row.facilitiesRating} />
              <RatingRow label="Staff" value={row.staffRating} />
              <RatingRow label="Engine" value={row.engineRating} />
              <RatingRow label="Academy" value={row.academyRating} />
              <RatingRow label="Race Ops" value={row.raceOpsRating} />
              <RatingRow label="Pit Crew" value={row.pitCrewRating} />
              <RatingRow label="Reliability" value={row.reliabilityRating} />
            </div>
            <div className="space-y-2 text-sm">
              <Line
                label="Engine agreement"
                value={detail.engineSupplier ? `${detail.engineSupplier}${detail.engineDealType ? ` (${detail.engineDealType})` : ''}` : 'Not recorded'}
              />
              <Line label="R&D focus" value={detail.technicalProgram.focus?.replace('_', ' ') ?? 'Not selected'} />
              <Line label="Active projects" value={String(detail.technicalProgram.activeProjects)} />
              <Line label="Completed projects" value={String(detail.technicalProgram.completedProjects)} />
              <Line label="Factory orders" value={String(detail.technicalProgram.factoryOrders)} />
              <Line label="Technical spend" value={formatMoney(detail.technicalProgram.spend)} />
            </div>
          </div>
          <MechanicImpact>
            Facilities and staff support development success. Race operations and pit crew influence weekend execution, while engine strength and reliability determine available performance and mechanical risk.
          </MechanicImpact>
        </Panel>
      )}

      {tab === 'finance' && (
        <Panel title="Financial Position">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2 text-sm">
              <Line label="Financial health" value={HEALTH_LABELS[row.financialHealth]} />
              <Line label="Budget" value={formatMoney(row.budget)} />
              <Line
                label={row.isPlayer ? 'Sponsor income' : 'Estimated sponsor income'}
                value={formatMoney(row.sponsorIncome)}
              />
              <Line label="Finance rating" value={row.financeRating.toFixed(1)} />
              <Line label="Sponsor rating" value={row.sponsorRating.toFixed(1)} />
            </div>
            <div className="space-y-2 text-sm">
              <Line label="Technical spend" value={formatMoney(detail.technicalProgram.spend)} />
              {detail.identityProfile && (
                <>
                  <Line label="Projected cash" value={formatMoney(detail.identityProfile.projectedCash)} />
                  <Line label="Protected reserve" value={formatMoney(detail.identityProfile.reserveTarget)} />
                </>
              )}
            </div>
          </div>
          <MechanicImpact>
            Finance contributes 9% of the overall organization rating and constrains hiring, development, facilities, and technical spending. Rival sponsor income is an estimate derived by the simulation, not a disclosed contract figure.
          </MechanicImpact>
        </Panel>
      )}

      {tab === 'history' && (
        <Panel title="Organization History">
          {detail.identityProfile && (
            <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <Line label="Tracked seasons" value={String(detail.identityProfile.seasonsTracked)} />
              <Line label="Average finish" value={detail.identityProfile.averageFinish ? `P${detail.identityProfile.averageFinish}` : 'Not established'} />
              <Line label="Best finish" value={detail.identityProfile.bestFinish ? `P${detail.identityProfile.bestFinish}` : 'Not established'} />
              <Line label="Seasons since win" value={String(detail.identityProfile.seasonsSinceWin)} />
              <Line label="Seasons since podium" value={String(detail.identityProfile.seasonsSincePodium)} />
              <Line label="Long-term trend" value={detail.identityProfile.trendLabel} />
            </div>
          )}
          {detail.recentMoves.length > 0 ? (
            <ul className="space-y-1 text-sm text-neutral-300">
              {detail.recentMoves.map((m, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-neutral-600">•</span>
                  {m}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-neutral-500">No recent offseason moves are recorded for this team.</div>
          )}
        </Panel>
      )}
        </div>
    </>
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

function MechanicImpact({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded border border-sky-900/60 bg-sky-950/20 px-3 py-2 text-xs leading-relaxed text-neutral-400">
      <span className="mr-1 font-semibold uppercase tracking-wide text-sky-300">Affects</span>
      {children}
    </div>
  );
}
