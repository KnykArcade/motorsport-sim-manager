import type { StandingsEntry } from '../types/gameTypes';

type Props = {
  entries: StandingsEntry[];
  nameOf: (entityId: string) => string;
  subtitleOf?: (entityId: string) => string | undefined;
  colorOf?: (entityId: string) => string | undefined;
  highlightId?: string;
  title?: string;
};

export function StandingsTable({
  entries,
  nameOf,
  subtitleOf,
  colorOf,
  highlightId,
  title,
}: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-800">
      {title && (
        <div className="border-b border-neutral-800 bg-neutral-900/60 px-3 py-2 text-sm font-semibold text-neutral-200">
          {title}
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-neutral-900/40 text-left text-xs uppercase tracking-wide text-neutral-500">
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-2 py-2 text-right font-medium">Pts</th>
            <th className="px-2 py-2 text-right font-medium">W</th>
            <th className="px-2 py-2 text-right font-medium">Pod</th>
            <th className="px-2 py-2 text-right font-medium">DNF</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => {
            const isPlayer = e.entityId === highlightId;
            const subtitle = subtitleOf?.(e.entityId);
            return (
              <tr
                key={e.entityId}
                className={`border-t border-neutral-800/60 ${isPlayer ? 'bg-amber-500/10' : 'hover:bg-neutral-900/40'}`}
              >
                <td className="px-3 py-1.5 tabular-nums text-neutral-400">{i + 1}</td>
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    {colorOf && (
                      <span
                        className="h-3 w-1 rounded-sm"
                        style={{ backgroundColor: colorOf(e.entityId) ?? '#666' }}
                      />
                    )}
                    <span className="font-medium text-neutral-100">{nameOf(e.entityId)}</span>
                    {subtitle && <span className="text-xs text-neutral-500">{subtitle}</span>}
                  </div>
                </td>
                <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-neutral-100">{e.points}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-neutral-300">{e.wins}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-neutral-300">{e.podiums}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-neutral-500">{e.dnfs}</td>
              </tr>
            );
          })}
          {entries.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-neutral-500">
                No results yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
