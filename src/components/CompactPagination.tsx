import { Button } from './Button';

export function CompactPagination({
  noun,
  total,
  page,
  pageCount,
  pageSize,
  onPage,
}: {
  noun: string;
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2">
      <Button variant="secondary" className="px-3 py-1 text-xs" disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</Button>
      <span className="text-xs text-neutral-500">{noun} {page * pageSize + 1}–{Math.min(total, (page + 1) * pageSize)} of {total} · Page {page + 1} of {pageCount}</span>
      <Button variant="secondary" className="px-3 py-1 text-xs" disabled={page >= pageCount - 1} onClick={() => onPage(page + 1)}>Next</Button>
    </div>
  );
}
