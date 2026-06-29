// Tire, fuel & weather strategy (Living Universe Phase 1 — types only).
//
// Deeper race strategy: tyre compounds with wear behaviours, fuel/refuelling
// strategy (relevant for ~1994-2009 F1), and probabilistic weather forecasts the
// player and AI must gamble on. These feed the live race sim and AI strategy.

export type TireCompound = {
  id: string;
  name: string;
  grip: number; // 1-10 peak grip
  durability: number; // 1-10 wear resistance
  warmup: number; // 1-10 ease of getting into window
  wetPerformance?: number; // 1-10, present for inter/wet compounds
};

export type TireConditionIssue =
  | 'Graining'
  | 'Blistering'
  | 'FlatSpot'
  | 'Overheating'
  | 'ColdSurface';

// Live tyre state for a car during a stint (used by the sim layer later).
export type TireState = {
  compoundId: string;
  wear: number; // 0-1, 1 = fully worn
  temperature: number; // 0-100 relative to window
  issues: TireConditionIssue[];
  lapsOnSet: number;
};

export type FuelStrategy = {
  startingFuelLaps: number; // laps of fuel at the start
  plannedStops: number;
  refuelAmounts: number[]; // laps of fuel added at each stop
  fuelSaveTarget?: number; // 0-1 lift-and-coast severity
};

export type WeatherSegment = {
  lapStart: number;
  lapEnd: number;
  rainChance: number; // 0-1
  expectedCondition: string; // 'Dry' | 'Damp' | 'Wet' | 'Mixed' ...
};

export type WeatherForecast = {
  confidence: number; // 0-1 forecast reliability
  segments: WeatherSegment[];
};

// A complete strategy plan for one car/driver in a race, combining tyre, fuel
// and the forecast it was built against.
export type RaceStrategyPlan = {
  driverId: string;
  stints: Array<{ compoundId: string; plannedLaps: number }>;
  fuel: FuelStrategy;
  builtForForecast?: WeatherForecast;
};
