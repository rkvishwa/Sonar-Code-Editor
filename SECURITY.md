# 🔒 Security Policy

## Supported Versions

Only the latest beta release of Sonar Code Editor receives security updates.

| Version       | Supported |
| ------------- | --------- |
| 1.0.0-beta.6  | ✅ Current |
| 1.0.0-beta.5  | ⚠️ Upgrade recommended |
| < 1.0.0-beta.5 | ❌        |

---

## 🏗️ Build Attestation & Client Validation

Sonar uses a **Build Attestation** system to differentiate between official production builds and unofficial or development clients:

- A signed `build-attestation.json` token is embedded in every official packaged release by `scripts/generate-attestation.js` at build time.
- The token is HMAC-signed using the `BUILD_SIGNING_KEY` secret key.
- On login, the editor sends this token to the `sonar-auth` Appwrite cloud function, which verifies the HMAC signature before permitting authentication.
- Unofficial builds or development clients authenticate using the `VITE_DEV_KEY` developer key flow instead.

> **Important**: The `BUILD_SIGNING_KEY` must only be present in the Appwrite Console environment variables and the secure CI/CD pipeline used to produce official releases. It must never be committed to the repository or included in any `.env` file.

---

## 🔐 ASAR Integrity Check

On application startup, `integrityCheck.ts` verifies the ASAR bundle's integrity to detect post-distribution tampering. If the check fails, the application will refuse to start in a degraded security state.

---

## 🛡️ IDE Security Restrictions

Because Sonar Code Editor is used for **Monitored Exams and Supervised Hackathons**:

- **Preview Panel Restriction**: The preview webview uses `will-navigate` and `new-window` event interception to strictly block all navigation to non-`localhost` URLs, preventing external information gathering during an exam.
- **Filesystem Sandboxing**: All file system access from the renderer is routed through IPC handlers in the main process. `enforceTrustedPath()` validates paths against a trusted workspace root to prevent path traversal attacks.
- **Context Isolation**: `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true` are enforced on the renderer `BrowserWindow`.
- **DevTools Lock**: In production builds, opening DevTools is blocked and a `DEVTOOLS_OPENED` security event is logged immediately.
- **Content Security Policy (CSP)**: In production, a strict CSP is applied via `session.defaultSession.webRequest.onHeadersReceived`, restricting `script-src`, `connect-src` (Appwrite endpoints + localhost WebSocket), and `frame-src` (localhost preview only).

---

## 👁️ Required Permissions & Privacy

To function as a monitored evaluation environment, the application requires and utilizes the following permissions:

### Network
- **Local & Outbound**: Required for Appwrite cloud authentication, real-time WebSocket collaboration (Yjs, port `1234`), and session/activity log synchronization.

### Activity Monitoring
The IDE automatically tracks all of the following for exam integrity:
- **Window focus changes** — detects when a participant leaves the IDE window (e.g., alt-tabbing).
- **Keyboard activity metrics** — keystroke volume and patterns.
- **Copy/paste events** — clipboard usage is logged.
- **Current open file** — file-level activity is tracked.
- **Session online/offline transitions** — recorded with timestamps from the `offlineHeartbeat` service.

All monitoring data is accessible to **authorized Administrators** via the **Sonar Web App Admin Dashboard** or via exported **PDF reports**.

### Local Storage
- `electron-store` is used to persist activity logs, security events, and session state locally so no exam metrics are lost during internet disconnection. Logs are synced to Appwrite upon reconnection.

### macOS Automation
- On macOS, the app requires **System Events Automation permission** (via `System Settings → Privacy & Security → Automation`) to detect which application is in the foreground, enabling app-switch monitoring during exams.

---

## 🔑 Collaboration Security

- The built-in WebSocket collaboration server (port `1234`) validates team identity by enforcing that all room names end with `-{teamId}`.
- Connections from different teams are rejected with a `1008` close code.
- Hosted Networks (Windows `netsh`) are created using `execFileSync` to prevent command injection.

---

## Reporting a Vulnerability

If you discover a security vulnerability within Sonar Code Editor, please **do not** open a public GitHub issue.

Instead, send an e-mail to the maintainers at **`hello@knurdz.org`**. Please include:
- A clear description of the vulnerability.
- Steps to reproduce.
- The affected version(s).
- Any suggested mitigations (optional).

We will review your disclosure and respond as soon as possible with a timeline for patching and coordinated release.