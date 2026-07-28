export function EntityBrowseControls({
  position,
  total,
  noun,
  onPrevious,
  onNext,
}: {
  position: number;
  total: number;
  noun: string;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="ui-entity-browse-controls" aria-label={`Browse ${noun}`}>
      <button type="button" onClick={onPrevious} disabled={total < 2} aria-label={`Previous ${noun}`}>‹</button>
      <span>{Math.min(position + 1, total)} / {total}</span>
      <button type="button" onClick={onNext} disabled={total < 2} aria-label={`Next ${noun}`}>›</button>
    </div>
  );
}
