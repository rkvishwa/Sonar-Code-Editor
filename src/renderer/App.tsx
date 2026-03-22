import React, { useCallback, useEffect, useRef, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import IDE from './pages/IDE';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { checkLatestVersionGate, getLocalAppVersion } from './services/appwrite';
import { resolveIncomingInvite } from './services/inviteLinks';
import { LoginInvitePrefill } from '../shared/types';

import { ShieldAlert, WifiOff, RefreshCw, Settings, AlertTriangle } from 'lucide-react';

// ── Permission gate ──────────────────────────────────────────────────────────
// On macOS the app needs Automation/System Events access to track app switching.
// If the user denied it, show a full-screen block — the app cannot be used.
// Auto-rechecks whenever the window regains focus so the user doesn't need to
// manually click anything after enabling the toggle in System Settings.
function PermissionRequired({ onRecheck }: { onRecheck: () => Promise<void> }) {
  const [checking, setChecking] = useState(false);
  const checkingRef = useRef(false);

  const openSettings = async () => {
    await window.electronAPI?.system?.openPrivacyPrefs();
  };

  const recheck = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    await onRecheck();
    checkingRef.current = false;
    setChecking(false);
  }, [onRecheck]);

  // Auto-recheck whenever the window regains focus (user came back from System Settings)
  useEffect(() => {
    const handleFocus = () => { recheck(); };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') recheck();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [recheck]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #121212 0%, #1e1e1e 100%)',
        color: '#e0e0e0',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '40px',
        textAlign: 'center',
      }}
    >
      <div style={{
        background: 'rgba(241, 76, 76, 0.1)',
        padding: '24px',
        borderRadius: '50%',
        marginBottom: '24px',
        border: '1px solid rgba(241, 76, 76, 0.2)'
      }}>
        <ShieldAlert size={64} color="#f14c4c" />
      </div>

      <h2 style={{ color: '#ffffff', margin: '0 0 16px', fontSize: '28px', fontWeight: '600' }}>
        Permission Required
      </h2>

      <p style={{ maxWidth: '480px', lineHeight: '1.6', margin: '0 0 32px', color: '#9e9e9e', fontSize: '15px' }}>
        Sonar Code Editor requires <strong style={{ color: '#fff' }}>Automation</strong> permission
        to securely monitor app switching during exams. Without this access, the application must remain locked.
      </p>

      <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '480px',
          width: '100%',
          textAlign: 'left',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Settings size={20} color="#60a5fa" />
          <strong style={{ color: '#e0e0e0', fontSize: '15px' }}>How to grant permission:</strong>
        </div>
        <ol style={{ margin: 0, paddingLeft: '24px', color: '#a0a0a0', lineHeight: '2' }}>
          <li>Open System Settings</li>
          <li>Go to <span style={{ color: '#ccc' }}>Privacy &amp; Security → Automation</span></li>
          <li>Enable <strong style={{ color: '#fff' }}>System Events</strong> for <strong style={{ color: '#fff' }}>Sonar Code Editor</strong></li>
          <li>Return to this window to continue automatically</li>
        </ol>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginTop: '32px' }}>
        <button
          onClick={openSettings}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 24px',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '15px',
            fontWeight: '500',
            transition: 'background 0.2s',
          }}
        >
          Open System Settings
        </button>
        <button
          onClick={recheck}
          disabled={checking}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 24px',
            background: 'rgba(255, 255, 255, 0.05)',
            color: checking ? '#666' : '#e0e0e0',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            cursor: checking ? 'not-allowed' : 'pointer',
            fontSize: '15px',
            fontWeight: '500',
            transition: 'all 0.2s',
          }}
        >
          <RefreshCw size={18} className={checking ? 'spin' : ''} />
          {checking ? 'Verifying…' : 'I\'ve enabled it'}
        </button>
      </div>
      <style>
        {`
          @keyframes spin-anim {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .spin {
            animation: spin-anim 1s linear infinite;
          }
        `}
      </style>
    </div>
  );
}

function InternetRestrictedBlock() {
  const [checking, setChecking] = useState(false);

  const checkManually = async () => {
    setChecking(true);
    try {
      if (window.electronAPI?.network) {
        await window.electronAPI.network.getStatus();
      }
      // Wait a moment for visual feedback and native hook synchronization
      await new Promise(r => setTimeout(r, 1000));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #121212 0%, #1e1e1e 100%)',
        color: '#e0e0e0',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '40px',
        textAlign: 'center',
      }}
    >
      <div style={{
        background: 'rgba(234, 179, 8, 0.1)',
        padding: '24px',
        borderRadius: '50%',
        marginBottom: '24px',
        border: '1px solid rgba(234, 179, 8, 0.2)'
      }}>
        <WifiOff size={64} color="#eab308" />
      </div>

      <h2 style={{ color: '#ffffff', margin: '0 0 16px', fontSize: '28px', fontWeight: '600' }}>
        Internet Access Restricted
      </h2>

      <p style={{ maxWidth: '440px', lineHeight: '1.6', margin: '0 0 32px', color: '#9e9e9e', fontSize: '15px' }}>
        The exam administrator has mandated an <strong style={{ color: '#fff' }}>offline-only</strong> environment. 
        Please disconnect from Wi-Fi or Ethernet to proceed with your session.
      </p>

      <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '20px',
          maxWidth: '440px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
          <AlertTriangle size={18} color="#eab308" />
          <strong style={{ color: '#e0e0e0', fontSize: '14px' }}>Network Connection Detected</strong>
        </div>
        <p style={{ margin: 0, color: '#a0a0a0', fontSize: '13px' }}>
          Disable your network adapters or turn off Wi-Fi, then click retry manually.
        </p>
      </div>

      <button
        onClick={checkManually}
        disabled={checking}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginTop: '32px',
          padding: '12px 32px',
          background: '#eab308',
          color: '#1a1a1a',
          border: 'none',
          borderRadius: '8px',
          cursor: checking ? 'not-allowed' : 'pointer',
          fontSize: '15px',
          fontWeight: '600',
          transition: 'all 0.2s',
          opacity: checking ? 0.7 : 1,
        }}
      >
        <RefreshCw size={18} className={checking ? 'spin' : ''} />
        {checking ? 'Checking Connection...' : 'Retry Connection'}
      </button>

      <style>
        {`
          @keyframes spin-anim {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .spin {
            animation: spin-anim 1s linear infinite;
          }
        `}
      </style>
    </div>
  );
}

function VersionBlockedPage({
  onRetry,
  checking,
  currentVersion,
  latestVersion,
  message,
}: {
  onRetry: () => Promise<void>;
  checking: boolean;
  currentVersion: string;
  latestVersion: string;
  message: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(145deg, #171717 0%, #0f172a 100%)',
        color: '#e5e7eb',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '40px',
        textAlign: 'center',
      }}
    >
      <div style={{
        background: 'rgba(239, 68, 68, 0.1)',
        padding: '24px',
        borderRadius: '50%',
        marginBottom: '24px',
        border: '1px solid rgba(239, 68, 68, 0.25)'
      }}>
        <AlertTriangle size={64} color="#ef4444" />
      </div>

      <h2 style={{ color: '#ffffff', margin: '0 0 14px', fontSize: '30px', fontWeight: 700 }}>
        Update Required
      </h2>

      <p style={{ maxWidth: '520px', lineHeight: '1.7', margin: '0 0 26px', color: '#cbd5e1', fontSize: '15px' }}>
        This version of Sonar Code Editor is no longer allowed for login.
        Install the latest approved version before continuing.
      </p>

      <div style={{
        width: '100%',
        maxWidth: '520px',
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '12px',
        padding: '18px 20px',
        textAlign: 'left',
      }}>
        <div style={{ marginBottom: '8px', color: '#94a3b8', fontSize: '13px' }}>Current Version</div>
        <div style={{ marginBottom: '14px', color: '#f8fafc', fontSize: '16px', fontWeight: 600 }}>{currentVersion || 'unknown'}</div>
        <div style={{ marginBottom: '8px', color: '#94a3b8', fontSize: '13px' }}>Required Latest Version</div>
        <div style={{ marginBottom: '14px', color: '#f8fafc', fontSize: '16px', fontWeight: 600 }}>{latestVersion || 'not available'}</div>
        <div style={{ color: '#fca5a5', fontSize: '13px' }}>{message}</div>
      </div>

      <button
        onClick={onRetry}
        disabled={checking}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginTop: '28px',
          padding: '12px 24px',
          background: '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          cursor: checking ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: 600,
          opacity: checking ? 0.75 : 1,
        }}
      >
        <RefreshCw size={16} className={checking ? 'spin' : ''} />
        {checking ? 'Checking Version...' : 'Retry Version Check'}
      </button>

      <style>
        {`
          @keyframes spin-anim {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .spin {
            animation: spin-anim 1s linear infinite;
          }
        `}
      </style>
    </div>
  );
}



function AppRoutes() {
  const { user, loading, internetBlocked, logout } = useAuth();
  const isOnline = useNetworkStatus();
  const [attestation, setAttestation] = useState<string | null>(null);
  const [invitePrefill, setInvitePrefill] = useState<LoginInvitePrefill | null>(null);
  const [inviteNotice, setInviteNotice] = useState<{
    message: string;
    type: 'error' | 'success';
  } | null>(null);

  const handleIncomingInvite = useCallback(
    async (incomingInvite: Parameters<typeof resolveIncomingInvite>[0]) => {
      const resolvedInvite = await resolveIncomingInvite(incomingInvite);

      if (!resolvedInvite) {
        if (user) {
          window.electronAPI?.dialog?.showError(
            'This invite link is invalid or could not be decrypted.',
          );
          return;
        }

        setInvitePrefill(null);
        setInviteNotice({
          message: 'This invite link is invalid or could not be decrypted.',
          type: 'error',
        });
        return;
      }

      if (user) {
        await logout();
      }

      setInvitePrefill(resolvedInvite);
      setInviteNotice(
        resolvedInvite.kind === 'hackathon'
          ? {
              message:
                resolvedInvite.studentId
                  ? 'Hackathon ID and student ID filled from invite. Enter the password to continue.'
                  : 'Hackathon ID filled from invite. Enter your student ID and password to continue.',
              type: 'success',
            }
          : null,
      );
    },
    [logout, user],
  );

  useEffect(() => {
    (async () => {
      try {
        const token = await window.electronAPI?.security?.getAttestationToken?.();
        setAttestation(token === 'DEV_MODE' ? 'DEV_MODE' : 'SECURE');
      } catch {
        setAttestation('SECURE');
      }
    })();
  }, []);

  useEffect(() => {
    let disposed = false;

    const consumePendingInvite = async () => {
      try {
        const pendingInvite = await window.electronAPI?.invite?.consumePending?.();
        if (!disposed && pendingInvite) {
          await handleIncomingInvite(pendingInvite);
        }
      } catch {
        // Ignore pending invite lookup failures.
      }
    };

    void consumePendingInvite();

    const unsubscribe = window.electronAPI?.invite?.onReceived?.((incomingInvite) => {
      void handleIncomingInvite(incomingInvite);
    });

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [handleIncomingInvite]);

  useEffect(() => {
    if (!user) return;
    setInvitePrefill(null);
    setInviteNotice(null);
  }, [user]);

  if (loading || attestation === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1e1e1e', color: '#d4d4d4' }}>
        <div>Loading...</div>
      </div>
    );
  }

  const showDevBanner = attestation === 'DEV_MODE';

  return (
    <>
      {showDevBanner && (
        <div style={{ background: '#d32f2f', color: '#fff', textAlign: 'center', padding: '6px 12px', fontSize: '12px', fontWeight: 'bold', zIndex: 9999, position: 'fixed', bottom: '16px', right: '16px', borderRadius: '4px', opacity: 0.8, pointerEvents: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
          ⚠️ DEV MODE
        </div>
      )}
      {!user ? (
        <Login invitePrefill={invitePrefill} inviteNotice={inviteNotice} />
      ) : internetBlocked && isOnline ? (
        <InternetRestrictedBlock />
      ) : (
        <Routes>
          <Route path="/ide" element={<IDE />} />
          <Route path="*" element={<Navigate to="/ide" />} />
        </Routes>
      )}
    </>
  );
}

export default function App() {
  const isOnline = useNetworkStatus();
  // null = checking, true = granted, false = denied
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [versionCheckState, setVersionCheckState] = useState<{
    status: 'checking' | 'allowed' | 'blocked';
    message: string;
    currentVersion: string;
    latestVersion: string;
  }>({
    status: 'checking',
    message: '',
    currentVersion: '',
    latestVersion: '',
  });
  const [versionRechecking, setVersionRechecking] = useState(false);

  useEffect(() => {
    // Add platform class to body for OS-specific styling globally
    const platform = window.navigator.userAgent.toLowerCase();
    if (platform.includes("mac")) {
      document.body.classList.add("platform-mac");
    } else if (platform.includes("win")) {
      document.body.classList.add("platform-windows");
    } else {
      document.body.classList.add("platform-linux");
    }
  }, []);

  useEffect(() => {
    // Add platform class to body for OS-specific styling globally
    const platform = window.navigator.userAgent.toLowerCase();
    if (platform.includes("mac")) {
      document.body.classList.add("platform-mac");
    } else if (platform.includes("win")) {
      document.body.classList.add("platform-windows");
    } else {
      document.body.classList.add("platform-linux");
    }
  }, []);

  useEffect(() => {
    // Add platform class to body for OS-specific styling globally
    const platform = window.navigator.userAgent.toLowerCase();
    if (platform.includes("mac")) {
      document.body.classList.add("platform-mac");
    } else if (platform.includes("win")) {
      document.body.classList.add("platform-windows");
    } else {
      document.body.classList.add("platform-linux");
    }
  }, []);

  const checkPermission = useCallback(async () => {
    if (!window.electronAPI?.system?.checkPermission) {
      // Not in Electron (dev web mode) — allow through
      setPermissionGranted(true);
      return;
    }
    try {
      const granted = await window.electronAPI.system.checkPermission();
      setPermissionGranted(granted);
    } catch {
      setPermissionGranted(true); // allow on unexpected error
    }
  }, []);

  const runVersionCheck = useCallback(async () => {
    if (!isOnline) {
      const localVersion = await getLocalAppVersion();
      setVersionCheckState({
        status: 'allowed',
        message: '',
        currentVersion: localVersion,
        latestVersion: '',
      });
      return;
    }

    setVersionRechecking(true);
    setVersionCheckState((prev) => ({ ...prev, status: 'checking' }));

    try {
      const result = await checkLatestVersionGate();
      if (result.upToDate) {
        setVersionCheckState({
          status: 'allowed',
          message: '',
          currentVersion: result.currentVersion,
          latestVersion: result.latestVersion,
        });
      } else {
        setVersionCheckState({
          status: 'blocked',
          message: result.message || `Update required. Please install ${result.latestVersion}.`,
          currentVersion: result.currentVersion,
          latestVersion: result.latestVersion,
        });
      }
    } catch (err: any) {
      const onlineNow = await window.electronAPI?.network?.getStatus?.().catch(() => false);
      if (!onlineNow) {
        const localVersion = await getLocalAppVersion();
        setVersionCheckState({
          status: 'allowed',
          message: '',
          currentVersion: localVersion,
          latestVersion: '',
        });
        return;
      }

      const localVersion = await getLocalAppVersion();

      setVersionCheckState({
        status: 'blocked',
        message: err?.message || 'Unable to verify app version. Try again later.',
        currentVersion: localVersion,
        latestVersion: '',
      });
    } finally {
      setVersionRechecking(false);
    }
  }, [isOnline]);

  // Initial check on mount
  useEffect(() => { checkPermission(); }, [checkPermission]);
  useEffect(() => { runVersionCheck(); }, [runVersionCheck]);
  useEffect(() => {
    const handleVersionBlocked = (event: Event) => {
      const customEvent = event as CustomEvent<{
        message?: string;
        currentVersion?: string;
        latestVersion?: string;
      }>;

      const detail = customEvent.detail || {};
      if (!isOnline) {
        return;
      }
      setVersionCheckState({
        status: 'blocked',
        message: detail.message || 'Update required to continue.',
        currentVersion: detail.currentVersion || '0.0.0-unknown',
        latestVersion: detail.latestVersion || '',
      });
    };

    window.addEventListener('version-gate-blocked', handleVersionBlocked as EventListener);
    return () => {
      window.removeEventListener('version-gate-blocked', handleVersionBlocked as EventListener);
    };
  }, [isOnline]);

  if (versionCheckState.status === 'checking') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1e1e1e', color: '#d4d4d4' }}>
        <div>Checking app version...</div>
      </div>
    );
  }

  if (versionCheckState.status === 'blocked') {
    return (
      <VersionBlockedPage
        onRetry={runVersionCheck}
        checking={versionRechecking}
        currentVersion={versionCheckState.currentVersion}
        latestVersion={versionCheckState.latestVersion}
        message={versionCheckState.message}
      />
    );
  }

  if (permissionGranted === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1e1e1e', color: '#d4d4d4' }}>
        <div>Checking permissions…</div>
      </div>
    );
  }

  if (!permissionGranted) {
    // Pass the recheck function so PermissionRequired can trigger a re-check
    // (also runs automatically on window focus — see inside PermissionRequired)
    return <PermissionRequired onRecheck={checkPermission} />;
  }

  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}
