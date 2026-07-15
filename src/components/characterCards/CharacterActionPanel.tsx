import type { GameState } from '../../game/careerState';
import { useGame } from '../../game/GameContext';
import {
  availableCharacterActions,
  characterRequestHistoryForTarget,
  interactionHistoryForTarget,
  isCharacterInteractionAvailable,
} from '../../sim/characterInteractionEngine';
import type { CharacterInteractionTarget } from '../../types/characterInteractionTypes';

type Props = {
  state: GameState;
  target?: CharacterInteractionTarget;
};

const TONE_CLASS = {
  Positive: 'border-emerald-800/70 bg-emerald-950/30 text-emerald-200',
  Mixed: 'border-amber-800/70 bg-amber-950/30 text-amber-200',
  Negative: 'border-red-800/70 bg-red-950/30 text-red-200',
  Informational: 'border-sky-800/70 bg-sky-950/30 text-sky-200',
} as const;

export function CharacterActionPanel({ state, target }: Props) {
  const { dispatch } = useGame();
  if (!target) {
    return <p className="text-sm text-neutral-500">This is your own management dossier. Actions are taken with the people around you.</p>;
  }

  const actions = availableCharacterActions(state, target);
  const available = isCharacterInteractionAvailable(state, target);
  const latest = interactionHistoryForTarget(state, target)[0];
  const requestHistory = characterRequestHistoryForTarget(state, target).slice(0, 3);

  if (!actions.length) {
    return <p className="text-sm text-neutral-500">No direct management actions are available with this character in their current role.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded border border-neutral-800 bg-neutral-950/70 p-3">
        <div className="text-xs font-semibold text-neutral-200">
          {available ? 'Choose one meaningful interaction this round' : 'Interaction completed for this round'}
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          {available
            ? 'The result changes the relationship or management state immediately and is recorded in this career.'
            : `You have already met with ${target.name}. Another action becomes available next round.`}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {actions.map((action) => (
          <article key={action.id} className="flex flex-col rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <h4 className="text-sm font-semibold text-neutral-100">{action.label}</h4>
            <p className="mt-1 flex-1 text-xs leading-relaxed text-neutral-400">{action.description}</p>
            <p className="mt-2 text-[11px] text-amber-300/80">Likely effect: {action.effectPreview}</p>
            <button
              type="button"
              disabled={!available}
              onClick={() => dispatch({ type: 'PERFORM_CHARACTER_INTERACTION', target, action: action.id })}
              className="mt-3 rounded bg-amber-500 px-3 py-2 text-xs font-semibold text-neutral-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-600"
            >
              {available ? action.label : 'Used this round'}
            </button>
          </article>
        ))}
      </div>

      {latest && (
        <section className={`rounded-lg border p-3 ${TONE_CLASS[latest.tone]}`}>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em]">Latest outcome · {latest.actionLabel}</div>
          <p className="mt-2 text-xs leading-relaxed text-neutral-200">{latest.outcome}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {latest.effects.map((effect) => <span key={effect} className="rounded bg-black/25 px-2 py-1 text-[10px]">{effect}</span>)}
          </div>
        </section>
      )}

      {requestHistory.length > 0 && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">Recent requests and decisions</div>
          <div className="mt-2 space-y-2">
            {requestHistory.map((record) => (
              <article key={record.id} className="rounded border border-neutral-800 bg-neutral-900/50 p-2.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <strong className="text-neutral-200">{record.optionLabel}</strong>
                  <span className="text-[10px] text-neutral-600">{record.seasonYear} · R{record.round}</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">{record.outcome}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
