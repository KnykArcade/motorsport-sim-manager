import { useState } from 'react';
import { useGame } from '../game/GameContext';
import { getTrackById, getRegulationSet } from '../data';
import { RatingBadge } from '../components/RatingBadge';
import { CompactPagination } from '../components/CompactPagination';
import { SeasonWorkflowRail } from '../components/workspace/SeasonWorkflowRail';
import {
  FmKeyValue,
  FmListButton,
  FmPane,
  FmPaneBody,
  FmPaneHeader,
  FmWorkspaceGrid,
} from '../components/workspace/FmPane';
import {
  MetricStrip,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceMetric,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';
import {
  CALENDAR_PAGE_SIZE,
  calendarEntriesForTab,
  compactPage,
  pageCount,
  type CalendarTab,
} from './seasonOverviewViewModel';
import { selectedWorkflowEntry, workflowStageForPhase } from './seasonRaceWorkflowViewModel';

export function Calendar() {
  const { state } = useGame();
  const [tab, setTab] = useState<CalendarTab>('schedule');
  const [page, setPage] = useState(0);
  const [selectedRaceId, setSelectedRaceId] = useState<string>();
  if (!state) return null;

  const driverName = (id: string) => state.drivers.find((driver) => driver.id === id)?.name ?? id;
  const regSet = getRegulationSet(state.regulationSetId);
  const entries = calendarEntriesForTab(state.calendar, tab);
  const tabPageCount = pageCount(entries.length, CALENDAR_PAGE_SIZE);
  const safePage = Math.min(page, tabPageCount - 1);
  const visibleEntries = compactPage(entries, safePage, CALENDAR_PAGE_SIZE);
  const completedCount = state.calendar.filter((race) => race.completed).length;
  const remainingCount = state.calendar.length - completedCount;
  const nextRace = state.calendar.find((race) => !race.completed);
  const selectedRace = selectedWorkflowEntry(visibleEntries, selectedRaceId, nextRace?.id);
  const selectedTrack = selectedRace ? getTrackById(selectedRace.trackId) : undefined;
  const selectedResults = selectedRace ? state.completedRaceResults[selectedRace.id] : undefined;
  const selectedWinner = selectedResults?.find((result) => result.position === 1);

  function selectTab(nextTab: CalendarTab) {
    setTab(nextTab);
    setPage(0);
  }

  return (
    <WorkspaceScreen className="era-feature-screen era-calendar-screen">
      <WorkspaceHeader
        eyebrow="Competition center"
        title={`${state.seasonYear} Calendar`}
        subtitle="Season schedule, circuit demands, and completed winners."
        actions={regSet ? <span className="rounded-md bg-neutral-800 px-3 py-1 text-xs font-medium text-neutral-300">{regSet.eraLabel}</span> : undefined}
      />

      <MetricStrip>
        <WorkspaceMetric label="Rounds" value={state.calendar.length} detail={`${state.series} season`} />
        <WorkspaceMetric label="Completed" value={completedCount} detail={`${Math.round((completedCount / Math.max(1, state.calendar.length)) * 100)}% complete`} />
        <WorkspaceMetric label="Remaining" value={remainingCount} detail={state.seasonComplete ? 'Season complete' : 'Still to run'} />
        <WorkspaceMetric label="Next event" value={nextRace?.gpName ?? 'Season complete'} detail={nextRace ? `Round ${nextRace.round} · ${nextRace.trackName}` : undefined} />
      </MetricStrip>

      <SeasonWorkflowRail
        active={workflowStageForPhase(state.careerPhase?.currentPhase, state.seasonComplete)}
        context={nextRace ? `Round ${nextRace.round} · ${nextRace.gpName}` : 'Championship complete'}
      />

      <WorkspaceTabs
        items={[
          { id: 'schedule' as const, label: `Remaining Schedule (${remainingCount})` },
          { id: 'results' as const, label: `Completed Results (${completedCount})` },
        ]}
        active={tab}
        onChange={selectTab}
        ariaLabel="Calendar sections"
      />

      <WorkspaceBody className="flex flex-col">
      <FmWorkspaceGrid className="ui-season-calendar-grid">
        <FmPane className="ui-season-calendar-list">
          <FmPaneHeader title={tab === 'schedule' ? 'Remaining rounds' : 'Completed rounds'} meta={`${entries.length} events · page ${safePage + 1} of ${tabPageCount}`} />
          <FmPaneBody>
            {visibleEntries.map((race) => {
              const isCurrent = race.round === state.currentRaceIndex + 1 && !state.seasonComplete;
              return (
                <FmListButton key={race.id} active={selectedRace?.id === race.id} urgent={isCurrent} onClick={() => setSelectedRaceId(race.id)}>
                  <span className="ui-news-list-source">Round {race.round} · {race.completed ? 'Complete' : isCurrent ? 'Current' : 'Upcoming'}</span>
                  <strong>{race.gpName}</strong>
                  <span>{race.trackName} · {race.laps} laps</span>
                </FmListButton>
              );
            })}
            {visibleEntries.length === 0 && <div className="ui-inbox-empty">No races are listed in this section.</div>}
          </FmPaneBody>
        </FmPane>

        <FmPane className="ui-season-calendar-detail">
          <FmPaneHeader
            title={selectedRace?.gpName ?? 'Event dossier'}
            meta={selectedRace ? `${selectedRace.trackName} · Round ${selectedRace.round}` : 'Select a race'}
            actions={selectedRace?.completed ? <Badge tone="done">DONE</Badge> : selectedRace?.id === nextRace?.id ? <Badge tone="next">NEXT</Badge> : undefined}
          />
          <FmPaneBody className="ui-fm-scroll-column">
            {selectedRace ? (
              <>
                <div className="ui-fm-key-value-stack">
                  <FmKeyValue label="Distance" value={`${selectedRace.laps} laps · ${selectedRace.distanceKm ?? '—'} km`} />
                  <FmKeyValue label="Circuit type" value={selectedTrack?.archetype ?? 'Unavailable'} />
                  <FmKeyValue label="Primary setup" value={selectedTrack?.setupProfile.primarySetupProfile ?? 'Unavailable'} />
                  <FmKeyValue label="Status" value={selectedRace.completed ? 'Complete' : selectedRace.id === nextRace?.id ? 'Next race' : 'Scheduled'} />
                </div>
                {selectedTrack && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <RatingBadge label="Aero" value={selectedTrack.setupProfile.aeroDemand} />
                    <RatingBadge label="Pwr" value={selectedTrack.setupProfile.powerDemand} />
                    <RatingBadge label="Mech" value={selectedTrack.setupProfile.mechanicalDemand} />
                    <RatingBadge label="Risk" value={selectedTrack.setupProfile.riskDemand} />
                  </div>
                )}
                {selectedTrack?.setupProfile.strategyNotes && <p className="ui-season-calendar-notes">{selectedTrack.setupProfile.strategyNotes}</p>}
              </>
            ) : <div className="ui-inbox-empty">Select a race to open its dossier.</div>}
          </FmPaneBody>
        </FmPane>

        <FmPane className="ui-season-calendar-context">
          <FmPaneHeader title="Round context" meta={selectedRace?.completed ? 'Recorded outcome' : 'Preparation outlook'} />
          <FmPaneBody>
            {selectedRace ? (
              <div className="ui-fm-key-value-stack">
                <FmKeyValue label="Winner" value={selectedWinner ? driverName(selectedWinner.driverId) : 'Not yet raced'} />
                <FmKeyValue label="Classification" value={selectedResults ? `${selectedResults.length} entries` : 'Pending'} />
                <FmKeyValue label="Season progress" value={`${completedCount}/${state.calendar.length} complete`} />
                <FmKeyValue label="Next action" value={selectedRace.id === nextRace?.id ? 'Open current race workflow' : selectedRace.completed ? 'Review result archive' : 'Monitor preparation'} />
              </div>
            ) : <div className="ui-inbox-empty">No event context is available.</div>}
          </FmPaneBody>
        </FmPane>
      </FmWorkspaceGrid>
      <CompactPagination noun="races" total={entries.length} page={safePage} pageCount={tabPageCount} pageSize={CALENDAR_PAGE_SIZE} onPage={setPage} />
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'next' | 'done' }) {
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${tone === 'next' ? 'bg-amber-500/20 text-amber-300' : 'bg-green-500/20 text-green-300'}`}>{children}</span>;
}
