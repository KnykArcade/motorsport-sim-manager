type StatusRow = {
  label: string;
  value: string;
};

type Props = {
  rows: StatusRow[];
  setupConfidence: string;
  onOpenCarStats: () => void;
};

export function CarStatusCard({ rows, setupConfidence, onOpenCarStats }: Props) {
  return (
    <section className="f1-1990s-panel min-h-[204px]" aria-label="Car status">
      <header className="f1-1990s-panel-title">Car Status</header>
      <div className="space-y-2 text-xs">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between border-b border-neutral-800/80 pb-1">
            <span className="text-neutral-400">{row.label}</span>
            <span className="font-mono text-lime-300">{row.value}</span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-1">
          <span className="text-neutral-400">Setup confidence</span>
          <span className="font-mono text-amber-200">{setupConfidence}</span>
        </div>
      </div>
      <button type="button" className="f1-1990s-secondary-button mt-3 w-full" onClick={onOpenCarStats}>
        Detailed Car Stats
      </button>
    </section>
  );
}
