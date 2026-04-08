# ED Companion – Claude Code Context

## Project

Electron + TypeScript overlay for Elite Dangerous.
Monitors journal files, shows live fuel/route/exobio status, streams structured events via WebSocket.

- **Repo**: https://github.com/HannaPanda/FlauschiPandaBotEDCompanion
- **Owner**: HannaPanda (johanna@hannapanda.de)
- **Node.js** (portable): `C:\Users\Shadow\tools\nodejs\`

---

## Deploy Workflow — the one and only way to release

```powershell
.\deploy.ps1              # patch bump: 1.0.0 → 1.0.1
.\deploy.ps1 -Minor       # minor bump: 1.0.0 → 1.1.0
.\deploy.ps1 -Major       # major bump: 1.0.0 → 2.0.0
.\deploy.ps1 -Version v1.5.0   # explicit version
.\deploy.ps1 -Force       # include dirty working tree in release commit
```

**What the script does (in order):**
1. Checks for uncommitted changes (blocks unless `-Force`)
2. TypeScript type-check (`tsc --noEmit`) on both main + renderer
3. *(Future)* ESLint — will block on lint errors once configured
4. Bumps version in `package.json`
5. `git add . && git commit && git tag && git push`
6. Waits for the GitHub Actions `Build & Release` workflow to succeed
7. Downloads the freshly built `ED-Companion-portable.exe` to the Desktop

**Never push tags manually** — always go through `deploy.ps1` so linting runs first.

---

## GitHub Token

The PAT is stored **only** in `.git/config` (via the remote URL) and is never committed.
`deploy.ps1` extracts it automatically from `git remote get-url origin`.

To update the token (e.g. after expiry):
```powershell
git remote set-url origin "https://HannaPanda:NEW_TOKEN@github.com/HannaPanda/FlauschiPandaBotEDCompanion.git"
```

Alternatively set `$env:GH_TOKEN` before running `deploy.ps1`.

---

## GitHub Actions

`.github/workflows/release.yml` triggers on every `v*` tag push:
- Runs on `windows-latest`
- `npm ci` → `npm run dist` (Vite + tsc + electron-builder)
- Uploads `ED-Companion-portable.exe` as release asset

The `GITHUB_TOKEN` secret is provided automatically by Actions. No secrets need to be configured manually.

---

## Building locally (dev/test only)

```powershell
$env:PATH = "C:\Users\Shadow\tools\nodejs;$env:PATH"

npm run dev:renderer    # Vite dev server on :5173
npm run dev:main        # tsc --watch for main process
npm run dev:electron    # launches Electron (needs dist/main/index.js)

npm run dist            # full build → dist-electron/ED-Companion-portable.exe
```

**Known build quirk:** electron-builder's `winCodeSign` cache must exist at
`%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0\`
and `node_modules/app-builder-lib/out/binDownload.js` is patched to check for it
before calling `app-builder-bin`. This avoids a 7zip symlink error on Windows without
Developer Mode. If `npm ci` is run fresh, the patch must be re-applied.

---

## Project Structure

```
src/
  main/
    index.ts          Electron main process, IPC, tray
    journal.ts        Journal tailer + all event parsers
    state.ts          In-memory EDState, exobio/signal cache
    scoop.ts          Fuel warning logic
    ws-client.ts      WebSocket client, auth, exponential backoff
    file-watcher.ts   chokidar: journal dir + NavRoute.json
    preload.ts        contextBridge → window.edApi
    types.ts          Shared types + defaults
  renderer/
    App.tsx           Root, tab navigation, state subscription
    pages/
      Dashboard.tsx   Fuel bar, FSS progress, exobio panel, route list
      Settings.tsx    All settings with validation + WS test
    components/
      FuelBar.tsx
      RouteList.tsx
      ScoopWarning.tsx
      ConnectionStatus.tsx
```

---

## WebSocket Events

Full payload documentation in **`WEBSOCKET_EVENTS.md`**.

Quick reference — events sent to the remote server:

| Event | Trigger |
|---|---|
| `jump_started` | FSD countdown begins |
| `jump_completed` | Arrival in new system (richest event) |
| `route_set` / `route_cleared` | Route plotted / cancelled |
| `scooping_started` / `scooping_completed` | Fuel scoop session |
| `fuel_warning` / `fuel_critical` | Fuel thresholds crossed |
| `fss_discovery_scan` | Honk (FSS sweep) |
| `fss_body_signals` | FSS reveals bio/geo signals on body |
| `body_scanned` | Any body scan (auto/FSS/detailed) |
| `body_mapped` | DSS mapping complete |
| `surface_signals_found` | DSS reveals genus list |
| `exobio_sample` | Exobio sample 1 or 2 of 3 |
| `exobio_complete` | Exobio 3/3 — payout earned |
| `codex_new_entry` | First-ever discovery |
| `approach_body` / `leave_body` | Orbital approach / departure |
| `touchdown` / `liftoff` | Landing/takeoff with coordinates |
| `exploration_sold` | Cartography data handed in |
| `state_update` | Full state sync (debounced 500 ms) |

---

## Settings (electron-store)

Stored in `%APPDATA%\ed-companion\config.json`. No `.env` files.

| Key | Default | Notes |
|---|---|---|
| `journalPath` | auto-detected | `%USERPROFILE%\Saved Games\Frontier Developments\Elite Dangerous` |
| `wsEnabled` | `false` | |
| `wsUrl` | `wss://flauschipandabot.de/ed-integration` | |
| `wsSecret` | `""` | |
| `fuelWarningThreshold` | `30` | % |
| `fuelLookaheadHops` | `10` | |
| `alwaysOnTop` | `true` | |
| `opacity` | `0.9` | |
| `windowBounds` | `{x,y,w,h}` | persisted on resize/move |

---

## Future: Linting

When adding ESLint, plug it into `deploy.ps1` at the `# TODO: Add ESLint` comment.
The deploy script is designed to block on any non-zero exit code — no changes needed
to the gating logic, just uncomment the two lines.
