import { writeFileSync } from 'node:fs';
import { availableSeasons, getTrackById, loadSeasonBundle } from '../src/data';

type RowBundle = {
  seasons: Array<{ Season: number; Series: string; Label: string }>;
  Calendar: Array<Record<string, unknown>>;
  Standings: Array<Record<string, unknown>>;
  Team_Entries: Array<Record<string, unknown>>;
  Driver_Ratings: Array<Record<string, unknown>>;
  Car_Ratings: Array<Record<string, unknown>>;
  Track_Ratings: Array<Record<string, unknown>>;
  Coverage: Array<Record<string, unknown>>;
};

const rows: RowBundle = {
  seasons: [],
  Calendar: [],
  Standings: [],
  Team_Entries: [],
  Driver_Ratings: [],
  Car_Ratings: [],
  Track_Ratings: [],
  Coverage: [],
};

for (const season of availableSeasons) {
  const bundle = await loadSeasonBundle(season.year, season.series);
  if (!bundle) continue;

  rows.seasons.push({ Season: season.year, Series: season.series, Label: season.label });

  const teamById = new Map(bundle.teams.map((team) => [team.id, team]));
  const carByTeamId = new Map(bundle.cars.map((car) => [car.teamId, car]));
  const seenTrackIds = new Set<string>();

  for (const [index, race] of bundle.season.calendar.entries()) {
    rows.Calendar.push({
      Season: season.year,
      Series: season.series,
      Round: race.round ?? index + 1,
      'Race Name': race.gpName,
      Track: race.trackName,
      TrackId: race.trackId,
      Laps: race.laps,
      DistanceKm: race.distanceKm ?? null,
    });

    if (!seenTrackIds.has(race.trackId)) {
      seenTrackIds.add(race.trackId);
      const track = getTrackById(race.trackId);
      rows.Track_Ratings.push({
        Season: season.year,
        Series: season.series,
        Track: track?.name ?? race.trackName,
        TrackId: race.trackId,
        Archetype: track?.archetype ?? '',
        corners: track?.attributes.corners ?? null,
        braking: track?.attributes.braking ?? null,
        straights: track?.attributes.straights ?? null,
        tractionAcceleration: track?.attributes.tractionAcceleration ?? null,
        elevationBlindCorners: track?.attributes.elevationBlindCorners ?? null,
        technical: track?.attributes.technical ?? null,
        overtakingRacecraft: track?.attributes.overtakingRacecraft ?? null,
        surfaceGripBumpiness: track?.attributes.surfaceGripBumpiness ?? null,
        riskWallProximity: track?.attributes.riskWallProximity ?? null,
        enduranceConsistency: track?.attributes.enduranceConsistency ?? null,
      });
    }
  }

  for (const driver of bundle.drivers) {
    const team = teamById.get(driver.teamId);
    rows.Driver_Ratings.push({
      Season: season.year,
      Series: season.series,
      Driver: driver.name,
      Team: team?.name ?? '',
      'Championship Position': '',
      Points: '',
      cornering: driver.ratings.cornering,
      braking: driver.ratings.braking,
      straights: driver.ratings.straights,
      tractionAcceleration: driver.ratings.tractionAcceleration,
      elevationBlindCorners: driver.ratings.elevationBlindCorners,
      technical: driver.ratings.technical,
      overtakingRacecraft: driver.ratings.overtakingRacecraft,
      surfaceGripBumpiness: driver.ratings.surfaceGripBumpiness,
      riskManagement: driver.ratings.riskManagement,
      enduranceConsistency: driver.ratings.enduranceConsistency,
      qualifying: driver.ratings.qualifying,
      racePace: driver.ratings.racePace,
      adaptability: driver.ratings.adaptability,
      aggression: driver.ratings.aggression,
      composure: driver.ratings.composure,
      overall: driver.ratings.overall,
    });

    rows.Team_Entries.push({
      Season: season.year,
      Series: season.series,
      Team: team?.name ?? '',
      'Car#': driver.number,
      Driver: driver.name,
      Chassis: '',
      Engine: '',
    });

    rows.Standings.push({
      Season: season.year,
      Series: season.series,
      Driver: driver.name,
      Team: team?.name ?? '',
      'Championship Position': '',
      Points: '',
    });
  }

  for (const team of bundle.teams) {
    rows.Car_Ratings.push({
      Season: season.year,
      Series: season.series,
      Team: team.name,
      enginePower: carByTeamId.get(team.id)?.ratings.enginePower ?? null,
      aeroEfficiency: carByTeamId.get(team.id)?.ratings.aeroEfficiency ?? null,
      mechanicalGrip: carByTeamId.get(team.id)?.ratings.mechanicalGrip ?? null,
      reliability: carByTeamId.get(team.id)?.ratings.reliability ?? null,
      pitCrewOperations: carByTeamId.get(team.id)?.ratings.pitCrewOperations ?? null,
    });
  }

  rows.Coverage.push({
    Season: season.year,
    Series: season.series,
    CalendarRows: bundle.season.calendar.length,
    StandingsRows: bundle.drivers.length,
    TeamEntriesRows: bundle.drivers.length,
    DriverRatingsRows: bundle.drivers.length,
    CarRatingsRows: bundle.teams.length,
    TrackRatingsRows: seenTrackIds.size,
  });
}

writeFileSync('/home/ubuntu/MOTORSPORT_MASTER_ALL_SEASONS.json', JSON.stringify(rows));
