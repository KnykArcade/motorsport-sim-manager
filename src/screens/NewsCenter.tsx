import { useMemo, useState } from 'react';
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-neutral-100">News Center</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">
            {filteredNews.length} {filteredNews.length === 1 ? 'story' : 'stories'}
          </span>
          {archiveCount > 0 && (
            <span className="text-xs text-neutral-500">
              ({archiveCount} archived)
            </span>
          )}
        </div>
      </div>

      {/* Filter Controls */}
      <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
        {/* Search + Quick Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search headlines..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 min-w-[180px] rounded bg-neutral-800 px-3 py-1 text-sm text-neutral-200 placeholder:text-neutral-600"
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
      </div>

      {/* News List */}
      <div className="space-y-2">
        {filteredNews.length === 0 && (
          <div className="py-8 text-center text-neutral-500">
            No news stories match the current filters.
          </div>
        )}
        {filteredNews.slice(0, displayLimit).map((item) => (
          <NewsCard key={item.id} item={item} />
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
      </div>
    </div>
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

function NewsCard({ item }: { item: NewsItem }) {
  const priColor = priorityColor(item.priority);
  const catLabel = categoryLabel(item.category);

  return (
    <div className={`rounded-lg border bg-neutral-900/50 p-3 ${
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
        </div>
      </div>
      {item.round != null && (
        <div className="mt-1 text-[10px] text-neutral-600">Round {item.round}</div>
      )}
    </div>
  );
}
