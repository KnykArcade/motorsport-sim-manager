import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import {
  MetricStrip,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceMetric,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';
import { useGame } from '../game/GameContext';
import { buildPerformanceDataHub } from './performanceDataHubViewModel';
import type { AnalyticsEvidenceLevel } from '../types/performanceAnalyticsTypes';

type HubTab = 'overview' | 'drivers' | 'tracks' | 'rivals';

const TABS: ReadonlyArray<{ id: HubTab; label: string }> = [
  { id: 'overview', label: 'Engineer Review' },
  { id: 'drivers', label: 'Driver Analysis' },
  { id: 'tracks', label: 'Circuit Types' },
  { id: 'rivals', label: 'Rival Intelligence' },
];

export function PerformanceDataHub() {
  const { state } = useGame();
  const navigate = useNavigate();
  const [tab, setTab] = useState<HubTab>('overview');
  const defaultRival = state?.constructorStandings.find((entry) => entry.entityId !== state.selectedTeamId)?.entityId
    ?? state?.teams.find((team) => team.id !== state.selectedTeamId)?.id;
  const [rivalTeamId, setRivalTeamId] = useState(defaultRival ?? '');
  const hub = useMemo(() => state ? buildPerformanceDataHub(state, rivalTeamId) : null, [state, rivalTeamId]);
  if (!state || !hub) return null;

  const driverName = (id: string) => state.drivers.find((driver) => driver.id === id)?.name ?? id;
  const teamName = (id: string) => state.teams.find((team) => team.id === id)?.name ?? id;
  const primaryMetrics = hub.metrics.slice(0, 4);
  const evidenceMetrics = hub.metrics.slice(4);

  return (
    <WorkspaceScreen className="era-feature-screen era-performance-data-hub-screen">
      <WorkspaceHeader
        eyebrow="Performance department"
        title="Motorsport Data Hub"
        subtitle={`${state.seasonYear} ${state.series} · Evidence-backed trends, conclusions, and follow-up actions`}
        actions={<div className="flex flex-wrap justify-end gap-2">
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
      <WorkspaceBody className="space-y-4">
        {tab === 'overview' && (
          <>
            <div className="grid gap-3 lg:grid-cols-3">
              {evidenceMetrics.map((metric) => (
                <Panel key={metric.id} title={metric.label} actions={<EvidenceBadge level={metric.confidence} />}>
                  <div className="text-2xl font-semibold text-neutral-100">{metric.value}</div>
                  <p className="mt-1 text-xs text-neutral-500">{metric.detail}</p>
                  <p className={`mt-3 text-xs font-semibold ${trendColor(metric.trend)}`}>{metric.trend}</p>
                </Panel>
              ))}
            </div>
            <Panel title="Engineer Conclusions" actions={<span className="text-xs text-neutral-500">Every claim links to stored evidence</span>}>
              <div className="grid gap-3 xl:grid-cols-2">
                {hub.findings.map((finding) => (
                  <div key={finding.id} className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-4">
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
                      <Button variant="ghost" onClick={() => navigate(finding.actionRoute)}>{finding.actionLabel} →</Button>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </>
        )}

        {tab === 'drivers' && (
          <Panel title="Driver and Teammate Comparison" actions={<Button variant="ghost" onClick={() => navigate('/curves')}>Open Development Plans →</Button>}>
            {hub.drivers.length === 0 ? <EmptyState text="No player-team driver results are available yet." /> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-neutral-800 text-left text-[10px] uppercase tracking-wide text-neutral-500">
                  <th className="pb-2">Driver</th><th className="pb-2">Races</th><th className="pb-2">Avg grid</th><th className="pb-2">Avg finish</th><th className="pb-2">Places/race</th><th className="pb-2">Finish rate</th><th className="pb-2">Consistency</th>
                </tr></thead>
                <tbody>{hub.drivers.map((driver) => (
                  <tr key={driver.driverId} className="border-b border-neutral-900/70">
                    <td className="py-3 font-medium text-neutral-200">{driverName(driver.driverId)}</td>
                    <td className="py-3 text-neutral-500">{driver.races}</td>
                    <td className="py-3 text-neutral-400">{position(driver.averageGrid)}</td>
                    <td className="py-3 text-neutral-400">{position(driver.averageFinish)}</td>
                    <td className="py-3 text-neutral-400">{signed(driver.averagePositionsGained)}</td>
                    <td className="py-3 text-neutral-400">{Math.round(driver.finishRate * 100)}%</td>
                    <td className="py-3 text-neutral-400">{driver.consistency == null ? 'Building baseline' : `±${driver.consistency.toFixed(1)} places`}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </Panel>
        )}

        {tab === 'tracks' && (
          <Panel title="Performance by Circuit Type" actions={<Button variant="ghost" onClick={() => navigate('/briefing?tab=preparation')}>Open Race Preparation →</Button>}>
            {hub.tracks.length === 0 ? <EmptyState text="Complete races on more circuit types to build this comparison." /> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-neutral-800 text-left text-[10px] uppercase tracking-wide text-neutral-500">
                  <th className="pb-2">Circuit type</th><th className="pb-2">Races</th><th className="pb-2">Avg grid</th><th className="pb-2">Avg finish</th><th className="pb-2">Places/race</th><th className="pb-2">Setup</th><th className="pb-2">Tire wear</th><th className="pb-2">Points</th><th className="pb-2">Finish rate</th>
                </tr></thead>
                <tbody>{hub.tracks.map((track) => (
                  <tr key={track.archetype} className="border-b border-neutral-900/70">
                    <td className="py-3 font-medium text-neutral-200">{track.archetype}</td>
                    <td className="py-3 text-neutral-500">{track.races}</td>
                    <td className="py-3 text-neutral-400">{position(track.averageGrid)}</td>
                    <td className="py-3 text-neutral-400">{position(track.averageFinish)}</td>
                    <td className="py-3 text-neutral-400">{signed(track.averagePositionsGained)}</td>
                    <td className="py-3 text-neutral-400">{track.averageSetupQuality == null ? 'Unavailable' : `${Math.round(track.averageSetupQuality)}/100`}</td>
                    <td className="py-3 text-neutral-400">{track.averageTireDegRate == null ? 'Unavailable' : `${track.averageTireDegRate.toFixed(1)}/lap`}</td>
                    <td className="py-3 text-neutral-400">{track.points}</td>
                    <td className="py-3 text-neutral-400">{Math.round(track.finishRate * 100)}%</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </Panel>
        )}

        {tab === 'rivals' && (
          <>
            <Panel title="Select Direct Rival">
              <label className="block max-w-md text-xs text-neutral-500">
                Rival team
                <select value={rivalTeamId} onChange={(event) => setRivalTeamId(event.target.value)} className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200">
                  {state.teams.filter((team) => team.id !== state.selectedTeamId).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
              </label>
            </Panel>
            {hub.rival ? (
              <Panel title={`${teamName(state.selectedTeamId)} vs ${teamName(hub.rival.teamId)}`} actions={<EvidenceBadge level={hub.rival.confidence} />}>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Comparison label="Points" player={String(hub.rival.playerPoints)} rival={String(hub.rival.rivalPoints)} />
                  <Comparison label="Average finish" player={position(hub.rival.playerAverageFinish)} rival={position(hub.rival.rivalAverageFinish)} />
                  <Comparison label="Net positions" player={signed(hub.rival.playerNetPositions)} rival={signed(hub.rival.rivalNetPositions)} />
                  <Comparison label="Shared evidence" player={`${hub.rival.racesCompared} races`} rival={`${hub.rival.racesCompared} races`} />
                </div>
                <p className="mt-4 text-xs text-neutral-500">Classification comparisons are high-integrity race records. Detailed rival pit and tire conclusions appear only when those measurements were captured.</p>
              </Panel>
            ) : <EmptyState text="Select a rival team to compare season evidence." />}
          </>
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
