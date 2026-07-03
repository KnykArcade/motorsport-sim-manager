import type { NewsItem } from '../types/gameTypes';
import { priorityColor, categoryLabel } from '../sim/careerNewsEngine';

export function NewsFeed({ items, limit }: { items: NewsItem[]; limit?: number }) {
  const shown = limit ? items.slice(0, limit) : items;
  return (
    <ul className="space-y-2">
      {shown.map((item) => (
        <li
          key={item.id}
          className={`rounded-md border px-3 py-2 ${
            item.priority === 'critical'
              ? 'border-red-800/50 bg-red-950/20'
              : item.priority === 'high'
                ? 'border-amber-800/40 bg-amber-950/10'
                : 'border-neutral-800 bg-neutral-900/40'
          }`}
        >
          <div className="flex items-start gap-2">
            {item.round !== undefined && (
              <span className="mt-0.5 shrink-0 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-400">
                R{item.round}
              </span>
            )}
            {item.category && (
              <span className="mt-0.5 shrink-0 rounded bg-neutral-800/70 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">
                {categoryLabel(item.category)}
              </span>
            )}
            <div>
              <p className={`text-sm font-medium ${priorityColor(item.priority)}`}>
                {item.headline}
              </p>
              {item.body && <p className="mt-0.5 text-xs text-neutral-400">{item.body}</p>}
            </div>
          </div>
        </li>
      ))}
      {shown.length === 0 && <li className="text-sm text-neutral-500">No news yet.</li>}
    </ul>
  );
}
