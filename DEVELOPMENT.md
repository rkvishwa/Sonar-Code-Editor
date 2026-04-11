# 🛠️ Development & Setup Guide

Welcome to the development guide for **Sonar Code Editor**. This document covers how to set up your local development environment, build the application, and package it for distribution.

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: `v18.x` or higher
- **NPM**: `v9.x` or higher
- **Git**

For macOS packaging, you additionally need Xcode Command Line Tools.

---

## 🚀 Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/rkvishwa/Sonar-Code-Editor.git
cd Sonar-Code-Editor
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory. Copy from the provided template:

```bash
cp .env.example .env
```

Fill in the required Appwrite credentials. See [appwrite.md](./appwrite.md) for the full list of required variables.

**Key development variables:**

| Variable | Description |
|---|---|
| `VITE_APPWRITE_ENDPOINT` | Your Appwrite API endpoint |
| `VITE_APPWRITE_PROJECT_ID` | Your Appwrite Project ID |
| `VITE_APPWRITE_DB_NAME` | Database ID (e.g. `devwatch_db`) |
| `VITE_APPWRITE_COLLECTION_SESSIONS` | Sessions collection ID |
| `VITE_APPWRITE_COLLECTION_ACTIVITY_LOGS` | Activity Logs collection ID |
| `VITE_APPWRITE_COLLECTION_REPORTS` | Reports collection ID |
| `VITE_APPWRITE_COLLECTION_SETTINGS` | Settings collection ID |
| `VITE_DEV_KEY` | Developer key for bypassing build attestation in dev mode (`username:secret` format) |

> **Note on `VITE_DEV_KEY`**: In development, the app skips build attestation. Set `VITE_DEV_KEY` to `username:secret` where `secret` matches the `BUILD_SIGNING_KEY` stored in your Appwrite cloud function environment variables.

---

## 💻 Running in Development

Start the application with hot-reloading for all processes simultaneously:

```bash
npm run start
```

This uses `concurrently` to run:
- **`dev:renderer`** — Vite dev server for the React UI (port `5173`)
- **`dev:preload`** — esbuild watcher for the preload script
- **`dev:main`** — esbuild watcher for the Electron main process
- **`dev:electron`** — Electron launcher (waits for Vite to be ready)

---

## 📂 Project Structure

```text
├── assets/                       # App icons (win_icon.png, mac_icon.png)
├── build/                        # Electron builder assets (icon.png, icon.icns)
├── release/                      # Compiled executables (generated on package)
├── scripts/                      # Build & release tooling scripts
│   ├── build-main.js             # esbuild bundler for the main process
│   ├── build-bytecode.js         # Bytecode compilation (bytenode) for production
│   ├── generate-attestation.js   # Generates signed build-attestation.json token
│   ├── generate-seal.js          # Post-pack seal/integrity signature generation
│   └── verify-release-integrity.js # Verifies release build signatures
├── src/
│   ├── main/                     # Electron main process
│   │   ├── main.ts               # App lifecycle, BrowserWindow, IPC, CSP, deep links
│   │   ├── ipcHandlers.ts        # File system IPC handlers (read/write/open/save)
│   │   ├── collaborationManager.ts # WebSocket server (y-websocket protocol, port 1234)
│   │   ├── monitoring.ts         # Activity monitoring service (keystroke/focus tracking)
│   │   ├── offlineHeartbeat.ts   # Periodic offline connectivity heartbeat
│   │   ├── securityLog.ts        # Structured local security event log
│   │   ├── buildAttestation.ts   # Reads/validates build-attestation.json token
│   │   ├── integrityCheck.ts     # ASAR bundle integrity verification
│   │   └── staticServer.ts       # Local HTTP server for preview panel assets
│   ├── preload/                  # Electron context bridge
│   │   └── preload.ts            # Exposes window.electronAPI to the renderer
│   ├── renderer/                 # React frontend (SPA)
│   │   ├── components/
│   │   │   ├── Editor/           # Monaco editor integration, welcome screen
│   │   │   ├── FileTree/         # @knurdz/jack-file-tree wrapper
│   │   │   ├── Collaboration/    # Host/join session UI, network interface picker
│   │   │   ├── Preview/          # Secure localhost-only webview panel
│   │   │   ├── Settings/         # Theme and environment settings modal
│   │   │   ├── Search/           # In-workspace file content search
│   │   │   └── Sidebar/          # Sidebar navigation
│   │   ├── context/
│   │   │   ├── AuthContext.tsx   # Appwrite authentication state
│   │   │   └── CollaborationContext.tsx # Yjs Doc, WebsocketProvider, awareness
│   │   ├── hooks/                # Custom hooks (network status, activity tracking)
│   │   ├── pages/
│   │   │   ├── IDE.tsx           # Main IDE shell (file tree + editor + preview)
│   │   │   └── Login.tsx         # Hackathon/student login flow
│   │   ├── services/
│   │   │   ├── appwrite.ts       # All Appwrite API calls (auth, DB, functions)
│   │   │   ├── activityLogger.ts # Client-side activity event collection
│   │   │   ├── reportGenerator.ts # PDF report via jsPDF
│   │   │   ├── inviteLinks.ts    # Deep-link invite generation/parsing
│   │   │   ├── localStore.ts     # electron-store wrapper
│   │   │   └── securityHeartbeat.ts # Session heartbeat to Appwrite
│   │   ├── styles/               # Global CSS
│   │   ├── types/                # TypeScript declarations
│   │   ├── utils/                # Shared utilities (formatKey, etc.)
│   │   ├── monacoSetup.ts        # Monaco language/theme registration
│   │   └── App.tsx               # Root React component and routing
│   └── shared/                   # Types and constants shared between main ↔ renderer
│       ├── constants.ts          # IPC channel names, app config
│       ├── types.ts              # Shared TypeScript interfaces
│       └── hackathonId.ts        # Hackathon ID normalization/validation
├── appwrite.json                 # Appwrite CLI active config (do not commit secrets)
├── package.json                  # Dependencies & npm scripts
├── tsconfig.json                 # TypeScript root config
├── tsconfig.main.json            # TypeScript config for main process
├── tsconfig.preload.json         # TypeScript config for preload script
└── vite.renderer.config.ts       # Vite config for the React renderer
```

---

## 📦 Building & Packaging

### Production Build (compile only)

```bash
npm run build
```

This compiles:
1. The React renderer via Vite → `dist/renderer/`
2. The main process via esbuild → `dist/main/`
3. The preload script via esbuild → `dist/preload/`
4. Bytecode compilation for production protection (`bytenode`)
5. Generates the signed `build-attestation.json` token

### Package for Distribution

```bash
# macOS (.dmg + .zip)
npm run package:mac

# Windows — NSIS installer only (.exe)
npm run package:win

# Windows — NSIS installer + Microsoft Store package (.exe + .appx)
npm run package:win:all

# Windows — Microsoft Store only (.appx)
npm run package:win:store

# Linux (.AppImage)
npm run package:linux
```

Compiled artifacts are placed in the `release/` directory.

> **Homebrew (macOS)**: Official releases are published to the `rkvishwa/knurdz` Homebrew tap:
> ```bash
> brew install --cask rkvishwa/knurdz/sonar-code-editor
> ```

> **Microsoft Store (Windows)**: The app is listed on the Microsoft Store under `Knurdz.SonarCodeEditor` (Identity: `Knurdz`).

---

## 🧪 Deep Link Testing

The app registers the `sonar-editor://` custom URL scheme. To test a deep-link invite locally:

```bash
# macOS
open "sonar-editor://?hackathonId=HACK2026&studentId=S12345"

# Windows (PowerShell)
Start-Process "sonar-editor://?invite=<encrypted-token>"
```

---

## 🌐 Sonar Web App (Companion)

The companion website lives in `../Sonar-Web-App/`. It is a **SvelteKit** application:

```bash
cd ../Sonar-Web-App
npm install
npm run dev
```

The web app provides the public-facing website (`sonar.knurdz.org`) and the hosted Admin Dashboard used by hackathon/exam organizers to monitor sessions and participants.
