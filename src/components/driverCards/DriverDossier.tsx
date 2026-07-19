import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../Button';
import { formatMoney, ratingColor } from '../ui';
import { driverSalary, toMoney } from '../../sim/financeEngine';
import { synthesizeDriverRatings } from '../../sim/driverMarketEngine';
import { computeConfidenceState, overallConfidenceScore } from '../../sim/driverConfidenceEngine';
import {
  readoutForDriverRating,
  readoutForMarketOverall,
  readoutForMarketSkill,
  readoutForPotential,
  type RatingReadout,
} from '../scouting/ratingDisplay';
import type { GameState } from '../../game/careerState';
import type { Driver, DriverRatings, RaceResult } from '../../types/gameTypes';
import type { AcademyMember, MarketDriver, YouthProspect } from '../../types/marketTypes';
import type { DriverRelationship, DriverWant } from '../../types/relationshipTypes';
import { getEraTheme, getEraThemeConfig, type MotorsportEraTheme } from '../../theme/eraTheme';
import { CharacterActionPanel } from '../characterCards/CharacterActionPanel';

type DriverSubject =
  | { type: 'driver'; driver: Driver }
  | { type: 'market'; driver: MarketDriver }
  | { type: 'academy'; driver: AcademyMember | YouthProspect };

type DossierFocus = 'identity' | 'relationship' | 'development' | 'market' | 'career';

type DriverSeasonStats = {
  starts: number;
  wins: number;
  podiums: number;
  top10s: number;
  dnfs: number;
  points: number;
  averageFinish: number | null;
  recent: Array<{ round: number; name: string; result: RaceResult }>;
};

type Props = {
  state: GameState;
  subject: DriverSubject;
  context?: string;
  focus?: DossierFocus;
  actionIntent?: boolean;
  children?: ReactNode;
  className?: string;
};

const WANT_LABELS: Record<DriverWant, string> = {
  number_one_status: 'Number-one status',
  equal_treatment: 'Equal treatment',
  better_reliability: 'Better reliability',
  development_priority: 'Development priority',
  contract_renewal: 'Contract renewal',
  race_seat_security: 'Race-seat security',
  less_risky_strategy: 'Less risky strategy',
  more_aggressive_strategy: 'More aggressive strategy',
  better_teammate_treatment: 'Better teammate treatment',
  podium_capable_car: 'Podium-capable car',
  title_contending_car: 'Title-contending car',
  better_salary: 'Better salary',
  academy_promotion: 'Academy promotion',
  practice_time: 'More practice time',
  team_stability: 'Team stability',
};

function dossierClassFor(theme: MotorsportEraTheme): string {
  if (theme === 'f1-1990s') return 'driver-dossier-90s';
  if (theme === 'f1-2000s') return 'driver-dossier-2000s';
  if (theme === 'f1-2010s') return 'driver-dossier-2010s';
  if (theme === 'f1-2020s') return 'driver-dossier-2020s';
  return 'driver-dossier-generic';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function roleLabel(driver: Driver): string {
  if (driver.contractType === 'third') return 'Third Driver';
  if (driver.contractType === 'reserve') return 'Reserve Driver';
  if (driver.contractType === 'test') return 'Test Driver';
  return 'Race Driver';
}

function scoreTone(value: number): 'good' | 'watch' | 'risk' {
  if (value >= 75) return 'good';
  if (value >= 55) return 'watch';
  return 'risk';
}

function getSubjectProfile(state: GameState, subject: DriverSubject) {
  if (subject.type === 'driver') {
    const driver = subject.driver;
    const team = state.teams.find((t) => t.id === driver.teamId);
    const rel = state.driverRelationships?.[driver.id];
    const curve = state.developmentCurves?.[driver.id];
    const promises = (state.driverPromises ?? []).filter((p) => p.driverId === driver.id);
    const teammate = rel?.teammateId ? state.drivers.find((d) => d.id === rel.teammateId) : undefined;
    const seasonStats = buildDriverSeasonStats(state, driver.id);
    return {
      name: driver.name,
      number: driver.number,
      nationality: driver.nationality ?? 'Unknown',
      age: driver.age,
      teamName: team?.name ?? 'Unsigned',
      teamColor: team?.color ?? '#d6b35a',
      role: roleLabel(driver),
      ratings: driver.ratings,
      salary: driverSalary(driver),
      contractYears: driver.contractYearsRemaining,
      traits: driver.traits,
      rel,
      curve,
      promises,
      teammateName: teammate?.name,
      marketLine: `${formatMoney(driverSalary(driver))} salary estimate`,
      developmentLine: curve
        ? driver.teamId === state.selectedTeamId
          ? `Peak ${curve.peakAgeStart}-${curve.peakAgeEnd}, ceiling ${curve.potentialCeiling.toFixed(1)}`
          : 'Development curve requires deeper scouting'
        : 'Development curve not scouted',
      seasonStats,
    };
  }

  if (subject.type === 'market') {
    const driver = subject.driver;
    const current = readoutForMarketOverall(state, driver.id, driver.skills, driver.potential, driver.overall).label;
    const potential = readoutForPotential(state, driver.id, driver.skills, driver.potential).label;
    return {
      name: driver.name,
      number: undefined,
      nationality: driver.nationality,
      age: driver.age,
      teamName: driver.context,
      teamColor: '#d6b35a',
      role: driver.primaryRole,
      ratings: synthesizeDriverRatings(driver.skills, driver.overall),
      salary: toMoney(driver.salary),
      contractYears: undefined,
      traits: [driver.marketStatus, driver.negotiationDifficulty, driver.suggestedUse].filter(Boolean),
      rel: undefined,
      curve: undefined,
      promises: [],
      teammateName: undefined,
      marketLine: `${formatMoney(toMoney(driver.buyoutCost))} buyout, ${formatMoney(toMoney(driver.sponsorValue))}/yr sponsor pull`,
      developmentLine: `Potential ${potential}, current ${current}, F1 readiness ${driver.f1Readiness}/100`,
      notes: driver.notes,
      seasonStats: null,
    };
  }

  const driver = subject.driver;
  const isMember = 'signedYear' in driver;
  const current = isMember
    ? driver.overall.toFixed(1)
    : readoutForMarketOverall(state, driver.id, driver.skills, driver.potential, driver.overall, 'YouthProspect').label;
  const potential = isMember
    ? driver.potential.toFixed(1)
    : readoutForPotential(state, driver.id, driver.skills, driver.potential, 'YouthProspect').label;
  return {
    name: driver.name,
    number: undefined,
    nationality: driver.nationality,
    age: isMember ? state.seasonYear - driver.birthYear : driver.age,
    teamName: isMember ? 'Your Academy' : driver.currentLevel,
    teamColor: '#8b5fbf',
    role: isMember ? 'Academy Driver' : 'Youth Prospect',
    ratings: synthesizeDriverRatings(driver.skills, driver.overall),
    salary: isMember ? undefined : toMoney(driver.yearlyAcademyCost),
    contractYears: undefined,
    traits: [
      isMember ? `${driver.yearsUntilF1Ready}y to F1` : driver.riskLevel,
      isMember ? 'First option rights' : driver.suggestedPath,
    ].filter(Boolean),
    rel: undefined,
    curve: undefined,
    promises: [],
    teammateName: undefined,
    marketLine: isMember
      ? `Signed ${driver.signedYear}, academy rights held`
      : `${formatMoney(toMoney(driver.signingCost))} signing, ${formatMoney(toMoney(driver.yearlyAcademyCost))}/yr academy`,
    developmentLine: `Potential ${potential}, current ${current}`,
    notes: isMember ? undefined : driver.notes,
    seasonStats: null,
  };
}

function buildDriverSeasonStats(state: GameState, driverId: string): DriverSeasonStats {
  const recent: DriverSeasonStats['recent'] = [];
  let starts = 0;
  let wins = 0;
  let podiums = 0;
  let top10s = 0;
  let dnfs = 0;
  let points = 0;
  let finishSum = 0;
  let classifiedFinishes = 0;

  for (const race of state.calendar) {
    const result = state.completedRaceResults[race.id]?.find((r) => r.driverId === driverId);
    if (!result) continue;
    starts += 1;
    points += result.points;
    if (result.status !== 'Finished') dnfs += 1;
    if (result.position != null) {
      finishSum += result.position;
      classifiedFinishes += 1;
      if (result.position === 1) wins += 1;
      if (result.position <= 3) podiums += 1;
      if (result.position <= 10) top10s += 1;
    }
    recent.push({ round: race.round, name: race.gpName, result });
  }

  return {
    starts,
    wins,
    podiums,
    top10s,
    dnfs,
    points,
    averageFinish: classifiedFinishes > 0 ? finishSum / classifiedFinishes : null,
    recent,
  };
}

export function DriverDossierButton({ state, subject, context, focus, actionIntent = false, children, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const profile = useMemo(() => getSubjectProfile(state, subject), [state, subject]);

  return (
    <>
      <Button
        variant="ghost"
        className={`px-2 py-1 text-xs ${className}`}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        {children ?? 'Driver Card'}
      </Button>
      {open && (
        <DriverDossierModal
          state={state}
          profile={profile}
          subject={subject}
          context={context}
          focus={focus}
          actionIntent={actionIntent}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function DriverDossierModal({
  state,
  profile,
  subject,
  context,
  focus = 'identity',
  actionIntent = false,
  onClose,
}: {
  state: GameState;
  profile: ReturnType<typeof getSubjectProfile>;
  subject: DriverSubject;
  context?: string;
  focus?: DossierFocus;
  actionIntent?: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DossierFocus>(focus);
  const rel = profile.rel as DriverRelationship | undefined;
  const confidence = rel ? computeConfidenceState(rel) : undefined;
  const confidenceScore = rel ? overallConfidenceScore(rel) : undefined;
  const activePromises = profile.promises.filter((p) => p.status === 'active').length;
  const eraTheme = getEraTheme(state.series, state.seasonYear);
  const eraConfig = getEraThemeConfig(eraTheme);
  const nineties = eraTheme === 'f1-1990s';
  const shellClass = `driver-dossier ${dossierClassFor(eraTheme)}`;
  const coreRatings = dossierRatingRows(state, subject, profile.ratings);
  const showsIn = (...tabs: DossierFocus[]) => tabs.includes(activeTab);

  return (
    <div className="driver-dossier-overlay" role="dialog" aria-modal="true" aria-label={`${profile.name} driver card`}>
      <div className={shellClass} data-era={eraTheme}>
        <div className="driver-dossier-topbar">
          <div>
            <div className="driver-dossier-kicker">{nineties ? 'Personnel file' : 'Driver intelligence file'}</div>
            <h2>{profile.name}</h2>
            <p>{context ?? profile.role}</p>
          </div>
          <div className="driver-dossier-actions">
            <span className="driver-dossier-era">{eraConfig.label}</span>
            <button onClick={onClose} aria-label="Close driver card">Close</button>
          </div>
        </div>

        <div className="driver-dossier-tabs" role="tablist" aria-label="Driver card sections">
          {(['identity', 'relationship', 'development', 'market', 'career'] as DossierFocus[]).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              className={activeTab === tab ? 'active' : ''}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'identity' ? 'overview' : tab}
            </button>
          ))}
        </div>

        <div className="driver-dossier-body">
          <section className="driver-dossier-id">
            <div className="driver-dossier-photo" style={{ borderColor: profile.teamColor }}>
              <span>{initials(profile.name)}</span>
            </div>
            <div className="driver-dossier-id-strip">
              <span>Driver ID</span>
              <strong>{profile.number ?? '--'}</strong>
            </div>
            <div className="driver-dossier-stamp">{profile.role}</div>
          </section>

          <section className="driver-dossier-main">
            <div className="driver-dossier-nameplate">
              <span className="driver-dossier-team-dot" style={{ backgroundColor: profile.teamColor }} />
              <div>
                <h3>{profile.teamName}</h3>
                <p>
                  {profile.nationality}
                  {profile.age ? ` - age ${profile.age}` : ''}
                  {profile.contractYears ? ` - ${profile.contractYears} yr contract` : ''}
                </p>
              </div>
            </div>

            <div className="driver-dossier-grid">
              {showsIn('identity', 'development', 'market') && (
              <DossierPanel title="Core Ratings" emphasis={activeTab === 'identity'}>
                {coreRatings.map(([label, readout]) => (
                  <RatingLine key={label} label={label} readout={readout} />
                ))}
              </DossierPanel>
              )}

              {showsIn('identity', 'relationship') && (
              <DossierPanel title="Relationship File" emphasis={activeTab === 'relationship'}>
                {rel ? (
                  <>
                    <MetricPill label="State" value={confidence ?? 'Unknown'} tone={scoreTone(confidenceScore ?? 0)} />
                    <MetricPill label="Score" value={`${confidenceScore}/100`} tone={scoreTone(confidenceScore ?? 0)} />
                    <MetricPill label="Loyalty" value={rel.teamLoyalty} tone={scoreTone(rel.teamLoyalty)} />
                    <MetricPill label="Trust Car" value={rel.trustInCar} tone={scoreTone(rel.trustInCar)} />
                    <MetricPill label="Frustration" value={rel.frustration} tone={rel.frustration >= 55 ? 'risk' : 'good'} />
                    {profile.teammateName && <p className="driver-dossier-note">Teammate: {profile.teammateName}</p>}
                  </>
                ) : (
                  <p className="driver-dossier-note">Relationship data appears after the driver joins a team.</p>
                )}
              </DossierPanel>
              )}

              {showsIn('identity', 'relationship') && (
              <DossierPanel title="Personality & Wants" emphasis={activeTab === 'relationship'}>
                <div className="driver-dossier-tags">
                  {profile.traits.length > 0 ? profile.traits.slice(0, 6).map((trait) => <span key={trait}>{trait}</span>) : <span>Balanced</span>}
                </div>
                {rel?.wants.length ? (
                  <ul className="driver-dossier-list">
                    {rel.wants.slice(0, 4).map((want) => <li key={want}>{WANT_LABELS[want]}</li>)}
                  </ul>
                ) : (
                  <p className="driver-dossier-note">No active wants recorded.</p>
                )}
              </DossierPanel>
              )}

              {showsIn('identity', 'development') && (
              <DossierPanel title="Development Sheet" emphasis={activeTab === 'development'}>
                <p className="driver-dossier-note">{profile.developmentLine}</p>
                <MetricPill label="Potential" value={potentialReadout(state, subject, profile).label} tone="watch" />
                <MetricPill label="Best fit" value={bestFitReadout(coreRatings)} tone="good" />
              </DossierPanel>
              )}

              {showsIn('identity', 'market') && (
              <DossierPanel title="Market / Contract Folder" emphasis={activeTab === 'market'}>
                <p className="driver-dossier-note">{profile.marketLine}</p>
                {profile.salary && <MetricPill label="Salary" value={formatMoney(profile.salary)} tone="watch" />}
                {activePromises > 0 && <MetricPill label="Active promises" value={activePromises} tone="risk" />}
              </DossierPanel>
              )}

              {subject.type === 'driver' && subject.driver.teamId === state.selectedTeamId && showsIn('identity', 'relationship') && (
                <DossierPanel title="Management Actions" emphasis={activeTab === 'relationship'}>
                  <CharacterActionPanel
                    state={state}
                    initialSection={actionIntent ? 'interact' : 'overview'}
                    target={{
                      type: 'Driver',
                      id: subject.driver.id,
                      name: subject.driver.name,
                      teamId: subject.driver.teamId,
                    }}
                  />
                </DossierPanel>
              )}

              {showsIn('identity', 'career') && (
              <DossierPanel title="Career Notes" emphasis={activeTab === 'career'}>
                {profile.seasonStats ? (
                  <SeasonStats stats={profile.seasonStats} />
                ) : (
                  <p className="driver-dossier-note">
                    {profile.notes ?? 'Season race history appears once this driver starts races in the save.'}
                  </p>
                )}
              </DossierPanel>
              )}
            </div>
          </section>

          <aside className="driver-dossier-side">
            <div className="driver-dossier-sticky">
              <strong>Player read</strong>
              <p>
                {rel
                  ? `${profile.name} is ${confidence?.toLowerCase()} with ${rel.frustration}/100 frustration. Watch wants and promises before contract talks.`
                  : `${profile.name} is not in your relationship file yet. Use this card for scouting, market fit, and development planning.`}
              </p>
            </div>
            <div className="driver-dossier-links">
              {subject.type === 'driver' && (
                <>
                  <button onClick={() => { onClose(); navigate('/relationships'); }}>Relationships</button>
                  <button onClick={() => { onClose(); navigate('/curves'); }}>Development</button>
                </>
              )}
              <button onClick={() => { onClose(); navigate('/market'); }}>Driver Market</button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function DossierPanel({ title, emphasis, children }: { title: string; emphasis?: boolean; children: ReactNode }) {
  return (
    <section className={`driver-dossier-panel ${emphasis ? 'is-emphasis' : ''}`}>
      <h4>{title}</h4>
      {children}
    </section>
  );
}

function RatingLine({ label, readout }: { label: string; readout: RatingReadout }) {
  const pct = Math.max(0, Math.min(100, readout.value ?? 0));
  const color = ratingColor(readout.value ?? 0);
  return (
    <div className="driver-dossier-rating">
      <span>{label}</span>
      <div><i style={{ width: `${pct}%`, background: color }} /></div>
      <strong>{readout.label}</strong>
    </div>
  );
}

function dossierRatingRows(
  state: GameState,
  subject: DriverSubject,
  ratings: DriverRatings,
): Array<[string, RatingReadout]> {
  if (subject.type === 'driver') {
    const driver = subject.driver;
    return [
      ['Overall', readoutForDriverRating(state, driver, 'overall')],
      ['Race Pace', readoutForDriverRating(state, driver, 'racePace')],
      ['Qualifying', readoutForDriverRating(state, driver, 'qualifying')],
      ['Racecraft', readoutForDriverRating(state, driver, 'overtakingRacecraft')],
      ['Composure', readoutForDriverRating(state, driver, 'composure')],
      ['Risk Mgmt.', readoutForDriverRating(state, driver, 'riskManagement')],
    ];
  }

  if (subject.type === 'market') {
    const driver = subject.driver;
    return [
      ['Overall', readoutForMarketOverall(state, driver.id, driver.skills, driver.potential, driver.overall)],
      ['Race Pace', readoutForMarketSkill(state, driver.id, driver.skills, driver.potential, 'enduranceConsistency')],
      ['Qualifying', readoutForMarketSkill(state, driver.id, driver.skills, driver.potential, 'technical')],
      ['Racecraft', readoutForMarketSkill(state, driver.id, driver.skills, driver.potential, 'overtakingRacecraft')],
      ['Composure', readoutForMarketSkill(state, driver.id, driver.skills, driver.potential, 'riskManagement')],
      ['Risk Mgmt.', readoutForMarketSkill(state, driver.id, driver.skills, driver.potential, 'riskManagement')],
    ];
  }

  const driver = subject.driver;
  const ownedAcademy = 'signedYear' in driver;
  const exact = (value: number): RatingReadout => ({ label: value.toFixed(1), value, exact: true });
  return [
    ['Overall', ownedAcademy ? exact(driver.overall) : readoutForMarketOverall(state, driver.id, driver.skills, driver.potential, driver.overall, 'YouthProspect')],
    ['Race Pace', ownedAcademy ? exact(ratings.racePace) : readoutForMarketSkill(state, driver.id, driver.skills, driver.potential, 'enduranceConsistency', 'YouthProspect')],
    ['Qualifying', ownedAcademy ? exact(ratings.qualifying) : readoutForMarketSkill(state, driver.id, driver.skills, driver.potential, 'technical', 'YouthProspect')],
    ['Racecraft', ownedAcademy ? exact(driver.skills.overtakingRacecraft) : readoutForMarketSkill(state, driver.id, driver.skills, driver.potential, 'overtakingRacecraft', 'YouthProspect')],
    ['Composure', ownedAcademy ? exact(ratings.composure) : readoutForMarketSkill(state, driver.id, driver.skills, driver.potential, 'riskManagement', 'YouthProspect')],
    ['Risk Mgmt.', ownedAcademy ? exact(driver.skills.riskManagement) : readoutForMarketSkill(state, driver.id, driver.skills, driver.potential, 'riskManagement', 'YouthProspect')],
  ];
}

function potentialReadout(
  state: GameState,
  subject: DriverSubject,
  profile: ReturnType<typeof getSubjectProfile>,
): RatingReadout {
  if (subject.type === 'driver') {
    if (subject.driver.teamId === state.selectedTeamId && profile.curve) {
      return { label: profile.curve.potentialCeiling.toFixed(1), value: profile.curve.potentialCeiling, exact: true };
    }
    return { label: 'Scouting range', value: null, exact: false };
  }
  if (subject.type === 'market') return readoutForPotential(state, subject.driver.id, subject.driver.skills, subject.driver.potential);
  if ('signedYear' in subject.driver) return { label: subject.driver.potential.toFixed(1), value: subject.driver.potential, exact: true };
  return readoutForPotential(state, subject.driver.id, subject.driver.skills, subject.driver.potential, 'YouthProspect');
}

function bestFitReadout(rows: Array<[string, RatingReadout]>): string {
  const race = rows.find(([label]) => label === 'Race Pace')?.[1].value ?? 0;
  const quali = rows.find(([label]) => label === 'Qualifying')?.[1].value ?? 0;
  if (race === 0 && quali === 0) return 'Unknown';
  return race >= quali ? 'Race pace' : 'Qualifying';
}

function MetricPill({ label, value, tone }: { label: string; value: ReactNode; tone: 'good' | 'watch' | 'risk' }) {
  return (
    <div className={`driver-dossier-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SeasonStats({ stats }: { stats: DriverSeasonStats }) {
  if (stats.starts === 0) {
    return <p className="driver-dossier-note">No race starts recorded yet this season.</p>;
  }

  return (
    <>
      <div className="driver-dossier-tags">
        <span>{stats.starts} starts</span>
        <span>{stats.wins} wins</span>
        <span>{stats.podiums} podiums</span>
        <span>{stats.top10s} top 10s</span>
        <span>{stats.dnfs} DNFs</span>
      </div>
      <MetricPill label="Points" value={stats.points} tone="good" />
      <MetricPill
        label="Avg finish"
        value={stats.averageFinish != null ? stats.averageFinish.toFixed(1) : 'n/a'}
        tone="watch"
      />
      <ul className="driver-dossier-list">
        {stats.recent.slice(-5).map(({ round, name, result }) => (
          <li key={`${round}-${name}`}>
            R{round} {name}: {result.position != null ? `P${result.position}` : result.status}
            {result.points > 0 ? `, ${result.points} pts` : ''}
          </li>
        ))}
      </ul>
    </>
  );
}
