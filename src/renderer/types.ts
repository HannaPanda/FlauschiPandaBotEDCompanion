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

export interface ExobioScan {
  genus: string;
  genusLocalised: string;
  species: string;
  speciesLocalised: string;
  variant: string;
  variantLocalised: string;
  bodyName: string;
  bodyID: number;
  samplesCollected: number;
  completed: boolean;
}

export interface BodySignals {
  bodyName: string;
  bodyID: number;
  biologicalCount: number;
  geologicalCount: number;
  otherSignals: Array<{ type: string; typeLocalised: string; count: number }>;
  genuses: Array<{ genus: string; genusLocalised: string }>;
}

export interface EDState {
  currentSystem: string;
  systemAddress: number;
  starPos: StarPos | null;
  population: number;
  systemSecurity: string;
  systemEconomy: string;
  systemAllegiance: string;
  fuelCurrent: number;
  fuelCapacity: number;
  fuelPercent: number;
  fuelReserve: number;
  lastFuelUsed: number;
  isScooping: boolean;
  fuelScoopedThisStop: number;
  remainingJumps: number;
  route: RouteEntry[];
  nextScoopableIn: number;
  estimatedFuelToNextScoop: number;
  shipName: string;
  shipType: string;
  jumpRangeCurrent: number;
  jumpRangeMax: number;
  currentStarClass: string;
  currentScoopable: boolean;
  currentBody: string;
  currentBodyID: number;
  fssProgress: number;
  fssBodyCount: number;
  fssNonBodyCount: number;
  activeExobioScans: ExobioScan[];
  bodySignals: BodySignals[];
  wsConnected: boolean;
}

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

declare global {
  interface Window {
    edApi: {
      getSettings: () => Promise<AppSettings>;
      saveSettings: (s: AppSettings) => Promise<void>;
      testWs: (url: string, secret: string) => Promise<{ success: boolean; message: string }>;
      detectPath: () => Promise<string>;
      verifyPath: (p: string) => Promise<boolean>;
      minimize: () => Promise<void>;
      closeWindow: () => Promise<void>;
      onStateUpdate: (cb: (state: EDState) => void) => () => void;
      onWsStatus: (cb: (status: string) => void) => () => void;
    };
  }
}
