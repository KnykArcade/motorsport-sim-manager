import { useMemo } from 'react';
import type { NewsItem, NewsCategory } from '../types/gameTypes';
import {
  sortNewsByPriority,
  categoryLabel,
  priorityColor,
  filterNewsByTeam,
} from '../sim/careerNewsEngine';
import { useNavigate } from 'react-router-dom';

// Compact news panel for embedding in career phase screens.
// Shows a limited number of headlines with optional category filter.

type NewsPanelProps = {
  news: NewsItem[];
  title?: string;
  maxItems?: number;
  categoryFilter?: NewsCategory | NewsCategory[];
  teamId?: string;
  showViewAll?: boolean;
  emptyMessage?: string;
};

export function NewsPanel({
  news,
  title = 'Latest Headlines',
  maxItems = 5,
  categoryFilter,
  teamId,
  showViewAll = true,
  emptyMessage = 'No news at this time.',
}: NewsPanelProps) {
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    let items = news;
    if (categoryFilter) {
      const cats = Array.isArray(categoryFilter) ? categoryFilter : [categoryFilter];
      items = items.filter((n) => n.category && cats.includes(n.category));
    }
    if (teamId) {
      items = filterNewsByTeam(items, teamId);
    }
    return sortNewsByPriority(items).slice(0, maxItems);
  }, [news, categoryFilter, teamId, maxItems]);

  if (filtered.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
        <h3 className="mb-2 text-sm font-bold text-neutral-200">{title}</h3>
        <p className="text-xs text-neutral-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold text-neutral-200">{title}</h3>
        {showViewAll && (
          <button
            onClick={() => navigate('/news')}
            className="text-[10px] text-blue-400 hover:text-blue-300"
          >
            View All →
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {filtered.map((item) => (
          <CompactNewsItem key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function CompactNewsItem({ item }: { item: NewsItem }) {
  const priColor = priorityColor(item.priority);

  return (
    <div className="border-l-2 pl-2 ${
      item.priority === 'critical' ? 'border-red-500' :
      item.priority === 'high' ? 'border-amber-500' :
      'border-neutral-700'
    }" style={{
      borderLeftColor: item.priority === 'critical' ? '#ef4444' : item.priority === 'high' ? '#f59e0b' : '#404040',
      borderLeftWidth: 2,
      paddingLeft: 8,
    }}>
      <div className="flex items-start gap-1.5">
        <span className={`text-xs font-medium ${priColor}`}>{item.headline}</span>
      </div>
      {item.body && (
        <p className="mt-0.5 text-[10px] text-neutral-500 line-clamp-2">{item.body}</p>
      )}
      <div className="mt-0.5 flex items-center gap-2">
        {item.category && (
          <span className="text-[9px] text-neutral-600">{categoryLabel(item.category)}</span>
        )}
        {item.round != null && (
          <span className="text-[9px] text-neutral-600">R{item.round}</span>
        )}
      </div>
    </div>
  );
}
