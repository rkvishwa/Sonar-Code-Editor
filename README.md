<div align="center">
  <img src="assets/win_icon.png" alt="Sonar Code Editor Logo" width="128" height="128" />
  <h1>🌊 Sonar Code Editor & Monitoring System</h1>
  <p>A modern, real-time collaborative IDE built for supervised exams, hackathons, and secure coding environments.</p>

  <p>
    <img src="https://img.shields.io/badge/Electron-191970?style=for-the-badge&logo=Electron&logoColor=white" alt="Electron" />
    <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E" alt="Vite" />
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Appwrite-F02E65?style=for-the-badge&logo=Appwrite&logoColor=white" alt="Appwrite" />
  </p>
</div>

---

## 🚀 Download Beta Release

### <img src="https://img.shields.io/badge/macOS-000000?style=for-the-badge&logo=apple&logoColor=white" alt="Mac Logo" align="absmiddle" /> (Recommended)
Install the latest beta with Homebrew:
```bash
brew install --cask rkvishwa/knurdz/sonar-code-editor
```

**Alternative: Manual Download**
Download the latest `.dmg` from [GitHub Releases](https://github.com/rkvishwa/Sonar-Code-Editor/releases):
[Download Mac Beta (.dmg)](https://github.com/rkvishwa/Sonar-Code-Editor/releases/download/v1.0.0-beta.6/Sonar.Code.Editor-1.0.0-beta.6-arm64.dmg)

> **Note on Mac Installation:** If you manually download the `.dmg`, macOS Gatekeeper may flag the app as damaged or from an unidentified developer because it is not yet code-signed in the beta phase.
>
> **To bypass and install:** Open your terminal and run the following command on the extracted app:
> ```bash
> sudo xattr -rd com.apple.quarantine /Applications/Sonar\ Code\ Editor.app
> ```

### <img src="https://img.shields.io/badge/Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white" alt="Windows Logo" align="absmiddle" />

**Microsoft Store** *(Recommended)*  
[![Microsoft Store](https://img.shields.io/badge/Microsoft%20Store-Download-0078D4?style=for-the-badge&logo=microsoft&logoColor=white)](https://apps.microsoft.com/detail/9NFFN07V94DZ?hl=en-us&gl=LK&ocid=pdpshare)

**Manual Download (.exe)**
Download the NSIS installer from [GitHub Releases](https://github.com/rkvishwa/Sonar-Code-Editor/releases):
[Download Windows Beta (.exe)](https://github.com/rkvishwa/Sonar-Code-Editor/releases/download/v1.0.0-beta.6/Sonar.Code.Editor.Setup.1.0.0-beta.6.exe)

> **Note on Windows Installation:** If using the `.exe` installer, Windows SmartScreen may show an "Untrusted" or "Windows protected your PC" prompt since the beta is not EV-signed.
>
> **To bypass and install:** Click **"More info"** and then **"Run anyway"**. The Windows installer supports **custom installation directory selection**.

### 🐛 Known Issues
If you encounter bugs or want to see what's being tracked, check our [GitHub Issues](https://github.com/rkvishwa/Sonar-Code-Editor/issues).

---

## 📖 Overview

**Sonar Code Editor** is a feature-rich desktop IDE built with Electron, React, and Vite. It provides a VS Code-like coding experience via Monaco Editor and enables real-time collaboration through Yjs and a self-hosted WebSocket server. Beyond standard editing, Sonar includes a monitoring system, activity logging, PDF report generation, and build attestation — making it ideal for supervised coding competitions, hackathons, and educational exam environments.

The project consists of two components:
- **Sonar Code Editor** — Electron desktop app (this repository)
- **Sonar Web App** — SvelteKit companion website at [sonar.knurdz.org](https://sonar.knurdz.org), providing the public homepage, hosted admin dashboard, and documentation.

---

## ✨ Key Features

- **💡 Advanced Code Editing**
  - Powered by **Monaco Editor** (the engine behind VS Code).
  - Syntax highlighting, auto-completion, and code formatting.
  - **@knurdz/jack-editor-tab** for multi-document tab management.
  - LF line-ending enforcement across operating systems.

- **🤝 Real-time Collaboration**
  - Google Docs-style real-time typing via **Yjs** CRDTs and `y-monaco`.
  - Self-hosted WebSocket server (y-websocket protocol, port `1234`) running in the Electron main process.
  - Collaborative cursors, awareness states, and team-isolated rooms.
  - Windows **Hosted Network** creation (`netsh`) for offline LAN-only exam environments.

- **🗂️ Smart File Management**
  - **@knurdz/jack-file-tree** — custom file explorer with create, rename, delete, and drag-drop.
  - Resizable panels (File Tree, Editor, Preview) via `react-resizable-panels`.

- **🛡️ Administration & Monitoring**
  - **Keystroke, focus, and clipboard monitoring** via `MonitoringService`.
  - **Offline behavior logging** — persisted locally via `electron-store` and synced to Appwrite when online.
  - Generates **PDF activity reports** with jsPDF + jsPDF-autotable.
  - **Admin Dashboard** available via the [Sonar Web App](https://sonar.knurdz.org) (cloud-based, removed from in-editor in beta.6).

- **🌐 Secure Preview Panel**
  - Embedded `webview` restricted to **`localhost` URLs only**.
  - All navigation events are intercepted; non-localhost requests are blocked.
  - Custom `local-file://` protocol for serving images from the filesystem safely.

- **🔐 Cloud & Authentication**
  - **Appwrite BaaS** — team authentication (Hackathon ID + Student ID + password), session management, and real-time data sync.
  - **Build Attestation** — official builds are HMAC-signed to prevent unauthorized client access.
  - **ASAR Integrity Check** — verifies the application bundle on startup.
  - **Deep Link support** (`sonar-editor://`) for invite-based team joining.

- **⚙️ Theme & Customization**
  - System Default, Light, and Dark themes selectable from Settings.

---

## 🛠️ Tech Stack

### Frontend (Renderer)
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Editor**: Monaco Editor (`@monaco-editor/react`)
- **Routing**: React Router DOM (v6)
- **Styling**: CSS with Radix UI Colors & Lucide React icons
- **Collaboration**: Yjs, y-monaco, y-websocket
- **File Tree**: `@knurdz/jack-file-tree`
- **Editor Tabs**: `@knurdz/jack-editor-tab`

### Backend / Desktop Core
- **Desktop Framework**: Electron
- **IPC**: Context Bridge + Preload scripts
- **Local Storage**: `electron-store`
- **BaaS**: Appwrite (Auth, Database, Functions)
- **WebSocket Server**: `ws` library (y-websocket protocol)
- **PDF Reports**: jsPDF + jsPDF-autotable
- **Security**: `bytenode` (bytecode compilation), HMAC build attestation, ASAR integrity

### Companion Web App
- **Framework**: SvelteKit
- **Styling**: Tailwind CSS
- **Auth**: Appwrite
- **Hosting**: Cloudflare Pages / static adapter

---

## 📚 Documentation

| Document | Description |
|---|---|
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Local setup, project structure, and build guide |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture, process model, and collaboration design |
| [appwrite.md](./appwrite.md) | Appwrite backend setup and environment variable reference |
| [SECURITY.md](./SECURITY.md) | Security policy, permissions, and vulnerability reporting |
| [CHANGELOG.md](./CHANGELOG.md) | Version history and release notes |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Contribution guidelines |

---

## 👥 Contributors

A huge thank you to everyone who has contributed to the Sonar Code Editor project.

| | | | Commits |
| :---: | :--- | :--- | :---: |
| <img src="https://github.com/rkvishwa.png?size=40&v=4" width="40" style="border-radius: 50%; margin-top: 15px;" /> | **rkvishwa** | [@rkvishwa](https://github.com/rkvishwa) | 225 |
| <img src="https://github.com/Kasun-Kumara.png?size=40&v=4" width="40" style="border-radius: 50%;" /> | **Kasun Kumara** | [@Kasun-Kumara](https://github.com/Kasun-Kumara) | 66 |
| <img src="https://github.com/SadeepaNHerath.png?size=40&v=4" width="40" style="border-radius: 50%;" /> | **SadeepaNHerath** | [@SadeepaNHerath](https://github.com/SadeepaNHerath) | 53 |
| <img src="https://github.com/Thesaru-p.png?size=40&v=4" width="40" style="border-radius: 50%;" /> | **Thesaru-p** | [@Thesaru-p](https://github.com/Thesaru-p) | 47 |
| <img src="https://github.com/rkvishwa.png?size=40&v=4" width="40" style="border-radius: 50%;" /> | **RKK Vishva Kumar** | [@rkvishwa](https://github.com/rkvishwa) | 39 |
| <img src="https://github.com/Praveen-R-2518.png?size=40&v=4" width="40" style="border-radius: 50%;" /> | **Praveen Ramanathan** | [@Praveen-R-2518](https://github.com/Praveen-R-2518) | 22 |
| <img src="https://github.com/harshasilva.png?size=40&v=4" width="40" style="border-radius: 50%;" /> | **harshasilva** | [@harshasilva](https://github.com/harshasilva) | 14 |
| <img src="https://github.com/Senuka-Deneth.png?size=40&v=4" width="40" style="border-radius: 50%;" /> | **Senuka-Deneth** | [@Senuka-Deneth](https://github.com/Senuka-Deneth) | 8 |

---

## 📜 License

This project is licensed under the **MIT License**. See [LICENSE](./LICENSE) for details.
