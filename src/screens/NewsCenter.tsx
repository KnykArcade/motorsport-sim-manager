import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { NewsCategory, NewsItem, NewsPriority } from '../types/gameTypes';
import {
  categoryLabel,
  filterNewsByCategory,
  filterNewsByPriority,
  filterNewsBySeason,
  filterNewsByTeam,
  isMajorStory,
  priorityColor,
} from '../sim/careerNewsEngine';
import { useGame } from '../game/GameContext';
import {
  buildNewsStorylines,
  selectedNewsItem,
  selectedNewsStoryline,
  storylineChapterCounts,
  type NewsStoryline,
} from './newsCenterViewModel';
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
import { MediaSessionsPanel } from './MediaSessionsPanel';

const ALL_CATEGORIES: (NewsCategory | 'all')[] = [
  'all',
  'race_result',
  'qualifying',
  'practice',
  'preseason',
  'paddock',
  'post_race',
  'financial',
  'driver_market',
  'youth_academy',
  'development',
  'sponsor',
  'ai_team',
  'career_event',
  'championship',
  'regulation',
  'general',
];

const ALL_PRIORITIES: (NewsPriority | 'all')[] = ['all', 'critical', 'high', 'normal', 'low'];
type NewsView = 'feed' | 'storylines' | 'media';

export function NewsCenter() {
  const { state } = useGame();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const view: NewsView = searchParams.get('tab') === 'media' ? 'media' : searchParams.get('tab') === 'storylines' ? 'storylines' : 'feed';
  const focusedItemId = searchParams.get('focus') ?? undefined;
  const [categoryFilter, setCategoryFilter] = useState<NewsCategory | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<NewsPriority | 'all'>('all');
  const [teamFilter, setTeamFilter] = useState<'all' | 'myTeam'>('all');
  const [seasonFilter, setSeasonFilter] = useState<number | 'all'>('all');
  const [showArchive, setShowArchive] = useState(false);
  const [majorOnly, setMajorOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roundFilter, setRoundFilter] = useState<number | 'all'>('all');
  const [displayLimit, setDisplayLimit] = useState(50);

  const allNews = useMemo(() => {
    const current = state?.news ?? [];
    const archive = state?.newsArchive ?? [];
    return showArchive ? [...archive, ...current] : current;
  }, [state?.news, state?.newsArchive, showArchive]);

  const filteredNews = useMemo(() => {
    let items = allNews;
    if (categoryFilter !== 'all') items = filterNewsByCategory(items, categoryFilter);
    if (priorityFilter !== 'all') items = filterNewsByPriority(items, priorityFilter);
    if (teamFilter === 'myTeam') items = filterNewsByTeam(items, state?.selectedTeamId);
    if (seasonFilter !== 'all') items = filterNewsBySeason(items, seasonFilter);
    if (majorOnly) items = items.filter(isMajorStory);
    if (roundFilter !== 'all') items = items.filter((item) => item.round === roundFilter);
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      items = items.filter((item) => item.headline.toLowerCase().includes(query) || item.body?.toLowerCase().includes(query));
    }
    return sortNewsNewestFirst(items);
  }, [allNews, categoryFilter, majorOnly, priorityFilter, roundFilter, searchQuery, seasonFilter, state?.selectedTeamId, teamFilter]);

  const availableSeasons = useMemo(() => {
    const seasons = new Set<number>();
    for (const item of [...(state?.news ?? []), ...(state?.newsArchive ?? [])]) {
      const year = new Date(item.timestamp).getFullYear();
      if (Number.isFinite(year)) seasons.add(year);
    }
    return [...seasons].sort((a, b) => b - a);
  }, [state?.news, state?.newsArchive]);

  const availableRounds = useMemo(() => {
    const rounds = new Set<number>();
    for (const item of allNews) if (item.round != null) rounds.add(item.round);
    return [...rounds].sort((a, b) => a - b);
  }, [allNews]);

  const storylines = useMemo(() => {
    const items = [...(state?.newsArchive ?? []), ...(state?.news ?? [])];
    const teamNames = Object.fromEntries((state?.teams ?? []).map((team) => [team.id, team.name]));
    const driverNames = Object.fromEntries((state?.drivers ?? []).map((driver) => [driver.id, driver.name]));
    return buildNewsStorylines(items, teamNames, driverNames);
  }, [state?.drivers, state?.news, state?.newsArchive, state?.teams]);

  const chapterCounts = useMemo(() => storylineChapterCounts(storylines), [storylines]);
  const selectedNews = selectedNewsItem(filteredNews, focusedItemId);
  const selectedStoryline = selectedNewsStoryline(storylines, focusedItemId);
  const attentionCount = (state?.news ?? []).filter((item) => item.priority === 'critical' || item.priority === 'high').length;

  const clearAllFilters = () => {
    setCategoryFilter('all');
    setPriorityFilter('all');
    setTeamFilter('all');
    setSeasonFilter('all');
    setMajorOnly(false);
    setRoundFilter('all');
    setSearchQuery('');
  };

  const setNewsView = (next: NewsView) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'feed') params.delete('tab');
    else params.set('tab', next);
    params.delete('focus');
    setSearchParams(params);
  };

  const selectFocusedItem = (id: string, nextView: NewsView) => {
    const params = new URLSearchParams(searchParams);
    if (nextView === 'feed') params.delete('tab');
    else params.set('tab', nextView);
    params.set('focus', id);
    setSearchParams(params);
  };

  return (
    <WorkspaceScreen className="ui-phase2-news">
      <WorkspaceHeader
        eyebrow="Media & intelligence"
        title="News Center"
        subtitle={`Season ${state?.seasonYear ?? '—'} · Round ${state?.careerPhase?.currentRound ?? '—'} · ${attentionCount} priority report${attentionCount === 1 ? '' : 's'}`}
        actions={<button type="button" onClick={() => navigate('/stories')} className="ui-inline-action rounded border px-3 py-1.5 text-xs font-semibold">Open Paddock Stories</button>}
      />
      <WorkspaceTabs
        items={[{ id: 'feed', label: 'News Feed' }, { id: 'storylines', label: `Storylines (${storylines.length})` }, { id: 'media', label: 'Media Sessions' }]}
        active={view}
        onChange={setNewsView}
        ariaLabel="News Center sections"
      />
      <WorkspaceBody>
        {view === 'media' && <MediaSessionsPanel focusedSessionId={focusedItemId} />}
        {view === 'feed' && (
          <FmWorkspaceGrid>
            <FmPane>
              <FmPaneHeader title="Reports" meta={`${filteredNews.length} shown · ${state?.news?.length ?? 0} current`} />
              <FmPaneBody className="ui-news-list-pane">
                <NewsFilters
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  categoryFilter={categoryFilter}
                  setCategoryFilter={setCategoryFilter}
                  priorityFilter={priorityFilter}
                  setPriorityFilter={setPriorityFilter}
                  teamFilter={teamFilter}
                  setTeamFilter={setTeamFilter}
                  seasonFilter={seasonFilter}
                  setSeasonFilter={setSeasonFilter}
                  roundFilter={roundFilter}
                  setRoundFilter={setRoundFilter}
                  majorOnly={majorOnly}
                  setMajorOnly={setMajorOnly}
                  showArchive={showArchive}
                  setShowArchive={setShowArchive}
                  availableSeasons={availableSeasons}
                  availableRounds={availableRounds}
                  clearAllFilters={clearAllFilters}
                />
                {filteredNews.slice(0, displayLimit).map((item) => (
                  <FmListButton
                    key={item.id}
                    active={selectedNews?.id === item.id}
                    urgent={item.priority === 'critical' || item.priority === 'high'}
                    onClick={() => {
                      selectFocusedItem(item.id, 'feed');
                    }}
                  >
                    <span className="ui-news-list-source">{categoryLabel(item.category)}</span>
                    <strong>{item.headline}</strong>
                    <span>{item.body ?? 'No additional report detail.'}</span>
                    <small>{item.round != null ? `Round ${item.round}` : formatTimestamp(item.timestamp)}</small>
                  </FmListButton>
                ))}
                {filteredNews.length === 0 && <EmptyState>No news stories match the current filters.</EmptyState>}
                {filteredNews.length > displayLimit && (
                  <button type="button" className="ui-fm-load-more" onClick={() => setDisplayLimit((value) => value + 50)}>
                    Show {Math.min(50, filteredNews.length - displayLimit)} more
                  </button>
                )}
              </FmPaneBody>
            </FmPane>

            <FmPane>
              <FmPaneHeader title={selectedNews ? categoryLabel(selectedNews.category) : 'Selected report'} meta={selectedNews ? formatTimestamp(selectedNews.timestamp) : 'No report selected'} />
              <FmPaneBody className="ui-news-reader">
                {selectedNews ? (
                  <article>
                    <div className="ui-news-reader-flags">
                      <span className={priorityColor(selectedNews.priority)}>{selectedNews.priority ?? 'normal'} priority</span>
                      {isMajorStory(selectedNews) && <span>Major story</span>}
                      {chapterCounts.get(selectedNews.id) && (
                        <span>Chapter {chapterCounts.get(selectedNews.id)?.chapter}/{chapterCounts.get(selectedNews.id)?.total}</span>
                      )}
                    </div>
                    <h2>{selectedNews.headline}</h2>
                    <p>{selectedNews.body ?? 'No additional report detail was recorded.'}</p>
                  </article>
                ) : <EmptyState>Select a report to read it.</EmptyState>}
              </FmPaneBody>
            </FmPane>

            <NewsContextPane item={selectedNews} state={state} archiveCount={state?.newsArchive?.length ?? 0} storylines={storylines} />
          </FmWorkspaceGrid>
        )}
        {view === 'storylines' && (
          <StorylineWorkspace
            storylines={storylines}
            selected={selectedStoryline}
            onSelect={(id) => {
              selectFocusedItem(id, 'storylines');
            }}
          />
        )}
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}

function NewsFilters({
  searchQuery,
  setSearchQuery,
  categoryFilter,
  setCategoryFilter,
  priorityFilter,
  setPriorityFilter,
  teamFilter,
  setTeamFilter,
  seasonFilter,
  setSeasonFilter,
  roundFilter,
  setRoundFilter,
  majorOnly,
  setMajorOnly,
  showArchive,
  setShowArchive,
  availableSeasons,
  availableRounds,
  clearAllFilters,
}: {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  categoryFilter: NewsCategory | 'all';
  setCategoryFilter: (value: NewsCategory | 'all') => void;
  priorityFilter: NewsPriority | 'all';
  setPriorityFilter: (value: NewsPriority | 'all') => void;
  teamFilter: 'all' | 'myTeam';
  setTeamFilter: (value: 'all' | 'myTeam') => void;
  seasonFilter: number | 'all';
  setSeasonFilter: (value: number | 'all') => void;
  roundFilter: number | 'all';
  setRoundFilter: (value: number | 'all') => void;
  majorOnly: boolean;
  setMajorOnly: (value: boolean) => void;
  showArchive: boolean;
  setShowArchive: (value: boolean) => void;
  availableSeasons: number[];
  availableRounds: number[];
  clearAllFilters: () => void;
}) {
  return (
    <div className="ui-news-compact-filters">
      <input type="search" placeholder="Search reports" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
      <div className="grid grid-cols-2 gap-1">
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as NewsCategory | 'all')}>
          {ALL_CATEGORIES.map((category) => <option key={category} value={category}>{category === 'all' ? 'All categories' : categoryLabel(category)}</option>)}
        </select>
        <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as NewsPriority | 'all')}>
          {ALL_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority === 'all' ? 'All priorities' : `${priority} priority`}</option>)}
        </select>
        <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value as 'all' | 'myTeam')}>
          <option value="all">All teams</option>
          <option value="myTeam">My team</option>
        </select>
        <select value={seasonFilter} onChange={(event) => setSeasonFilter(event.target.value === 'all' ? 'all' : Number(event.target.value))}>
          <option value="all">All seasons</option>
          {availableSeasons.map((season) => <option key={season} value={season}>{season}</option>)}
        </select>
        <select value={roundFilter} onChange={(event) => setRoundFilter(event.target.value === 'all' ? 'all' : Number(event.target.value))}>
          <option value="all">All rounds</option>
          {availableRounds.map((round) => <option key={round} value={round}>Round {round}</option>)}
        </select>
        <button type="button" onClick={clearAllFilters}>Clear filters</button>
      </div>
      <label><input type="checkbox" checked={majorOnly} onChange={(event) => setMajorOnly(event.target.checked)} /> Major only</label>
      <label><input type="checkbox" checked={showArchive} onChange={(event) => setShowArchive(event.target.checked)} /> Include archive</label>
    </div>
  );
}

function NewsContextPane({
  item,
  state,
  archiveCount,
  storylines,
}: {
  item?: NewsItem;
  state: ReturnType<typeof useGame>['state'];
  archiveCount: number;
  storylines: NewsStoryline[];
}) {
  const team = item?.teamId ? state?.teams.find((candidate) => candidate.id === item.teamId) : undefined;
  const driver = item?.driverId ? state?.drivers.find((candidate) => candidate.id === item.driverId) : undefined;
  const storyline = item ? storylines.find((candidate) => candidate.chapters.some((chapter) => chapter.id === item.id)) : undefined;
  return (
    <FmPane>
      <FmPaneHeader title="Report context" meta="State-backed detail" />
      <FmPaneBody className="ui-news-context-pane">
        {item ? (
          <>
            <section>
              <h3>Report</h3>
              <FmKeyValue label="Category" value={categoryLabel(item.category)} />
              <FmKeyValue label="Priority" value={item.priority ?? 'normal'} />
              <FmKeyValue label="Round" value={item.round ?? '—'} />
              <FmKeyValue label="Season archive" value={archiveCount} />
            </section>
            <section>
              <h3>Subject</h3>
              <FmKeyValue label="Driver" value={driver?.name ?? '—'} />
              <FmKeyValue label="Team" value={team?.name ?? '—'} />
              <FmKeyValue label="Storyline" value={storyline?.status ?? 'Standalone'} />
              {storyline && <p>{storyline.summary}</p>}
            </section>
          </>
        ) : <EmptyState>No report context available.</EmptyState>}
      </FmPaneBody>
    </FmPane>
  );
}

function StorylineWorkspace({
  storylines,
  selected,
  onSelect,
}: {
  storylines: NewsStoryline[];
  selected?: NewsStoryline;
  onSelect: (id: string) => void;
}) {
  return (
    <FmWorkspaceGrid>
      <FmPane>
        <FmPaneHeader title="Developing stories" meta={`${storylines.length} connected threads`} />
        <FmPaneBody>
          {storylines.map((storyline) => (
            <FmListButton key={storyline.id} active={selected?.id === storyline.id} urgent={storyline.status === 'Escalating'} onClick={() => onSelect(storyline.id)}>
              <span className="ui-news-list-source">{storyline.subjectType} · {storyline.status}</span>
              <strong>{storyline.title}</strong>
              <span>{storyline.summary}</span>
              <small>{storyline.chapters.length} chapters</small>
            </FmListButton>
          ))}
          {storylines.length === 0 && <EmptyState>Continuing storylines appear after connected reports are generated.</EmptyState>}
        </FmPaneBody>
      </FmPane>
      <FmPane>
        <FmPaneHeader title={selected?.title ?? 'Selected storyline'} meta={selected ? `${selected.status} · ${selected.chapters.length} chapters` : 'No storyline selected'} />
        <FmPaneBody className="ui-news-reader">
          {selected ? (
            <article>
              <h2>{selected.title}</h2>
              <p>{selected.summary}</p>
              <div className="ui-news-timeline">
                {selected.chapters.map((chapter, index) => (
                  <section key={chapter.id}>
                    <small>Chapter {selected.chapters.length - index}{chapter.round != null ? ` · R${chapter.round}` : ''}</small>
                    <h3>{chapter.headline}</h3>
                    {chapter.body && <p>{chapter.body}</p>}
                  </section>
                ))}
              </div>
            </article>
          ) : <EmptyState>Select a storyline to inspect its chronology.</EmptyState>}
        </FmPaneBody>
      </FmPane>
      <FmPane>
        <FmPaneHeader title="Story context" meta="Trend and pressure" />
        <FmPaneBody className="ui-news-context-pane">
          {selected ? (
            <section>
              <h3>Status</h3>
              <FmKeyValue label="State" value={selected.status} />
              <FmKeyValue label="Subject" value={selected.subjectType} />
              <FmKeyValue label="Latest round" value={selected.latestRound ?? '—'} />
              <FmKeyValue label="Reports" value={selected.chapters.length} />
              <p>{selected.status === 'Escalating' ? 'Recent reporting contains critical pressure.' : selected.status === 'Developing' ? 'Recent reports are forming a stronger sustained trend.' : 'This thread remains active without immediate escalation.'}</p>
            </section>
          ) : <EmptyState>No storyline context available.</EmptyState>}
        </FmPaneBody>
      </FmPane>
    </FmWorkspaceGrid>
  );
}

function sortNewsNewestFirst(items: NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => {
    const timeA = Date.parse(a.timestamp);
    const timeB = Date.parse(b.timestamp);
    if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) return timeB - timeA;
    if ((b.round ?? -1) !== (a.round ?? -1)) return (b.round ?? -1) - (a.round ?? -1);
    return b.id.localeCompare(a.id);
  });
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString() : timestamp;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="ui-inbox-empty">{children}</div>;
}
