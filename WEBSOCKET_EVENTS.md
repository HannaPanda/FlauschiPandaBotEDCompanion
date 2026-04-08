# ED Companion – WebSocket Events Reference

All messages follow the envelope:

```json
{
  "type": "<event_type>",
  "timestamp": "2025-01-01T12:00:00.000Z",
  "payload": { ... }
}
```

State updates are debounced (500 ms). All other events fire immediately unless noted.

---

## Authentication

```json
// Client → Server (on connect)
{ "type": "auth", "secret": "...", "plugin": "elite-dangerous" }

// Server → Client (required before any events flow)
{ "type": "auth_ok" }
```

---

## Navigation

### `jump_started`
Fired when the FSD countdown begins (player commits to a jump).
Useful for: pre-jump UI, disabling route edits, clearing stale body data.

```json
{
  "system":    "Sagittarius A*",   // Target system name
  "starClass": "Bh"                // Target star class (first char)
}
```

---

### `jump_completed`
Fired on arrival in the new system. This is the richest system-context event.
Useful for: updating system display, fuel management, Exobio eligibility checks, route progress.

```json
{
  // ── System identity ──
  "system":           "Scheau Flyuae AA-A h1",
  "systemAddress":    1234567890,        // Unique 64-bit system ID (use for EDSM/Spansh lookups)
  "starPos":          { "x": 25.3, "y": -18.6, "z": 9100.0 }, // Galactic coords in ly

  // ── System properties ──
  "population":       0,                 // 0 = uninhabited → good for exploration/exobio
  "systemSecurity":   "high",            // "high" | "medium" | "low" | "anarchy" | ""
  "systemEconomy":    "agriculture",     // Primary economy type
  "systemAllegiance": "Federation",      // "" for uncolonised

  // ── Arrival star ──
  "starClass":        "K",               // Single char, e.g. K G B F O A M T Y etc.
  "scoopable":        true,              // true if starClass ∈ {K G B F O A M}
  "bodyName":         "Scheau Flyuae AA-A h1",
  "bodyID":           0,

  // ── Fuel ──
  "fuelUsed":         1.42,              // Tonnes used for this jump
  "fuelRemaining":    18.7,              // Tonnes remaining in main tank
  "fuelPercent":      74.8,              // Percentage of main tank capacity

  // ── Route context ──
  "remainingJumps":   34,                // Jumps left to plotted destination
  "jumpDist":         42.3               // Actual jump distance in ly
}
```

---

### `route_set`
Fired when a new route is plotted.
Useful for: ETA calculations, fuel planning, unscoopable-stretch warnings.

```json
{
  "destination":             "Beagle Point",
  "totalJumps":              127,
  "totalDistanceLy":         5420.8,
  "firstUnscoopableStretch": 3,   // Consecutive unscoopable hops from current position

  "route": [
    {
      "system":     "Eol Prou RS-T d3-94",
      "starClass":  "M",
      "scoopable":  true,
      "distanceLy": 42.3
    }
    // … up to all hops
  ]
}
```

---

### `route_cleared`
Fired when the route is cancelled.

```json
{}
```

---

## Fuel

### `scooping_started`
Fired on the first `FuelScoop` event after arriving (debounce: fires once per stop).
Useful for: "currently scooping" indicator.

```json
{
  "system":          "Scheau Flyuae AA-A h1",
  "fuelBeforeScoop": 9.4      // Fuel level when scooping began
}
```

---

### `scooping_completed`
Fired 2 seconds after the last FuelScoop event (debounced).
Useful for: logging scoop stops, fuel efficiency stats.

```json
{
  "fuelScooped": 8.2,          // Total tonnes scooped this stop
  "fuelFinal":   17.6,         // Fuel level after scooping
  "fuelPercent": 88.0
}
```

---

### `fuel_warning`
Fired once per system when: `fuelPercent < threshold` AND `nextScoopableIn >= 2`.
Useful for: chatbot alerts, TTS warnings.

```json
{
  "fuelPercent":        22.4,
  "fuelRemaining":      5.6,
  "nextScoopableIn":    3,        // Hops until next scoopable star
  "nextScoopableSystem":"Col 285 Sector XX-B b14-6",
  "estimatedFuelAtScoop": 2.1,   // Simulated fuel on arrival (positive = reachable)
  "canReachNextScoop":  true
}
```

---

### `fuel_critical`
Fired once per system when: `estimatedFuelAtScoop < 0` (cannot reach next scoop).
Useful for: emergency alerts, automatic fuel-rat callout.

```json
{
  "fuelPercent":        8.1,
  "fuelRemaining":      2.0,
  "nextScoopableIn":    4,
  "estimatedFuelAtScoop": -1.3,  // Negative = will run out before arrival
  "canReachNextScoop":  false,
  "nearestScoopable":  "Col 285 Sector XY-Z b3-1"
}
```

---

## FSS / DSS Scanning

### `fss_discovery_scan`
Fired every time the FSS is used (each "honk" updates progress toward 100%).
Useful for: tracking system completeness, knowing how many bodies to expect.

```json
{
  "system":        "Scheau Flyuae AA-A h1",
  "systemAddress": 1234567890,
  "progress":      0.42,          // 0.0–1.0 (multiply × 100 for %)
  "bodyCount":     12,            // Total stellar bodies in system
  "nonBodyCount":  3,             // Signal sources (not stellar bodies)
  "complete":      false          // true when progress >= 1.0
}
```

---

### `fss_body_signals`
Fired when FSS reveals biological or geological signals on a body (before DSS mapping).
Useful for: early exobio candidate detection, prioritising which bodies to map.

```json
{
  "system":        "Scheau Flyuae AA-A h1",
  "systemAddress": 1234567890,
  "bodyName":      "Scheau Flyuae AA-A h1 3",
  "bodyID":        3,
  "biologicalCount": 3,           // Number of distinct biological sites
  "geologicalCount": 1,
  "otherSignals": [               // Anything that isn't bio/geo
    { "type": "human", "typeLocalised": "Human", "count": 1 }
  ],
  "genuses": []                   // Always empty here – populated in surface_signals_found
}
```

---

### `body_scanned`
Fired for every body scan (auto-scan on arrival, FSS detailed scan, nav beacon).
Useful for: first-discovery / first-map bonus detection, exobio eligibility, body catalogue.

```json
{
  "system":        "Scheau Flyuae AA-A h1",
  "systemAddress": 1234567890,
  "scanType":      "Detailed",    // "AutoScan" | "Detailed" | "NavBeaconDetail"
  "bodyName":      "Scheau Flyuae AA-A h1 3",
  "bodyID":        3,
  "isStar":        false,

  // ── Discovery flags (most important for payout calculation) ──
  "wasDiscovered": false,         // false = you are the first to scan this body
  "wasMapped":     false,         // false = nobody has mapped it yet
  "firstDiscovery": true,         // shorthand: !wasDiscovered
  "firstMap":       true,         // shorthand: !wasMapped

  // ── Stars only ──
  "starType":      null,          // e.g. "K", "M", "Bh", "NS" – null for planets
  "stellarMass":   null,

  // ── Planets / moons ──
  "planetClass":        "High metal content body",
  "terraformState":     "Terraformable",  // "" | "Terraformable" | "Candidate for terraforming"
  "atmosphere":         "thin oxygen atmosphere",
  "atmosphereType":     "Oxygen",         // Used for exobio eligibility
  "volcanism":          "major silicate vapour geysers volcanism",
  "landable":           true,
  "massEM":             0.23,             // Earth masses
  "radius":             1534212,          // Metres
  "surfaceGravity":     3.17,             // m/s² — divide by 9.81 for g
  "surfaceTemperature": 289,              // Kelvin
  "surfacePressure":    12450,            // Pascals

  // ── Mining ──
  "reserveLevel": "PristineResources",    // null | "PristineResources" | "MajorResources" | …
  "hasRings":     true
}
```

---

### `body_mapped`
Fired when DSS mapping of a body completes.
Useful for: tracking mapping bonuses, exobio-ready confirmation.

```json
{
  "system":        "Scheau Flyuae AA-A h1",
  "systemAddress": 1234567890,
  "bodyName":      "Scheau Flyuae AA-A h1 3",
  "bodyID":        3,
  "probesUsed":    5,
  "efficiencyTarget": 6,
  "efficient":     true           // true = 3× payout multiplier
}
```

---

### `surface_signals_found`
Fired after DSS mapping reveals detailed signal data including exact genus list.
This is the most useful Exobio event you get *before landing*.
Useful for: predicting which species are present, estimating payout, routing decisions.

```json
{
  "system":        "Scheau Flyuae AA-A h1",
  "systemAddress": 1234567890,
  "bodyName":      "Scheau Flyuae AA-A h1 3",
  "bodyID":        3,
  "biologicalCount": 3,
  "geologicalCount": 0,
  "otherSignals":  [],

  // Genus list – tells you the family, not the exact species (need to land for that)
  "genuses": [
    { "genus": "$Codex_Ent_Stratum_Name;",     "genusLocalised": "Stratum" },
    { "genus": "$Codex_Ent_Fonticulus_Name;",  "genusLocalised": "Fonticulus" },
    { "genus": "$Codex_Ent_Osseus_Name;",      "genusLocalised": "Osseus" }
  ]
}
```

---

## Exobiology

### `exobio_sample`
Fired for each of the first two samples of a species (Log and Sample scan types).
Three samples are required per species. Variant is confirmed on the third (Analyse).
Useful for: progress tracking, "2 more needed" reminders.

```json
{
  "system":        "Scheau Flyuae AA-A h1",
  "systemAddress": 1234567890,
  "bodyName":      "Scheau Flyuae AA-A h1 3",
  "bodyID":        3,

  "sampleNumber":  1,             // 1 = first sample (Log), 2 = second sample (Sample)
  "scanType":      "Log",         // "Log" | "Sample"
  "samplesRemaining": 2,          // How many more before payout

  // Species info (variant not confirmed until Analyse)
  "genus":            "$Codex_Ent_Stratum_Name;",
  "genusLocalised":   "Stratum",
  "species":          "$Codex_Ent_Stratum_Paleas_Name;",
  "speciesLocalised": "Stratum Paleas",
  "variant":          "$Codex_Ent_Stratum_Paleas_Lime_Name;",
  "variantLocalised": "Stratum Paleas – Lime"
}
```

---

### `exobio_complete`
Fired when the third sample (Analyse) is taken – species scan is complete and payout is earned.
Useful for: logging discoveries, session value tracking, achievement triggers.

```json
{
  "system":        "Scheau Flyuae AA-A h1",
  "systemAddress": 1234567890,
  "bodyName":      "Scheau Flyuae AA-A h1 3",
  "bodyID":        3,

  // All three fields confirmed after Analyse
  "genus":            "$Codex_Ent_Stratum_Name;",
  "genusLocalised":   "Stratum",
  "species":          "$Codex_Ent_Stratum_Paleas_Name;",
  "speciesLocalised": "Stratum Paleas",
  "variant":          "$Codex_Ent_Stratum_Paleas_Lime_Name;",
  "variantLocalised": "Stratum Paleas – Lime"

  // Payout value lookup: query Canonn or EDDB by species name server-side.
  // Values range from ~19,000 Cr (Bacterium) to ~19,800,000 Cr (Clypeus/Raris).
}
```

---

### `codex_new_entry`
Fired only for first-ever discoveries (IsNewEntry = true in journal).
Useful for: first-discovery notifications, Codex completion tracking.

```json
{
  "system":        "Scheau Flyuae AA-A h1",
  "systemAddress": 1234567890,
  "bodyID":        3,
  "entryID":       2100403,
  "name":          "$Codex_Ent_Stratum_Paleas_Name;",
  "nameLocalised": "Stratum Paleas",
  "category":      "codex_category_biology",
  "subCategory":   "",
  "newTraitsDiscovered": false   // true = additional voucher reward
}
```

---

## Surface Operations

### `approach_body`
Fired when the ship enters orbital approach to a body.
Useful for: pre-landing checklist, loading cached body signal data.
Payload includes the cached `bodySignals` for the body if it was FSS/DSS scanned earlier.

```json
{
  "system":        "Scheau Flyuae AA-A h1",
  "systemAddress": 1234567890,
  "bodyName":      "Scheau Flyuae AA-A h1 3",
  "bodyID":        3,
  "bodyType":      "Planet",

  // Pre-cached signal data if body was scanned this session (null otherwise)
  "bodySignals": {
    "bodyName":        "Scheau Flyuae AA-A h1 3",
    "bodyID":          3,
    "biologicalCount": 3,
    "geologicalCount": 0,
    "otherSignals":    [],
    "genuses": [
      { "genus": "$Codex_Ent_Stratum_Name;", "genusLocalised": "Stratum" }
    ]
  }
}
```

---

### `leave_body`
Fired when the ship leaves orbital approach.
Useful for: clearing body-specific UI, logging time-on-body.

```json
{
  "system":        "Scheau Flyuae AA-A h1",
  "systemAddress": 1234567890,
  "bodyName":      "Scheau Flyuae AA-A h1 3",
  "bodyID":        3,
  "bodyType":      "Planet"
}
```

---

### `touchdown`
Fired on landing.
Useful for: geo-tagging exobio scans, logging landing coordinates, surface session start.

```json
{
  "system":        "Scheau Flyuae AA-A h1",
  "systemAddress": 1234567890,
  "bodyName":      "Scheau Flyuae AA-A h1 3",
  "bodyID":        3,
  "bodyType":      "Planet",
  "latitude":      -24.51,        // null if not available
  "longitude":     133.84,
  "playerControlled": true,       // false for NPC/carrier touchdowns
  "nearestDest":   null,          // Settlement name if landed near one

  // Cached signal data (same as approach_body.bodySignals)
  "bodySignals": { ... }
}
```

---

### `liftoff`
Fired on takeoff. Includes a summary of completed exobio scans done on this body.
Useful for: session accounting, "did I get everything" check.

```json
{
  "system":        "Scheau Flyuae AA-A h1",
  "systemAddress": 1234567890,
  "bodyName":      "Scheau Flyuae AA-A h1 3",
  "bodyID":        3,
  "bodyType":      "Planet",
  "latitude":      -24.51,
  "longitude":     133.84,
  "playerControlled": true,

  // All completed scans on this body during the current session
  "completedScans": [
    {
      "genus":            "$Codex_Ent_Stratum_Name;",
      "genusLocalised":   "Stratum",
      "species":          "$Codex_Ent_Stratum_Paleas_Name;",
      "speciesLocalised": "Stratum Paleas",
      "variant":          "$Codex_Ent_Stratum_Paleas_Lime_Name;",
      "variantLocalised": "Stratum Paleas – Lime",
      "bodyName":         "Scheau Flyuae AA-A h1 3",
      "bodyID":           3,
      "samplesCollected": 3,
      "completed":        true
    }
  ]
}
```

---

## Economy

### `exploration_sold`
Fired when exploration data is handed in at a station (both SellExplorationData and MultiSellExplorationData).
Useful for: session earnings tracking, cartography leaderboards.

```json
{
  "system":        "Jameson Memorial",
  "systemAddress": 9999999999,

  // System names included in this sale (SellExplorationData only, empty for MultiSell)
  "systems":    ["Scheau Flyuae AA-A h1", "Eol Prou RS-T d3-94"],
  // Bodies that earned first-discovery bonus
  "discovered": ["Scheau Flyuae AA-A h1 3", "Scheau Flyuae AA-A h1 4"],

  "baseValue":     4820000,   // Credits before bonus
  "bonus":          964000,   // First-discovery / first-map bonus
  "totalEarnings": 5784000    // baseValue + bonus
}
```

---

## State Sync

### `state_update`
Sent 500 ms after any state change (debounced). Contains the full current state.
Useful for: reconnection recovery, dashboard initialisation, persistent state on the server.

```json
{
  "currentSystem":    "Scheau Flyuae AA-A h1",
  "systemAddress":    1234567890,
  "starPos":          { "x": 25.3, "y": -18.6, "z": 9100.0 },
  "population":       0,
  "systemSecurity":   "",
  "systemEconomy":    "",
  "systemAllegiance": "",

  "fuelCurrent":  18.7,
  "fuelCapacity": 25.0,
  "fuelPercent":  74.8,
  "fuelReserve":  0.63,
  "lastFuelUsed": 1.42,
  "isScooping":   false,

  "remainingJumps": 34,
  "nextScoopableIn": 2,
  "estimatedFuelToNextScoop": 15.4,

  "shipName":     "Wandering Panda",
  "shipType":     "Krait_MkII",
  "jumpRangeMax": 55.4,

  "currentStarClass": "K",
  "currentScoopable": true,
  "currentBody":      "Scheau Flyuae AA-A h1",
  "currentBodyID":    0,

  "fssProgress":     0.42,
  "fssBodyCount":    12,
  "fssNonBodyCount": 3,

  "activeExobioScans": [
    {
      "genus":            "$Codex_Ent_Stratum_Name;",
      "genusLocalised":   "Stratum",
      "species":          "$Codex_Ent_Stratum_Paleas_Name;",
      "speciesLocalised": "Stratum Paleas",
      "variant":          "",
      "variantLocalised": "",
      "bodyName":         "Scheau Flyuae AA-A h1 3",
      "bodyID":           3,
      "samplesCollected": 1,
      "completed":        false
    }
  ],

  "bodySignals": [
    {
      "bodyName":        "Scheau Flyuae AA-A h1 3",
      "bodyID":          3,
      "biologicalCount": 3,
      "geologicalCount": 0,
      "otherSignals":    [],
      "genuses": [
        { "genus": "$Codex_Ent_Stratum_Name;", "genusLocalised": "Stratum" }
      ]
    }
  ],

  "wsConnected": true,
  "route": [ ... ]
}
```

---

## Event Quick Reference

| Event | Journal Source | Debounce | Key Use Case |
|---|---|---|---|
| `jump_started` | `StartJump` | — | Pre-jump UI |
| `jump_completed` | `FSDJump` | — | System arrival, fuel/route update |
| `route_set` | `NavRoute` / `NavRoute.json` | — | ETA, fuel planning |
| `route_cleared` | `NavRouteClear` | — | Route cancelled |
| `scooping_started` | `FuelScoop` (first) | — | Scooping indicator |
| `scooping_completed` | `FuelScoop` (last) | 2 s | Scoop log |
| `fuel_warning` | derived from `FSDJump` | 1× per system | Low fuel alert |
| `fuel_critical` | derived from `FSDJump` | 1× per system | Emergency alert |
| `fss_discovery_scan` | `FSSDiscoveryScan` | — | System completeness |
| `fss_body_signals` | `FSSBodySignals` | — | Early bio detection |
| `body_scanned` | `Scan` | — | Discovery bonuses, exobio eligibility |
| `body_mapped` | `SAAScanComplete` | — | Mapping bonus, exobio ready |
| `surface_signals_found` | `SAASignalsFound` | — | Genus list before landing |
| `exobio_sample` | `ScanOrganic` (Log/Sample) | — | Sample progress |
| `exobio_complete` | `ScanOrganic` (Analyse) | — | Species complete, payout |
| `codex_new_entry` | `CodexEntry` (IsNewEntry) | — | First discovery |
| `approach_body` | `ApproachBody` | — | Pre-landing, signal preview |
| `leave_body` | `LeaveBody` | — | Left orbit |
| `touchdown` | `Touchdown` | — | Landing coords, exobio session start |
| `liftoff` | `Liftoff` | — | Completed scans summary |
| `exploration_sold` | `Sell/MultiSellExplorationData` | — | Credits earned |
| `state_update` | any state change | 500 ms | Full state sync / reconnect |
