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
| Organization Profile universe metrics | Current team count, player championship position, championship leader, financial-health states, and calculated field rating |
| Organization Profile filters and sorting | Existing deterministic team-overview rows; no roster or simulation mutation |
| Organization Profile dossiers | Existing principal, owner, and driver dossier subjects |
| Organization Profile management tabs | Existing lineup, academy, technical program, engine deal, finance, identity memory, ratings, and offseason-move data |
| Finance workspace | Existing season ledger, category summaries, annual commitments, season filter, transaction filters, and pagination |
| Facilities workspace | Existing infrastructure effects, upgrade dispatches, affordability checks, pending construction, portfolio groups, and specialization dispatches |
| Staff workspace | Existing roster, contracts, advisor council, real staff pool, rival poaching, dossiers, hiring, firing, renewal, role filters, and pagination |

No decorative button or fabricated metric was added in the foundation phase.

## Existing mechanics whose causes or effects remain too hidden

These systems are connected in the simulation, but their current UI does not
fully explain why a value changed or what it influences. They should be made
explicit as their screens are migrated.

| Mechanic | What is currently visible | What the refreshed UI should add |
| --- | --- | --- |
| Team morale | Current score on HQ and Paddock Week | Trend, recent causes, active modifiers, and which personnel or performance outcomes it affects |
| Team reputation | Current score on HQ and team views | Recent change history and its effects on sponsor income, operating expectations, hiring, and market interest |
| Organization ratings | Ratings on the Organization tab and Team Universe profiles | Team profiles now explain the overall-rating weights and the effects of performance, personnel, operations, and finance. Driver bids and academy-capacity explanations still belong on their action screens. |
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

## Team Command Center findings

| Finding | Status | Resolution |
| --- | --- | --- |
| Rival sponsor income is derived by the overview simulation but previously looked like a disclosed exact contract value. | Fixed | Rival values are now labeled `Estimated sponsor income`; the Finance tab explains the distinction. |
| Team ratings were visible without revealing how the overall organization score was built. | Fixed | The Performance tab states the exact category weights and the lead-driver/second-driver split used by the engine. |
| Team operational ratings did not explain their downstream purpose. | Fixed | Performance, Personnel, Operations, and Finance tabs now include concise `Affects` explanations tied to implemented systems. |
| The large team comparison page required document scrolling and the five-tab dossier mixed unrelated information. | Fixed | The screen now uses the fixed workspace shell with an internally scrolling table and seven focused organization-profile tabs. |
| Team identity memory appeared separately from recent offseason history. | Improved | Identity keeps current posture and philosophy; History consolidates tracked performance memory with recorded offseason moves. |

## Operations Center findings

| Finding | Status | Resolution |
| --- | --- | --- |
| Finance, Facilities, and Staff had working tabs but each used a separate header, metric-card, and tab treatment. | Fixed | All three now use the shared compact workspace header, metric strip, tabs, and internally scrolling content body. |
| Six separate Staff metric cards consumed too much vertical space. | Fixed | The same real values are consolidated into four management metrics: staffing, payroll, development/setup, and race execution. |
| A visual migration could accidentally turn active management controls into decorative UI. | Prevented | Every existing facility upgrade/specialization and staff hire/fire/renewal/poaching control is preserved and still dispatches its original game action. |
| Finance coverage could be mistaken for a full forecast. | Preserved | The commitments workspace retains its explicit warning that coverage excludes variable engine, development, repair, facility, and future-income effects. |
