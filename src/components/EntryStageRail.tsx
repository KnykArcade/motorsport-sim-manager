import {
  ENTRY_STEPS,
  entryStepState,
  type EntryStep,
} from '../screens/entryRacePresentationViewModel';

export function EntryStageRail({
  active,
  onSelect,
}: {
  active: EntryStep;
  onSelect?: (step: EntryStep) => void;
}) {
  return (
    <nav className="ui-entry-stage-rail" aria-label="New career stages">
      {ENTRY_STEPS.map((item, index) => {
        const state = entryStepState(item.id, active);
        const disabled = state === 'upcoming';
        return (
          <button
            key={item.id}
            type="button"
            className={`ui-entry-stage ${state === 'active' ? 'is-active' : ''} ${state === 'complete' ? 'is-complete' : ''}`}
            aria-current={state === 'active' ? 'step' : undefined}
            disabled={disabled || !onSelect}
            onClick={() => onSelect?.(item.id)}
          >
            <span className="ui-entry-stage-number">{state === 'complete' ? '✓' : index + 1}</span>
            <span className="min-w-0">
              <strong>{item.label}</strong>
              <small>{item.detail}</small>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
