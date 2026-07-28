import { useNavigate } from 'react-router';
import { useGame } from '../game/GameContext';
import { Button } from '../components/Button';
import { WorkspaceBody, WorkspaceHeader, WorkspaceScreen } from '../components/workspace/Workspace';
import {
  FmDecisionBar,
  FmKeyValue,
  FmPane,
  FmPaneBody,
  FmPaneHeader,
  FmWorkspaceGrid,
} from '../components/workspace/FmPane';

export function StaffContractNegotiation() {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  if (!state) return null;

  const returnToDepartments = () => {
    if (state.staffContractNegotiation) dispatch({ type: 'CANCEL_STAFF_CONTRACT_NEGOTIATION' });
    navigate('/staff');
  };

  return (
    <WorkspaceScreen className="ui-recruitment-screen ui-staff-contract-compatibility">
      <WorkspaceHeader
        eyebrow="People · Departments"
        title="Departments are permanent"
        subtitle="Technical, engineering, pit operations, and strategy are improved with Principal Points rather than personnel transactions."
        actions={<Button variant="ghost" onClick={returnToDepartments}>Back to Departments</Button>}
      />
      <WorkspaceBody className="overflow-hidden">
        <FmWorkspaceGrid columns="three">
          <FmPane>
            <FmPaneHeader title="Previous workflow" meta="Compatibility route" />
            <FmPaneBody className="ui-staff-compatibility-copy">
              <strong>Individual personnel contract</strong>
              <p>This route remains available so older saves and links resolve safely, but it no longer exposes a transaction.</p>
            </FmPaneBody>
          </FmPane>
          <FmPane>
            <FmPaneHeader title="Current management model" meta="Permanent departments" />
            <FmPaneBody className="ui-staff-compatibility-copy">
              <strong>Department development</strong>
              <p>Technical Director, Race Engineer, Pit Crew Chief, and Strategist remain attached to the team and continue feeding their existing simulation bonuses.</p>
              <FmKeyValue label="Improvement currency" value="Principal Points" />
              <FmKeyValue label="Upgrade effect" value="+1 department rating" />
              <FmKeyValue label="Hiring transaction" value="Not applicable" />
            </FmPaneBody>
          </FmPane>
          <FmPane>
            <FmPaneHeader title="Next action" meta="Return safely" />
            <FmPaneBody className="ui-staff-compatibility-copy">
              <strong>Open Team Departments</strong>
              <p>Review each department’s current level, performance effect, and upgrade availability in the active management workspace.</p>
            </FmPaneBody>
          </FmPane>
        </FmWorkspaceGrid>
        <FmDecisionBar actions={<Button variant="primary" onClick={returnToDepartments}>Open Team Departments</Button>}>
          <strong>No contract decision is required</strong>
          <span>Any stored legacy negotiation is cancelled when you return to the department workspace.</span>
        </FmDecisionBar>
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}
