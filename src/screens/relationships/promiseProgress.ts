import type { GameState } from '../../game/careerState';
import type { DriverPromise } from '../../types/relationshipTypes';
import { activeUpgradePrograms, completedUpgradePrograms } from '../../sim/technicalAdapters';

export type PromiseProgressInfo = {
  percent: number;
  tone: 'good' | 'watch' | 'bad' | 'neutral';
  status: string;
  detail: string;
  deadline: string;
};

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function standingPoints(state: GameState, driverId: string): number {
  return state.driverStandings.find((entry) => entry.entityId === driverId)?.points ?? 0;
}

function promiseDeadlineProgress(promise: DriverPromise, state: GameState): string {
  const dueSeason = promise.dueSeason ?? promise.madeSeason;
  const dueRound = promise.dueRound;
  if (dueRound == null) {
    return state.seasonYear > dueSeason ? 'Deadline has passed.' : `Season-end review in ${dueSeason}.`;
  }
  if (state.seasonYear > dueSeason || (state.seasonYear === dueSeason && state.currentRaceIndex + 1 > dueRound)) {
    return 'Deadline has passed.';
  }
  if (state.seasonYear < dueSeason) return `Due in season ${dueSeason}, round ${dueRound}.`;
  const roundsLeft = Math.max(0, dueRound - (state.currentRaceIndex + 1));
  return roundsLeft === 0 ? 'Due this round.' : `${roundsLeft} round${roundsLeft === 1 ? '' : 's'} remaining.`;
}

export function promiseProgress(promise: DriverPromise, state: GameState): PromiseProgressInfo {
  const rel = state.driverRelationships?.[promise.driverId];
  const driver = state.drivers.find((d) => d.id === promise.driverId);
  const teammateId = rel?.teammateId;
  const driverStillWithTeam = !!driver && driver.teamId === state.selectedTeamId;
  const orders = state.teamOrderHistory?.filter((order) => order.favoredDriverId === promise.driverId || order.disadvantagedDriverId === promise.driverId) ?? [];
  const favoredOrders = orders.filter((order) => order.favoredDriverId === promise.driverId).length;
  const disadvantagedOrders = orders.filter((order) => order.disadvantagedDriverId === promise.driverId).length;
  const car = state.cars.find((c) => c.teamId === state.selectedTeamId);
  const reliabilityScore = car ? Math.round((car.ratings.reliability / 10) * 70 + (car.condition / 100) * 30) : 50;
  const relevantDevelopment = activeUpgradePrograms(state).filter((project) => project.category === 'Driver' || project.category === 'Reliability' || project.category === 'Strategy');
  const completedDevelopment = completedUpgradePrograms(state).filter((project) => project.category === 'Driver' || project.category === 'Reliability' || project.category === 'Strategy');
  const deadline = promiseDeadlineProgress(promise, state);

  switch (promise.promiseType) {
    case 'equal_treatment':
      if (disadvantagedOrders > 0) {
        return { percent: 15, tone: 'bad', status: 'At risk', detail: `${disadvantagedOrders} team order${disadvantagedOrders === 1 ? '' : 's'} disadvantaged this driver.`, deadline };
      }
      return { percent: favoredOrders > 0 ? 55 : 80, tone: favoredOrders > 0 ? 'watch' : 'good', status: favoredOrders > 0 ? 'Watch fairness' : 'Currently on track', detail: favoredOrders > 0 ? 'Driver has been favoured; teammate treatment may become an issue.' : 'No team orders have disadvantaged this driver.', deadline };
    case 'number_one_status':
      if (disadvantagedOrders > 0) {
        return { percent: 10, tone: 'bad', status: 'At risk', detail: 'Driver has been asked to give up priority despite the promise.', deadline };
      }
      return { percent: favoredOrders > 0 ? 90 : rel?.numberOneExpectation ? 65 : 50, tone: favoredOrders > 0 ? 'good' : 'watch', status: favoredOrders > 0 ? 'Priority shown' : 'Waiting for proof', detail: favoredOrders > 0 ? 'Team orders have backed this driver.' : 'No decisive number-one call has happened yet.', deadline };
    case 'improved_reliability':
      return { percent: clampPercent(reliabilityScore), tone: reliabilityScore >= 70 ? 'good' : reliabilityScore >= 50 ? 'watch' : 'bad', status: reliabilityScore >= 70 ? 'Currently on track' : 'Needs improvement', detail: `Car reliability/condition tracker: ${reliabilityScore}/100.`, deadline };
    case 'contract_renewal': {
      const years = driver?.contractYearsRemaining ?? 0;
      return { percent: years > 1 ? 100 : years === 1 ? 55 : 15, tone: years > 1 ? 'good' : 'watch', status: years > 1 ? 'Contract secured' : 'Needs renewal', detail: `${years} contract year${years === 1 ? '' : 's'} remaining.`, deadline };
    }
    case 'fight_teammate': {
      const driverPoints = standingPoints(state, promise.driverId);
      const teammatePoints = teammateId ? standingPoints(state, teammateId) : 0;
      const ahead = driverPoints >= teammatePoints;
      return { percent: ahead ? 75 : 35, tone: ahead ? 'good' : 'watch', status: ahead ? 'Ahead of teammate' : 'Needs to beat teammate', detail: teammateId ? `${driverPoints} pts vs ${teammatePoints} pts for ${state.drivers.find((d) => d.id === teammateId)?.name ?? 'teammate'}.` : 'No teammate comparison available.', deadline };
    }
    case 'development_priority':
    case 'priority_upgrades':
      return { percent: completedDevelopment.length > 0 ? 100 : relevantDevelopment.length > 0 ? 70 : 35, tone: completedDevelopment.length > 0 ? 'good' : relevantDevelopment.length > 0 ? 'watch' : 'neutral', status: completedDevelopment.length > 0 ? 'Development delivered' : relevantDevelopment.length > 0 ? 'Project in progress' : 'No priority project yet', detail: completedDevelopment.length > 0 ? `${completedDevelopment.length} relevant project${completedDevelopment.length === 1 ? '' : 's'} completed.` : relevantDevelopment.length > 0 ? `${relevantDevelopment.length} relevant project${relevantDevelopment.length === 1 ? '' : 's'} active.` : 'Assign development work to back this promise.', deadline };
    case 'promotion':
    case 'reserve_practice_time':
      return { percent: driverStillWithTeam ? 45 : 10, tone: 'neutral', status: 'Season-end review', detail: 'This promise is judged at season end from role and practice-time decisions.', deadline };
    case 'no_midseason_replacement':
      return { percent: driverStillWithTeam ? 80 : 0, tone: driverStillWithTeam ? 'good' : 'bad', status: driverStillWithTeam ? 'Seat retained' : 'Seat lost', detail: driverStillWithTeam ? 'Driver is still signed to the team.' : 'Driver is no longer with the selected team.', deadline };
    case 'better_strategy_support':
      return { percent: relevantDevelopment.some((project) => project.category === 'Strategy') || completedDevelopment.some((project) => project.category === 'Strategy') ? 70 : 45, tone: 'neutral', status: 'Waiting for race evidence', detail: 'Race strategy outcomes and successful aggressive calls will determine this.', deadline };
    case 'calmer_risk_approach':
      return { percent: 60, tone: 'neutral', status: 'Monitoring race calls', detail: 'Aggressive strategy choices can break this promise after races.', deadline };
  }
}
