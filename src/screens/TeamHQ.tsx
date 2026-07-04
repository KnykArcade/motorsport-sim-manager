import { useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import {
  activeDriversForTeam,
  carForTeam,
  currentRace,
  driversForTeam,
  teamById,
} from '../game/careerState';
import { effectiveCarRatings } from '../sim/trackFitEngine';
import { getGameModeLabel, isRouteRestricted, isSingleSeasonMode } from '../game/modeRestrictions';
import { getTrackById, getRegulationSet } from '../data';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { RegulationPanel } from '../components/RegulationPanel';
import { StatBar } from '../components/StatBar';
import { StandingsTable } from '../components/StandingsTable';
import { NewsFeed } from '../components/NewsFeed';
import { NewsPanel } from '../components/NewsPanel';
import { TrackDemandBars } from '../components/TrackDemandBars';
import { DriverDossierButton } from '../components/driverCards/DriverDossier';
import { formatMoney } from '../components/ui';
import {
  BACKGROUNDS,
  MANAGEMENT_STYLES,
  STRENGTHS,
  optionById,
  type PrincipalOption,
} from '../data/principal/principalOptions';
import { calculateAcademyCapacity } from '../sim/teamRatingsEngine';
import type { TeamOrganizationRatings } from '../types/teamRatingsTypes';
import type { GameMode } from '../types/gameTypes';
import type { TeamPrincipal } from '../types/principalTypes';

export function TeamHQ() {
  const { state } = useGame();
  const navigate = useNavigate();
  if (!state) return null;

  const team = teamById(state, state.selectedTeamId);
  const car = carForTeam(state, state.selectedTeamId);
  const drivers = driversForTeam(state, state.selectedTeamId);
  const race = currentRace(state);
  const track = race ? getTrackById(race.trackId) : undefined;
  const ratings = car ? effectiveCarRatings(car) : null;

  const principal = state.teamPrincipal;
  const orgRatings = state.teamOrgRatings?.[state.selectedTeamId];

  const activeDrivers = activeDriversForTeam(state, state.selectedTeamId);
  const hasEnoughDrivers = activeDrivers.length >= 2;

  const driverName = (id: string) => state.drivers.find((d) => d.id === id)?.name ?? id;
  const teamName = (id: string) => state.teams.find((t) => t.id === id)?.name ?? id;
  const teamColor = (id: string) => state.teams.find((t) => t.id === id)?.color;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">{team?.name} — Team HQ</h1>
          <p className="text-sm text-neutral-400">{state.seasonYear} {state.series} · {getGameModeLabel(state.gameMode)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {state.seasonComplete ? (
            <Button variant="primary" onClick={() => navigate('/season-review')}>
              Season Review →
            </Button>
          ) : hasEnoughDrivers ? (
            <Button variant="primary" onClick={() => navigate('/briefing')}>
              Go to Next Race: {race?.gpName} →
            </Button>
          ) : (
            <Button variant="primary" onClick={() => navigate('/market')}>
              Sign Race Drivers ({activeDrivers.length}/2) →
            </Button>
          )}
          {race && !state.seasonComplete && (
            <span className="text-xs text-amber-400">
              Round {race.round} of {state.calendar.length} · {state.calendar.length - state.currentRaceIndex} races remaining
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Budget" value={team ? formatMoney(team.budget) : '—'} />
        <KpiCard label="Team Morale" value={`${Math.round(team?.morale ?? 0)}%`} />
        <KpiCard label="Reputation" value={`${Math.round(team?.reputation ?? 0)}`} />
        <KpiCard label="Active Projects" value={String(state.activeDevelopmentProjects.length)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Next race briefing */}
          {race && track && !state.seasonComplete && (
            <Panel
              title={`Next Race · Round ${race.round}`}
              actions={
                hasEnoughDrivers ? (
                  <Button onClick={() => navigate('/weekend')}>Enter Weekend →</Button>
                ) : (
                  <Button onClick={() => navigate('/market')}>Sign Drivers →</Button>
                )
              }
            >
              {!hasEnoughDrivers && (
                <div className="mb-3 rounded border border-amber-600/50 bg-amber-900/20 px-3 py-2 text-sm text-amber-300">
                  ⚠ Your team has only {activeDrivers.length} active race driver{activeDrivers.length === 1 ? '' : 's'}. Sign at least 2 drivers before entering the race weekend.
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-lg font-bold text-neutral-100">{race.gpName}</div>
                  <div className="text-sm text-neutral-400">{race.trackName}</div>
                  <div className="mt-2 inline-block rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
                    {track.archetype}
                  </div>
                  <div className="mt-3 text-xs text-neutral-500">
                    {race.laps} laps · {race.distanceKm ?? '—'} km
                  </div>
                </div>
                <TrackDemandBars track={track} />
              </div>
            </Panel>
          )}

          {/* Car performance */}
          {ratings && (
            <Panel title="Car Performance">
              <div className="grid gap-2 md:grid-cols-2">
                <StatBar label="Engine Power" value={ratings.enginePower} />
                <StatBar label="Aero Efficiency" value={ratings.aeroEfficiency} />
                <StatBar label="Mechanical Grip" value={ratings.mechanicalGrip} />
                <StatBar label="Reliability" value={ratings.reliability} />
                <StatBar label="Pit Crew Ops" value={ratings.pitCrewOperations} />
                <StatBar label="Condition" value={(car?.condition ?? 0) / 10} />
              </div>
            </Panel>
          )}

          {/* Season regulations */}
          {(() => {
            const regSet = getRegulationSet(state.regulationSetId);
            if (!regSet) return null;
            return (
              <RegulationPanel
                regulationSet={regSet}
                seasonYear={state.seasonYear}
                locked={isSingleSeasonMode(state.gameMode)}
                compact
              />
            );
          })()}

          {/* Team organization ratings */}
          {orgRatings && <TeamRatingsPanel ratings={orgRatings} academyUsed={(state.academy ?? []).length} />}

          {/* Drivers */}
          <Panel title="Drivers">
            <div className="grid gap-3 sm:grid-cols-2">
              {drivers.map((d) => (
                <div key={d.id} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <MoraleDot morale={d.morale} />
                      <span className="font-semibold text-neutral-100">#{d.number} {d.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-500">OVR {d.ratings.overall.toFixed(1)}</span>
                      <DriverDossierButton
                        state={state}
                        subject={{ type: 'driver', driver: d }}
                        context="Team HQ"
                        focus="relationship"
                      />
                    </div>
                  </div>
                  <div className="mt-2 space-y-1">
                    <StatBar label="Morale" value={d.morale / 10} />
                    <StatBar label="Confidence" value={d.confidence / 10} />
                    <StatBar label="Qualifying" value={d.ratings.qualifying} />
                    <StatBar label="Race Pace" value={d.ratings.racePace} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          {principal && <PrincipalPanel principal={principal} />}

          <Panel title="Quick Actions">
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => navigate('/calendar')}>Calendar</Button>
              <Button onClick={() => navigate('/standings')}>Standings</Button>
              <Button onClick={() => navigate('/history')}>Race History</Button>
              <Button onClick={() => navigate('/drivers')}>Drivers</Button>
              <Button onClick={() => navigate('/development')}>Development</Button>
              <Button onClick={() => navigate('/finance')}>Finance</Button>
              <Button onClick={() => navigate('/staff')}>Staff</Button>
              <Button onClick={() => navigate('/facilities')}>Facilities</Button>
              <QuickActionButton label="Engine" route="/engine" navigate={navigate} mode={state.gameMode} />
              <Button onClick={() => navigate('/principal')}>Principal</Button>
              <Button onClick={() => navigate('/relationships')}>Relationships</Button>
              <QuickActionButton label="Regulations" route="/politics" navigate={navigate} mode={state.gameMode} />
              <QuickActionButton label="Scouting" route="/scouting" navigate={navigate} mode={state.gameMode} />
              <QuickActionButton label="Dev Curves" route="/curves" navigate={navigate} mode={state.gameMode} />
              <Button onClick={() => navigate('/records')}>Universe History</Button>
              <Button onClick={() => navigate('/data')}>Team Data</Button>
              <Button onClick={() => navigate('/settings')}>Settings</Button>
            </div>
          </Panel>

          <Panel title="Top Stories">
            <NewsFeed items={state.news} limit={6} />
          </Panel>

          <NewsPanel
            news={state.news}
            title="My Team News"
            maxItems={4}
            teamId={state.selectedTeamId}
            emptyMessage="No team-specific news yet."
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <StandingsTable
          title="Drivers' Championship"
          entries={state.driverStandings.slice(0, 8)}
          nameOf={driverName}
          subtitleOf={(id) => teamName(state.drivers.find((d) => d.id === id)?.teamId ?? '')}
          highlightId={drivers[0]?.id}
        />
        <StandingsTable
          title="Constructors' Championship"
          entries={state.constructorStandings.slice(0, 8)}
          nameOf={teamName}
          colorOf={teamColor}
          highlightId={state.selectedTeamId}
        />
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-neutral-100">{value}</div>
    </div>
  );
}

function MoraleDot({ morale }: { morale: number }) {
  const color =
    morale >= 75 ? 'bg-green-500' :
    morale >= 50 ? 'bg-yellow-500' :
    morale >= 30 ? 'bg-orange-500' :
    'bg-red-500';
  const label =
    morale >= 75 ? 'High morale' :
    morale >= 50 ? 'Stable' :
    morale >= 30 ? 'Low morale' :
    'Critical';
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${color}`}
      title={label}
    />
  );
}

function PrincipalPanel({ principal }: { principal: TeamPrincipal }) {
  const labelOf = (list: PrincipalOption[], id: string) => optionById(list, id)?.label ?? id;
  return (
    <Panel title="Team Principal">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-neutral-700 bg-neutral-800 text-lg font-black text-neutral-200">
          {principal.name
            .trim()
            .split(/\s+/)
            .map((w) => w[0])
            .filter(Boolean)
            .slice(0, 2)
            .join('')
            .toUpperCase() || '??'}
        </div>
        <div className="min-w-0">
          <div className="truncate font-bold text-neutral-100">{principal.name}</div>
          <div className="text-xs text-neutral-500">
            {labelOf(BACKGROUNDS, principal.background)}
            {principal.nationality ? ` · ${principal.nationality}` : ''}
            {principal.age ? ` · ${principal.age}` : ''}
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-1 text-xs">
        <Row label="Management" value={labelOf(MANAGEMENT_STYLES, principal.managementStyle)} />
        <Row label="Strength" value={labelOf(STRENGTHS, principal.primaryStrength)} />
        <Row label="Weakness" value={labelOf(STRENGTHS, principal.weakness)} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <MiniStat label="Reputation" value={principal.reputation} />
        <MiniStat label="Driver Mgmt" value={principal.driverManagement} />
        <MiniStat label="Development" value={principal.developmentFocus} />
        <MiniStat label="Strategy" value={principal.raceStrategy} />
        <MiniStat label="Commercial" value={principal.commercialSkill} />
        <MiniStat label="Risk" value={principal.riskTolerance} />
      </div>
    </Panel>
  );
}

function TeamRatingsPanel({
  ratings,
  academyUsed,
}: {
  ratings: TeamOrganizationRatings;
  academyUsed: number;
}) {
  const capacity = calculateAcademyCapacity(ratings);
  const rows: { label: string; value: number }[] = [
    { label: 'Car Performance', value: ratings.carPerformance },
    { label: 'Research', value: ratings.research },
    { label: 'Facilities', value: ratings.facilities },
    { label: 'Financial Stability', value: ratings.financialStability },
    { label: 'Staff Quality', value: ratings.staffQuality },
    { label: 'Driver Appeal', value: ratings.driverAppeal },
    { label: 'Sponsor Appeal', value: ratings.sponsorAppeal },
    { label: 'Operations', value: ratings.operations },
    { label: 'Reliability Dept', value: ratings.reliabilityDepartment },
    { label: 'Pit Crew', value: ratings.pitCrew },
    { label: 'Marketing', value: ratings.marketing },
    { label: 'Fan Support', value: ratings.fanSupport },
    { label: 'Media Reach', value: ratings.mediaReach },
    { label: 'Scouting', value: ratings.scouting },
    { label: 'Youth Academy', value: ratings.youthAcademy },
  ];
  return (
    <Panel
      title="Team Rating"
      actions={
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-black text-amber-400">{ratings.overallTeamRating}</span>
          <span className="text-xs text-neutral-500">/ 100</span>
        </div>
      }
    >
      <div className="mb-3 flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-sm">
        <span className="text-neutral-400">Academy Capacity</span>
        <span className="font-semibold text-neutral-100">
          {academyUsed} / {capacity} slot{capacity === 1 ? '' : 's'}
        </span>
      </div>
      <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2 text-xs">
            <span className="w-28 shrink-0 text-neutral-400">{r.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-800">
              <div className="h-full bg-sky-500" style={{ width: `${r.value}%` }} />
            </div>
            <span className="w-6 text-right tabular-nums text-neutral-300">{r.value}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-neutral-500">{label}</span>
      <span className="truncate font-medium text-neutral-200">{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900/40 px-2 py-1 text-center">
      <div className="text-sm font-bold text-neutral-100">{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-neutral-500">{label}</div>
    </div>
  );
}

function QuickActionButton({
  label,
  route,
  navigate,
  mode,
}: {
  label: string;
  route: string;
  navigate: (path: string) => void;
  mode: GameMode | undefined;
}) {
  const locked = isRouteRestricted(route, mode);
  return (
    <Button onClick={() => navigate(route)}>
      {locked && <span className="mr-1 text-amber-500">🔒</span>}
      {label}
    </Button>
  );
}
