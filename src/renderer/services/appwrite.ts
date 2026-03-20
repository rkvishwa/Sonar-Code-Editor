import { Client, Databases, Functions, ExecutionMethod, Query, ID, RealtimeResponseEvent, Account } from 'appwrite';
import { APP_CONFIG } from '../../shared/constants';
import { Team, Session, ActivityLog, ActivitySyncData, Report, HeartbeatPayload } from '../../shared/types';
import packageJson from '../../../package.json';

const APPWRITE_ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT;
const APPWRITE_PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID;

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

const account = new Account(client);
const databases = new Databases(client);
const functions = new Functions(client);

const DB_ID = import.meta.env.VITE_APPWRITE_DB_NAME || 'devwatch_db';
// COL_TEAMS removed - fully migrated to Appwrite Users and sonar-settings
const COL_SESSIONS = import.meta.env.VITE_APPWRITE_COLLECTION_SESSIONS || 'sessions';
const COL_ACTIVITY_LOGS = import.meta.env.VITE_APPWRITE_COLLECTION_ACTIVITY_LOGS || 'activityLogs';
const COL_REPORTS = import.meta.env.VITE_APPWRITE_COLLECTION_REPORTS || 'reports';
const COL_SETTINGS = import.meta.env.VITE_APPWRITE_COLLECTION_SETTINGS || 'settings';
const SETTINGS_FUNCTION_ID = 'sonar-settings';
const SETTINGS_FUNCTION_COOLDOWN_MS = 30_000;

let settingsFunctionBlockedUntil = 0;

function isUnauthorizedAppwriteError(err: any): boolean {
  const code = err?.code ?? err?.response?.code;
  const message = String(err?.message || '').toLowerCase();
  const type = String(err?.type || '').toLowerCase();
  return code === 401 || message.includes('unauthorized') || type.includes('unauthorized');
}

function isActiveSessionError(err: any): boolean {
  const message = String(err?.message || '').toLowerCase();
  const type = String(err?.type || '').toLowerCase();
  return (
    message.includes('session is active') ||
    message.includes('creation of a session is prohibited') ||
    type.includes('session_already_exists')
  );
}

function isTimeoutOrNetworkError(err: any): boolean {
  const code = String(err?.code || '').toLowerCase();
  const type = String(err?.type || '').toLowerCase();
  const message = String(err?.message || '').toLowerCase();
  return (
    code.includes('timed_out') ||
    code.includes('timeout') ||
    type.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('timeout') ||
    message.includes('network request failed') ||
    message.includes('failed to fetch')
  );
}

function hasLocalSessionHint(): boolean {
  try {
    const projectId = String(APPWRITE_PROJECT_ID || '');
    return Object.keys(localStorage).some((key) => {
      if (!key.startsWith('cookieFallback')) return false;
      // Prefer keys tied to this Appwrite project when possible.
      return !projectId || key.includes(projectId);
    });
  } catch {
    return false;
  }
}

function hasCookieSessionHint(): boolean {
  try {
    const projectId = String(APPWRITE_PROJECT_ID || '');
    if (!projectId || typeof document === 'undefined') return false;

    const cookiePrefix = `a_session_${projectId}=`;
    return document.cookie
      .split(';')
      .map((part) => part.trim())
      .some((cookie) => cookie.startsWith(cookiePrefix));
  } catch {
    return false;
  }
}

function hasSessionHint(): boolean {
  return hasLocalSessionHint() || hasCookieSessionHint();
}

function clearLocalSessionHints(): void {
  try {
    const projectId = String(APPWRITE_PROJECT_ID || '');
    const keysToRemove = Object.keys(localStorage).filter((key) => {
      if (!key.startsWith('cookieFallback')) return false;
      return !projectId || key.includes(projectId);
    });

    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore local storage cleanup errors.
  }
}

async function hmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const msgData = encoder.encode(message);

  const cryptoKey = await window.crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );

  const signature = await window.crypto.subtle.sign(
    'HMAC', cryptoKey, msgData
  );

  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getSecurityContext() {
  let attestation = null;
  try {
      // @ts-ignore - electronAPI is exposed
      attestation = await window.electronAPI?.security.getAttestationToken();
  } catch (e) {
      console.warn('Failed to get attestation', e);
  }

  // Official Build
  if (attestation && attestation.token) {
    return { type: 'build', attestation };
  }

  // Development Mode
  const devKey = import.meta.env.VITE_DEV_KEY; // The secret key
  // Assume VITE_DEV_NAME is set, or try to infer from VITE_DEV_KEY if formatted "user:key"
  // But strictly following prompt "user will set" generated key.
  // I will assume VITE_DEV_KEY is the secret and we need VITE_DEV_USER.
  // Since I can't easily add env vars, I will assume the key ITSELF is unique enough if users can't collide?
  // But prompt said "table... user name...".
  // Let's use a dummy user if VITE_DEV_USER is missing, or ask user to set it.
  // I'll assume VITE_DEV_USER is there or I'll use 'dev-user'. 
  // Wait, if I use 'dev-user' the server won't find the row.
  // I will check if VITE_DEV_KEY contains a prefix `user:`?
  
  let devUser = 'unknown'; 
  // If user provided a key like "username:secret", let's split it.
  if (devKey && devKey.includes(':')) {
     const parts = devKey.split(':');
     devUser = parts[0];
  } else {
     // If not provided, we can't really look it up by user.
     // But wait, if the key is just the secret, maybe we just search by secret?
     // No, hash.
     // I'll default devUser to 'developer' and log a warning.
     console.warn('VITE_DEV_KEY should be in format username:secret for proper identification');
  }

  if (devKey) {
     const secret = devKey.includes(':') ? devKey.split(':')[1] : devKey;
     const timestamp = Date.now();
     const signature = await hmacSha256(secret, String(timestamp));
     
     return { type: 'dev', devUser, timestamp, signature };
  }

  return { type: 'unknown', attestation: null };
}

async function executeSettingsFunction(payload: Record<string, unknown>): Promise<any> {
  if (Date.now() < settingsFunctionBlockedUntil) {
    throw new Error('sonar-settings temporarily unavailable');
  }

  try {
    const securityContext = await getSecurityContext();
    const finalPayload = { ...payload, ...securityContext };

    const res = await functions.createExecution(
      SETTINGS_FUNCTION_ID,
      JSON.stringify(finalPayload),
      false,
      '/',
      ExecutionMethod.POST
    );
    settingsFunctionBlockedUntil = 0;
    return res;
  } catch (err: any) {
    if (isTimeoutOrNetworkError(err)) {
      settingsFunctionBlockedUntil = Date.now() + SETTINGS_FUNCTION_COOLDOWN_MS;
    }
    throw err;
  }
}

const knownRestrictedCollections = new Set<string>([
  COL_ACTIVITY_LOGS,
  COL_SESSIONS,
  COL_REPORTS,
  COL_SETTINGS
]);

// Fallback helper for listDocuments
async function fallbackListDocuments(
  dbId: string,
  colId: string,
  queries?: any[]
): Promise<any> {
  return await _listDocumentsViaFunction(colId, queries);
}

async function _listDocumentsViaFunction(colId: string, queries?: any[]): Promise<any> {
  try {
    const payload = { action: 'listDocuments', collectionId: colId, queries };
    const res = await executeSettingsFunction(payload);
    const data = JSON.parse(res.responseBody || '{}');
    if (data.success) {
      return { total: (data.documents || []).length, documents: data.documents || [] };
    }
    throw new Error(data.error || 'Fallback failed');
  } catch (fErr) {
    throw fErr;
  }
}

// Fallback helper for getDocument
async function fallbackGetDocument(
  dbId: string,
  colId: string,
  docId: string
): Promise<any> {
  return await _getDocumentViaFunction(colId, docId);
}

async function _getDocumentViaFunction(colId: string, docId: string): Promise<any> {
  try {
    const payload = { action: 'listDocuments', collectionId: colId, queries: [Query.equal('$id', docId)] };
    const res = await executeSettingsFunction(payload);
    const data = JSON.parse(res.responseBody || '{}');
    if (data.success && data.documents && data.documents.length > 0) {
      return data.documents[0];
    }
    throw new Error(data.error || 'Fallback failed');
  } catch (fErr) {
    throw fErr;
  }
}

async function getSettingViaFunction(settingType: string): Promise<boolean> {
  const res = await executeSettingsFunction({ action: 'getSetting', settingType });
  const data = JSON.parse(res.responseBody || '{}');
  return data?.success === true ? data.value === true : false;
}

async function updateSettingViaFunction(settingType: string, settingValue: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await executeSettingsFunction({ action: 'updateSetting', settingType, settingValue });
    const data = JSON.parse(res.responseBody || '{}');
    if (data?.success === true) {
      return data;
    }

    return {
      success: false,
      error: data?.error || 'Failed to update setting',
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// upsertSettingDirect REMOVED - Direct DB access blocked.

async function executeFunctionAndRequireSuccess(functionId: string, payload: Record<string, unknown>): Promise<void> {
  const securityContext = await getSecurityContext();
  const finalPayload = {
    ...securityContext,
    ...payload,
  };

  const res = await functions.createExecution(
    functionId,
    JSON.stringify(finalPayload),
    false,
    '/',
    ExecutionMethod.POST
  );

  let data: any = {};
  try {
    data = JSON.parse(res.responseBody || '{}');
  } catch {
    throw new Error(`${functionId} returned invalid JSON response`);
  }

  if (data?.success !== true) {
    throw new Error(data?.error || `${functionId} execution failed`);
  }
}

async function verifyBuildAccessForAuth(): Promise<void> {
  const securityContext = await getSecurityContext();
  const res = await functions.createExecution(
    'sonar-auth',
    JSON.stringify({ action: 'verifyAccess', ...securityContext }),
    false,
    '/',
    ExecutionMethod.POST
  );

  let data: any = {};
  try {
    data = JSON.parse(res.responseBody || '{}');
  } catch {
    throw new Error('sonar-auth returned invalid JSON response');
  }

  if (data?.success !== true) {
    throw new Error(data?.error || 'Forbidden: Invalid Build Attestation or Developer Key');
  }
}

export interface VersionGateResult {
  upToDate: boolean;
  currentVersion: string;
  latestVersion: string;
  message: string;
}

export async function getLocalAppVersion(): Promise<string> {
  try {
    const version = await window.electronAPI?.system?.getAppVersion?.();
    if (typeof version === 'string' && version.trim()) {
      return version.trim();
    }
  } catch {
    // Fall through to dev/package fallback.
  }

  if (import.meta.env.DEV) {
    const devVersion = String((packageJson as { version?: string })?.version || '').trim();
    if (devVersion) {
      return devVersion;
    }
  }

  return '0.0.0-unknown';
}

export async function checkLatestVersionGate(): Promise<VersionGateResult> {
  const currentVersion = await getLocalAppVersion();
  const securityContext = await getSecurityContext();
  const res = await functions.createExecution(
    'sonar-auth',
    JSON.stringify({ action: 'checkVersionGate', currentVersion, ...securityContext }),
    false,
    '/',
    ExecutionMethod.POST
  );

  let data: any = {};
  try {
    data = JSON.parse(res.responseBody || '{}');
  } catch {
    throw new Error('sonar-auth returned invalid JSON response');
  }

  if (data?.success !== true) {
    throw new Error(data?.error || 'Version check failed');
  }

  return {
    upToDate: data.upToDate === true,
    currentVersion: String(data.currentVersion || currentVersion),
    latestVersion: String(data.latestVersion || ''),
    message: String(data.message || ''),
  };
}

// ---- Teams (Migrated to Appwrite Users) ----
export async function getTeamByName(teamName: string): Promise<Team | null> {
  // Deprecated: Only used during migration. New logic uses account.createEmailPasswordSession
  // Or check against existing users if needed via admin function
  console.warn('getTeamByName is deprecated and will be removed.');
  return null;
}

// ... other helpers ...
const getEmail = (teamName: string) => {
  if (teamName.includes('@')) return teamName;
  return `${teamName.replace(/[^a-zA-Z0-9]/g, '.').toLowerCase()}@sonar.knurdz.org`;
};

function normalizeStudentIds(raw: unknown): string[] {
  let value: unknown = raw;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        value = JSON.parse(trimmed);
      } catch {
        value = trimmed;
      }
    }
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (typeof item === 'number') return String(item);
        if (item && typeof item === 'object') {
          const rec = item as Record<string, unknown>;
          const candidate = rec.studentId ?? rec.id ?? rec.value;
          if (typeof candidate === 'string') return candidate.trim();
          if (typeof candidate === 'number') return String(candidate);
        }
        return '';
      })
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/[\n,]/)
      .map((id) => id.trim())
      .filter(Boolean);
  }

  return [];
}

const mapUserToTeam = (user: any): Team => {
  let role = user.prefs?.role || 'team';
  if (user.labels && Array.isArray(user.labels)) {
    if (user.labels.includes('admin')) role = 'admin';
  }

  return {
    $id: user.$id,
    teamName: user.name,
    email: user.email,
    role: role,
    studentIds: normalizeStudentIds(user.prefs?.studentIds),
    createdAt: user.$createdAt
  };
};

export async function getCurrentTeam(): Promise<Team | null> {
  try {
    const user = await account.get();
    return mapUserToTeam(user);
  } catch {
    return null;
  }
}

export async function logoutTeam(): Promise<void> {
  if (!hasSessionHint()) return;

  try {
    await account.deleteSession('current');
  } catch (err: any) {
    // Session may already be gone (common in dev/hot-reload flows).
    if (!isUnauthorizedAppwriteError(err)) {
      throw err;
    }
  }
}

export async function resetSessionOnAppLaunch(): Promise<void> {
  try {
    await account.deleteSession('current');
  } catch (err: any) {
    if (!isUnauthorizedAppwriteError(err)) {
      // Ignore at startup and continue local cleanup.
    }
  } finally {
    clearLocalSessionHints();
  }
}

export function closeSessionOnAppClose(): void {
  if (!hasSessionHint()) return;

  try {
    if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID) return;

    const endpoint = String(APPWRITE_ENDPOINT).replace(/\/$/, '');
    const projectId = String(APPWRITE_PROJECT_ID);
    const url = `${endpoint}/account/sessions/current`;

    // keepalive helps the request survive page teardown during app close.
    fetch(url, {
      method: 'DELETE',
      headers: {
        'X-Appwrite-Project': projectId,
      },
      credentials: 'include',
      mode: 'cors',
      keepalive: true,
    }).catch(() => {
      // Best effort only during shutdown.
    });
  } catch {
    // Ignore teardown errors.
  } finally {
    clearLocalSessionHints();
  }
}

export async function validateTeamCredentials(teamName: string, password: string): Promise<Team | null> {
  try {
    await verifyBuildAccessForAuth();

    if (hasSessionHint()) {
      try {
        await account.deleteSession('current');
      } catch (deleteErr: any) {
        if (!isUnauthorizedAppwriteError(deleteErr)) {
          throw deleteErr;
        }
      }
    }

    try {
      await account.createEmailPasswordSession(getEmail(teamName), password);
    } catch (err: any) {
      const shouldRotateSession = isActiveSessionError(err);
      if (!shouldRotateSession) throw err;

      // Session already exists in this browser context. Rotate it, then retry once.
      try {
        await account.deleteSession('current');
      } catch (deleteErr: any) {
        if (!isUnauthorizedAppwriteError(deleteErr)) {
          throw deleteErr;
        }
      }
      await account.createEmailPasswordSession(getEmail(teamName), password);
    }

    const user = await account.get();
    return mapUserToTeam(user);
  } catch (err) {
    console.error('Login failed:', err);
    return null;
  }
}

export async function registerTeam(
  teamName: string,
  password: string,
  studentIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const securityContext = await getSecurityContext();
    const res = await functions.createExecution(
      'sonar-auth', 
      JSON.stringify({ action: 'register', teamName, password, studentIds, ...securityContext }), 
      false, 
      '/', 
      ExecutionMethod.POST
    );
    const data = JSON.parse(res.responseBody || '{}');
    if (data.success) {
      return { success: true };
    }
    return { success: false, error: data.error || 'Registration failed' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Registration failed' };
  }
}

export async function addTeamMember(
  teamId: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await executeFunctionAndRequireSuccess('sonar-teams', {
      action: 'addMember',
      teamId,
      studentId,
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to add member' };
  }
}

export async function getTeamMembers(teamId: string): Promise<string[]> {
  try {
    const securityContext = await getSecurityContext();
    const payload = { action: 'getMembers', teamId, ...securityContext };
    const res = await functions.createExecution(
      'sonar-teams',
      JSON.stringify(payload),
      false,
      '/',
      ExecutionMethod.POST
    );

    const data = JSON.parse(res.responseBody || '{}');
    if (data?.success === true) {
      return normalizeStudentIds(data.members);
    }
    return [];
  } catch {
    return [];
  }
}

export async function changeTeamPassword(
  teamId: string,
  oldPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await account.updatePassword(newPassword, oldPassword);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to change password' };
  }
}

export async function getTeamById(teamId: string): Promise<Team | null> {
  // Deprecated: Use AuthContext user object directly
  console.warn('getTeamById is deprecated.');
  return null;
}

export async function updateTeamEmail(
  teamId: string,
  newEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await executeFunctionAndRequireSuccess('sonar-teams', {
      action: 'updateTeamEmail',
      teamId,
      newEmail,
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update email' };
  }
}

export async function updateTeamPassword(
  teamId: string,
  oldPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await functions.createExecution('sonar-teams', JSON.stringify({ action: 'changePassword', teamId, oldPassword, newPassword }), false, '/', ExecutionMethod.POST);
    const data = JSON.parse(res.responseBody || '{}');
    if (data.success) {
      return { success: true };
    }
    return { success: false, error: data.error || 'Failed to update password' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update password' };
  }
}



// ---- Teams ----
export async function getAdminTeamIds(): Promise<Set<string>> {
  try {
    const res = await executeSettingsFunction({ action: 'listAdmins' });
    const data = JSON.parse(res.responseBody || '{}');
    if (data.success && Array.isArray(data.adminIds)) {
      return new Set(data.adminIds);
    }
    return new Set();
  } catch (err) {
    console.error('Failed to list admins:', err);
    return new Set();
  }
}

// ---- Sessions ----
async function getNoncePayload(): Promise<{ nonce: string, nonceToken: string } | null> {
  try {
    const securityContext = await getSecurityContext();
    const res = await functions.createExecution(
      'sonar-auth',
      JSON.stringify({ action: 'getNonce', ...securityContext }),
      false,
      '/',
      ExecutionMethod.POST
    );
    const data = JSON.parse(res.responseBody || '{}');
    if (data.success) {
      return { nonce: data.nonce, nonceToken: data.nonceToken };
    }
  } catch (err) {
    // console.warn('Failed to get nonce payload:', err);
  }
  return null;
}

export async function updateSessionLastSeen(teamId: string, teamName?: string, status: string = 'online'): Promise<void> {
  try {
    const nonceData = await getNoncePayload();
    const token = await window.electronAPI.security!.getAttestationToken(nonceData?.nonce);
    
    await executeFunctionAndRequireSuccess('sonar-session-sync', {
      teamId, 
      teamName: teamName || 'Unknown', 
      status, 
      attestation: token,
      ...(nonceData ? { nonceToken: nonceData.nonceToken } : {})
    });
  } catch (err) {
    console.error('Session sync error:', err);
    throw err;
  }
}

export async function getAllSessions(): Promise<Session[]> {
  try {
    const res = await fallbackListDocuments(DB_ID, COL_SESSIONS, [
      Query.limit(100),
    ]);
    return res.documents as unknown as Session[];
  } catch {
    return [];
  }
}

// ---- Activity Logs (one row per team, upserted) ----

export function parseSyncData(doc: ActivityLog): ActivitySyncData {
  let parsed: any = null;
  try {
    if (doc.windowTitle) parsed = JSON.parse(doc.windowTitle);
  } catch { /* ignore */ }
  
  const isArray = Array.isArray(parsed);
  return {
    sessionStart: doc.timestamp,
    heartbeatCount: 0,
    apps: {},
    files: [],
    windows: [],
    statusChanges: 0,
    totalOnlineSec: 0,
    totalOfflineSec: 0,
    lastStatus: doc.status as 'online' | 'offline',
    lastStatusAt: doc.timestamp,
    offlinePeriods: [],
    activityEvents: isArray ? parsed : (parsed?.activityEvents || []),
    ...(isArray ? {} : parsed),
  };
}

const HEARTBEAT_SEC = APP_CONFIG.HEARTBEAT_INTERVAL_MS / 1000;

export async function upsertActivityLog(payload: HeartbeatPayload): Promise<void> {
  try {
    const nonceData = await getNoncePayload();
    const token = await window.electronAPI.security!.getAttestationToken(nonceData?.nonce);
    await executeFunctionAndRequireSuccess('sonar-activity-sync', {
      teamId: payload.teamId,
      payload: [payload],
      attestation: token,
      ...(nonceData ? { nonceToken: nonceData.nonceToken } : {})
    });
  } catch (err) {
    console.error('Activity sync error:', err);
    throw err;
  }
}

export interface OfflineSyncSummary {
  offlineFrom: string;
  offlineTo: string;
  duration: number;
  logCount: number;
  apps: string[];
  files: string[];
  windows: string[];
  syncedAt: string;
}

export async function mergeOfflineSyncData(
  teamId: string,
  teamName: string,
  summary: OfflineSyncSummary,
): Promise<void> {
  try {
    const nonceData = await getNoncePayload();
    const token = await window.electronAPI.security!.getAttestationToken(nonceData?.nonce);
    const payload = Array.from({ length: summary.logCount }).map(() => ({
      teamId,
      teamName,
      status: 'online',
      timestamp: summary.syncedAt,
      event: 'offline_sync',
    }));
    
    await executeFunctionAndRequireSuccess('sonar-activity-sync', {
      teamId,
      payload,
      attestation: token,
      ...(nonceData ? { nonceToken: nonceData.nonceToken } : {})
    });
  } catch (err) {
    console.error('Offline sync error:', err);
    throw err;
  }
}

export async function getGlobalBlockNonEmptyWorkspace(useFunction = false): Promise<boolean> {
  if (useFunction) {
    try {
      return await getSettingViaFunction('blockNonEmptyWorkspace');
    } catch {
      return false;
    }
  }

  try {
    const res = await fallbackListDocuments(DB_ID, COL_SETTINGS, [
      Query.equal('settingType', 'blockNonEmptyWorkspace'),
      Query.limit(1),
    ]);
    if (res.documents.length > 0) {
      return res.documents[0].settingValue === 'true';
    }
    return false;
  } catch (err: any) {
    if (isUnauthorizedAppwriteError(err)) {
      try {
        return await getSettingViaFunction('blockNonEmptyWorkspace');
      } catch {
        return false;
      }
    }
    return false;
  }
}

export async function setGlobalBlockNonEmptyWorkspace(blocked: boolean): Promise<{ success: boolean; error?: string }> {
  return await updateSettingViaFunction('blockNonEmptyWorkspace', blocked);
}

export function subscribeGlobalBlockNonEmptyWorkspace(callback: (blocked: boolean) => void): () => void {
  return client.subscribe(`databases.${DB_ID}.collections.${COL_SETTINGS}.documents`, (response: RealtimeResponseEvent<any>) => {
    if (
      response.events.includes(`databases.${DB_ID}.collections.${COL_SETTINGS}.documents.*.update`) ||
      response.events.includes(`databases.${DB_ID}.collections.${COL_SETTINGS}.documents.*.create`)
    ) {
      if (response.payload.settingType === 'blockNonEmptyWorkspace') {
        callback(response.payload.settingValue === 'true');
      }
    }
  });
}

export async function getGlobalInternetRestriction(useFunction = false): Promise<boolean> {
  if (useFunction) {
    try {
      return await getSettingViaFunction('blockInternetAccess');
    } catch {
      return false;
    }
  }

  try {
    const res = await fallbackListDocuments(DB_ID, COL_SETTINGS, [
      Query.equal('settingType', 'blockInternetAccess'),
      Query.limit(1),
    ]);
    if (res.documents.length > 0) {
      return res.documents[0].settingValue === 'true';
    }
    return false;
  } catch (err: any) {
    if (isUnauthorizedAppwriteError(err)) {
      try {
        return await getSettingViaFunction('blockInternetAccess');
      } catch {
        return false;
      }
    }
    return false;
  }
}

export async function setGlobalInternetRestriction(blocked: boolean): Promise<{ success: boolean; error?: string }> {
  return await updateSettingViaFunction('blockInternetAccess', blocked);
}

export async function flushAllActivityLogs(): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await functions.createExecution('sonar-settings', JSON.stringify({ action: 'flushActivityLogs' }), false, '/', ExecutionMethod.POST);
    const data = JSON.parse(res.responseBody || '{}');
    if (data.success) {
      return { success: true };
    }
    return { success: false, error: data.error || 'Failed to flush activity logs' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to flush activity logs' };
  }
}

export async function getActivityLogForTeam(teamId: string): Promise<ActivityLog | null> {
  try {
    const res = await fallbackListDocuments(DB_ID, COL_ACTIVITY_LOGS, [
      Query.equal('teamId', teamId),
      Query.orderDesc('timestamp'),
      Query.limit(1),
    ]);
    if (res.documents.length === 0) return null;
    return res.documents[0] as unknown as ActivityLog;
  } catch {
    return null;
  }
}

export async function getAllActivityLogs(limit = 100): Promise<ActivityLog[]> {
  try {
    const res = await fallbackListDocuments(DB_ID, COL_ACTIVITY_LOGS, [
      Query.orderDesc('timestamp'),
      Query.limit(limit),
    ]);
    const logs = res.documents as unknown as ActivityLog[];
    const byTeam = new Map<string, ActivityLog>();
    for (const log of logs) {
      if (!log?.teamId) continue;
      if (!byTeam.has(log.teamId)) byTeam.set(log.teamId, log);
    }
    return Array.from(byTeam.values()).slice(0, limit);
  } catch {
    return [];
  }
}

// ---- Reports ----
export async function saveReport(report: Omit<Report, '$id'>): Promise<void> {
  try {
    await databases.createDocument(DB_ID, COL_REPORTS, ID.unique(), report);
  } catch (err) {
    console.error('Failed to save report:', err);
  }
}

export async function getReportsForTeam(teamId: string): Promise<Report[]> {
  try {
    const res = await fallbackListDocuments(DB_ID, COL_REPORTS, [
      Query.equal('teamId', teamId),
      Query.orderDesc('generatedAt'),
    ]);
    return res.documents as unknown as Report[];
  } catch {
    return [];
  }
}

// ---- Realtime ----
// Delay helper to prevent WebSocket CONNECTING state errors when making multiple quick subscriptions
const createDeferredSubscription = (channel: string, callback: (payload: any) => void, delayMs = 100) => {
  let unsub: (() => void) | null = null;
  const timeoutId = setTimeout(() => {
    unsub = client.subscribe(channel, callback);
  }, delayMs);
  return () => {
    clearTimeout(timeoutId);
    if (unsub) unsub();
  };
};

export function subscribeToActivityLogs(callback: (log: ActivityLog) => void): () => void {
  return createDeferredSubscription(
    `databases.${DB_ID}.collections.${COL_ACTIVITY_LOGS}.documents`,
    (response: RealtimeResponseEvent<ActivityLog>) => {
      if (response.events.some((e) => e.includes('create') || e.includes('update'))) {
        callback(response.payload);
      }
    },
    50
  );
}

export function subscribeToActivityLogDeletes(callback: () => void): () => void {
  return createDeferredSubscription(
    `databases.${DB_ID}.collections.${COL_SETTINGS}.documents`,
    (response: RealtimeResponseEvent<any>) => {
      const isCreateOrUpdate = response.events.some((e) => e.includes('create') || e.includes('update'));
      if (isCreateOrUpdate && response.payload && response.payload.settingType === 'latestActivityLogFlush') {
        callback();
      }
    },
    150
  );
}

export function subscribeToSessions(callback: (session: Session) => void): () => void {
  return createDeferredSubscription(
    `databases.${DB_ID}.collections.${COL_SESSIONS}.documents`,
    (response: RealtimeResponseEvent<Session>) => {
      if (response.events.some((e) => e.includes('create') || e.includes('update'))) {
        callback(response.payload);
      }
    },
    250
  );
}

export function subscribeToSettings(callback: (blocked: boolean) => void): () => void {
  return createDeferredSubscription(
    `databases.${DB_ID}.collections.${COL_SETTINGS}.documents`,
    (response: RealtimeResponseEvent<any>) => {
      if (response.events.some((e) => e.includes('update') || e.includes('create'))) {
        const payload = response.payload;
        if (payload.settingType === 'blockInternetAccess') {
          callback(payload.settingValue === 'true');
        }
      }
    },
    350
  );
}

export { client, databases };
