# ED Companion

Elite Dangerous live monitoring overlay. Tracks fuel, route planning, scoop warnings, and streams events via WebSocket.

## Requirements

- Windows 10/11
- Node.js 18+
- Elite Dangerous installed (Odyssey or Horizons)

## Setup

```bash
npm install
```

### Development

```bash
# Terminal 1: start Vite renderer dev server
npm run dev:renderer

# Terminal 2: compile main process
npm run dev:main

# Terminal 3: launch Electron (after dist/main/index.js exists)
npm run dev:electron
```

Or use a process manager like `concurrently` — `npm run dev` attempts all three.

### Build portable .exe

```bash
npm run dist
```

Output: `dist-electron/ED-Companion-portable.exe`

## First Run

1. Launch the app
2. Journal path is auto-detected from `%USERPROFILE%\Saved Games\Frontier Developments\Elite Dangerous`
3. Go to **Settings** tab to configure WebSocket if needed
4. Start Elite Dangerous — the overlay updates in real time

## Settings

All settings persist via `electron-store` in `%APPDATA%\ed-companion\`.

| Setting | Default | Description |
|---|---|---|
| Journal Path | auto-detected | Path to ED journal directory |
| WS Enabled | false | Enable WebSocket streaming |
| WS URL | wss://... | Remote server URL |
| WS Secret | — | Auth secret |
| Fuel Warning | 30% | Threshold for low-fuel warning |
| Lookahead Hops | 10 | Hops to simulate for scoop analysis |
| Always on Top | true | Keep window above other windows |
| Opacity | 90% | Window transparency |

## WebSocket Protocol

After connecting, the client sends:
```json
{ "type": "auth", "secret": "...", "plugin": "elite-dangerous" }
```

Server must respond with:
```json
{ "type": "auth_ok" }
```

All subsequent messages follow:
```json
{ "type": "<event>", "timestamp": "ISO8601", "payload": { ... } }
```

Event types: `state_update`, `route_set`, `route_cleared`, `jump_started`, `jump_completed`, `fuel_warning`, `fuel_critical`, `scooping_started`, `scooping_completed`
