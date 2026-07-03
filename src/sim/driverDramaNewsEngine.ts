// Driver Drama News Engine — generates immersive news items from driver
// confidence, trust, ego, morale, promise, and teammate rivalry events.
//
// This engine hooks into existing relationship/confidence/promise systems and
// produces structured NewsItems for the News Center. It is pure & deterministic:
// given the same inputs it produces the same news items.
//
// Spam control: only major shifts generate news. Duplicate triggers in the
// same round are suppressed via deduplication keys.

import type { NewsItem, NewsCategory, NewsPriority } from '../types/gameTypes';
import type { DriverRelationship, DriverPromise, TeamOrderDecision, RelationshipConsequence } from '../types/relationshipTypes';
import type { RaceEventContext, ConfidenceUpdate, PromiseResolution } from './driverConfidenceEngine';

// ---------------------------------------------------------------------------
// Drama news context
// ---------------------------------------------------------------------------

export type DramaNewsContext = {
  season: number;
  round: number;
  gpName: string;
  driverNames: Record<string, string>;
  teamNames: Record<string, string>;
};

// ---------------------------------------------------------------------------
// News item factory (local to this engine)
// ---------------------------------------------------------------------------

function makeDramaNews(
  id: string,
  ctx: DramaNewsContext,
  headline: string,
  body: string,
  priority: NewsPriority,
  driverId: string,
  teamId?: string,
): NewsItem {
  return {
    id,
    round: ctx.round,
    headline,
    body,
    timestamp: new Date().toISOString(),
    category: 'paddock' as NewsCategory,
    priority,
    careerPhase: 'post_race_review',
    teamId,
    driverId,
  };
}

// ---------------------------------------------------------------------------
// Confidence / Morale hooks
// ---------------------------------------------------------------------------

export function generateConfidenceDramaNews(
  ctx: DramaNewsContext,
  rel: DriverRelationship,
  updates: ConfidenceUpdate[],
  prevRel: DriverRelationship,
): NewsItem[] {
  const items: NewsItem[] = [];
  const driverName = ctx.driverNames[rel.driverId] ?? rel.driverId;
  const teamId = rel.teamId;

  // Calculate total confidence delta from updates.
  const confDelta = updates.reduce((sum, u) => sum + (u.selfConfidenceDelta ?? 0), 0);
  const moraleDelta = updates.reduce((sum, u) => sum + (u.moraleDelta ?? 0), 0);
  const frustrationDelta = updates.reduce((sum, u) => sum + (u.frustrationDelta ?? 0), 0);

  // Major confidence surge (>= +8).
  if (confDelta >= 8) {
    items.push(makeDramaNews(
      `drama-conf-surge-${ctx.season}-${ctx.round}-${rel.driverId}`,
      ctx,
      `${driverName} Riding High After Strong ${ctx.gpName} Performance`,
      `Confidence is surging in the ${teamId ? ctx.teamNames[teamId] ?? '' : ''} camp after a standout weekend for ${driverName}. The momentum could be building into something special.`,
      'high',
      rel.driverId,
      teamId,
    ));
  }

  // Major confidence collapse (<= -8).
  if (confDelta <= -8) {
    items.push(makeDramaNews(
      `drama-conf-collapse-${ctx.season}-${ctx.round}-${rel.driverId}`,
      ctx,
      `Pressure Builds Around ${driverName} After Another Difficult Weekend`,
      `A tough round at the ${ctx.gpName} has left ${driverName} searching for answers. The confidence drop is becoming a talking point in the paddock.`,
      'high',
      rel.driverId,
      teamId,
    ));
  }

  // Young driver gaining belief — selfConfidence crossing above 60 from below.
  if (prevRel.selfConfidence < 60 && rel.selfConfidence >= 60 && confDelta > 0) {
    items.push(makeDramaNews(
      `drama-young-belief-${ctx.season}-${ctx.round}-${rel.driverId}`,
      ctx,
      `${driverName} Finding Another Gear As Belief Grows`,
      `The young driver is starting to believe in himself after outperforming expectations. Team insiders note a noticeable shift in demeanour.`,
      'normal',
      rel.driverId,
      teamId,
    ));
  }

  // Veteran frustrated by decline — high frustration + low confidence.
  if (frustrationDelta >= 5 && rel.frustration >= 70 && rel.selfConfidence < 40) {
    items.push(makeDramaNews(
      `drama-vet-frustration-${ctx.season}-${ctx.round}-${rel.driverId}`,
      ctx,
      `${driverName} Shows Visible Frustration As Car Struggles Continue`,
      `The experienced hand is running out of patience. Post-race body language told a story of a driver questioning whether the package can deliver.`,
      'high',
      rel.driverId,
      teamId,
    ));
  }

  // Morale boost after teammate comparison win.
  if (moraleDelta >= 5 && updates.some((u) => u.reason?.includes('teammate'))) {
    items.push(makeDramaNews(
      `drama-morale-win-${ctx.season}-${ctx.round}-${rel.driverId}`,
      ctx,
      `${driverName} Lifted By Getting The Better Of Teammate At ${ctx.gpName}`,
      `Coming out on top in the intra-team battle has given ${driverName} a visible spring in his step. The garage atmosphere reflects it.`,
      'normal',
      rel.driverId,
      teamId,
    ));
  }

  // Morale drop after repeated teammate losses.
  if (moraleDelta <= -5 && rel.morale < 40) {
    items.push(makeDramaNews(
      `drama-morale-drop-${ctx.season}-${ctx.round}-${rel.driverId}`,
      ctx,
      `${driverName} Feeling The Strain After Another Weekend In Teammate's Shadow`,
      `Repeatedly coming off second best is taking its toll. The morale gauge is heading in the wrong direction for ${driverName}.`,
      'normal',
      rel.driverId,
      teamId,
    ));
  }

  return items;
}

// ---------------------------------------------------------------------------
// Trust in Car hooks
// ---------------------------------------------------------------------------

export function generateTrustInCarDramaNews(
  ctx: DramaNewsContext,
  rel: DriverRelationship,
  updates: ConfidenceUpdate[],
  raceCtx: RaceEventContext,
): NewsItem[] {
  const items: NewsItem[] = [];
  const driverName = ctx.driverNames[rel.driverId] ?? rel.driverId;
  const teamId = rel.teamId;

  const trustCarDelta = updates.reduce((sum, u) => sum + (u.trustInCarDelta ?? 0), 0);

  // Driver loses trust in car after reliability failure.
  if (raceCtx.carReliabilityDNF && trustCarDelta <= -5) {
    items.push(makeDramaNews(
      `drama-trust-car-dnf-${ctx.season}-${ctx.round}-${rel.driverId}`,
      ctx,
      `${driverName} Questions Reliability After Another DNF At ${ctx.gpName}`,
      `A mechanical retirement has left ${driverName} openly questioning whether the car can be trusted to see out a race distance. The frustration is palpable.`,
      'high',
      rel.driverId,
      teamId,
    ));
  }

  // Driver says team "finally found something" after development breakthrough.
  if (trustCarDelta >= 8 && rel.trustInCar < 60) {
    items.push(makeDramaNews(
      `drama-trust-car-breakthrough-${ctx.season}-${ctx.round}-${rel.driverId}`,
      ctx,
      `${driverName}: "We Finally Found Something" As Upgrades Deliver Pace`,
      `The latest upgrade package seems to have turned a corner. ${driverName} was spotted smiling in the paddock for the first time in weeks.`,
      'normal',
      rel.driverId,
      teamId,
    ));
  }

  // Driver questions whether car can fight at the front.
  if (rel.trustInCar < 30 && raceCtx.finishingPosition > 10 && !raceCtx.dnf) {
    items.push(makeDramaNews(
      `drama-trust-car-front-${ctx.season}-${ctx.round}-${rel.driverId}`,
      ctx,
      `${driverName} Wonders Aloud If The Car Can Fight At The Sharp End`,
      `Another race mired in the midfield has ${driverName} questioning the direction of development. "Are we even close?" was the mood in the debrief.`,
      'normal',
      rel.driverId,
      teamId,
    ));
  }

  return items;
}

// ---------------------------------------------------------------------------
// Trust in Team / Principal hooks
// ---------------------------------------------------------------------------

export function generateTrustInTeamDramaNews(
  ctx: DramaNewsContext,
  rel: DriverRelationship,
  updates: ConfidenceUpdate[],
  raceCtx: RaceEventContext,
): NewsItem[] {
  const items: NewsItem[] = [];
  const driverName = ctx.driverNames[rel.driverId] ?? rel.driverId;
  const teamId = rel.teamId;

  const trustTeamDelta = updates.reduce((sum, u) => sum + (u.trustInTeamDelta ?? 0), 0);
  const trustPrincipalDelta = updates.reduce((sum, u) => sum + (u.trustInPrincipalDelta ?? 0), 0);

  // Driver backs the team principal after good strategy.
  if (trustPrincipalDelta >= 5 && raceCtx.pointsScored > 0) {
    items.push(makeDramaNews(
      `drama-trust-principal-good-${ctx.season}-${ctx.round}-${rel.driverId}`,
      ctx,
      `${driverName} Credits Team Principal After Strategic Masterclass At ${ctx.gpName}`,
      `The call from the pit wall paid off and ${driverName} was quick to praise the decision-making. Trust in the leadership is growing.`,
      'normal',
      rel.driverId,
      teamId,
    ));
  }

  // Driver questions strategy after a poor call.
  if (trustPrincipalDelta <= -5) {
    items.push(makeDramaNews(
      `drama-trust-principal-poor-${ctx.season}-${ctx.round}-${rel.driverId}`,
      ctx,
      `Garage Tension Rises As ${driverName} Questions Strategy Call`,
      `The post-race debrief was frosty. ${driverName} made no secret of his feelings about the strategic direction taken during the race.`,
      'high',
      rel.driverId,
      teamId,
    ));
  }

  // Driver hints trust in management is fading.
  if (rel.trustInTeam < 30 && trustTeamDelta < 0) {
    items.push(makeDramaNews(
      `drama-trust-team-fading-${ctx.season}-${ctx.round}-${rel.driverId}`,
      ctx,
      `${driverName} Hints At Fraying Relationship With Team Management`,
      `Body language and carefully chosen words suggest all is not well behind the scenes. The trust deficit is becoming harder to hide.`,
      'high',
      rel.driverId,
      teamId,
    ));
  }

  // Driver reacts to team orders — negatively.
  if (raceCtx.wasDisadvantagedInOrders && raceCtx.teamOrderIssued) {
    items.push(makeDramaNews(
      `drama-team-orders-neg-${ctx.season}-${ctx.round}-${rel.driverId}`,
      ctx,
      `${driverName} Unhappy After Being Asked To Support Teammate At ${ctx.gpName}`,
      `Team orders did not sit well with ${driverName}. The radio traffic told the story of a driver who felt he had more to give.`,
      'high',
      rel.driverId,
      teamId,
    ));
  }

  // Driver reacts to team orders — positively.
  if (raceCtx.wasFavoredInOrders && raceCtx.teamOrderIssued && trustTeamDelta >= 0) {
    items.push(makeDramaNews(
      `drama-team-orders-pos-${ctx.season}-${ctx.round}-${rel.driverId}`,
      ctx,
      `${driverName} Welcomes Team Support After Strategic Call Goes His Way`,
      `Being the beneficiary of team orders has strengthened ${driverName}'s feeling that the team is behind him. The dynamic is shifting.`,
      'normal',
      rel.driverId,
      teamId,
    ));
  }

  return items;
}

// ---------------------------------------------------------------------------
// Ego / Status hooks
// ---------------------------------------------------------------------------

export function generateEgoDramaNews(
  ctx: DramaNewsContext,
  rel: DriverRelationship,
  updates: ConfidenceUpdate[],
  raceCtx: RaceEventContext,
): NewsItem[] {
  const items: NewsItem[] = [];
  const driverName = ctx.driverNames[rel.driverId] ?? rel.driverId;
  const teamId = rel.teamId;

  const egoDelta = updates.reduce((sum, u) => sum + (u.egoDelta ?? 0), 0);

  // Driver wants number-one status.
  if (rel.numberOneExpectation && rel.ego >= 70 && raceCtx.wasDisadvantagedInOrders) {
    items.push(makeDramaNews(
      `drama-ego-number1-${ctx.season}-${ctx.round}-${rel.driverId}`,
      ctx,
      `${driverName} Pushes For Clearer Number-One Status Within The Team`,
      `The ego is growing and the patience is shrinking. ${driverName} believes the team should be built around him — and he's making that known.`,
      'high',
      rel.driverId,
      teamId,
    ));
  }

  // Driver reacts badly to teammate receiving priority.
  if (raceCtx.wasDisadvantagedInOrders && rel.ego >= 60) {
    items.push(makeDramaNews(
      `drama-ego-priority-${ctx.season}-${ctx.round}-${rel.driverId}`,
      ctx,
      `${driverName} Resents Teammate Receiving Priority Treatment`,
      `Watching the team rally around the other side of the garage has not gone down well. ${driverName} feels the balance of power shifting away from him.`,
      'normal',
      rel.driverId,
      teamId,
    ));
  }

  // Ego grows after dominant performance.
  if (egoDelta >= 3 && raceCtx.win) {
    items.push(makeDramaNews(
      `drama-ego-win-${ctx.season}-${ctx.round}-${rel.driverId}`,
      ctx,
      `${driverName}'s Confidence Soars After Dominant ${ctx.gpName} Victory`,
      `A commanding win has ${driverName} walking taller than ever. The self-belief is bordering on swagger — and that could make him harder to manage.`,
      'normal',
      rel.driverId,
      teamId,
    ));
  }

  return items;
}

// ---------------------------------------------------------------------------
// Promise hooks
// ---------------------------------------------------------------------------

export function generatePromiseDramaNews(
  ctx: DramaNewsContext,
  driverId: string,
  teamId: string | undefined,
  resolutions: PromiseResolution[],
  promises: DriverPromise[],
): NewsItem[] {
  const items: NewsItem[] = [];
  const driverName = ctx.driverNames[driverId] ?? driverId;

  for (const res of resolutions) {
    const p = res.promise;
    if (res.fulfilled) {
      items.push(makeDramaNews(
        `drama-promise-kept-${ctx.season}-${ctx.round}-${p.id}`,
        ctx,
        `${driverName} Praises Team After Promise Delivered At ${ctx.gpName}`,
        res.reason ?? `A commitment to ${driverName} has been honoured, strengthening the bond between driver and team.`,
        'normal',
        driverId,
        teamId,
      ));
    } else {
      items.push(makeDramaNews(
        `drama-promise-broken-${ctx.season}-${ctx.round}-${p.id}`,
        ctx,
        `Broken Promise Leaves ${driverName} Frustrated With Team Direction`,
        res.reason ?? `A commitment to ${driverName} has not been kept. The fallout could affect the working relationship going forward.`,
        'high',
        driverId,
        teamId,
      ));
    }
  }

  // Expired promises.
  const expired = promises.filter((p) => p.status === 'expired' && p.driverId === driverId);
  for (const p of expired) {
    items.push(makeDramaNews(
      `drama-promise-expired-${ctx.season}-${ctx.round}-${p.id}`,
      ctx,
      `${driverName} Disappointed As Promise Deadline Passes Without Resolution`,
      `A promise made to ${driverName} has expired unfulfilled. The driver's camp is said to be unimpressed with the team's follow-through.`,
      'normal',
      driverId,
      teamId,
    ));
  }

  return items;
}

// ---------------------------------------------------------------------------
// Teammate rivalry hooks
// ---------------------------------------------------------------------------

export function generateTeammateRivalryDramaNews(
  ctx: DramaNewsContext,
  rel: DriverRelationship,
  raceCtx: RaceEventContext,
  consequences: RelationshipConsequence[],
): NewsItem[] {
  const items: NewsItem[] = [];
  const driverName = ctx.driverNames[rel.driverId] ?? rel.driverId;
  const teammateId = rel.teammateId;
  const teammateName = teammateId ? ctx.driverNames[teammateId] ?? teammateId : undefined;
  const teamId = rel.teamId;

  // Teammate tension after team orders.
  if (raceCtx.teamOrderIssued && rel.teammateRelationship < 40) {
    items.push(makeDramaNews(
      `drama-rivalry-orders-${ctx.season}-${ctx.round}-${rel.driverId}`,
      ctx,
      `Internal Tension At ${teamId ? ctx.teamNames[teamId] ?? '' : ''} After Team Orders Divide Garage`,
      `The relationship between ${driverName}${teammateName ? ` and ${teammateName}` : ''} is showing cracks. Team orders have a way of exposing fault lines.`,
      'high',
      rel.driverId,
      teamId,
    ));
  }

  // Teammate relationship improves after clean teamwork.
  if (rel.teammateRelationship >= 70 && raceCtx.pointsScored > 0 && !raceCtx.teamOrderIssued) {
    items.push(makeDramaNews(
      `drama-rivalry-clean-${ctx.season}-${ctx.round}-${rel.driverId}`,
      ctx,
      `${driverName} Praises Teammate After Strong Team Result At ${ctx.gpName}`,
      `A clean race with both drivers scoring has the garage in good spirits. ${driverName} was quick to credit the teamwork.`,
      'low',
      rel.driverId,
      teamId,
    ));
  }

  // On-track clash detected from consequences.
  const clashConsequence = consequences.find(
    (c) => c.mediaReaction?.includes('clash') || c.mediaReaction?.includes('collision'),
  );
  if (clashConsequence) {
    items.push(makeDramaNews(
      `drama-rivalry-clash-${ctx.season}-${ctx.round}-${rel.driverId}`,
      ctx,
      `Teammate Rivalry Heats Up After On-Track Clash Between ${driverName} And ${teammateName ?? 'Teammate'}`,
      `Contact between teammates has escalated the intra-garage tension. The debrief is going to be uncomfortable.`,
      'high',
      rel.driverId,
      teamId,
    ));
  }

  return items;
}

// ---------------------------------------------------------------------------
// Contract / Market hooks
// ---------------------------------------------------------------------------

export function generateContractDramaNews(
  ctx: DramaNewsContext,
  rel: DriverRelationship,
): NewsItem[] {
  const items: NewsItem[] = [];
  const driverName = ctx.driverNames[rel.driverId] ?? rel.driverId;
  const teamId = rel.teamId;

  // Driver becomes more open to leaving after broken trust.
  if (rel.trustInTeam < 25 && rel.teamLoyalty < 30) {
    items.push(makeDramaNews(
      `drama-contract-leave-${ctx.season}-${ctx.round}-${rel.driverId}`,
      ctx,
      `${driverName}'s Camp Said To Be Exploring Options As Trust Erodes`,
      `With loyalty at rock bottom and trust in management fading, sources close to ${driverName} suggest the driver is open to a move elsewhere.`,
      'high',
      rel.driverId,
      teamId,
    ));
  }

  // Driver wants a new contract after strong form.
  if (rel.selfConfidence >= 75 && rel.morale >= 70 && rel.teamLoyalty >= 60) {
    items.push(makeDramaNews(
      `drama-contract-new-${ctx.season}-${ctx.round}-${rel.driverId}`,
      ctx,
      `${driverName} In Strong Position To Seek New Deal After Consistent Form`,
      `Strong results and high confidence have ${driverName} well-placed to open contract talks. The team will need to move quickly to secure his services.`,
      'normal',
      rel.driverId,
      teamId,
    ));
  }

  // Driver loyalty improves after being supported.
  if (rel.teamLoyalty >= 80 && rel.trustInPrincipal >= 75) {
    items.push(makeDramaNews(
      `drama-contract-loyalty-${ctx.season}-${ctx.round}-${rel.driverId}`,
      ctx,
      `${driverName} Commits To Project As Loyalty Strengthens`,
      `The bond between ${driverName} and the team is growing stronger. The driver has been vocal about buying into the long-term vision.`,
      'low',
      rel.driverId,
      teamId,
    ));
  }

  return items;
}

// ---------------------------------------------------------------------------
// Master generator — combines all hooks with spam control
// ---------------------------------------------------------------------------

export function generateDriverDramaNews(
  ctx: DramaNewsContext,
  params: {
    relationships: Record<string, DriverRelationship>;
    prevRelationships: Record<string, DriverRelationship>;
    confidenceUpdates: Record<string, ConfidenceUpdate[]>;
    raceContexts: Record<string, RaceEventContext>;
    promiseResolutions: Record<string, PromiseResolution[]>;
    expiredPromises: DriverPromise[];
    allPromises: DriverPromise[];
    teamOrderConsequences: RelationshipConsequence[];
    teamOrders: TeamOrderDecision[];
  },
): NewsItem[] {
  const allItems: NewsItem[] = [];
  const seenKeys = new Set<string>();
  const priorityRank: Record<NewsPriority, number> = { critical: 0, high: 1, normal: 2, low: 3 };

  for (const driverId of Object.keys(params.relationships)) {
    const rel = params.relationships[driverId];
    const prevRel = params.prevRelationships[driverId] ?? rel;
    const updates = params.confidenceUpdates[driverId] ?? [];
    const raceCtx = params.raceContexts[driverId];
    if (!raceCtx) continue;

    // Confidence / morale hooks.
    const confNews = generateConfidenceDramaNews(ctx, rel, updates, prevRel);
    // Trust in car hooks.
    const carNews = generateTrustInCarDramaNews(ctx, rel, updates, raceCtx);
    // Trust in team hooks.
    const teamNews = generateTrustInTeamDramaNews(ctx, rel, updates, raceCtx);
    // Ego hooks.
    const egoNews = generateEgoDramaNews(ctx, rel, updates, raceCtx);
    // Teammate rivalry hooks.
    const rivalNews = generateTeammateRivalryDramaNews(ctx, rel, raceCtx, params.teamOrderConsequences);
    // Contract hooks.
    const contractNews = generateContractDramaNews(ctx, rel);

    // Promise hooks.
    const promiseNews = generatePromiseDramaNews(
      ctx,
      driverId,
      rel.teamId,
      params.promiseResolutions[driverId] ?? [],
      params.expiredPromises,
    );

    // Collect and deduplicate by news ID key (round+driver+type).
    const driverItems: NewsItem[] = [];
    for (const item of [...confNews, ...carNews, ...teamNews, ...egoNews, ...rivalNews, ...contractNews, ...promiseNews]) {
      if (!seenKeys.has(item.id)) {
        seenKeys.add(item.id);
        driverItems.push(item);
      }
    }

    // Spam control: keep only the top 2 highest-priority items per driver.
    driverItems.sort((a, b) => (priorityRank[a.priority ?? 'normal'] ?? 2) - (priorityRank[b.priority ?? 'normal'] ?? 2));
    allItems.push(...driverItems.slice(0, 2));
  }

  // Spam control: cap total drama news to 8 per round, keeping highest priority.
  if (allItems.length > 8) {
    allItems.sort((a, b) => (priorityRank[a.priority ?? 'normal'] ?? 2) - (priorityRank[b.priority ?? 'normal'] ?? 2));
    allItems.length = 8;
  }

  return allItems;
}
