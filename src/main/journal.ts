import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { SCOOPABLE_CLASSES, RouteEntry, ExobioScan, BodySignals } from './types';
import { stateManager } from './state';
import { wsClient } from './ws-client';
import { computeScoopStatus } from './scoop';
import { AppSettings } from './types';

let currentJournalPath: string | null = null;
let currentWatcher: fs.FSWatcher | null = null;
let lastFileSize = 0;
let fuelWarnedSystems = new Set<string>();

// ─── File discovery ──────────────────────────────────────────────────────────

export function getLatestJournalFile(journalDir: string): string | null {
  try {
    const files = fs.readdirSync(journalDir)
      .filter((f) => f.startsWith('Journal.') && f.endsWith('.log'))
      .sort()
      .reverse();
    return files[0] ? path.join(journalDir, files[0]) : null;
  } catch {
    return null;
  }
}

export function parseNavRoute(journalDir: string): RouteEntry[] {
  const routeFile = path.join(journalDir, 'NavRoute.json');
  try {
    const data = JSON.parse(fs.readFileSync(routeFile, 'utf-8'));
    const route: RouteEntry[] = (data.Route || []).map((entry: any) => ({
      system: entry.StarSystem || entry.Name || '',
      starClass: entry.StarClass || '',
      scoopable: SCOOPABLE_CLASSES.has((entry.StarClass || '').charAt(0).toUpperCase()),
      distanceLy: entry.SystemDistance || 0,
    }));
    return route.slice(1); // skip current system
  } catch {
    return [];
  }
}

// ─── Event dispatcher ────────────────────────────────────────────────────────

function processJournalLine(line: string, settings: AppSettings): void {
  if (!line.trim()) return;
  let event: any;
  try {
    event = JSON.parse(line);
  } catch {
    return;
  }

  switch (event.event) {
    case 'Loadout':             return handleLoadout(event);
    case 'Location':            return handleLocation(event);
    case 'FSDJump':             return handleFSDJump(event, settings);
    case 'StartJump':           return handleStartJump(event);
    case 'FuelScoop':           return handleFuelScoop(event);
    case 'NavRoute':            return handleNavRoute(event);
    case 'NavRouteClear':       return handleNavRouteClear();
    case 'FSSDiscoveryScan':    return handleFSSDiscoveryScan(event);
    case 'FSSBodySignals':      return handleFSSBodySignals(event);
    case 'Scan':                return handleScan(event);
    case 'SAAScanComplete':     return handleSAAScanComplete(event);
    case 'SAASignalsFound':     return handleSAASignalsFound(event);
    case 'ScanOrganic':         return handleScanOrganic(event);
    case 'CodexEntry':          return handleCodexEntry(event);
    case 'ApproachBody':        return handleApproachBody(event);
    case 'LeaveBody':           return handleLeaveBody(event);
    case 'Touchdown':           return handleTouchdown(event);
    case 'Liftoff':             return handleLiftoff(event);
    case 'SellExplorationData': return handleSellExploration(event);
    case 'MultiSellExplorationData': return handleSellExploration(event);
  }
}

// ─── Ship / session ──────────────────────────────────────────────────────────

function handleLoadout(e: any): void {
  stateManager.update({
    fuelCapacity:  e.FuelCapacity?.Main    ?? 0,
    fuelReserve:   e.FuelCapacity?.Reserve ?? 0,
    fuelCurrent:   Math.min(
      stateManager.get().fuelCurrent || (e.FuelCapacity?.Main ?? 0),
      e.FuelCapacity?.Main ?? 0
    ),
    shipName:      e.ShipName || e.Ship || '',
    shipType:      e.Ship     || '',
    jumpRangeMax:  e.MaxJumpRange || 0,
  });
}

// ─── Location (game load / carrier jump arrival) ─────────────────────────────

function handleLocation(e: any): void {
  stateManager.update({
    currentSystem:    e.StarSystem     || stateManager.get().currentSystem,
    systemAddress:    e.SystemAddress  ?? stateManager.get().systemAddress,
    starPos:          e.StarPos ? { x: e.StarPos[0], y: e.StarPos[1], z: e.StarPos[2] } : stateManager.get().starPos,
    population:       e.Population     ?? 0,
    systemSecurity:   stripLocalisation(e.SystemSecurity)   || '',
    systemEconomy:    stripLocalisation(e.SystemEconomy)     || '',
    systemAllegiance: e.SystemAllegiance || '',
    currentStarClass: (e.StarClass || '').charAt(0).toUpperCase(),
    currentScoopable: SCOOPABLE_CLASSES.has((e.StarClass || '').charAt(0).toUpperCase()),
    currentBody:      e.Body       || '',
    currentBodyID:    e.BodyID     ?? -1,
  });
}

// ─── Jump ─────────────────────────────────────────────────────────────────────

function handleStartJump(e: any): void {
  if (e.JumpType !== 'Hyperspace') return;

  const state = stateManager.get();
  if (state.isScooping) flushScoopingCompleted();

  wsClient.sendEvent('jump_started', {
    // Target system info from the route
    system:    e.StarSystem || '',
    starClass: e.StarClass  || '',
  });
}

function handleFSDJump(e: any, settings: AppSettings): void {
  const fuelCurrent = e.FuelLevel  ?? stateManager.get().fuelCurrent;
  const fuelUsed    = e.FuelUsed   ?? 0;
  const newSystem   = e.StarSystem || stateManager.get().currentSystem;
  const starClass   = (e.StarClass || '').charAt(0).toUpperCase();
  const scoopable   = SCOOPABLE_CLASSES.has(starClass);

  fuelWarnedSystems.delete(stateManager.get().currentSystem);

  stateManager.clearSystemData();
  stateManager.update({
    currentSystem:    newSystem,
    systemAddress:    e.SystemAddress   ?? 0,
    starPos:          e.StarPos ? { x: e.StarPos[0], y: e.StarPos[1], z: e.StarPos[2] } : null,
    population:       e.Population      ?? 0,
    systemSecurity:   stripLocalisation(e.SystemSecurity)   || '',
    systemEconomy:    stripLocalisation(e.SystemEconomy)     || '',
    systemAllegiance: e.SystemAllegiance || '',
    fuelCurrent,
    lastFuelUsed:     fuelUsed,
    currentStarClass: starClass,
    currentScoopable: scoopable,
    currentBody:      e.Body   || newSystem,
    currentBodyID:    e.BodyID ?? 0,
    isScooping:       false,
    fuelScoopedThisStop: 0,
  });

  const state = stateManager.get();
  if (state.route.length > 0) {
    stateManager.setRoute(state.route.slice(1));
  }

  wsClient.sendEvent('jump_completed', {
    // ── System ──
    system:           newSystem,
    systemAddress:    e.SystemAddress   ?? 0,
    starPos:          e.StarPos         ? { x: e.StarPos[0], y: e.StarPos[1], z: e.StarPos[2] } : null,
    population:       e.Population      ?? 0,
    systemSecurity:   stripLocalisation(e.SystemSecurity)   || '',
    systemEconomy:    stripLocalisation(e.SystemEconomy)     || '',
    systemAllegiance: e.SystemAllegiance || '',
    // ── Arrival star ──
    starClass,
    scoopable,
    bodyName:         e.Body   || newSystem,
    bodyID:           e.BodyID ?? 0,
    // ── Fuel ──
    fuelUsed,
    fuelRemaining:    fuelCurrent,
    fuelPercent:      stateManager.get().fuelPercent,
    // ── Route context ──
    remainingJumps:   stateManager.get().remainingJumps,
    jumpDist:         e.JumpDist ?? 0,
  });

  checkFuelWarning(settings);
}

// ─── Fuel scooping ───────────────────────────────────────────────────────────

function handleFuelScoop(e: any): void {
  const state       = stateManager.get();
  const fuelCurrent = e.Total   ?? state.fuelCurrent;
  const scooped     = e.Scooped ?? 0;
  const wasScooping = state.isScooping;

  stateManager.update({
    fuelCurrent,
    isScooping:          true,
    fuelScoopedThisStop: (state.fuelScoopedThisStop || 0) + scooped,
  });

  if (!wasScooping) {
    wsClient.sendEvent('scooping_started', {
      system:          state.currentSystem,
      fuelBeforeScoop: state.fuelCurrent,
    });
  }
  scheduleScoopingCompleted();
}

let scoopCompletedTimer: NodeJS.Timeout | null = null;

function scheduleScoopingCompleted(): void {
  if (scoopCompletedTimer) clearTimeout(scoopCompletedTimer);
  scoopCompletedTimer = setTimeout(flushScoopingCompleted, 2000);
}

function flushScoopingCompleted(): void {
  if (scoopCompletedTimer) { clearTimeout(scoopCompletedTimer); scoopCompletedTimer = null; }
  const state = stateManager.get();
  if (!state.isScooping) return;
  const fuelScooped = state.fuelScoopedThisStop;
  stateManager.update({ isScooping: false, fuelScoopedThisStop: 0 });
  wsClient.sendEvent('scooping_completed', {
    fuelScooped,
    fuelFinal:   state.fuelCurrent,
    fuelPercent: state.fuelPercent,
  });
}

// ─── Route ───────────────────────────────────────────────────────────────────

function handleNavRoute(e: any): void {
  const journalDir = path.dirname(currentJournalPath || '');
  const route = parseNavRoute(journalDir);

  if (route.length > 0) {
    stateManager.setRoute(route);
    const dest     = route[route.length - 1];
    const totalDist = route.reduce((acc, r) => acc + r.distanceLy, 0);
    wsClient.sendEvent('route_set', {
      destination:             dest.system,
      totalJumps:              route.length,
      totalDistanceLy:         totalDist,
      firstUnscoopableStretch: computeFirstUnscoopableStretch(route),
      route: route.map((r) => ({
        system:     r.system,
        starClass:  r.starClass,
        scoopable:  r.scoopable,
        distanceLy: r.distanceLy,
      })),
    });
  } else {
    stateManager.clearRoute();
    wsClient.sendEvent('route_cleared', {});
  }
}

function handleNavRouteClear(): void {
  stateManager.clearRoute();
  wsClient.sendEvent('route_cleared', {});
}

// ─── FSS Discovery Scan (Honk) ───────────────────────────────────────────────

function handleFSSDiscoveryScan(e: any): void {
  stateManager.update({
    fssProgress:     e.Progress     ?? stateManager.get().fssProgress,
    fssBodyCount:    e.BodyCount    ?? stateManager.get().fssBodyCount,
    fssNonBodyCount: e.NonBodyCount ?? stateManager.get().fssNonBodyCount,
  });

  wsClient.sendEvent('fss_discovery_scan', {
    system:        e.SystemName    || stateManager.get().currentSystem,
    systemAddress: e.SystemAddress ?? stateManager.get().systemAddress,
    // 0.0–1.0, multiply by 100 for percent
    progress:      e.Progress      ?? 0,
    bodyCount:     e.BodyCount     ?? 0,
    nonBodyCount:  e.NonBodyCount  ?? 0,
    // Derived: true when all bodies resolved
    complete:      (e.Progress ?? 0) >= 1.0,
  });
}

// ─── FSS Body Signals (biological/geological signals from FSS) ───────────────

function handleFSSBodySignals(e: any): void {
  const signals: BodySignals = buildBodySignals(e);
  stateManager.setBodySignals(signals);

  if (signals.biologicalCount > 0) {
    wsClient.sendEvent('fss_body_signals', {
      system:        stateManager.get().currentSystem,
      systemAddress: e.SystemAddress ?? stateManager.get().systemAddress,
      bodyName:      e.BodyName  || '',
      bodyID:        e.BodyID    ?? -1,
      biologicalCount: signals.biologicalCount,
      geologicalCount: signals.geologicalCount,
      otherSignals:    signals.otherSignals,
      // Genuses NOT available in FSSBodySignals – only in SAASignalsFound
      genuses: [],
    });
  }
}

// ─── Detailed body Scan (FSS / auto) ─────────────────────────────────────────

function handleScan(e: any): void {
  // AutoScan = arrived in system, Detailed = FSS-scanned, NavBeaconDetail = nav beacon
  // We forward all types; server can filter by scanType

  const isStar   = !!e.StarType;
  const isValuable = !e.WasDiscovered || !e.WasMapped;

  wsClient.sendEvent('body_scanned', {
    system:        stateManager.get().currentSystem,
    systemAddress: e.SystemAddress ?? stateManager.get().systemAddress,
    scanType:      e.ScanType || 'AutoScan',
    bodyName:      e.BodyName || '',
    bodyID:        e.BodyID   ?? -1,
    // ── Flags ──
    isStar,
    wasDiscovered: e.WasDiscovered ?? true,
    wasMapped:     e.WasMapped     ?? true,
    // First-discovery / first-map bonus available when false
    firstDiscovery: e.WasDiscovered === false,
    firstMap:       e.WasMapped     === false,
    // ── Stars ──
    starType:      e.StarType   || null,
    stellarMass:   e.StellarMass ?? null,
    // ── Planets / moons ──
    planetClass:        e.PlanetClass       || null,
    terraformState:     e.TerraformState    || null,   // '' | 'Terraformable' | 'Terraformed' | 'Candidate for terraforming'
    atmosphere:         e.Atmosphere        || null,
    atmosphereType:     e.AtmosphereType    || null,
    volcanism:          e.Volcanism         || null,
    landable:           e.Landable          ?? null,
    massEM:             e.MassEM            ?? null,   // Earth masses
    radius:             e.Radius            ?? null,   // metres
    surfaceGravity:     e.SurfaceGravity    ?? null,   // m/s² (divide by 9.81 for g)
    surfaceTemperature: e.SurfaceTemperature ?? null,  // Kelvin
    surfacePressure:    e.SurfacePressure   ?? null,   // Pascals
    // ── Rings / reserves ──
    reserveLevel: e.ReserveLevel || null,
    hasRings:     Array.isArray(e.Rings) && e.Rings.length > 0,
  });
}

// ─── SAA Scan Complete (planet fully mapped with DSS) ────────────────────────

function handleSAAScanComplete(e: any): void {
  const efficient = typeof e.ProbesUsed === 'number' && typeof e.EfficiencyTarget === 'number'
    ? e.ProbesUsed <= e.EfficiencyTarget
    : false;

  wsClient.sendEvent('body_mapped', {
    system:        stateManager.get().currentSystem,
    systemAddress: e.SystemAddress ?? stateManager.get().systemAddress,
    bodyName:      e.BodyName          || '',
    bodyID:        e.BodyID            ?? -1,
    probesUsed:    e.ProbesUsed        ?? 0,
    efficiencyTarget: e.EfficiencyTarget ?? 0,
    // true = 3× payout bonus
    efficient,
  });
}

// ─── SAA Signals Found (detailed biological/geological list after DSS) ────────

function handleSAASignalsFound(e: any): void {
  const signals: BodySignals = buildBodySignals(e);
  // SAASignalsFound includes Genuses, unlike FSSBodySignals
  if (e.Genuses && Array.isArray(e.Genuses)) {
    signals.genuses = e.Genuses.map((g: any) => ({
      genus:          g.Genus          || '',
      genusLocalised: g.Genus_Localised || g.Genus || '',
    }));
  }
  stateManager.setBodySignals(signals);

  if (signals.biologicalCount > 0) {
    wsClient.sendEvent('surface_signals_found', {
      system:        stateManager.get().currentSystem,
      systemAddress: e.SystemAddress ?? stateManager.get().systemAddress,
      bodyName:      e.BodyName || '',
      bodyID:        e.BodyID   ?? -1,
      biologicalCount: signals.biologicalCount,
      geologicalCount: signals.geologicalCount,
      otherSignals:    signals.otherSignals,
      // Exact genus list – available here (not in FSSBodySignals)
      genuses:         signals.genuses,
    });
  }
}

// ─── Exobiology scans ────────────────────────────────────────────────────────

function handleScanOrganic(e: any): void {
  const state      = stateManager.get();
  const sampleMap  = { Log: 1, Sample: 2, Analyse: 3 } as const;
  const sampleNum  = sampleMap[e.ScanType as keyof typeof sampleMap] ?? 1;
  const completed  = e.ScanType === 'Analyse';

  const scan: ExobioScan = {
    genus:            e.Genus            || '',
    genusLocalised:   e.Genus_Localised  || e.Genus   || '',
    species:          e.Species          || '',
    speciesLocalised: e.Species_Localised || e.Species || '',
    variant:          e.Variant          || '',
    variantLocalised: e.Variant_Localised || e.Variant || '',
    bodyName:         state.currentBody,
    bodyID:           state.currentBodyID,
    samplesCollected: sampleNum,
    completed,
  };

  stateManager.upsertExobioScan(scan);

  if (!completed) {
    wsClient.sendEvent('exobio_sample', {
      system:        state.currentSystem,
      systemAddress: state.systemAddress,
      bodyName:      scan.bodyName,
      bodyID:        scan.bodyID,
      // Which sample in the sequence (1 = first, 2 = second, 3 = analysis)
      sampleNumber:  sampleNum,
      scanType:      e.ScanType,
      genus:            scan.genus,
      genusLocalised:   scan.genusLocalised,
      species:          scan.species,
      speciesLocalised: scan.speciesLocalised,
      variant:          scan.variant,
      variantLocalised: scan.variantLocalised,
      // Remaining samples needed until complete
      samplesRemaining: 3 - sampleNum,
    });
  } else {
    wsClient.sendEvent('exobio_complete', {
      system:        state.currentSystem,
      systemAddress: state.systemAddress,
      bodyName:      scan.bodyName,
      bodyID:        scan.bodyID,
      genus:            scan.genus,
      genusLocalised:   scan.genusLocalised,
      species:          scan.species,
      speciesLocalised: scan.speciesLocalised,
      variant:          scan.variant,
      variantLocalised: scan.variantLocalised,
      // Value lookup needs to happen server-side using species name
    });
  }
}

// ─── Codex entry (new discovery) ─────────────────────────────────────────────

function handleCodexEntry(e: any): void {
  if (!e.IsNewEntry) return; // only care about first discoveries

  wsClient.sendEvent('codex_new_entry', {
    system:        e.System        || stateManager.get().currentSystem,
    systemAddress: e.SystemAddress ?? stateManager.get().systemAddress,
    bodyID:        e.BodyID        ?? -1,
    entryID:       e.EntryID,
    name:          e.Name          || '',
    nameLocalised: e.Name_Localised || e.Name || '',
    category:      stripLocalisation(e.Category) || '',
    subCategory:   stripLocalisation(e.SubCategory) || '',
    // true = voucher reward for first discovery
    newTraitsDiscovered: e.NewTraitsDiscovered ?? false,
  });
}

// ─── Body approach / leave ───────────────────────────────────────────────────

function handleApproachBody(e: any): void {
  stateManager.update({
    currentBody:   e.Body   || '',
    currentBodyID: e.BodyID ?? -1,
  });

  wsClient.sendEvent('approach_body', {
    system:        e.StarSystem    || stateManager.get().currentSystem,
    systemAddress: e.SystemAddress ?? stateManager.get().systemAddress,
    bodyName:      e.Body          || '',
    bodyID:        e.BodyID        ?? -1,
    bodyType:      e.BodyType      || '',
    // Check cached signals for this body
    bodySignals:   stateManager.get().bodySignals.find((b) => b.bodyID === (e.BodyID ?? -1)) ?? null,
  });
}

function handleLeaveBody(e: any): void {
  stateManager.update({ currentBody: '', currentBodyID: -1 });

  wsClient.sendEvent('leave_body', {
    system:        e.StarSystem    || stateManager.get().currentSystem,
    systemAddress: e.SystemAddress ?? stateManager.get().systemAddress,
    bodyName:      e.Body          || '',
    bodyID:        e.BodyID        ?? -1,
    bodyType:      e.BodyType      || '',
  });
}

// ─── Touchdown / Liftoff ─────────────────────────────────────────────────────

function handleTouchdown(e: any): void {
  wsClient.sendEvent('touchdown', {
    system:        stateManager.get().currentSystem,
    systemAddress: stateManager.get().systemAddress,
    bodyName:      e.Body          || stateManager.get().currentBody,
    bodyID:        e.BodyID        ?? stateManager.get().currentBodyID,
    bodyType:      e.BodyType      || '',
    latitude:      e.Latitude      ?? null,
    longitude:     e.Longitude     ?? null,
    // true = player landed, false = NPC/fleet carrier
    playerControlled: e.PlayerControlled ?? true,
    // Nearest port if landed at settlement
    nearestDest:   e.NearestDestination || null,
    // Check cached signals to know what biomes to expect
    bodySignals: stateManager.get().bodySignals.find((b) => b.bodyID === (e.BodyID ?? -1)) ?? null,
  });
}

function handleLiftoff(e: any): void {
  wsClient.sendEvent('liftoff', {
    system:        stateManager.get().currentSystem,
    systemAddress: stateManager.get().systemAddress,
    bodyName:      e.Body          || stateManager.get().currentBody,
    bodyID:        e.BodyID        ?? stateManager.get().currentBodyID,
    bodyType:      e.BodyType      || '',
    latitude:      e.Latitude      ?? null,
    longitude:     e.Longitude     ?? null,
    playerControlled: e.PlayerControlled ?? true,
    // Summary of completed exobio scans on this body
    completedScans: stateManager.get().activeExobioScans.filter(
      (s) => s.completed && s.bodyID === (e.BodyID ?? -1)
    ),
  });
}

// ─── Exploration data sale ────────────────────────────────────────────────────

function handleSellExploration(e: any): void {
  wsClient.sendEvent('exploration_sold', {
    system:        stateManager.get().currentSystem,
    systemAddress: stateManager.get().systemAddress,
    // Systems in this sale batch (SellExplorationData only)
    systems:       e.Systems    ?? [],
    discovered:    e.Discovered ?? [],
    baseValue:     e.BaseValue     ?? 0,
    bonus:         e.Bonus         ?? 0,
    totalEarnings: e.TotalEarnings ?? 0,
  });
}

// ─── Fuel warning check ───────────────────────────────────────────────────────

function checkFuelWarning(settings: AppSettings): void {
  const state  = stateManager.get();
  const status = computeScoopStatus(state, settings.fuelWarningThreshold);
  const system = state.currentSystem;

  if (fuelWarnedSystems.has(system)) return;

  if (status.level === 'critical') {
    fuelWarnedSystems.add(system);
    wsClient.sendEvent('fuel_critical', {
      fuelPercent:      state.fuelPercent,
      fuelRemaining:    state.fuelCurrent,
      nextScoopableIn:  state.nextScoopableIn,
      estimatedFuelAtScoop: state.estimatedFuelToNextScoop,
      canReachNextScoop:    status.canReachNextScoop,
      nearestScoopable:     status.nearestScoopable,
    });
  } else if (status.level === 'warning') {
    fuelWarnedSystems.add(system);
    wsClient.sendEvent('fuel_warning', {
      fuelPercent:      state.fuelPercent,
      fuelRemaining:    state.fuelCurrent,
      nextScoopableIn:  state.nextScoopableIn,
      nextScoopableSystem:  status.nextScoopableSystem,
      estimatedFuelAtScoop: state.estimatedFuelToNextScoop,
      canReachNextScoop:    status.canReachNextScoop,
    });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeFirstUnscoopableStretch(route: RouteEntry[]): number {
  let stretch = 0;
  for (const hop of route) {
    if (!hop.scoopable) stretch++;
    else break;
  }
  return stretch;
}

/** Strip "$Foo_Bar;" style localisation keys → 'foo_bar' */
function stripLocalisation(value: string | undefined): string {
  if (!value) return '';
  return value.replace(/^\$/, '').replace(/;$/, '').toLowerCase();
}

function buildBodySignals(e: any): BodySignals {
  let bioCount  = 0;
  let geoCount  = 0;
  const other: Array<{ type: string; typeLocalised: string; count: number }> = [];

  for (const sig of (e.Signals ?? [])) {
    const raw = (sig.Type || '') as string;
    if (raw.includes('Biological')) {
      bioCount = sig.Count ?? 0;
    } else if (raw.includes('Geological')) {
      geoCount = sig.Count ?? 0;
    } else {
      other.push({
        type:          stripLocalisation(sig.Type),
        typeLocalised: sig.Type_Localised || stripLocalisation(sig.Type),
        count:         sig.Count ?? 0,
      });
    }
  }

  return {
    bodyName:        e.BodyName || '',
    bodyID:          e.BodyID   ?? -1,
    biologicalCount: bioCount,
    geologicalCount: geoCount,
    otherSignals:    other,
    genuses:         [],
  };
}

// ─── File tailing ────────────────────────────────────────────────────────────

export function tailJournalFile(filePath: string, settings: AppSettings): void {
  if (currentWatcher) { currentWatcher.close(); currentWatcher = null; }

  currentJournalPath = filePath;
  lastFileSize = 0;

  readJournalFrom(filePath, 0, settings, () => {
    lastFileSize = fs.statSync(filePath).size;

    currentWatcher = fs.watch(filePath, () => {
      try {
        const stat = fs.statSync(filePath);
        if (stat.size > lastFileSize) {
          readJournalFrom(filePath, lastFileSize, settings, () => {
            lastFileSize = stat.size;
          });
        }
      } catch { /* rotated */ }
    });
  });
}

function readJournalFrom(
  filePath: string,
  start: number,
  settings: AppSettings,
  done: () => void
): void {
  const stream = fs.createReadStream(filePath, { start, encoding: 'utf-8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  rl.on('line', (line) => processJournalLine(line, settings));
  rl.on('close', done);
  rl.on('error', done);
}

export function stopJournalTail(): void {
  if (currentWatcher) { currentWatcher.close(); currentWatcher = null; }
  currentJournalPath = null;
}
