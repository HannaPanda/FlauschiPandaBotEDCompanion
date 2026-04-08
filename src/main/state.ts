import { EDState, DEFAULT_STATE, RouteEntry, ExobioScan, BodySignals } from './types';

type StateChangeListener = (state: EDState) => void;

class StateManager {
  private state: EDState = {
    ...DEFAULT_STATE,
    activeExobioScans: [],
    bodySignals: [],
  };
  private listeners: StateChangeListener[] = [];

  get(): EDState {
    return {
      ...this.state,
      activeExobioScans: [...this.state.activeExobioScans],
      bodySignals: [...this.state.bodySignals],
    };
  }

  update(partial: Partial<EDState>): void {
    this.state = { ...this.state, ...partial };
    this.recompute();
    this.emit();
  }

  private recompute(): void {
    if (this.state.fuelCapacity > 0) {
      this.state.fuelPercent = (this.state.fuelCurrent / this.state.fuelCapacity) * 100;
    }
    const { nextScoopableIn, estimatedFuelToNextScoop } = this.computeScoopLookahead();
    this.state.nextScoopableIn = nextScoopableIn;
    this.state.estimatedFuelToNextScoop = estimatedFuelToNextScoop;
  }

  private computeScoopLookahead(): { nextScoopableIn: number; estimatedFuelToNextScoop: number } {
    const { route, fuelCurrent, lastFuelUsed, jumpRangeMax } = this.state;
    if (!route.length || lastFuelUsed <= 0) {
      return { nextScoopableIn: 0, estimatedFuelToNextScoop: fuelCurrent };
    }
    let simulatedFuel = fuelCurrent;
    const fuelPerHop = lastFuelUsed > 0 ? lastFuelUsed : jumpRangeMax * 0.3;
    for (let i = 0; i < route.length; i++) {
      const hop = route[i];
      if (hop.scoopable) {
        return { nextScoopableIn: i, estimatedFuelToNextScoop: simulatedFuel };
      }
      simulatedFuel -= fuelPerHop;
    }
    return { nextScoopableIn: route.length, estimatedFuelToNextScoop: simulatedFuel };
  }

  setRoute(entries: RouteEntry[]): void {
    this.state.route = entries;
    this.state.remainingJumps = entries.length;
    this.recompute();
    this.emit();
  }

  clearRoute(): void {
    this.state.route = [];
    this.state.remainingJumps = 0;
    this.recompute();
    this.emit();
  }

  // --- Exobio ---

  upsertExobioScan(scan: ExobioScan): void {
    const idx = this.state.activeExobioScans.findIndex(
      (s) => s.species === scan.species && s.bodyID === scan.bodyID
    );
    if (idx >= 0) {
      this.state.activeExobioScans[idx] = scan;
    } else {
      this.state.activeExobioScans = [...this.state.activeExobioScans, scan];
    }
    if (scan.completed) {
      // Keep completed scans for the session but mark them
    }
    this.emit();
  }

  clearCompletedExobioScans(): void {
    this.state.activeExobioScans = this.state.activeExobioScans.filter((s) => !s.completed);
    this.emit();
  }

  // --- Body signals cache ---

  setBodySignals(signals: BodySignals): void {
    const idx = this.state.bodySignals.findIndex((b) => b.bodyID === signals.bodyID);
    if (idx >= 0) {
      this.state.bodySignals[idx] = signals;
    } else {
      this.state.bodySignals = [...this.state.bodySignals, signals];
    }
    this.emit();
  }

  clearSystemData(): void {
    this.state.bodySignals = [];
    this.state.activeExobioScans = [];
    this.state.fssProgress = 0;
    this.state.fssBodyCount = 0;
    this.state.fssNonBodyCount = 0;
    this.state.currentBody = '';
    this.state.currentBodyID = -1;
    this.emit();
  }

  setWsConnected(connected: boolean): void {
    this.state.wsConnected = connected;
    this.emit();
  }

  onChange(listener: StateChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(): void {
    const snapshot = this.get();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

export const stateManager = new StateManager();
