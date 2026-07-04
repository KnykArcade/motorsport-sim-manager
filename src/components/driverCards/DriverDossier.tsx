import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../Button';
import { formatMoney } from '../ui';
import { driverSalary, toMoney } from '../../sim/financeEngine';
import { synthesizeDriverRatings } from '../../sim/driverMarketEngine';
import { computeConfidenceState, overallConfidenceScore } from '../../sim/driverConfidenceEngine';
import type { GameState } from '../../game/careerState';
import type { Driver, DriverRatings } from '../../types/gameTypes';
import type { AcademyMember, MarketDriver, YouthProspect } from '../../types/marketTypes';
import type { DriverRelationship, DriverWant } from '../../types/relationshipTypes';
import { getEraTheme, getEraThemeConfig, type MotorsportEraTheme } from '../../theme/eraTheme';

type DriverSubject =
  | { type: 'driver'; driver: Driver }
  | { type: 'market'; driver: MarketDriver }
  | { type: 'academy'; driver: AcademyMember | YouthProspect };

type DossierFocus = 'identity' | 'relationship' | 'development' | 'market' | 'career';

type Props = {
  state: GameState;
  subject: DriverSubject;
  context?: string;
  focus?: DossierFocus;
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

function ratingRows(ratings: DriverRatings): Array<[string, number]> {
  return [
    ['Overall', ratings.overall],
    ['Race Pace', ratings.racePace],
    ['Qualifying', ratings.qualifying],
    ['Racecraft', ratings.overtakingRacecraft],
    ['Composure', ratings.composure],
    ['Risk Mgmt.', ratings.riskManagement],
  ];
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
        ? `Peak ${curve.peakAgeStart}-${curve.peakAgeEnd}, ceiling ${curve.potentialCeiling.toFixed(1)}`
        : 'Development curve not scouted',
    };
  }

  if (subject.type === 'market') {
    const driver = subject.driver;
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
      developmentLine: `Potential ${driver.potential.toFixed(1)}, F1 readiness ${driver.f1Readiness}/100`,
      notes: driver.notes,
    };
  }

  const driver = subject.driver;
  const isMember = 'signedYear' in driver;
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
    developmentLine: `Potential ${driver.potential.toFixed(1)}, current ${driver.overall.toFixed(1)}`,
    notes: isMember ? undefined : driver.notes,
  };
}

export function DriverDossierButton({ state, subject, context, focus, children, className = '' }: Props) {
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
  onClose,
}: {
  state: GameState;
  profile: ReturnType<typeof getSubjectProfile>;
  subject: DriverSubject;
  context?: string;
  focus?: DossierFocus;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const rel = profile.rel as DriverRelationship | undefined;
  const confidence = rel ? computeConfidenceState(rel) : undefined;
  const confidenceScore = rel ? overallConfidenceScore(rel) : undefined;
  const activePromises = profile.promises.filter((p) => p.status === 'active').length;
  const eraTheme = getEraTheme(state.series, state.seasonYear);
  const eraConfig = getEraThemeConfig(eraTheme);
  const nineties = eraTheme === 'f1-1990s';
  const shellClass = `driver-dossier ${dossierClassFor(eraTheme)}`;

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

        <div className="driver-dossier-tabs" aria-label="Driver card sections">
          {(['identity', 'relationship', 'development', 'market', 'career'] as DossierFocus[]).map((tab) => (
            <span key={tab} className={focus === tab ? 'active' : ''}>{tab}</span>
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
              <DossierPanel title="Core Ratings" emphasis={focus === 'identity'}>
                {ratingRows(profile.ratings).map(([label, value]) => (
                  <RatingLine key={label} label={label} value={value} />
                ))}
              </DossierPanel>

              <DossierPanel title="Relationship File" emphasis={focus === 'relationship'}>
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

              <DossierPanel title="Personality & Wants" emphasis={focus === 'relationship'}>
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

              <DossierPanel title="Development Sheet" emphasis={focus === 'development'}>
                <p className="driver-dossier-note">{profile.developmentLine}</p>
                <MetricPill label="Potential" value={subject.type === 'driver' ? (profile.curve?.potentialCeiling.toFixed(1) ?? 'Unscouted') : profile.ratings.overall.toFixed(1)} tone="watch" />
                <MetricPill label="Best fit" value={profile.ratings.racePace >= profile.ratings.qualifying ? 'Race pace' : 'Qualifying'} tone="good" />
              </DossierPanel>

              <DossierPanel title="Market / Contract Folder" emphasis={focus === 'market'}>
                <p className="driver-dossier-note">{profile.marketLine}</p>
                {profile.salary && <MetricPill label="Salary" value={formatMoney(profile.salary)} tone="watch" />}
                {activePromises > 0 && <MetricPill label="Active promises" value={activePromises} tone="risk" />}
              </DossierPanel>

              <DossierPanel title="Career Notes" emphasis={focus === 'career'}>
                <p className="driver-dossier-note">
                  {profile.notes ?? 'Career history and detailed rivalries can plug into this panel as the record book grows.'}
                </p>
              </DossierPanel>
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

function RatingLine({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value * 10));
  return (
    <div className="driver-dossier-rating">
      <span>{label}</span>
      <div><i style={{ width: `${pct}%` }} /></div>
      <strong>{value.toFixed(1)}</strong>
    </div>
  );
}

function MetricPill({ label, value, tone }: { label: string; value: ReactNode; tone: 'good' | 'watch' | 'risk' }) {
  return (
    <div className={`driver-dossier-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
