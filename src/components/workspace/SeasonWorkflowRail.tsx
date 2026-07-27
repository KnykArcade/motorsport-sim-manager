import {
  SEASON_WORKFLOW_STAGES,
  workflowStageState,
  type SeasonWorkflowStage,
} from '../../screens/seasonRaceWorkflowViewModel';

export function SeasonWorkflowRail({
  active,
  context,
  blocker,
}: {
  active: SeasonWorkflowStage;
  context: string;
  blocker?: string;
}) {
  return (
    <section className="ui-season-workflow-rail" aria-label="Season and race workflow">
      <div className="ui-season-workflow-context">
        <span>{blocker ? 'Action required' : 'Current workflow'}</span>
        <strong>{context}</strong>
        {blocker && <small>{blocker}</small>}
      </div>
      <ol>
        {SEASON_WORKFLOW_STAGES.map((stage, index) => {
          const state = workflowStageState(stage.id, active);
          return (
            <li key={stage.id} className={`is-${state}`} aria-current={state === 'active' ? 'step' : undefined}>
              <span className="ui-season-workflow-index">{index + 1}</span>
              <span className="ui-season-workflow-label">{stage.label}</span>
              <span className="ui-season-workflow-short">{stage.shortLabel}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
