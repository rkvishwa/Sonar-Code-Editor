import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAllSessions, subscribeToActivityLogs, subscribeToSessions, getAllActivityLogs, getAdminTeamIds, parseSyncData } from '../services/appwrite';
import { Session, ActivityLog, ActivitySyncData, Team } from '../../shared/types';
import { APP_CONFIG } from '../../shared/constants';
import ReportModal from '../components/AdminPanel/ReportModal';
import { Radar, Shield, Clock, Activity, LayoutGrid, List, Search, LogOut, RefreshCw, BarChart2, ShieldAlert, Monitor, Users, Zap, CheckCircle2, XCircle, Settings, MoreVertical } from 'lucide-react';
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import AdminSettingsModal from '../components/AdminPanel/AdminSettingsModal';
import GlobalClock from '../components/GlobalClock';
import './AdminDashboard.css';

interface TeamStatus extends Session {
  currentWindow?: string;
  currentFile?: string;
  lastActivity?: string;
  syncData?: ActivitySyncData;
}

type SortKey = 'teamName' | 'status' | 'lastSeen';
type SortDir = 'asc' | 'desc';
type ViewMode = 'table' | 'grid';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [teams, setTeams] = useState<TeamStatus[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<TeamStatus | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('status');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const navigate = useNavigate();
  const location = useLocation();


  // Helper to get current sub-route
  const currentView = useMemo(() => {
    const path = location.pathname;
    if (path.includes('/admin/candidates')) return 'candidates';
    if (path.includes('/admin/settings')) return 'settings';
    return 'analytics';
  }, [location.pathname]);

  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [theme, setTheme] = useState(
    () => localStorage.getItem('ide-theme') || 'system'
  );
  const [accentColor, setAccentColor] = useState(
    () => localStorage.getItem("ide-accent-color") || "#3b82f6"
  );
  const unsubRefs = useRef<Array<() => void>>([]);
  const adminIdsRef = useRef<Set<string>>(new Set());

  const applyStaleCheck = useCallback((teamsList: TeamStatus[]): TeamStatus[] => {
    const now = Date.now();
    return teamsList.map((s) => {
      const lastSeenMs = new Date(s.lastSeen).getTime();
      const stale = now - lastSeenMs > APP_CONFIG.HEARTBEAT_INTERVAL_MS * 2;
      if (stale && s.status === 'online') return { ...s, status: 'offline' as const };
      return s;
    });
  }, []);

  const loadSessions = useCallback(async () => {
    const [sessions, logs, adminIds] = await Promise.all([
      getAllSessions(),
      getAllActivityLogs(100),
      getAdminTeamIds(),
    ]);
    adminIdsRef.current = adminIds;

    // Build a map of sync data per team from single-row activity logs
    const syncMap = new Map<string, ActivitySyncData>();
    const logMetaMap = new Map<string, { currentWindow?: string; currentFile?: string }>();
    for (const log of logs) {
      if (!syncMap.has(log.teamId)) {
        syncMap.set(log.teamId, parseSyncData(log));
        logMetaMap.set(log.teamId, { currentWindow: log.currentWindow, currentFile: log.currentFile });
      }
    }

    const now = Date.now();
    const fetched = sessions
      .filter((s) => !adminIds.has(s.teamId))
      .map((s) => {
        const lastSeenMs = new Date(s.lastSeen).getTime();
        const stale = now - lastSeenMs > APP_CONFIG.HEARTBEAT_INTERVAL_MS * 2;
        const meta = logMetaMap.get(s.teamId);
        return {
          ...s,
          status: stale ? 'offline' : s.status,
          syncData: syncMap.get(s.teamId),
          currentWindow: meta?.currentWindow,
          currentFile: meta?.currentFile,
        } as TeamStatus;
      });
    setTeams((prev) => {
      const prevMap = new Map(prev.map((t) => [t.teamId, t]));
      return fetched.map((s) => {
        const existing = prevMap.get(s.teamId);
        if (!existing) return s;
        const existingMs = new Date(existing.lastSeen).getTime();
        const fetchedMs = new Date(s.lastSeen).getTime();
        // Preserve more recent realtime data over potentially stale DB data
        if (existingMs > fetchedMs) {
          return { ...s, lastSeen: existing.lastSeen, status: existing.status, currentWindow: existing.currentWindow || s.currentWindow, currentFile: existing.currentFile || s.currentFile, lastActivity: existing.lastActivity };
        }
        return { ...s, currentWindow: s.currentWindow || existing.currentWindow, currentFile: s.currentFile || existing.currentFile, lastActivity: existing.lastActivity };
      });
    });
    setActivityLogs(logs);
    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    let activeTheme = theme;
    if (theme === 'system') {
      activeTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';

      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        if (theme === 'system') {
          document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        }
      };
      mediaQuery.addEventListener('change', listener);
      document.documentElement.setAttribute('data-theme', activeTheme);
      localStorage.setItem('ide-theme', theme);

      return () => mediaQuery.removeEventListener('change', listener);
    } else {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('ide-theme', theme);
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("ide-accent-color", accentColor);
    const root = document.documentElement;
    root.style.setProperty("--user-accent", accentColor);
    root.style.setProperty("--user-accent-hover", accentColor);

    let r = 59, g = 130, b = 246; // default blue
    if (accentColor.startsWith('#') && (accentColor.length === 7 || accentColor.length === 9)) {
      r = parseInt(accentColor.slice(1, 3), 16);
      g = parseInt(accentColor.slice(3, 5), 16);
      b = parseInt(accentColor.slice(5, 7), 16);
    }
    root.style.setProperty("--user-accent-rgb", `${r}, ${g}, ${b}`);
  }, [accentColor]);

  useEffect(() => {
    loadSessions();

    const unsubActivity = subscribeToActivityLogs((log: ActivityLog) => {
      if (adminIdsRef.current.has(log.teamId)) return;
      const sync = parseSyncData(log);
      setTeams((prev) => {
        const idx = prev.findIndex((t) => t.teamId === log.teamId);
        if (idx === -1) return prev;
        const updated = [...prev];

        updated[idx] = {
          ...updated[idx],
          currentWindow: log.currentWindow || updated[idx].currentWindow,
          currentFile: log.currentFile || updated[idx].currentFile,
          status: 'online',
          lastSeen: log.timestamp,
          lastActivity: log.timestamp,
          syncData: sync,
        };
        return updated;
      });
      setActivityLogs((prev) => {
        // Replace the existing log for this team rather than accumulating
        const filtered = prev.filter((l) => l.teamId !== log.teamId);
        return [log, ...filtered];
      });
      setLastUpdated(new Date());
    });

    const unsubSessions = subscribeToSessions((session: Session) => {
      if (adminIdsRef.current.has(session.teamId)) return;
      setTeams((prev) => {
        const idx = prev.findIndex((t) => t.teamId === session.teamId);
        if (idx === -1) return [...prev, session as TeamStatus];
        const updated = [...prev];
        updated[idx] = { ...updated[idx], ...session };
        return updated;
      });
      setLastUpdated(new Date());
    });

    unsubRefs.current = [unsubActivity, unsubSessions];
    const pollInterval = setInterval(loadSessions, 30000);

    // Frequent stale-check: re-evaluate online→offline every 5s based on lastSeen
    const staleCheckInterval = setInterval(() => {
      setTeams((prev) => applyStaleCheck(prev));
    }, 5000);

    return () => {
      unsubRefs.current.forEach((fn) => fn());
      clearInterval(pollInterval);
      clearInterval(staleCheckInterval);
    };
  }, [loadSessions, applyStaleCheck]);

  // Computed metrics
  const onlineCount = teams.filter((t) => t.status === 'online').length;
  const offlineCount = teams.filter((t) => t.status === 'offline').length;
  const onlinePercent = teams.length > 0 ? Math.round((onlineCount / teams.length) * 100) : 0;

  // Team-level activity metrics (derived from syncData on each team)
  const teamMetrics = useMemo(() => {
    const metrics = new Map<string, {
      totalLogs: number;
      uniqueApps: Set<string>;
      uniqueWindows: Set<string>;
      lastFile: string;
      lastWindow: string;
      firstSeen: string;
      lastSeen: string;
      onlineSec: number;
      offlineSec: number;
      appBlurCount: number;
      extPasteCount: number;
      onlineCount: number;
      clipboardCopyCount: number;
      totalEvents: number;
    }>();

    for (const team of teams) {
      const sync = team.syncData;
      if (!sync) continue;
      const apps = Object.keys(sync.apps);

      // Count activity events
      let appBlurCount = 0;
      let extPasteCount = 0;
      let onlineCount = 0;
      let clipboardCopyCount = 0;
      const events = sync.activityEvents || [];
      for (const e of events) {
        if (e.type === 'app_blur') appBlurCount++;
        else if (e.type === 'clipboard_paste_external') extPasteCount++;
        else if (e.type === 'status_online') onlineCount++;
        else if (e.type === 'clipboard_copy') clipboardCopyCount++;
      }

      metrics.set(team.teamId, {
        totalLogs: sync.heartbeatCount,
        uniqueApps: new Set(apps),
        uniqueWindows: new Set(sync.windows),
        lastFile: sync.files.length > 0 ? sync.files[sync.files.length - 1] : '',
        lastWindow: sync.windows.length > 0 ? sync.windows[sync.windows.length - 1] : '',
        firstSeen: sync.sessionStart,
        lastSeen: sync.lastStatusAt,
        onlineSec: sync.totalOnlineSec,
        offlineSec: sync.totalOfflineSec,
        appBlurCount,
        extPasteCount,
        onlineCount,
        clipboardCopyCount,
        totalEvents: events.length,
      });
    }
    return metrics;
  }, [teams]);

  // Global activity insights
  const globalInsights = useMemo(() => {
    const switchedAppCounts = new Map<string, number>();
    let totalOnlineSec = 0;
    let totalOfflineSec = 0;
    let totalHeartbeats = 0;

    for (const team of teams) {
      const sync = team.syncData;
      if (!sync) continue;
      totalHeartbeats += sync.heartbeatCount;
      totalOnlineSec += sync.totalOnlineSec;
      totalOfflineSec += sync.totalOfflineSec;
      // Count switched-to apps from app_blur events
      for (const ev of (sync.activityEvents || [])) {
        if (ev.type === 'app_blur' && ev.details) {
          const m = ev.details.match(/^(?:Switched to|Active app):\s*(.+)$/i);
          if (m) {
            const raw = m[1].trim();
            const parts = raw.split(' - ');
            const appName = parts[parts.length - 1].trim() || raw;
            switchedAppCounts.set(appName, (switchedAppCounts.get(appName) || 0) + 1);
          }
        }
      }
    }

    const topApps = Array.from(switchedAppCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Active teams in last 5 min
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const recentlyActive = teams.filter((t) => new Date(t.lastSeen).getTime() > fiveMinAgo).length;

    // Average session duration estimate
    let totalSessionDuration = 0;
    let sessionCount = 0;
    teamMetrics.forEach((m) => {
      const duration = new Date(m.lastSeen).getTime() - new Date(m.firstSeen).getTime();
      if (duration > 0) {
        totalSessionDuration += duration;
        sessionCount++;
      }
    });
    const avgSessionMs = sessionCount > 0 ? totalSessionDuration / sessionCount : 0;

    return {
      totalLogs: totalHeartbeats,
      uniqueApps: switchedAppCounts.size,
      topApps,
      totalOnlineSec,
      totalOfflineSec,
      recentlyActive,
      avgSessionMs,
    };
  }, [teams, teamMetrics]);

  // Filtering & sorting
  const filteredTeams = useMemo(() => {
    let result = teams.filter((t) =>
      !search || t.teamName.toLowerCase().includes(search.toLowerCase())
    );
    if (statusFilter !== 'all') {
      result = result.filter((t) => t.status === statusFilter);
    }
    result.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'teamName') cmp = a.teamName.localeCompare(b.teamName);
      else if (sortKey === 'status') cmp = a.status.localeCompare(b.status);
      else if (sortKey === 'lastSeen') cmp = new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime();
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [teams, search, statusFilter, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const formatTime = (iso: string) => {
    if (!iso) return '\u2014';
    return new Date(iso).toLocaleTimeString();
  };

  const timeSince = (iso: string) => {
    if (!iso) return '\u2014';
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  const formatDuration = (ms: number) => {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    const h = Math.floor(ms / 3600000);
    const m = Math.round((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return '\u2195';
    return sortDir === 'asc' ? '\u2191' : '\u2193';
  };

  const handleOpenReport = (team: TeamStatus) => {
    setSelectedTeam(team);
    setShowReport(true);
  };

  return (
    <div className="admin-container">
      <div className={`admin-sidebar ${isSidebarExpanded ? 'expanded' : 'collapsed'}`}>
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <div className="admin-logo">
              <div className="logo-icon-wrapper">
                <Radar className="logo-icon" size={24} />
              </div>
              <div className="logo-info">
                <span className="logo-text">Sonar</span>
                <div className="admin-live-badge mini">
                  <span className="live-dot" />
                  <span className="badge-text">Live</span>
                </div>
              </div>
            </div>
            <button className="sidebar-toggle-btn" onClick={() => setIsSidebarExpanded(!isSidebarExpanded)} title="Toggle Menu">
              <MoreVertical size={16} />
            </button>
          </div>
        </div>

        <div className="sidebar-nav">
          <button className={`sidebar-item ${currentView === 'analytics' ? 'active' : ''}`} onClick={() => navigate('/admin/dashboard')} title="Analytics">
            <BarChart2 size={18} className="nav-icon" />
            <span className="item-text">Analytics</span>
          </button>
          <button className={`sidebar-item ${currentView === 'candidates' ? 'active' : ''}`} onClick={() => navigate('/admin/candidates')} title="Candidates">
            <Users size={18} className="nav-icon" />
            <span className="item-text">Candidates</span>
          </button>
          <button className="sidebar-item" onClick={loadSessions} title="Refresh Data">
            <RefreshCw size={18} className={`nav-icon ${loading ? 'anim-spin' : ''}`} />
            <span className="item-text">Refresh Data</span>
          </button>
          <button className={`sidebar-item ${currentView === 'settings' ? 'active' : ''}`} onClick={() => navigate('/admin/settings')} title="Settings">
            <Settings size={18} className="nav-icon" />
            <span className="item-text">Settings</span>
          </button>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-user-card" title={user?.teamName || 'Admin'}>
            <div className="user-avatar">
              <ShieldAlert size={16} className="user-icon" />
            </div>
            <div className="user-details">
              <span className="user-name">{user?.teamName || 'Admin'}</span>
              <span className="user-role">Administrator</span>
            </div>
          </div>
          <button className="sidebar-item btn-danger" onClick={logout} title="Sign Out">
            <LogOut size={18} className="nav-icon" />
            <span className="item-text">Sign Out</span>
          </button>
        </div>
      </div>

      <div className="admin-content" style={{ display: 'flex', flexDirection: 'column' }}>
        {currentView !== 'candidates' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 32px 0 32px', flexShrink: 0 }}>
            <GlobalClock mode="inline" />
          </div>
        )}
        <Routes>
          <Route path="dashboard" element={
            <>
              {/* Dashboard Analytics Grid */}
              <div className="analytics-grid-layout">
                <div className="stats-row">
                  <div className="stat-card">
                    <div className="stat-card-header">
                      <div className="stat-icon neutral"><Users size={18} /></div>
                      <span className="stat-label">Total Candidates</span>
                    </div>
                    <div className="stat-body">
                      <span className="stat-value">{teams.length}</span>
                    </div>
                    <div className="stat-bar"><div className="stat-bar-fill neutral" style={{ width: '100%' }} /></div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-card-header">
                      <div className="stat-icon online"><Zap size={18} /></div>
                      <span className="stat-label">Active Now</span>
                    </div>
                    <div className="stat-body">
                      <span className="stat-value">{onlineCount}</span>
                      <span className="stat-percent online">{onlinePercent}%</span>
                    </div>
                    <div className="stat-bar"><div className="stat-bar-fill online" style={{ width: `${onlinePercent}%` }} /></div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-card-header">
                      <div className="stat-icon offline"><XCircle size={18} /></div>
                      <span className="stat-label">Disconnected</span>
                    </div>
                    <div className="stat-body">
                      <span className="stat-value">{offlineCount}</span>
                      <span className="stat-percent offline">{teams.length > 0 ? Math.round((offlineCount / teams.length) * 100) : 0}%</span>
                    </div>
                    <div className="stat-bar"><div className="stat-bar-fill offline" style={{ width: `${teams.length ? (offlineCount / teams.length) * 100 : 0}%` }} /></div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-card-header">
                      <div className="stat-icon accent"><Activity size={18} /></div>
                      <span className="stat-label">Events Tracked</span>
                    </div>
                    <div className="stat-body">
                      <span className="stat-value">{globalInsights.totalLogs}</span>
                    </div>
                    <div className="stat-bar"><div className="stat-bar-fill accent" style={{ width: '100%' }} /></div>
                  </div>
                </div>

                {/* Global Action Insights */}
                <div className="insight-card full-width">
                  <div className="insight-card-header">
                    <div className="insight-title"><Monitor size={16} /> Distracting Apps Detected</div>
                    <span className="insight-stat-pill">Platform Wide</span>
                  </div>
                  {globalInsights.topApps.length > 0 ? (
                    <div className="top-apps-list">
                      {globalInsights.topApps.map(([app, count], idx) => {
                        const isFlagged = app.toLowerCase().includes('discord') || app.toLowerCase().includes('youtube') || app.toLowerCase().includes('whatsapp');
                        const maxCount = globalInsights.topApps[0][1];
                        const pct = Math.round((count / maxCount) * 100);
                        return (
                          <div key={idx} className="top-app-item">
                            <div className="top-app-header">
                              <span className="top-app-rank">#{idx + 1}</span>
                              <span className={`top-app-name ${isFlagged ? 'flagged' : ''}`}>{app}</span>
                              <span className="top-app-count">{count} switches</span>
                            </div>
                            <div className="top-app-bar">
                              <div className={`top-app-bar-fill ${isFlagged ? 'non-ide' : ''}`} style={{ width: `${pct}%`, background: isFlagged ? '#f59e0b' : 'rgba(255,255,255,0.15)' }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="insight-empty">
                      <Monitor size={24} style={{ opacity: 0.3 }} />
                      <span>No app switches detected yet</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          } />

          <Route path="candidates" element={
            <>
              {/* Sticky Toolbar */}
              <div className="admin-controls-bar">
                <div className="controls-left">
                  <div className="search-wrapper">
                    <Search className="search-icon" size={16} />
                    <input
                      type="text"
                      placeholder="Search candidates..."
                      className="admin-search-input"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="filter-group">
                    <button className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => setStatusFilter('all')}>
                      All <span className="filter-badge">{teams.length}</span>
                    </button>
                    <button className={`filter-btn ${statusFilter === 'online' ? 'active' : ''}`} onClick={() => setStatusFilter('online')}>
                      Online <span className="filter-badge">{onlineCount}</span>
                    </button>
                    <button className={`filter-btn ${statusFilter === 'offline' ? 'active' : ''}`} onClick={() => setStatusFilter('offline')}>
                      Offline <span className="filter-badge">{offlineCount}</span>
                    </button>
                  </div>
                </div>
                <div className="controls-right">
                  <GlobalClock mode="inline" className="candidates-time" style={{ marginRight: '16px' }} />
                  <div className="view-toggle">
                    <button className={`view-btn ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')} title="List View"><List size={16} /></button>
                    <button className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')} title="Grid View"><LayoutGrid size={16} /></button>
                  </div>
                </div>
              </div>

              {/* Dynamic Display Area */}
              <div className="admin-content-area">
                {loading ? (
                  <div className="state-container">
                    <RefreshCw className="anim-spin spinner-glow" size={28} />
                    <span>Syncing live data...</span>
                  </div>
                ) : filteredTeams.length === 0 ? (
                  <div className="state-container">
                    <Users size={28} style={{ opacity: 0.25 }} />
                    <span>No candidates match your filters</span>
                  </div>
                ) : viewMode === 'table' ? (
                  /* Table View */
                  <div className="glass-panel">
                    <table className="modern-table">
                      <thead>
                        <tr>
                          <th className="th-sortable" onClick={() => handleSort('teamName')}>
                            <div className="th-content">Candidate {sortKey === 'teamName' && (sortDir === 'asc' ? '↑' : '↓')}</div>
                          </th>
                          <th className="th-sortable" onClick={() => handleSort('status')}>
                            <div className="th-content">Status {sortKey === 'status' && (sortDir === 'asc' ? '↑' : '↓')}</div>
                          </th>
                          <th>Activity Insights</th>
                          <th className="th-sortable" onClick={() => handleSort('lastSeen')}>
                            <div className="th-content">Last Seen {sortKey === 'lastSeen' && (sortDir === 'asc' ? '↑' : '↓')}</div>
                          </th>
                          <th className="th-actions">Manage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTeams.map((team) => {
                          const metrics = teamMetrics.get(team.teamId);
                          const riskLevel = metrics && metrics.appBlurCount > 10 ? 'high' : (metrics && metrics.appBlurCount > 3 ? 'medium' : 'low');

                          return (
                            <tr key={team.teamId} className="team-row">
                              <td>
                                <div className="team-identity">
                                  <div className={`team-avatar ${team.status}`}>
                                    {team.teamName.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="team-info">
                                    <span className="team-name">{team.teamName}</span>
                                    <span className="team-window" title={team.currentWindow || 'Idle'}>
                                      {team.currentWindow || 'Awaiting window context'}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div className={`status-chip ${team.status}`}>
                                  <span className="status-dot"></span>
                                  {team.status === 'online' ? 'Active' : 'Offline'}
                                </div>
                              </td>
                              <td>
                                {metrics ? (
                                  <div className="metrics-cluster">
                                    <div className="metric-pill" title="Total Events">
                                      <Activity size={12} className="meta-icon" />
                                      <span>{metrics.totalEvents}</span>
                                    </div>
                                    <div className={`metric-pill ${metrics.appBlurCount > 0 ? 'warn' : 'clean'}`} title="App Switches">
                                      <Monitor size={12} className="meta-icon" />
                                      <span>{metrics.appBlurCount}</span>
                                    </div>
                                    <div className={`risk-badge ${riskLevel}`}>
                                      {riskLevel === 'high' ? 'High Risk' : (riskLevel === 'medium' ? 'Review' : 'Secure')}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="metric-chip clean">Assimilating...</span>
                                )}
                              </td>
                              <td>
                                <div className="time-display">
                                  <Clock size={12} />
                                  {formatTime(team.lastSeen)}
                                </div>
                              </td>
                              <td className="td-actions">
                                <button className="action-btn" onClick={() => handleOpenReport(team)}>
                                  <BarChart2 size={13} />
                                  View Report
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* Grid View */
                  <div className="modern-grid">
                    {filteredTeams.map(team => {
                      const metrics = teamMetrics.get(team.teamId);
                      return (
                        <div key={team.teamId} className={`grid-card ${team.status}`}>
                          <div className="grid-card-glow" />
                          <div className="gc-header">
                            <div className="gc-avatar">{team.teamName.charAt(0).toUpperCase()}</div>
                            <div className="gc-title">
                              <h4>{team.teamName}</h4>
                              <div className={`status-sm ${team.status}`}>
                                <span className="dot" />
                                {team.status}
                              </div>
                            </div>
                          </div>

                          <div className="gc-body">
                            <div className="gc-stat-row">
                              <span className="gc-label">Active Window</span>
                              <span className="gc-val truncate" title={team.currentWindow || 'N/A'}>{team.currentWindow || 'N/A'}</span>
                            </div>
                            <div className="gc-stat-row">
                              <span className="gc-label">Active File</span>
                              <span className="gc-val truncate" title={team.currentFile || 'N/A'}>{team.currentFile || 'N/A'}</span>
                            </div>
                            {metrics && (
                              <div className="gc-stat-row mt-4">
                                <span className="gc-label">Away / Focus Loss</span>
                                <span className={`gc-val ${metrics.appBlurCount > 3 ? 'warn' : ''}`}>{metrics.appBlurCount} events</span>
                              </div>
                            )}
                          </div>

                          <div className="gc-footer">
                            <span className="gc-time"><Clock size={12} /> {formatTime(team.lastSeen)}</span>
                            <button className="gc-btn" onClick={() => handleOpenReport(team)}>Report</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          } />

          <Route path="settings" element={
            <div className="settings-view-wrapper">
              <AdminSettingsModal
                isOpen={true}
                isEmbedded={true}
                onClose={() => navigate('dashboard')}
                user={user}
                onLogout={logout}
                theme={theme}
                onThemeChange={setTheme}
                accentColor={accentColor}
                onAccentColorChange={setAccentColor}
                onTeamNameUpdated={(newName) => {
                  const updated = { ...user!, teamName: newName };
                  localStorage.setItem('sonar_session', JSON.stringify(updated));
                  window.location.reload();
                }}
              />
            </div>
          } />

          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </div>

      {showReport && selectedTeam && (
        <ReportModal
          team={selectedTeam as any}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}
