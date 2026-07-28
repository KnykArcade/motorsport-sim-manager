import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Button } from '../components/Button';
import {
  MetricStrip,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceMetric,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';
import { useGame } from '../game/GameContext';
import {
  buildPerformanceDataHub,
  type DataHubDriverRow,
  type DataHubTrackRow,
} from './performanceDataHubViewModel';
import type { AnalyticsEvidenceLevel } from '../types/performanceAnalyticsTypes';
import {
  FmKeyValue,
  FmListButton,
  FmPane,
  FmPaneBody,
  FmPaneHeader,
  FmWorkspaceGrid,
} from '../components/workspace/FmPane';
import {
  DEFAULT_DRIVER_COLUMNS,
  DEFAULT_TRACK_COLUMNS,
  moveItem,
  useInformationViewPreferences,
  type DataHubPanelId,
  type DataHubTab,
  type DriverColumnId,
  type NamedDataHubView,
  type TrackColumnId,
} from './informationViewPreferences';

const TABS: ReadonlyArray<{ id: DataHubTab; label: string }> = [
  { id: 'overview', label: 'Engineer Review' },
  { id: 'drivers', label: 'Driver Analysis' },
  { id: 'tracks', label: 'Circuit Types' },
  { id: 'rivals', label: 'Rival Intelligence' },
];

export function PerformanceDataHub() {
  const { state } = useGame();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const tab: DataHubTab = requestedTab === 'drivers' || requestedTab === 'tracks' || requestedTab === 'rivals'
    ? requestedTab
    : 'overview';
  const [customizing, setCustomizing] = useState(false);
  const [viewName, setViewName] = useState('');
  const defaultRival = state?.constructorStandings.find((entry) => entry.entityId !== state.selectedTeamId)?.entityId
    ?? state?.teams.find((team) => team.id !== state.selectedTeamId)?.id;
  const rivalTeamId = searchParams.get('rival') ?? defaultRival ?? '';
  const hub = useMemo(() => state ? buildPerformanceDataHub(state, rivalTeamId) : null, [state, rivalTeamId]);
  const { preferences, setPreferences, resetPreferences } = useInformationViewPreferences(state?.id ?? 'no-career');
  if (!state || !hub) return null;

  const driverName = (id: string) => state.drivers.find((driver) => driver.id === id)?.name ?? id;
  const teamName = (id: string) => state.teams.find((team) => team.id === id)?.name ?? id;
  const primaryMetrics = hub.metrics.slice(0, 4);
  const evidenceMetrics = hub.metrics.slice(4);
  const updateQuery = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value == null) next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  };
  const setTab = (next: DataHubTab) => updateQuery({ tab: next });
  const togglePin = (findingId: string) => setPreferences((current) => ({
    ...current,
    pinnedFindingIds: current.pinnedFindingIds.includes(findingId)
      ? current.pinnedFindingIds.filter((id) => id !== findingId)
      : [...current.pinnedFindingIds, findingId].slice(-12),
  }));
  const saveView = () => {
    const name = viewName.trim();
    if (!name) return;
    const view: NamedDataHubView = {
      id: `${Date.now()}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
      name,
      tab,
      rivalTeamId,
      density: preferences.density,
      panelOrder: preferences.dataHubPanelOrder,
      driverColumns: preferences.driverColumns,
      trackColumns: preferences.trackColumns,
      columnWidths: preferences.columnWidths,
    };
    setPreferences((current) => ({ ...current, namedViews: [...current.namedViews.filter((item) => item.name !== name), view].slice(-12) }));
    setViewName('');
  };
  const applyView = (view: NamedDataHubView) => {
    setPreferences((current) => ({
      ...current,
      density: view.density,
      dataHubPanelOrder: view.panelOrder,
      driverColumns: view.driverColumns,
      trackColumns: view.trackColumns,
      columnWidths: view.columnWidths,
    }));
    updateQuery({ tab: view.tab, rival: view.rivalTeamId || undefined });
  };

  return (
    <WorkspaceScreen className={`era-feature-screen era-performance-data-hub-screen ui-density-${preferences.density}`}>
      <WorkspaceHeader
        eyebrow="Performance department"
        title="Motorsport Data Hub"
        subtitle={`${state.seasonYear} ${state.series} · Evidence-backed trends, conclusions, and follow-up actions`}
        actions={<div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => setCustomizing((current) => !current)}>{customizing ? 'Close View Setup' : 'Customize View'}</Button>
          <Button variant="ghost" onClick={() => navigate('/history')}>Raw Race History</Button>
          {hub.latestRaceId && <Button variant="primary" onClick={() => navigate(`/post-race/${hub.latestRaceId}`)}>Latest Debrief →</Button>}
        </div>}
      />
      <MetricStrip>
        {primaryMetrics.map((metric) => (
          <WorkspaceMetric key={metric.id} label={metric.label} value={metric.value} detail={`${metric.detail} · ${metric.trend}`} />
        ))}
      </MetricStrip>
      <div className="shrink-0 rounded border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-[11px] text-sky-100">
        {hub.raceCount === 0
          ? 'No completed races yet. The Data Hub will build its baseline after the first race.'
          : `${hub.raceCount} race snapshot${hub.raceCount === 1 ? '' : 's'} available; ${hub.telemetryRaceCount} include detailed live pit and tire telemetry. Missing historical measurements remain unavailable rather than estimated.`}
      </div>
      <WorkspaceTabs items={TABS} active={tab} onChange={setTab} ariaLabel="Data Hub sections" />
      <WorkspaceBody className="ui-phase14-workspace">
        {customizing && (
          <DataHubViewCustomizer
            preferences={preferences}
            viewName={viewName}
            onViewName={setViewName}
            onSaveView={saveView}
            onApplyView={applyView}
            onDeleteView={(viewId) => setPreferences((current) => ({ ...current, namedViews: current.namedViews.filter((view) => view.id !== viewId) }))}
            onDensity={(density) => setPreferences((current) => ({ ...current, density }))}
            onPanelOrder={(panelOrder) => setPreferences((current) => ({ ...current, dataHubPanelOrder: panelOrder }))}
            onDriverColumns={(driverColumns) => setPreferences((current) => ({ ...current, driverColumns }))}
            onTrackColumns={(trackColumns) => setPreferences((current) => ({ ...current, trackColumns }))}
            onColumnWidth={(column, width) => setPreferences((current) => ({ ...current, columnWidths: { ...current.columnWidths, [column]: width } }))}
            onReset={resetPreferences}
          />
        )}
        {tab === 'overview' && (
          <FmWorkspaceGrid className="ui-performance-review-grid">
            <FmPane style={{ order: preferences.dataHubPanelOrder.indexOf('indicators') }}>
              <FmPaneHeader title="Evidence indicators" meta={`${evidenceMetrics.length} live measures`} />
              <FmPaneBody>
              {evidenceMetrics.map((metric) => (
                <FmListButton key={metric.id}>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <small>{metric.detail}</small>
                  <em className={trendColor(metric.trend)}>{metric.trend} · {metric.confidence} confidence</em>
                </FmListButton>
              ))}
              </FmPaneBody>
            </FmPane>
            <FmPane style={{ order: preferences.dataHubPanelOrder.indexOf('findings') }}>
              <FmPaneHeader title="Engineer conclusions" meta="Every claim links to stored evidence" />
              <FmPaneBody className="overflow-auto">
                <div className="ui-performance-finding-list">
                {hub.findings.map((finding) => (
                  <article key={finding.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-neutral-100">{finding.title}</h3>
                        <p className="mt-1 text-sm text-neutral-300">{finding.conclusion}</p>
                      </div>
                      <EvidenceBadge level={finding.confidence} />
                    </div>
                    <ul className="mt-3 space-y-1 text-xs text-neutral-500">
                      {finding.evidence.map((evidence) => <li key={evidence}>• {evidence}</li>)}
                    </ul>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className={`text-xs font-semibold ${trendColor(finding.trend)}`}>{finding.trend}</span>
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => togglePin(finding.id)}>
                          {preferences.pinnedFindingIds.includes(finding.id) ? 'Unpin' : 'Pin to Home & Strategy'}
                        </Button>
                        <Button variant="ghost" onClick={() => navigate(finding.actionRoute)}>{finding.actionLabel} →</Button>
                      </div>
                    </div>
                  </article>
                ))}
                </div>
              </FmPaneBody>
            </FmPane>
            <FmPane style={{ order: preferences.dataHubPanelOrder.indexOf('context') }}>
              <FmPaneHeader title="Analysis context" meta={`${hub.raceCount} race snapshots`} />
              <FmPaneBody className="ui-phase14-pane-body">
                <div className="ui-phase14-dossier">
                  <section>
                    <h3>Evidence coverage</h3>
                    <FmKeyValue label="Race snapshots" value={hub.raceCount} />
                    <FmKeyValue label="Live telemetry" value={hub.telemetryRaceCount} />
                    <FmKeyValue label="Findings" value={hub.findings.length} />
                  </section>
                  <section>
                    <h3>Interpretation rule</h3>
                    <p>Missing measurements remain unavailable. The engineering team does not invent certainty where the save has no evidence.</p>
                  </section>
                  <section>
                    <h3>Next review</h3>
                    <Button variant="ghost" className="w-full" onClick={() => navigate('/history')}>Open raw race history →</Button>
                  </section>
                </div>
              </FmPaneBody>
            </FmPane>
          </FmWorkspaceGrid>
        )}

        {tab === 'drivers' && (
          <FmWorkspaceGrid columns="two" className="ui-performance-table-grid">
            <FmPane>
              <FmPaneHeader title="Driver and teammate comparison" meta={`${hub.drivers.length} team drivers`} />
              <FmPaneBody className="overflow-auto">
              {hub.drivers.length === 0 ? <EmptyState text="No player-team driver results are available yet." /> : (
                <table className="w-full text-sm">
                <thead><tr className="border-b border-neutral-800 text-left text-[10px] uppercase tracking-wide text-neutral-500">
                  {preferences.driverColumns.map((column) => <th key={column} className="pb-2 ui-resizable-column" style={{ width: preferences.columnWidths[`driver:${column}`] }}>{DRIVER_COLUMN_LABELS[column]}</th>)}
                </tr></thead>
                <tbody>{hub.drivers.map((driver) => (
                  <tr key={driver.driverId} className="border-b border-neutral-900/70">
                    {preferences.driverColumns.map((column) => (
                      <td key={column} className={column === 'driver' ? 'py-3 font-medium text-neutral-200' : 'py-3 text-neutral-400'}>
                        {driverColumnValue(column, driver, driverName)}
                      </td>
                    ))}
                  </tr>
                ))}</tbody>
                </table>
              )}
              </FmPaneBody>
            </FmPane>
            <FmPane>
              <FmPaneHeader title="Driver context" meta="Stored race evidence" />
              <FmPaneBody className="ui-phase14-pane-body">
                <div className="ui-phase14-dossier">
                  <section><h3>Reading the comparison</h3><p>Grid-to-finish movement, finish rate, and consistency separate race execution from one-lap starting position.</p></section>
                  <section><h3>Development route</h3><Button variant="ghost" className="w-full" onClick={() => navigate('/curves')}>Open development plans →</Button></section>
                </div>
              </FmPaneBody>
            </FmPane>
          </FmWorkspaceGrid>
        )}

        {tab === 'tracks' && (
          <FmWorkspaceGrid columns="two" className="ui-performance-table-grid">
            <FmPane>
              <FmPaneHeader title="Performance by circuit type" meta={`${hub.tracks.length} circuit profiles`} />
              <FmPaneBody className="overflow-auto">
              {hub.tracks.length === 0 ? <EmptyState text="Complete races on more circuit types to build this comparison." /> : (
                <table className="w-full text-sm">
                <thead><tr className="border-b border-neutral-800 text-left text-[10px] uppercase tracking-wide text-neutral-500">
                  {preferences.trackColumns.map((column) => <th key={column} className="pb-2 ui-resizable-column" style={{ width: preferences.columnWidths[`track:${column}`] }}>{TRACK_COLUMN_LABELS[column]}</th>)}
                </tr></thead>
                <tbody>{hub.tracks.map((track) => (
                  <tr key={track.archetype} className="border-b border-neutral-900/70">
                    {preferences.trackColumns.map((column) => (
                      <td key={column} className={column === 'archetype' ? 'py-3 font-medium text-neutral-200' : 'py-3 text-neutral-400'}>
                        {trackColumnValue(column, track)}
                      </td>
                    ))}
                  </tr>
                ))}</tbody>
                </table>
              )}
              </FmPaneBody>
            </FmPane>
            <FmPane>
              <FmPaneHeader title="Circuit context" meta="Preparation consequence" />
              <FmPaneBody className="ui-phase14-pane-body">
                <div className="ui-phase14-dossier">
                  <section><h3>Use this evidence</h3><p>Compare circuit types before choosing race preparation and setup priorities for the next weekend.</p></section>
                  <section><h3>Preparation route</h3><Button variant="ghost" className="w-full" onClick={() => navigate('/briefing?tab=preparation')}>Open race preparation →</Button></section>
                </div>
              </FmPaneBody>
            </FmPane>
          </FmWorkspaceGrid>
        )}

        {tab === 'rivals' && (
          <FmWorkspaceGrid className="ui-performance-rival-grid">
            <FmPane>
              <FmPaneHeader title="Direct rival" meta="Choose comparison team" />
              <FmPaneBody className="ui-phase14-pane-body">
              <label className="block max-w-md text-xs text-neutral-500">
                Rival team
                <select value={rivalTeamId} onChange={(event) => updateQuery({ rival: event.target.value })} className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200">
                  {state.teams.filter((team) => team.id !== state.selectedTeamId).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
              </label>
              </FmPaneBody>
            </FmPane>
            {hub.rival ? (
              <FmPane>
                <FmPaneHeader title={`${teamName(state.selectedTeamId)} vs ${teamName(hub.rival.teamId)}`} meta={`${hub.rival.racesCompared} shared races`} actions={<EvidenceBadge level={hub.rival.confidence} />} />
                <FmPaneBody className="ui-phase14-pane-body">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Comparison label="Points" player={String(hub.rival.playerPoints)} rival={String(hub.rival.rivalPoints)} />
                  <Comparison label="Average finish" player={position(hub.rival.playerAverageFinish)} rival={position(hub.rival.rivalAverageFinish)} />
                  <Comparison label="Net positions" player={signed(hub.rival.playerNetPositions)} rival={signed(hub.rival.rivalNetPositions)} />
                  <Comparison label="Shared evidence" player={`${hub.rival.racesCompared} races`} rival={`${hub.rival.racesCompared} races`} />
                </div>
                <p className="mt-4 text-xs text-neutral-500">Classification comparisons are high-integrity race records. Detailed rival pit and tire conclusions appear only when those measurements were captured.</p>
                </FmPaneBody>
              </FmPane>
            ) : <FmPane><FmPaneBody><EmptyState text="Select a rival team to compare season evidence." /></FmPaneBody></FmPane>}
            <FmPane>
              <FmPaneHeader title="Rival intelligence" meta="Confidence and limits" />
              <FmPaneBody className="ui-phase14-pane-body">
                <div className="ui-phase14-dossier">
                  <section><h3>Comparison basis</h3><p>Only shared completed races are compared. The view does not estimate hidden rival telemetry.</p></section>
                  <section><h3>Current sample</h3><FmKeyValue label="Shared races" value={hub.rival?.racesCompared ?? 0} /><FmKeyValue label="Confidence" value={hub.rival?.confidence ?? 'Unavailable'} /></section>
                </div>
              </FmPaneBody>
            </FmPane>
          </FmWorkspaceGrid>
        )}
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}

function EvidenceBadge({ level }: { level: AnalyticsEvidenceLevel }) {
  const color = level === 'High' ? 'text-emerald-300 border-emerald-500/30' : level === 'Medium' ? 'text-sky-300 border-sky-500/30' : level === 'Low' ? 'text-amber-300 border-amber-500/30' : 'text-neutral-500 border-neutral-700';
  return <span className={`shrink-0 rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${color}`}>{level} confidence</span>;
}

function Comparison({ label, player, rival }: { label: string; player: string; rival: string }) {
  return <div className="rounded border border-neutral-800 bg-neutral-950/50 p-3"><div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div><div className="mt-2 flex justify-between gap-3 text-sm"><span className="font-semibold text-amber-300">{player}</span><span className="text-neutral-400">{rival}</span></div></div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded border border-dashed border-neutral-800 p-6 text-center text-sm text-neutral-500">{text}</div>;
}

function position(value?: number) { return value == null ? 'Unavailable' : `P${value.toFixed(1)}`; }
function signed(value: number) { return `${value > 0 ? '+' : ''}${value.toFixed(1)}`; }
function trendColor(trend: string) { return trend === 'Improving' ? 'text-emerald-300' : trend === 'Worsening' ? 'text-orange-300' : 'text-neutral-400'; }

const DRIVER_COLUMN_LABELS: Record<DriverColumnId, string> = {
  driver: 'Driver',
  races: 'Races',
  grid: 'Avg grid',
  finish: 'Avg finish',
  gain: 'Places/race',
  finishRate: 'Finish rate',
  consistency: 'Consistency',
};

const TRACK_COLUMN_LABELS: Record<TrackColumnId, string> = {
  archetype: 'Circuit type',
  races: 'Races',
  grid: 'Avg grid',
  finish: 'Avg finish',
  gain: 'Places/race',
  setup: 'Setup',
  tireWear: 'Tire wear',
  points: 'Points',
  finishRate: 'Finish rate',
};

function driverColumnValue(column: DriverColumnId, driver: DataHubDriverRow, driverName: (id: string) => string) {
  if (column === 'driver') return driverName(driver.driverId);
  if (column === 'races') return driver.races;
  if (column === 'grid') return position(driver.averageGrid);
  if (column === 'finish') return position(driver.averageFinish);
  if (column === 'gain') return signed(driver.averagePositionsGained);
  if (column === 'finishRate') return `${Math.round(driver.finishRate * 100)}%`;
  return driver.consistency == null ? 'Building baseline' : `±${driver.consistency.toFixed(1)} places`;
}

function trackColumnValue(column: TrackColumnId, track: DataHubTrackRow) {
  if (column === 'archetype') return track.archetype;
  if (column === 'races') return track.races;
  if (column === 'grid') return position(track.averageGrid);
  if (column === 'finish') return position(track.averageFinish);
  if (column === 'gain') return signed(track.averagePositionsGained);
  if (column === 'setup') return track.averageSetupQuality == null ? 'Unavailable' : `${Math.round(track.averageSetupQuality)}/100`;
  if (column === 'tireWear') return track.averageTireDegRate == null ? 'Unavailable' : `${track.averageTireDegRate.toFixed(1)}/lap`;
  if (column === 'points') return track.points;
  return `${Math.round(track.finishRate * 100)}%`;
}

type ViewPreferences = ReturnType<typeof useInformationViewPreferences>['preferences'];

function DataHubViewCustomizer({
  preferences,
  viewName,
  onViewName,
  onSaveView,
  onApplyView,
  onDeleteView,
  onDensity,
  onPanelOrder,
  onDriverColumns,
  onTrackColumns,
  onColumnWidth,
  onReset,
}: {
  preferences: ViewPreferences;
  viewName: string;
  onViewName: (name: string) => void;
  onSaveView: () => void;
  onApplyView: (view: NamedDataHubView) => void;
  onDeleteView: (viewId: string) => void;
  onDensity: (density: ViewPreferences['density']) => void;
  onPanelOrder: (order: DataHubPanelId[]) => void;
  onDriverColumns: (columns: DriverColumnId[]) => void;
  onTrackColumns: (columns: TrackColumnId[]) => void;
  onColumnWidth: (column: string, width: number) => void;
  onReset: () => void;
}) {
  return (
    <section className="ui-data-view-customizer">
      <header>
        <div><span>Information layout</span><strong>Customize Data Hub view</strong></div>
        <Button variant="ghost" onClick={onReset}>Restore defaults</Button>
      </header>
      <div className="ui-data-view-customizer-grid">
        <section>
          <h3>Information density</h3>
          <div className="ui-density-picker">
            {(['compact', 'standard', 'detailed'] as const).map((density) => (
              <button type="button" key={density} className={preferences.density === density ? 'is-active' : ''} onClick={() => onDensity(density)}>{density}</button>
            ))}
          </div>
          <h3>Overview panel order</h3>
          <ReorderList
            items={preferences.dataHubPanelOrder}
            labels={{ indicators: 'Evidence indicators', findings: 'Engineer conclusions', context: 'Analysis context' }}
            onChange={onPanelOrder}
          />
        </section>
        <section>
          <h3>Driver table columns</h3>
          <ColumnEditor
            all={DEFAULT_DRIVER_COLUMNS}
            selected={preferences.driverColumns}
            labels={DRIVER_COLUMN_LABELS}
            required="driver"
            widths={preferences.columnWidths}
            widthPrefix="driver"
            onChange={onDriverColumns}
            onWidth={onColumnWidth}
          />
        </section>
        <section>
          <h3>Circuit table columns</h3>
          <ColumnEditor
            all={DEFAULT_TRACK_COLUMNS}
            selected={preferences.trackColumns}
            labels={TRACK_COLUMN_LABELS}
            required="archetype"
            widths={preferences.columnWidths}
            widthPrefix="track"
            onChange={onTrackColumns}
            onWidth={onColumnWidth}
          />
        </section>
        <section>
          <h3>Named views</h3>
          <div className="ui-save-view-row">
            <input value={viewName} onChange={(event) => onViewName(event.target.value)} placeholder="View name" maxLength={40} />
            <Button
              variant="primary"
              onClick={onSaveView}
              disabled={!viewName.trim()}
              title={!viewName.trim() ? 'Enter a view name before saving this layout.' : undefined}
            >
              Save current
            </Button>
          </div>
          <div className="ui-saved-view-list">
            {preferences.namedViews.map((view) => (
              <div key={view.id}>
                <button type="button" onClick={() => onApplyView(view)}>
                  <strong>{view.name}</strong>
                  <span>{view.tab} · {view.density}</span>
                </button>
                <button type="button" aria-label={`Delete ${view.name}`} onClick={() => onDeleteView(view.id)}>×</button>
              </div>
            ))}
            {preferences.namedViews.length === 0 && <p>No named views saved yet.</p>}
          </div>
        </section>
      </div>
    </section>
  );
}

function ReorderList<T extends string>({
  items,
  labels,
  onChange,
}: {
  items: T[];
  labels: Record<T, string>;
  onChange: (items: T[]) => void;
}) {
  return (
    <div className="ui-reorder-list">
      {items.map((item, index) => (
        <div key={item}>
          <span>{index + 1}. {labels[item]}</span>
          <button type="button" onClick={() => onChange(moveItem(items, item, -1))} disabled={index === 0} aria-label={`Move ${labels[item]} earlier`}>↑</button>
          <button type="button" onClick={() => onChange(moveItem(items, item, 1))} disabled={index === items.length - 1} aria-label={`Move ${labels[item]} later`}>↓</button>
        </div>
      ))}
    </div>
  );
}

function ColumnEditor<T extends string>({
  all,
  selected,
  labels,
  required,
  widths,
  widthPrefix,
  onChange,
  onWidth,
}: {
  all: T[];
  selected: T[];
  labels: Record<T, string>;
  required: T;
  widths: Record<string, number>;
  widthPrefix: string;
  onChange: (columns: T[]) => void;
  onWidth: (column: string, width: number) => void;
}) {
  const toggle = (column: T) => {
    if (column === required) return;
    if (selected.includes(column)) onChange(selected.filter((item) => item !== column));
    else onChange([...selected, column]);
  };
  return (
    <div className="ui-column-editor">
      {all.map((column) => {
        const index = selected.indexOf(column);
        return (
          <div key={column} className={index >= 0 ? 'is-visible' : ''}>
            <label title={column === required ? `${labels[column]} is required to identify each row.` : undefined}>
              <input
                type="checkbox"
                checked={index >= 0}
                disabled={column === required}
                onChange={() => toggle(column)}
                aria-label={`${index >= 0 ? 'Hide' : 'Show'} ${labels[column]} column`}
              />
              {labels[column]}
            </label>
            {index >= 0 && (
              <span>
                <button
                  type="button"
                  onClick={() => onChange(moveItem(selected, column, -1))}
                  disabled={index === 0}
                  title={index === 0 ? `${labels[column]} is already the first visible column.` : undefined}
                  aria-label={`Move ${labels[column]} column earlier`}
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => onChange(moveItem(selected, column, 1))}
                  disabled={index === selected.length - 1}
                  title={index === selected.length - 1 ? `${labels[column]} is already the last visible column.` : undefined}
                  aria-label={`Move ${labels[column]} column later`}
                >
                  →
                </button>
                <input
                  type="range"
                  min={70}
                  max={320}
                  step={10}
                  value={widths[`${widthPrefix}:${column}`] ?? 120}
                  onChange={(event) => onWidth(`${widthPrefix}:${column}`, Number(event.target.value))}
                  aria-label={`${labels[column]} column width`}
                />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
