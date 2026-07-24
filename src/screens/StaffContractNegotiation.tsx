import { useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import { WorkspaceBody, WorkspaceHeader, WorkspaceScreen } from '../components/workspace/Workspace';

export function StaffContractNegotiation() {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  if (!state) return null;

  const returnToDepartments = () => {
    if (state.staffContractNegotiation) dispatch({ type: 'CANCEL_STAFF_CONTRACT_NEGOTIATION' });
    navigate('/staff');
  };

  return (
    <WorkspaceScreen>
      <WorkspaceHeader
        eyebrow="Staff departments"
        title="Departments are permanent"
        subtitle="Technical, engineering, pit operations, and strategy are improved with Principal Points rather than personnel transactions."
        actions={<Button variant="ghost" onClick={returnToDepartments}>Back to Departments</Button>}
      />
      <WorkspaceBody>
        <Panel title="Department management">
          <p className="text-sm leading-6 text-neutral-300">
            This personnel transaction is no longer part of the player-facing management flow. Open the Staff screen to review department ratings and spend Principal Points on upgrades.
          </p>
          <Button className="mt-4" variant="primary" onClick={returnToDepartments}>Open Staff Departments →</Button>
        </Panel>
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}
