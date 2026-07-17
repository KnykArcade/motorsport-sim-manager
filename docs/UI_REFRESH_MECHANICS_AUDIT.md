# UI Refresh Mechanics Audit

This document travels with the FM-style management UI refresh. Every migrated
screen should update the tables below so existing mechanics do not disappear
behind a visual redesign and new controls do not imply behavior they lack.

## Foundation findings

| Finding | Status | Resolution |
| --- | --- | --- |
| Short windows could hide sidebar destinations because the navigation container used `overflow-hidden`. | Fixed | The persistent grouped navigation now has its own vertical scroll region. |
| Team HQ always offered `Open Race Briefing`, even when the career phase was already Race Weekend. The route guard prevented an invalid transition, but the label and destination were misleading. | Fixed | Team HQ and the global Continue control now use the same career-phase destination. |
| A global Continue control could accidentally bypass required decisions if it dispatched a phase-advance action. | Prevented | The shell control only navigates to the current workflow. The workflow screen retains all progression checks and dispatches. |
| The shell could display invented calendar dates or weekly financial deltas that are not stored by the game. | Prevented | The first implementation only displays real team, season, round, budget, next-event, mode, and phase data. |

## Connected foundation controls

| UI element | Connected behavior/source |
| --- | --- |
| Back / Forward | Router/browser history |
| Save | Existing `saveNow` persistence action |
| Settings / Main Menu | Existing application routes |
| Sidebar destinations | Existing routes filtered through the established mode restrictions |
| Continue | `careerPhase.currentPhase`; navigation only |
| Team HQ metrics | Current team budget, morale, reputation, and active development projects |
| Team HQ tabs and actions | Existing screen state, routes, dossiers, development, regulations, news, and standings |

No decorative button or fabricated metric was added in the foundation phase.

## Existing mechanics whose causes or effects remain too hidden

These systems are connected in the simulation, but their current UI does not
fully explain why a value changed or what it influences. They should be made
explicit as their screens are migrated.

| Mechanic | What is currently visible | What the refreshed UI should add |
| --- | --- | --- |
| Team morale | Current score on HQ and Paddock Week | Trend, recent causes, active modifiers, and which personnel or performance outcomes it affects |
| Team reputation | Current score on HQ and team views | Recent change history and its effects on sponsor income, operating expectations, hiring, and market interest |
| Organization ratings | Ratings on the Organization tab | “Affects” links for driver bids, academy capacity, development success, and related systems |
| Race preparation focus | Detailed in Pre-Race Briefing | A compact active-effect summary on HQ/Race Desk so the chosen pace, qualifying, reliability, mistake-risk, or budget tradeoff is not forgotten |
| Character ambitions, influence, disputes, initiatives, mandates, breaking points, commitments, and future intentions | Available primarily in Paddock Week and character dossiers | Shell-level attention counts and direct links to unresolved people matters, without duplicating the decision controls |
| Scouting fog and network accuracy | Visible inside Scouting and Market | Consistent knowledge/confidence language anywhere a driver rating or potential is shown |
| AI technical activity | Reflected through projects and paddock/news reporting | Clear confirmed-versus-rumor treatment and links from news to the affected team/project where data exists |

## Rules for the remaining refresh

1. A displayed number must come from current game state or a named view model.
2. A control must navigate, mutate state, or be visibly disabled with a reason.
3. Navigation controls must never dispatch progression actions.
4. Hidden tabs may not hide required decisions without an attention badge.
5. Any rating affected by another system should expose an `Affects` or `Why` explanation.
6. Mode-restricted systems remain filtered through the central restriction helpers.
7. Live Race remains outside this UI refresh until separately approved.
