# 📝 Changelog

All notable changes to **Sonar Code Editor** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0-beta.6] - 2026-04-09

### Added
- **Microsoft Store (AppX) packaging** support via `electron-builder` with `appx` target configuration for `Knurdz.SonarCodeEditor`.
- **`package:win:all`** and **`package:win:store`** npm scripts for flexible Windows distribution (NSIS installer + AppX).
- Windows installer now allows users to **choose installation directory** (`allowToChangeInstallationDirectory: true` in NSIS config).
- Enhanced **CI/CD workflows** with npm dependency caching for faster build times.

### Changed
- **Admin Panel removed from the editor** — administration is now handled exclusively through the **Sonar Web App** (cloud dashboard). The editor focuses solely on the coding experience.
- Improved workflow file **asset versioning** for release uploads.
- Download links in README updated to point to beta.6 artifacts.

### Fixed
- Improved `npm install` reliability across CI runners.

**Full Changelog**: https://github.com/rkvishwa/Sonar-Code-Editor/compare/v1.0.0-beta.5...v1.0.0-beta.6

---

## [1.0.0-beta.5] - 2026-04-05

### Added
- **User Customization Options**: Introduced new settings panel allowing users to configure editor preferences.
- **Theme Selection (Appearance Settings)**: Added System Default, Light, and Dark theme selection in the settings modal.

### Fixed
- **File Tree bug** causing incorrect state after rename/delete operations.
- **Security improvements** — tightened Appwrite session handling and key validation logic.
- Several other minor UI and stability bugs.

---

## [1.0.0-beta.4] - 2026-03-11

### Fixed
- **Preview Panel crashing issue** — resolved a crash that occurred when loading certain localhost environments.
- Minor bug fixes and UI tweaks across the editor layout.

---

## [1.0.0-beta.3] - 2026-03-11

### Added
- **Appearance Settings** — admin settings modal now includes a theme section (System, Light, Dark).
- **Platform-specific keyboard shortcuts** — shortcuts display OS-aware key names (⌘ on macOS, Ctrl on Windows/Linux) using the new `formatKey` utility.
- **Platform-specific body classes** — enables global OS-based CSS targeting.
- **Refreshed Welcome Screen** — updated `EditorPanel` welcome screen with larger gradient-styled logo, improved layout, and wider shortcut panel.

### Changed
- **Robust File Binding in Collaboration** — `EditorPanel.tsx` now uses per-file tracking with retry logic to correctly bind/unbind Yjs collaborative sessions when files are deleted, restored, or switched.
- **LF Line Ending Enforcement** — all Monaco editor models now use LF line endings to prevent cursor drift and sync issues across operating systems.
- **Smart Auto-Closing Tags** — auto-close tag logic now only fires for local user input, preventing duplicate tags from remote collaborative edits.

---

## [1.0.0-beta.2] - 2026-03-09

### Changed
- **Windows Installer** — updated NSIS package to allow users to select a custom installation location during setup.
- Production stability fixes for the Windows build.

---

## [1.0.0-beta] — Initial Release - 2026-03-09

### Added
- **Real-time Collaborative Code Editing** via Monaco Editor + Yjs (CRDT-based) + y-websocket.
- **Custom File Tree** (`@knurdz/jack-file-tree`) for workspace navigation.
- **Multi-document Tab Management** (`@knurdz/jack-editor-tab`) for seamless file switching.
- **Monitored Admin Dashboard** — real-time activity logging, environment restrictions, and PDF report generation (jsPDF + jsPDF-autotable).
- **Secure Preview Panel** — embedded webview restricted to `localhost` URLs only; blocks external browsing.
- **Appwrite BaaS Integration** — authentication, real-time database, and cloud functions.
- **Offline Behavior Logging** — activity logs persisted locally via `electron-store`, synced when online.
- **IPC Context Bridge** — secure `window.electronAPI` interface between Main and Renderer processes.
- **Network Status Polling** — real-time connectivity monitoring via Electron `net` module, sent to renderer.
- macOS (`.dmg`) and Windows (`.exe`) installer builds via GitHub Actions CI.