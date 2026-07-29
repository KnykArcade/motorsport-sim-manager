import { Button } from './Button';
import { Panel } from './Panel';
import {
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceScreen,
} from './workspace/Workspace';

export function UnavailableWorkspace({
  title,
  reason,
  actionLabel,
  onAction,
}: {
  title: string;
  reason: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <WorkspaceScreen className="era-feature-screen ui-unavailable-workspace">
      <WorkspaceHeader
        eyebrow="Career navigation"
        title={title}
        subtitle="This destination is not part of the current task."
      />
      <WorkspaceBody>
        <Panel title="What happens next">
          <p className="text-sm leading-6 text-neutral-300">{reason}</p>
          <div className="mt-4">
            <Button variant="primary" onClick={onAction}>{actionLabel} →</Button>
          </div>
        </Panel>
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}
