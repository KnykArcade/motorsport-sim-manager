import { useState } from 'react';
import { useGame } from '../game/GameContext';
import { Button } from '../components/Button';
import {
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceScreen,
  WorkspaceTabs,
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
import type { StaffResponsibilityId, StaffRole } from '../types/staffTypes';
import type { GameState } from '../game/careerState';
import type { GameAction } from '../game/gameReducer';
import {
  selectedStaffDepartment,
  staffDepartmentRows,
} from './staffDepartmentViewModel';
import {
  STAFF_RESPONSIBILITY_POLICY_OPTIONS,
  staffResponsibilities,
  type StaffResponsibility,
} from './staffResponsibilitiesViewModel';

export function Staff() {
  const { state, dispatch } = useGame();
  const [view, setView] = useState<'responsibilities' | 'departments'>('responsibilities');
  if (!state) return null;

  return (
    <WorkspaceScreen className="ui-recruitment-screen ui-staff-departments-screen">
      <WorkspaceHeader
        eyebrow="People · Staff"
        title={view === 'responsibilities' ? 'Staff Responsibilities' : 'Team Departments'}
        subtitle={view === 'responsibilities'
          ? 'Choose who handles each part of team management. Protected decisions always remain under your control.'
          : 'Improve the permanent Technical Director, Race Engineer, Pit Crew Chief, and Strategist departments with Principal Points.'}
        actions={
          view === 'departments'
            ? <span className="ui-recruitment-header-status">{state.principal?.skillPoints ?? 0} Principal Points available</span>
            : <span className="ui-recruitment-header-status">7 responsibility areas</span>
        }
      />
      <WorkspaceTabs
        items={[
          { id: 'responsibilities', label: 'Responsibilities' },
          { id: 'departments', label: 'Department Ability' },
        ]}
        active={view}
        onChange={setView}
        ariaLabel="Staff management views"
      />
      <WorkspaceBody className="overflow-hidden">
        {view === 'responsibilities'
          ? <StaffResponsibilities state={state} dispatch={dispatch} />
          : <StaffDepartments state={state} dispatch={dispatch} />}
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}

function StaffResponsibilities({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: (action: GameAction) => void;
}) {
  const responsibilities = staffResponsibilities(state);
  const [selectedId, setSelectedId] = useState<StaffResponsibilityId>('technical');
  const selected = responsibilities.find((item) => item.id === selectedId) ?? responsibilities[0];

  const setPolicy = (responsibility: StaffResponsibility, policy: StaffResponsibility['policy']) => {
    dispatch({ type: 'SET_STAFF_RESPONSIBILITY_POLICY', responsibility: responsibility.id, policy });
  };

  return (
    <>
      <FmWorkspaceGrid columns="three" className="ui-staff-responsibilities-grid">
        <FmPane>
          <FmPaneHeader title="Responsibility Areas" meta={`${responsibilities.length} policies`} />
          <FmPaneBody className="overflow-auto">
            {responsibilities.map((responsibility) => (
              <FmListButton
                key={responsibility.id}
                active={selected.id === responsibility.id}
                onClick={() => setSelectedId(responsibility.id)}
              >
                <span>{responsibility.policyLabel}</span>
                <strong>{responsibility.area}</strong>
                <span>{responsibility.owner}</span>
                <small>{responsibility.confidenceLabel} confidence · {responsibility.confidence}%</small>
              </FmListButton>
            ))}
          </FmPaneBody>
        </FmPane>

        <FmPane className="ui-staff-responsibility-policy">
          <FmPaneHeader title={selected.area} meta={selected.policyLabel} />
          <FmPaneBody className="overflow-auto">
            <section className="ui-staff-responsibility-owner">
              <span>Assigned lead</span>
              <strong>{selected.owner}</strong>
              <p>{selected.role} · {selected.status}</p>
              <div role="progressbar" aria-label={`${selected.area} expected confidence`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={selected.confidence}>
                <i style={{ width: `${selected.confidence}%` }} />
              </div>
              <small>{selected.confidenceLabel} expected confidence · {selected.confidence}%</small>
            </section>

            <section className="ui-staff-policy-options" aria-label={`${selected.area} policy`}>
              <h3>Responsibility policy</h3>
              {STAFF_RESPONSIBILITY_POLICY_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={selected.policy === option.id ? 'is-active' : ''}
                  aria-pressed={selected.policy === option.id}
                  onClick={() => setPolicy(selected, option.id)}
                >
                  <strong>{option.label}</strong>
                  <span>{option.detail}</span>
                </button>
              ))}
            </section>
          </FmPaneBody>
        </FmPane>

        <FmPane className="ui-staff-responsibility-boundaries">
          <FmPaneHeader title="Authority Boundaries" meta={selected.confidenceLabel} />
          <FmPaneBody className="overflow-auto">
            <section>
              <h3>What staff can do</h3>
              <ul>
                {selected.staffCanDo.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
            <section>
              <h3>Always requires you</h3>
              <ul>
                {selected.approvalBoundary.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
            <section className={selected.confidenceLabel === 'Low' ? 'is-warning' : ''}>
              <h3>Current operating effect</h3>
              <p>{selected.policyDetail}</p>
              <p>{selected.confidenceReason}</p>
            </section>
          </FmPaneBody>
        </FmPane>
      </FmWorkspaceGrid>
      <FmDecisionBar
        actions={selected.policy !== 'player' && (
          <Button onClick={() => setPolicy(selected, 'player')}>Take Control</Button>
        )}
      >
        <strong>{selected.area} · {selected.policyLabel}</strong>
        <span>{selected.effect} Policy changes are saved immediately.</span>
      </FmDecisionBar>
    </>
  );
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
    <>
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
    </>
  );
}
