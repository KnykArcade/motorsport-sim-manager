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
| Drivers workspace | Existing race seats, reserves, swaps, extensions, clauses, future intentions, scouting readouts, dossiers, directory, and pagination |
| Driver Market workspace | Existing shared-universe market, series interest, availability rules, bidding, third-driver and race-seat signings, pending signings, academy actions, scouting fog, and pagination |
| Intelligence workspace | Existing scouting network accuracy, fogged driver and potential ranges, scout assignments, investigation actions, paddock reports, confidence, and report history |
| Calendar workspace | Existing season calendar, current round, regulation era, circuit demands, completed winners, schedule/results tabs, and pagination |
| Standings workspace | Existing driver and constructor standings, player-team highlighting, leader points, team colors, and pagination |
| Race History workspace | Existing race archive selection, classification, qualifying, lap pace, event stories, filters, fastest laps, and pagination |

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

## Recruitment Center findings

| Finding | Status | Resolution |
| --- | --- | --- |
| Drivers, Driver Market, and Scouting behaved as connected systems but presented separate page structures. | Fixed | All three now share an FM-style Recruitment Center hierarchy with persistent context, compact metrics, primary tabs, and internally scrolling work areas. |
| Roster and market priorities were easy to lose while browsing long card lists. | Fixed | Race-seat status, reserve count, expiring contracts, budget, academy capacity, and scouting accuracy remain visible above the active workspace. |
| A UI refresh could accidentally imply that fogged ratings are exact. | Prevented | Recruitment metrics explicitly identify scouting accuracy as the control on uncertainty, and the existing knowledge-aware rating readouts remain unchanged. |
| The single shared driver universe could look like separate series-specific markets. | Clarified | Driver Market now states that it is one shared universe market; series preference still affects interest and AI decisions without creating hidden pools. |
| Market or profile styling could expose actions that bypass availability rules. | Prevented | Existing preseason, offseason, open-seat, third-driver, academy-capacity, affordability, competing-bid, and game-mode checks remain the source of action availability. |

## Competition Center findings

| Finding | Status | Resolution |
| --- | --- | --- |
| Schedule, standings, and race archive information used separate pre-refresh page structures. | Fixed | All three now use the FM-style Competition Center hierarchy with persistent season context, compact metrics, tabs, and internal work areas. |
| Calendar browsing could hide overall season progress and the next event. | Fixed | Total, completed, remaining, completion percentage, and next-race context stay visible above Schedule and Results. |
| Standings browsing required reading the table to recover basic championship context. | Fixed | Leader, lead margin, player-team position/points, and season progress remain visible while switching championships or pages. |
| Race archive tabs repeated winner/pole/fastest-lap context inside scrollable content. | Fixed | Selected-race archive count, winner, pole, and fastest lap now remain in the persistent metric strip. |
| A compact competition UI could replace detailed historical data with summaries. | Prevented | Circuit demand, winners, full classifications, qualifying, lap pace, race stories, filters, player highlighting, and pagination remain connected to their original data. |

## Inbox and News Center findings

| Finding | Status | Resolution |
| --- | --- | --- |
| News reports, connected news storylines, persistent narrative stories, and weekly decisions could look like one duplicated system. | Clarified | News Center remains the searchable report archive, Paddock Stories remains the persistent narrative tracker, and Paddock Week remains the only place that resolves guarded weekly decisions. Direct links connect the layers. |
| The game does not store read/unread state for news reports. | Preserved | The refresh does not invent unread badges. It surfaces real current-report, priority, team-report, archive, and storyline counts instead. |
| Narrative responses appeared available even outside their valid weekly phase. | Clarified | Paddock Stories now keeps response timing in persistent context and only offers the response route during Paddock Week. |
| Long report and story lists required document-level scrolling. | Fixed | News Center, Paddock Stories, and Paddock Week now use fixed workspace framing with internally scrolling work areas. |
| Paddock Week tabs could hide required decisions and the race-package gate. | Preserved | Existing attention counts, required-action notices, disabled advancement reason, decision controls, and package selection remain above or inside the correct work area. |
| A summary view could imply that news changes game state by itself. | Prevented | Report cards and storyline summaries remain informational. Only existing Paddock Week options and related-screen actions mutate or route into connected systems. |

## Development and Technical Center findings

| Finding | Status | Resolution |
| --- | --- | --- |
| Development, engine supply, and regulation politics affect the same technical strategy but used three unrelated page structures. | Fixed | All three now use the shared Technical Center hierarchy with persistent metrics, focused tabs, and internally scrolling work areas while retaining their separate simulation responsibilities. |
| Project outcome chances could look like base probabilities unrelated to the organization. | Clarified | Development keeps the calculated outcome distribution on every catalog project and now keeps the combined staff, facility, and culture success modifier in persistent context. |
| Project actions could hide why they were unavailable. | Preserved | Budget, slot capacity, facility level, duration, risk, effect, carryover, Single Season restrictions, and disabled-action reasons remain connected to the existing project rules. |
| Engine annual cost and an immediate supplier-switch payment could be mistaken for the same charge. | Clarified | Persistent metrics identify annual cost, while supplier offers retain their net cash-due/refund explanation and next-season billing language. |
| A supplier comparison could imply every package was immediately active. | Prevented | Current and pending packages remain distinct; signing still uses the existing affordability, mode, preseason, buyout, and next-season activation rules. |
| Manufacturer confidence and politics influence were visible but their downstream timing was easy to miss. | Clarified | Manufacturer reviews retain support-tier consequences, and Regulations now keeps influence rank, proposal votes, effective season, and season-rollover settlement visible above every tab. |
| Compact technical summaries could become decorative dashboards. | Prevented | Every metric is derived from current game state; project, supplier, and regulation controls continue to dispatch their original actions. |

## Sponsorship and Commercial Center findings

| Finding | Status | Resolution |
| --- | --- | --- |
| Guaranteed contract value, race installments, and performance bonuses could be mistaken for the same income stream. | Clarified | Persistent metrics separate annual guaranteed value from the per-race installment, while the Portfolio and Objectives tabs retain the 25% upfront / 75% installment rule and every conditional bonus term. |
| Commercial reputation and sponsor confidence appeared as separate ratings without enough context. | Clarified | Commercial reputation remains identified as the driver of offer quality; average confidence stays visible as the relationship-health measure governing renewal prospects. |
| A compact sponsor list could hide objective failures and owner pressure. | Prevented | Pending objective count remains in the primary tabs, full reward/penalty terms remain visible, and owner expectations and reviews retain their dedicated workspace. |
| Some objectives store a `midseason` deadline even though the current engine evaluates every unresolved sponsor objective at season end. | Exposed gap | The Objectives workspace states the real settlement timing instead of implying an in-season checkpoint exists. A future gameplay phase can implement the missing midseason evaluation. |
| Sponsor actions could bypass portfolio or mode rules. | Preserved | Opportunity signing still uses the existing generated offer IDs and slot-capacity gate, while central mode restrictions continue to keep sponsor management out of locked historical Single Season careers. |
| Dropping a sponsor might imply a modeled termination fee or negotiation process. | Clarified | The current simulation removes the sponsor immediately and does not model a termination fee. The refresh does not invent a charge or negotiation state. |
| Commercial cards could imply rival financial figures are disclosed. | Prevented | This workspace only shows the player team's persisted sponsor contracts; rival sponsor values remain labeled as estimates on the organization screens. |

## People and Relationships Center findings

| Finding | Status | Resolution |
| --- | --- | --- |
| Principal standing, driver relationships, and rival relationships used different page structures despite forming the game's people-management layer. | Fixed | All three now use the shared People Center hierarchy with persistent metrics, focused tabs, and internally scrolling work areas. |
| The optional Due Round field created a promise with no due season, but round expiry required both values. The progress UI showed a deadline that the engine would not enforce. | Fixed | Promise creation now binds a round-only deadline to the season in which the promise was made, with regression coverage for expiry. |
| Clause compensation remained clickable without enough budget even though the reducer silently rejected it. | Fixed | Compensation is now visibly disabled with an insufficient-budget reason whenever the recorded renegotiation cost cannot be paid. |
| Job offers could look like immediate team switches. | Preserved | Offer controls retain explicit next-season wording; accepted approaches remain cancellable before rollover. Rumors remain informational only. |
| Driver trust, confidence, ego, wants, promises, clauses, and team-order effects could be reduced to one relationship score. | Prevented | The driver workspace keeps the distinct implemented dimensions, explanatory text, promise progress, dossier links, and action consequences. |
| Rival action cards could become decorative relationship flavor. | Prevented | Every action continues to use the existing budget cost, finance transaction, relationship deltas, news generation, and protest-success rules. |
| Rival management actions could be repeated against the same team throughout one round; only formal protests had partial duplicate protection. | Fixed | Each action now has an engine-enforced per-rival, per-round cooldown. Different actions remain available in the same round, cooldowns reset next round and season, and the dossier visibly marks used actions. |

## Season Review findings

| Finding | Status | Resolution |
| --- | --- | --- |
| The season-complete screen used a separate page structure and required document-level scrolling on shorter displays. | Fixed | Season Review now uses the shared FM-style workspace with persistent honours and team context, focused tabs, and one internally scrolling work area. |
| Switching between final standings could hide the champions and the player's final result. | Fixed | Driver champion, constructors' champion, player-team position, points, and season size remain visible above every tab. |
| A visual refresh could disconnect the career rollover and Single Season conversion rules. | Prevented | Existing replay, conversion, offseason, and main-menu actions retain their original dispatch and routing behavior, including the Single Season explanation. |

## Offseason findings

| Finding | Status | Resolution |
| --- | --- | --- |
| Line-up, academy, reserve-contract, market-outlook, and advance controls appeared in one long page. | Fixed | Offseason now uses the shared FM-style workspace with five focused tabs, persistent rollover metrics, and one internally scrolling work area. |
| The screen claimed that budget, regulation, staff, car-design, and AI market systems were still planned even though the rollover engine already processes them. | Fixed | The stale future-phase panel is removed. Transition Overview now describes the real people, technical, commercial, and rival-team systems advanced by the existing rollover engine. |
| Unresolved academy rights could look like a hard blocker even though the engine retains undecided drivers for another first-option window. | Clarified | Academy decisions are explicitly labeled optional, unresolved counts remain visible, and only season completion controls the advance gate. |
| Reserve-driver ambition consequences were buried below the academy list. | Improved | At-risk reserve count is persistent, the overview explains the departure risk, and the Line-up tab retains the original promotion controls and points comparison. |
| Academy readiness used F1-specific labels in every championship. | Fixed | Offseason now describes the shared progression as senior-series and race-seat readiness without changing the underlying development calculation. |
| A prominent advance action could bypass the real season-completion rule. | Prevented | Header and Advance-tab actions share the existing completion/loading gate and visibly explain why advancement is unavailable. |
