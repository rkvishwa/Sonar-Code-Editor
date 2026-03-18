import React, { useCallback, useEffect, useRef, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import IDE from './pages/IDE';
import AdminDashboard from './pages/AdminDashboard';
import { useNetworkStatus } from './hooks/useNetworkStatus';

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

function AppRoutes() {
  const { user, loading, internetBlocked } = useAuth();
  const isOnline = useNetworkStatus();
  const [attestation, setAttestation] = useState<string | null>(null);

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
        <Login />
      ) : user.role === 'admin' ? (
        <Routes>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/admin" />} />
        </Routes>
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
  // null = checking, true = granted, false = denied
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

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

  // Initial check on mount
  useEffect(() => { checkPermission(); }, [checkPermission]);

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
