export interface AppSettings {
  journalPath: string;
  wsEnabled: boolean;
  wsUrl: string;
  wsSecret: string;
  fuelWarningThreshold: number;
  fuelLookaheadHops: number;
  alwaysOnTop: boolean;
  opacity: number;
  windowBounds: { x: number; y: number; w: number; h: number };
}

export interface RouteEntry {
  system: string;
  starClass: string;
  scoopable: boolean;
  distanceLy: number;
}

export interface StarPos {
  x: number;
  y: number;
  z: number;
}

// One active exobio scan in progress (up to 3 samples per species)
export interface ExobioScan {
  genus: string;
  genusLocalised: string;
  species: string;
  speciesLocalised: string;
  variant: string;
  variantLocalised: string;
  bodyName: string;
  bodyID: number;
  samplesCollected: number; // 1 = Log, 2 = Sample, 3 = Analyse (complete)
  completed: boolean;
}

// Biological/geological signals found on a body via FSS or DSS
export interface BodySignals {
  bodyName: string;
  bodyID: number;
  biologicalCount: number;
  geologicalCount: number;
  otherSignals: Array<{ type: string; typeLocalised: string; count: number }>;
  genuses: Array<{ genus: string; genusLocalised: string }>;
}

export interface EDState {
  // Navigation
  currentSystem: string;
  systemAddress: number;
  starPos: StarPos | null;
  population: number;
  systemSecurity: string;
  systemEconomy: string;
  systemAllegiance: string;

  // Fuel
  fuelCurrent: number;
  fuelCapacity: number;
  fuelPercent: number;
  fuelReserve: number;
  lastFuelUsed: number;
  isScooping: boolean;
  fuelScoopedThisStop: number;

  // Route
  remainingJumps: number;
  route: RouteEntry[];
  nextScoopableIn: number;
  estimatedFuelToNextScoop: number;

  // Ship
  shipName: string;
  shipType: string;
  jumpRangeCurrent: number;
  jumpRangeMax: number;

  // Current star/body
  currentStarClass: string;
  currentScoopable: boolean;
  currentBody: string;
  currentBodyID: number;

  // FSS progress
  fssProgress: number;
  fssBodyCount: number;
  fssNonBodyCount: number;

  // Exobiology
  activeExobioScans: ExobioScan[];

  // Body signals cache (keyed by bodyID)
  bodySignals: BodySignals[];

  // WebSocket
  wsConnected: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  journalPath: '',
  wsEnabled: false,
  wsUrl: 'wss://flauschipandabot.de/ed-integration',
  wsSecret: '',
  fuelWarningThreshold: 30,
  fuelLookaheadHops: 10,
  alwaysOnTop: true,
  opacity: 0.9,
  windowBounds: { x: 100, y: 100, w: 420, h: 620 },
};

export const SCOOPABLE_CLASSES = new Set(['K', 'G', 'B', 'F', 'O', 'A', 'M']);

export const DEFAULT_STATE: EDState = {
  currentSystem: 'Unknown',
  systemAddress: 0,
  starPos: null,
  population: 0,
  systemSecurity: '',
  systemEconomy: '',
  systemAllegiance: '',
  fuelCurrent: 0,
  fuelCapacity: 0,
  fuelPercent: 0,
  fuelReserve: 0,
  lastFuelUsed: 0,
  isScooping: false,
  fuelScoopedThisStop: 0,
  remainingJumps: 0,
  route: [],
  nextScoopableIn: 0,
  estimatedFuelToNextScoop: 0,
  shipName: '',
  shipType: '',
  jumpRangeCurrent: 0,
  jumpRangeMax: 0,
  currentStarClass: '',
  currentScoopable: false,
  currentBody: '',
  currentBodyID: -1,
  fssProgress: 0,
  fssBodyCount: 0,
  fssNonBodyCount: 0,
  activeExobioScans: [],
  bodySignals: [],
  wsConnected: false,
};
