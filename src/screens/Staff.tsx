import { useState } from 'react';
import { useGame } from '../game/GameContext';
import { Button } from '../components/Button';
import {
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceScreen,
} from '../components/workspace/Workspace';
import {
  FmDecisionBar,
  FmKeyValue,
  FmListButton,
  FmPane,
  FmPaneBody,
  FmPaneHeader,
  FmWorkspaceGrid,
} from '../components/workspace/FmPane';
import type { StaffRole } from '../types/staffTypes';
import type { GameState } from '../game/careerState';
import type { GameAction } from '../game/gameReducer';
import {
  selectedStaffDepartment,
  staffDepartmentRows,
} from './staffDepartmentViewModel';

export function Staff() {
  const { state, dispatch } = useGame();
  if (!state) return null;

  return <StaffDepartments state={state} dispatch={dispatch} />;
}

function StaffDepartments({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: (action: GameAction) => void;
}) {
  const [selectedRole, setSelectedRole] = useState<StaffRole>();
  const principalPoints = state.principal?.skillPoints ?? 0;
  const departments = staffDepartmentRows(state.staff, principalPoints);
  const selected = selectedStaffDepartment(departments, selectedRole);

  return (
    <WorkspaceScreen className="ui-recruitment-screen ui-staff-departments-screen">
      <WorkspaceHeader
        eyebrow="People · Departments"
        title="Team Departments"
        subtitle="Your Technical Director, Race Engineer, Pit Crew Chief, and Strategist are permanent departments. Improve their ratings with Principal Points."
        actions={
          <span className="ui-recruitment-header-status">
            {principalPoints} Principal Points available
          </span>
        }
      />
      <WorkspaceBody className="overflow-hidden">
        <FmWorkspaceGrid columns="three" className="ui-staff-departments-grid">
          <FmPane>
            <FmPaneHeader title="Departments" meta={`${departments.length} permanent units`} />
            <FmPaneBody className="overflow-auto">
              {departments.map((department) => (
                <FmListButton
                  key={department.role}
                  active={selected?.role === department.role}
                  onClick={() => setSelectedRole(department.role)}
                >
                  <span>Level {department.level}</span>
                  <strong>{department.role}</strong>
                  <span>{department.rating}/100 rating</span>
                  <small>{department.rating >= 100 ? 'Maximum rating' : `${100 - department.rating} points to maximum`}</small>
                </FmListButton>
              ))}
            </FmPaneBody>
          </FmPane>

          <FmPane className="ui-staff-department-profile">
            <FmPaneHeader title={selected?.role ?? 'Department'} meta={selected ? `Level ${selected.level}` : undefined} />
            <FmPaneBody className="overflow-auto">
              {selected && (
                <div className="ui-staff-profile-body">
                  <section className="ui-staff-rating-block">
                    <span>Department performance</span>
                    <strong>{selected.rating}</strong>
                    <div role="progressbar" aria-label={`${selected.role} rating`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={selected.rating}>
                      <i style={{ width: `${selected.rating}%` }} />
                    </div>
                  </section>
                  <section>
                    <h3>Simulation effect</h3>
                    <p>{selected.effect}</p>
                  </section>
                  <section>
                    <h3>Improvement recommendation</h3>
                    <p>
                      {selected.rating >= 100
                        ? 'This department is already operating at the maximum modeled level.'
                        : selected.rating >= 80
                          ? 'A strong department. Invest when this specialty is central to the team plan.'
                          : selected.rating >= 60
                            ? 'A dependable department with room for meaningful performance gains.'
                            : 'A priority development area that can materially limit team execution.'}
                    </p>
                  </section>
                </div>
              )}
            </FmPaneBody>
          </FmPane>

          <FmPane className="ui-staff-upgrade-context">
            <FmPaneHeader title="Principal Development" meta={`${principalPoints} points available`} />
            <FmPaneBody className="overflow-auto">
              <section>
                <h3>Permanent department model</h3>
                <p>Staff records and their existing simulation bonuses remain intact. Personnel hiring and contract transactions are not part of this management model.</p>
              </section>
              {selected && (
                <section>
                  <FmKeyValue label="Selected department" value={selected.role} />
                  <FmKeyValue label="Current level" value={`${selected.level} · ${selected.rating}/100`} />
                  <FmKeyValue label="Upgrade cost" value="1 Principal Point" />
                  <FmKeyValue label="Result" value="+1 rating level" />
                </section>
              )}
            </FmPaneBody>
          </FmPane>
        </FmWorkspaceGrid>
        <FmDecisionBar
          actions={selected && (
            <Button
              variant="primary"
              disabled={!selected.canImprove}
              title={selected.disabledReason}
              onClick={() => dispatch({ type: 'UPGRADE_STAFF_DEPARTMENT', role: selected.role })}
            >
              {selected.rating >= 100 ? 'Department maxed' : 'Spend 1 Principal Point'}
            </Button>
          )}
        >
          <strong>{selected?.role ?? 'Select a department'}</strong>
          <span>{selected?.disabledReason ?? 'Upgrade the selected department by one rating level.'}</span>
        </FmDecisionBar>
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}
