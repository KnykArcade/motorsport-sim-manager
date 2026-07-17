import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { NewsItem, NewsCategory, NewsPriority } from '../types/gameTypes';
import {
  categoryLabel,
  priorityColor,
  filterNewsByCategory,
  filterNewsByPriority,
  filterNewsByTeam,
  filterNewsBySeason,
  isMajorStory,
} from '../sim/careerNewsEngine';
import { useGame } from '../game/GameContext';
import { buildNewsStorylines, storylineChapterCounts, type NewsStoryline } from './newsCenterViewModel';
import {
  MetricStrip,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceMetric,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';

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

export function NewsCenter() {
  const { state } = useGame();
  const navigate = useNavigate();
  const [view, setView] = useState<'feed' | 'storylines'>('feed');
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
    if (categoryFilter !== 'all') {
      items = filterNewsByCategory(items, categoryFilter);
    }
    if (priorityFilter !== 'all') {
      items = filterNewsByPriority(items, priorityFilter);
    }
    if (teamFilter === 'myTeam') {
      items = filterNewsByTeam(items, state?.selectedTeamId);
    }
    if (seasonFilter !== 'all') {
      items = filterNewsBySeason(items, seasonFilter);
    }
    if (majorOnly) {
      items = items.filter(isMajorStory);
    }
    if (roundFilter !== 'all') {
      items = items.filter((n) => n.round === roundFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(
        (n) =>
          n.headline.toLowerCase().includes(q) ||
          (n.body?.toLowerCase().includes(q) ?? false),
      );
    }
    return sortNewsNewestFirst(items);
  }, [allNews, categoryFilter, priorityFilter, teamFilter, seasonFilter, majorOnly, roundFilter, searchQuery, state?.selectedTeamId]);

  const availableSeasons = useMemo(() => {
    const seasons = new Set<number>();
    for (const n of [...(state?.news ?? []), ...(state?.newsArchive ?? [])]) {
      try {
        seasons.add(new Date(n.timestamp).getFullYear());
      } catch { /* skip */ }
    }
    return Array.from(seasons).sort((a, b) => b - a);
  }, [state?.news, state?.newsArchive]);

  const availableRounds = useMemo(() => {
    const rounds = new Set<number>();
    for (const n of allNews) {
      if (n.round != null) rounds.add(n.round);
    }
    return Array.from(rounds).sort((a, b) => a - b);
  }, [allNews]);

  const archiveCount = state?.newsArchive?.length ?? 0;
  const storylines = useMemo(() => {
    const items = [...(state?.newsArchive ?? []), ...(state?.news ?? [])];
    const teamNames = Object.fromEntries((state?.teams ?? []).map((team) => [team.id, team.name]));
    const driverNames = Object.fromEntries((state?.drivers ?? []).map((driver) => [driver.id, driver.name]));
    return buildNewsStorylines(items, teamNames, driverNames);
  }, [state?.newsArchive, state?.news, state?.teams, state?.drivers]);
  const chapterCounts = useMemo(() => storylineChapterCounts(storylines), [storylines]);
  const attentionCount = (state?.news ?? []).filter((item) => item.priority === 'critical' || item.priority === 'high').length;
  const teamReportCount = filterNewsByTeam(state?.news ?? [], state?.selectedTeamId).length;

  const hasActiveFilters =
    categoryFilter !== 'all' ||
    priorityFilter !== 'all' ||
    teamFilter !== 'all' ||
    seasonFilter !== 'all' ||
    majorOnly ||
    roundFilter !== 'all' ||
    searchQuery.trim() !== '';

  const clearAllFilters = () => {
    setCategoryFilter('all');
    setPriorityFilter('all');
    setTeamFilter('all');
    setSeasonFilter('all');
    setMajorOnly(false);
    setRoundFilter('all');
    setSearchQuery('');
  };

  return (
    <WorkspaceScreen>
      <WorkspaceHeader
        eyebrow="Media & intelligence"
        title="News Center"
        subtitle={`Season ${state?.seasonYear ?? '—'} · Round ${state?.careerPhase?.currentRound ?? '—'} · Reports and developing stories from the shared universe`}
        actions={<button type="button" onClick={() => navigate('/stories')} className="ui-inline-action rounded border px-3 py-1.5 text-xs font-semibold">Open Paddock Stories</button>}
      />
      <MetricStrip>
        <WorkspaceMetric label="Current reports" value={state?.news?.length ?? 0} detail={`${filteredNews.length} match this view`} />
        <WorkspaceMetric label="Priority reports" value={attentionCount} detail="Critical or high priority" />
        <WorkspaceMetric label="My team" value={teamReportCount} detail="Current team reports" />
        <WorkspaceMetric label="Story archive" value={archiveCount} detail={`${storylines.length} connected storylines`} />
      </MetricStrip>
      <WorkspaceTabs
        items={[{ id: 'feed', label: 'News Feed' }, { id: 'storylines', label: 'Storylines' }]}
        active={view}
        onChange={setView}
        ariaLabel="News Center sections"
      />
      <WorkspaceBody className="space-y-3">

      {/* Filter Controls */}
      {view === 'feed' && <div className="ui-news-filter-panel space-y-3 rounded-lg border p-3">
        {/* Search + Quick Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search headlines..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ui-news-search flex-1 min-w-[180px] rounded border px-3 py-1.5 text-sm text-neutral-200 placeholder:text-neutral-600"
          />
          <label className="flex items-center gap-1 text-xs text-neutral-400">
            <input
              type="checkbox"
              checked={majorOnly}
              onChange={(e) => setMajorOnly(e.target.checked)}
              className="accent-amber-600"
            />
            Major stories only
          </label>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
            >
              ✕ Clear filters
            </button>
          )}
        </div>

        {/* Category Filter */}
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-400">Category</label>
          <div className="flex flex-wrap gap-1">
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`rounded px-2 py-0.5 text-xs transition-colors ${
                  categoryFilter === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                }`}
              >
                {cat === 'all' ? 'All' : categoryLabel(cat)}
              </button>
            ))}
          </div>
        </div>

        {/* Priority + Team + Season + Round Filters */}
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-400">Priority</label>
            <div className="flex gap-1">
              {ALL_PRIORITIES.map((pri) => (
                <button
                  key={pri}
                  onClick={() => setPriorityFilter(pri)}
                  className={`rounded px-2 py-0.5 text-xs capitalize transition-colors ${
                    priorityFilter === pri
                      ? 'bg-blue-600 text-white'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                >
                  {pri === 'all' ? 'All' : pri}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-400">Team</label>
            <div className="flex gap-1">
              <button
                onClick={() => setTeamFilter('all')}
                className={`rounded px-2 py-0.5 text-xs transition-colors ${
                  teamFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                }`}
              >
                All Teams
              </button>
              <button
                onClick={() => setTeamFilter('myTeam')}
                className={`rounded px-2 py-0.5 text-xs transition-colors ${
                  teamFilter === 'myTeam'
                    ? 'bg-blue-600 text-white'
                    : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                }`}
              >
                My Team
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-400">Season</label>
            <select
              value={seasonFilter}
              onChange={(e) => setSeasonFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-200"
            >
              <option value="all">All Seasons</option>
              {availableSeasons.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {availableRounds.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-400">Round</label>
              <select
                value={roundFilter}
                onChange={(e) => setRoundFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-200"
              >
                <option value="all">All Rounds</option>
                {availableRounds.map((r) => (
                  <option key={r} value={r}>Round {r}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-end">
            <label className="flex items-center gap-1 text-xs text-neutral-400">
              <input
                type="checkbox"
                checked={showArchive}
                onChange={(e) => setShowArchive(e.target.checked)}
                className="accent-blue-600"
              />
              Include Archive
            </label>
          </div>
        </div>
      </div>}

      {/* News List */}
      {view === 'feed' ? <div className="space-y-2">
        {filteredNews.length === 0 && (
          <div className="py-8 text-center text-neutral-500">
            No news stories match the current filters.
          </div>
        )}
        {filteredNews.slice(0, displayLimit).map((item) => (
          <NewsCard key={item.id} item={item} chapter={chapterCounts.get(item.id)} />
        ))}
        {filteredNews.length > displayLimit && (
          <div className="py-3 text-center">
            <button
              className="rounded-lg border border-neutral-700 bg-neutral-800/50 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
              onClick={() => setDisplayLimit((d) => d + 50)}
            >
              Show {Math.min(50, filteredNews.length - displayLimit)} more ({filteredNews.length - displayLimit} remaining)
            </button>
          </div>
        )}
      </div> : <StorylineList storylines={storylines} />}
      </WorkspaceBody>
    </WorkspaceScreen>
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

function NewsCard({ item, chapter }: { item: NewsItem; chapter?: { chapter: number; total: number } }) {
  const priColor = priorityColor(item.priority);
  const catLabel = categoryLabel(item.category);

  return (
    <article className={`ui-news-card rounded-lg border p-3 ${
      item.priority === 'critical' ? 'border-red-600/40' :
      item.priority === 'high' ? 'border-amber-600/30' :
      'border-neutral-800'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <h3 className={`text-sm font-semibold ${priColor}`}>{item.headline}</h3>
          {item.body && <p className="mt-1 text-xs text-neutral-400">{item.body}</p>}
        </div>
        <div className="flex flex-col items-end gap-1">
          {item.category && (
            <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">
              {catLabel}
            </span>
          )}
          {item.priority && (
            <span className={`text-[10px] capitalize ${priColor}`}>
              {item.priority}
            </span>
          )}
          {chapter && (
            <span className="rounded bg-amber-950/50 px-1.5 py-0.5 text-[10px] text-amber-300">
              Chapter {chapter.chapter}/{chapter.total}
            </span>
          )}
        </div>
      </div>
      {item.round != null && (
        <div className="mt-1 text-[10px] text-neutral-600">Round {item.round}</div>
      )}
    </article>
  );
}

function StorylineList({ storylines }: { storylines: NewsStoryline[] }) {
  if (storylines.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 py-10 text-center text-sm text-neutral-500">
        Continuing storylines will appear after a driver or team generates multiple connected reports.
      </div>
    );
  }
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {storylines.map((storyline) => (
        <article key={storyline.id} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                {storyline.subjectType} storyline{storyline.latestRound ? ` · Through round ${storyline.latestRound}` : ''}
              </div>
              <h3 className="mt-1 text-base font-bold text-neutral-100">{storyline.title}</h3>
            </div>
            <span className={`rounded px-2 py-1 text-[10px] font-semibold ${
              storyline.status === 'Escalating'
                ? 'bg-red-950/60 text-red-300'
                : storyline.status === 'Developing'
                  ? 'bg-amber-950/60 text-amber-300'
                  : 'bg-blue-950/60 text-blue-300'
            }`}>
              {storyline.status}
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">{storyline.summary}</p>
          <div className="mt-4 space-y-2">
            {storyline.chapters.slice(0, 4).map((chapter, index) => (
              <div key={chapter.id} className="rounded border border-neutral-800 bg-neutral-950/55 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-neutral-200">{chapter.headline}</div>
                  <span className="shrink-0 text-[10px] text-neutral-600">
                    Chapter {storyline.chapters.length - index}{chapter.round != null ? ` · R${chapter.round}` : ''}
                  </span>
                </div>
                {chapter.body && <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">{chapter.body}</p>}
              </div>
            ))}
          </div>
          {storyline.chapters.length > 4 && (
            <div className="mt-2 text-[10px] text-neutral-600">{storyline.chapters.length - 4} earlier chapters remain in the searchable feed.</div>
          )}
        </article>
      ))}
    </div>
  );
}
