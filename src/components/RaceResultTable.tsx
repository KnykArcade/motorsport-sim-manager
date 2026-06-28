import type { RaceResult } from '../types/gameTypes';

type Props = {
  results: RaceResult[];
  nameOf: (driverId: string) => string;
  teamNameOf: (teamId: string) => string;
  colorOf?: (teamId: string) => string | undefined;
  highlightTeamId?: string;
};

export function RaceResultTable({
  results,
  nameOf,
  teamNameOf,
  colorOf,
  highlightTeamId,
}: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-neutral-900/40 text-left text-xs uppercase tracking-wide text-neutral-500">
            <th className="px-3 py-2 font-medium">Pos</th>
            <th className="px-3 py-2 font-medium">Driver</th>
            <th className="px-3 py-2 font-medium">Team</th>
            <th className="px-2 py-2 text-center font-medium">Grid</th>
            <th className="px-3 py-2 font-medium">Gap / Status</th>
            <th className="px-2 py-2 text-right font-medium">Pts</th>
            <th className="px-2 py-2 text-right font-medium">Rtg</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => {
            const isPlayer = r.teamId === highlightTeamId;
            const dnf = r.status !== 'Finished';
            return (
              <tr
                key={r.driverId}
                className={`border-t border-neutral-800/60 ${isPlayer ? 'bg-amber-500/10' : ''}`}
              >
                <td className="px-3 py-1.5 font-semibold tabular-nums text-neutral-200">
                  {r.position ?? '—'}
                </td>
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    {colorOf && (
                      <span className="h-3 w-1 rounded-sm" style={{ backgroundColor: colorOf(r.teamId) ?? '#666' }} />
                    )}
                    <span className="font-medium text-neutral-100">{nameOf(r.driverId)}</span>
                  </div>
                </td>
                <td className="px-3 py-1.5 text-neutral-400">{teamNameOf(r.teamId)}</td>
                <td className="px-2 py-1.5 text-center tabular-nums text-neutral-500">{r.gridPosition}</td>
                <td className={`px-3 py-1.5 ${dnf ? 'text-red-400' : 'text-neutral-300'}`}>{r.gapText}</td>
                <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-neutral-100">
                  {r.points || ''}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-neutral-400">
                  {r.rating?.toFixed(1) ?? ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
