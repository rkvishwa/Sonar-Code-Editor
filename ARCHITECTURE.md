# 🏛️ Architecture Overview

**Sonar Code Editor** is a desktop application built with web technologies. It is structured for high performance, secure offline capabilities, and seamless real-time collaboration — primarily targeting supervised exam and hackathon environments.

## 🧱 Core Technologies

| Layer | Technology | Purpose |
|---|---|---|
| Desktop Runtime | **Electron** | OS-level APIs, window management, IPC |
| UI Framework | **React 18 + Vite** | Renderer process, component UI |
| Editor Engine | **Monaco Editor** | VS Code-compatible code editing |
| Collaboration | **Yjs + y-websocket** | CRDT-based real-time editing |
| Backend (BaaS) | **Appwrite** | Auth, database, cloud functions |
| File Tree | **@knurdz/jack-file-tree** | Custom workspace file explorer |
| Editor Tabs | **@knurdz/jack-editor-tab** | Multi-document tab management |
| Local Persistence | **electron-store** | Offline log storage |
| PDF Reporting | **jsPDF + jsPDF-autotable** | Activity report generation |

---

## 🔄 Process Model

Sonar uses Electron's multi-process architecture:

### 1. Main Process (`src/main/`)
Manages the app lifecycle, native OS interactions, and security:

- **`main.ts`** — App lifecycle, `BrowserWindow` creation, CSP headers, deep-link handling (`sonar-editor://`), macOS Automation permission enforcement.
- **`ipcHandlers.ts`** — Registered IPC handlers for filesystem operations (open/save/read/write files); enforces `enforceTrustedPath` sandboxing.
- **`collaborationManager.ts`** — Self-hosted WebSocket server (`ws` library, port `1234`) implementing the `y-websocket` protocol. Manages multi-room awareness state and CRDT message broadcasting. Also handles Windows hosted network creation via `netsh`.
- **`monitoring.ts`** — `MonitoringService` that tracks keyboard activity, window focus changes, and application events.
- **`offlineHeartbeat.ts`** — Periodic heartbeat signals sent to the renderer for offline-state tracking.
- **`securityLog.ts`** — Structured local security event logging (DevTools opened, app quit, etc.).
- **`buildAttestation.ts`** — Reads a compile-time signed `build-attestation.json` token to identify official production builds vs. dev mode.
- **`integrityCheck.ts`** — Verifies asar archive integrity on startup to detect tampering.
- **`staticServer.ts`** — Local HTTP server for serving static assets inside the preview panel.

### 2. Preload Script (`src/preload/preload.ts`)
- Acts as a **secure Context Bridge** between Main and Renderer.
- Exposes only safe, explicit APIs via `window.electronAPI` (filesystem ops, monitoring controls, security, collaboration, system info).
- Prevents full Node.js access from the UI layer; `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.

### 3. Renderer Process (`src/renderer/`)
The React SPA that drives the editor UI:

- **`pages/IDE.tsx`** — Primary IDE shell: file tree panel, editor panel, preview panel, sidebar, collaboration and settings overlays.
- **`pages/Login.tsx`** — Hackathon/student login flow with Hackathon ID + Student ID + password authentication.
- **`components/Editor/`** — Monaco editor integration, auto-closing tags, LF enforcement, welcome screen.
- **`components/Collaboration/`** — Collaboration panel: host/join session, network interface selection, hosted-network creation.
- **`components/FileTree/`** — File tree wrapper around `@knurdz/jack-file-tree`.
- **`components/Preview/`** — Sandboxed `webview` tag with `localhost`-only navigation enforcement.
- **`components/Settings/`** — Settings modal with theme (System/Light/Dark) and environment controls.
- **`components/Search/`** — In-workspace file content search.
- **`context/AuthContext.tsx`** — React context for Appwrite authentication state.
- **`context/CollaborationContext.tsx`** — Yjs `Doc`, `WebsocketProvider` management, awareness, and cursor tracking.
- **`services/appwrite.ts`** — All Appwrite interactions: session management, team login, hackathon lookup, activity log sync, version gating.
- **`services/activityLogger.ts`** — Client-side activity event collection.
- **`services/reportGenerator.ts`** — PDF report creation via jsPDF.
- **`services/inviteLinks.ts`** — Deep-link invite URL generation and parsing.

---

## 🤝 Collaborative Editing Architecture

Real-time collaboration follows the `y-websocket` protocol:

```
[Host Machine: Main Process]
  └─ CollaborationManager (WebSocketServer on :1234)
       └─ Room: "monaco-collab-{teamId}"
            ├─ Yjs CRDT sync (binary messages)
            └─ Awareness state broadcasting

[Client Machine: Renderer Process]
  └─ CollaborationContext
       └─ WebsocketProvider → ws://{hostIp}:1234/{roomName}
            └─ y-monaco binding → Monaco Editor
```

- **Host** starts the WS server via IPC (`COLLAB_START_HOST`).
- **Clients** connect via IPC (`COLLAB_JOIN_SESSION`), which updates local status; the actual Yjs WS connection is made in the renderer's `CollaborationContext`.
- **Awareness** (cursor positions, selection) is replayed to late-joining clients using stored awareness states.
- **Team isolation** — rooms are namespaced by `teamId`; connections from different teams are rejected.

---

## 🌐 Sonar Web App (Companion Website)

The **Sonar Web App** (`Sonar-Web-App/`) is a SvelteKit application hosted at `sonar.knurdz.org`:

- **Homepage** — Marketing site with feature showcase, live GitHub release feed (fetched at page load via `+page.ts`), and OS-aware download CTAs.
- **Admin Dashboard** (`/admin/`) — Cloud-based admin panel for managing hackathons, viewing activity logs, and managing sessions. Replaces the in-editor admin panel (removed in beta.6).
- **Download Page** (`/download/`) — Platform-specific download options (Homebrew, DMG, Microsoft Store, EXE).
- **Docs** (`/docs/`) — User and developer documentation.
- **Light/Dark theme** — Full system-aware theme toggle using CSS `prefers-color-scheme` and a manual `ThemeToggle` component.

---

## 🛡️ Security & Monitoring Isolation

To serve its primary use case in **Supervised/Exam Environments**:

- **Preview Restriction**: The preview panel is a sandboxed `webview` that intercepts `will-navigate` and `new-window` events, blocking any non-`localhost` traffic.
- **Event Tracking**: Keystrokes, window focus changes (blur/focus), and copy/paste actions are monitored via the `MonitoringService` and stored locally via `electron-store`.
- **Activity Sync**: Logs are synced to Appwrite's `Activity Logs` collection via the `sonar-activity-sync` cloud function when online.
- **Offline Resilience**: An `offlineHeartbeat` detects connectivity loss; logs continue to accumulate locally and are exported via `jsPDF` on demand.
- **Build Attestation**: Official production builds include a signed `build-attestation.json` token, verified by Appwrite cloud functions to prevent unauthorized client access.
- **ASAR Integrity Check**: On startup, `integrityCheck.ts` verifies the application's ASAR bundle hasn't been tampered with.
- **DevTools Lock**: In production, if DevTools is somehow opened, it is immediately closed and a `DEVTOOLS_OPENED` security event is logged.
- **macOS Automation Permission**: On macOS, the app enforces that `System Events` Automation permission is granted (required for app-switch detection) before the main window is created.