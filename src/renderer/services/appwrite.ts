import { Client, Databases, Functions, ExecutionMethod, Query, ID, RealtimeResponseEvent } from 'appwrite';
import { APP_CONFIG } from '../../shared/constants';
import { Team, Session, ActivityLog, ActivitySyncData, Report, HeartbeatPayload } from '../../shared/types';

const APPWRITE_ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT;
const APPWRITE_PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID;

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

const databases = new Databases(client);
const functions = new Functions(client);

const DB_ID = import.meta.env.VITE_APPWRITE_DB_NAME || 'devwatch_db';
const COL_TEAMS = import.meta.env.VITE_APPWRITE_COLLECTION_TEAMS || 'teams';
const COL_SESSIONS = import.meta.env.VITE_APPWRITE_COLLECTION_SESSIONS || 'sessions';
const COL_ACTIVITY_LOGS = import.meta.env.VITE_APPWRITE_COLLECTION_ACTIVITY_LOGS || 'activityLogs';
const COL_REPORTS = import.meta.env.VITE_APPWRITE_COLLECTION_REPORTS || 'reports';
const COL_SETTINGS = import.meta.env.VITE_APPWRITE_COLLECTION_SETTINGS || 'settings';

function isUnauthorizedAppwriteError(err: any): boolean {
  const code = err?.code ?? err?.response?.code;
  const message = String(err?.message || '').toLowerCase();
  const type = String(err?.type || '').toLowerCase();
  return code === 401 || message.includes('unauthorized') || type.includes('unauthorized');
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
  if (knownRestrictedCollections.has(colId)) {
    return _listDocumentsViaFunction(colId, queries);
  }

  try {
    return await databases.listDocuments(dbId, colId, queries);
  } catch (err: any) {
    if (isUnauthorizedAppwriteError(err)) {
      knownRestrictedCollections.add(colId);
      return _listDocumentsViaFunction(colId, queries);
    }
    throw err;
  }
}

async function _listDocumentsViaFunction(colId: string, queries?: any[]): Promise<any> {
  try {
    const payload = { action: 'listDocuments', collectionId: colId, queries };
    const res = await functions.createExecution(
      'sonar-settings',
      JSON.stringify(payload),
      false,
      '/',
      ExecutionMethod.POST
    );
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
  if (knownRestrictedCollections.has(colId)) {
    return _getDocumentViaFunction(colId, docId);
  }

  try {
    return await databases.getDocument(dbId, colId, docId);
  } catch (err: any) {
    if (isUnauthorizedAppwriteError(err)) {
      knownRestrictedCollections.add(colId);
      return _getDocumentViaFunction(colId, docId);
    }
    throw err;
  }
}

async function _getDocumentViaFunction(colId: string, docId: string): Promise<any> {
  try {
    const payload = { action: 'listDocuments', collectionId: colId, queries: [Query.equal('$id', docId)] };
    const res = await functions.createExecution(
      'sonar-settings',
      JSON.stringify(payload),
      false,
      '/',
      ExecutionMethod.POST
    );
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
  const res = await functions.createExecution(
    'sonar-settings',
    JSON.stringify({ action: 'getSetting', settingType }),
    false,
    '/',
    ExecutionMethod.POST
  );
  const data = JSON.parse(res.responseBody || '{}');
  return data?.success === true ? data.value === true : false;
}

async function updateSettingViaFunction(settingType: string, settingValue: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await functions.createExecution(
      'sonar-settings',
      JSON.stringify({ action: 'updateSetting', settingType, settingValue }),
      false,
      '/',
      ExecutionMethod.POST
    );
    const data = JSON.parse(res.responseBody || '{}');
    return data;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ---- Teams ----
export async function getTeamByName(teamName: string): Promise<Team | null> {
  try {
    const res = await fallbackListDocuments(DB_ID, COL_TEAMS, [
      Query.limit(500),
    ]);
    const match = res.documents.find(
      (d: any) => d.teamName.toLowerCase() === teamName.toLowerCase()
    );
    if (!match) return null;
    return match as unknown as Team;
  } catch {
    return null;
  }
}

export async function validateTeamCredentials(teamName: string, password: string): Promise<Team | null> {
  try {
    const res = await functions.createExecution('sonar-auth', JSON.stringify({ teamName, password }), false, '/', ExecutionMethod.POST);
    const data = JSON.parse(res.responseBody);
    if (data.success) {
      return { $id: data.teamId, teamName, password, studentIds: data.studentIds, role: data.role || 'team', createdAt: new Date().toISOString() } as Team;
    }
    return null;
  } catch (err) {
    console.error('Auth error:', err);
    return null;
  }
}

export async function registerTeam(
  teamName: string,
  password: string,
  studentIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await functions.createExecution('sonar-teams', JSON.stringify({ action: 'register', teamName, password, studentIds }), false, '/', ExecutionMethod.POST);
    const data = JSON.parse(res.responseBody);
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
    const res = await functions.createExecution('sonar-teams', JSON.stringify({ action: 'addMember', teamId, studentId }), false, '/', ExecutionMethod.POST);
    const data = JSON.parse(res.responseBody);
    if (data.success) {
      return { success: true };
    }
    return { success: false, error: data.error || 'Failed to add member' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to add member' };
  }
}

export async function changeTeamPassword(
  teamId: string,
  oldPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await functions.createExecution('sonar-teams', JSON.stringify({ action: 'changePassword', teamId, oldPassword, newPassword }), false, '/', ExecutionMethod.POST);
    const data = JSON.parse(res.responseBody);
    if (data.success) {
      return { success: true };
    }
    return { success: false, error: data.error || 'Failed to change password' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to change password' };
  }
}

export async function getTeamById(teamId: string): Promise<Team | null> {
  try {
    const res = await fallbackGetDocument(DB_ID, COL_TEAMS, teamId);
    return res as unknown as Team;
  } catch {
    return null;
  }
}

export async function updateTeamName(
  teamId: string,
  newName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = await getTeamByName(newName);
    if (existing && existing.$id !== teamId) {
      return { success: false, error: 'Team name already exists' };
    }
    const res = await functions.createExecution('sonar-teams', JSON.stringify({ action: 'updateTeamName', teamId, newName }), false, '/', ExecutionMethod.POST);
    const data = JSON.parse(res.responseBody || '{}');
    if (data.success) {
      return { success: true };
    }
    return { success: false, error: data.error || 'Failed to update team name' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update team name' };
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
    const res = await fallbackListDocuments(DB_ID, COL_TEAMS, [
      Query.equal('role', 'admin'),
      Query.limit(100),
    ]);
    return new Set(res.documents.map((d: any) => d.$id));
  } catch {
    return new Set();
  }
}

// ---- Sessions ----
export async function updateSessionLastSeen(teamId: string, teamName?: string, status: string = 'online'): Promise<void> {
  try {
    const token = await window.electronAPI.security!.getAttestationToken();
    await functions.createExecution('sonar-session-sync', JSON.stringify({
      teamId, 
      teamName: teamName || 'Unknown', 
      status, 
      attestation: token
    }), false, '/', ExecutionMethod.POST);
  } catch (err) {
    console.error('Session sync error:', err);
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
  try {
    if (doc.windowTitle) return JSON.parse(doc.windowTitle);
  } catch { /* ignore */ }
  return {
    sessionStart: doc.timestamp,
    heartbeatCount: 0,
    apps: {},
    files: [],
    windows: [],
    statusChanges: 0,
    totalOnlineSec: 0,
    totalOfflineSec: 0,
    lastStatus: doc.status,
    lastStatusAt: doc.timestamp,
    offlinePeriods: [],
  };
}

const HEARTBEAT_SEC = APP_CONFIG.HEARTBEAT_INTERVAL_MS / 1000;

export async function upsertActivityLog(payload: HeartbeatPayload): Promise<void> {
  try {
    const token = await window.electronAPI.security!.getAttestationToken();
    await functions.createExecution('sonar-activity-sync', JSON.stringify({
      teamId: payload.teamId,
      payload: [payload],
      attestation: token
    }), false, '/', ExecutionMethod.POST);
  } catch (err) {
    console.error('Activity sync error:', err);
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
    const token = await window.electronAPI.security!.getAttestationToken();
    const payload = Array.from({ length: summary.logCount }).map(() => ({
      teamId,
      teamName,
      status: 'online',
      timestamp: summary.syncedAt,
      event: 'offline_sync',
    }));
    
    await functions.createExecution('sonar-activity-sync', JSON.stringify({
      teamId,
      payload,
      attestation: token
    }), false, '/', ExecutionMethod.POST);
  } catch (err) {
    console.error('Offline sync error:', err);
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
    return res.documents as unknown as ActivityLog[];
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
export function subscribeToActivityLogs(callback: (log: ActivityLog) => void): () => void {
  const unsub = client.subscribe(
    `databases.${DB_ID}.collections.${COL_ACTIVITY_LOGS}.documents`,
    (response: RealtimeResponseEvent<ActivityLog>) => {
      if (response.events.some((e) => e.includes('create') || e.includes('update'))) {
        callback(response.payload);
      }
    }
  );
  return unsub;
}

export function subscribeToActivityLogDeletes(callback: () => void): () => void {
  const unsub = client.subscribe(
    `databases.${DB_ID}.collections.${COL_SETTINGS}.documents`,
    (response: RealtimeResponseEvent<any>) => {
      const isCreateOrUpdate = response.events.some((e) => e.includes('create') || e.includes('update'));
      if (isCreateOrUpdate && response.payload && response.payload.settingType === 'latestActivityLogFlush') {
        callback();
      }
    }
  );
  return unsub;
}

export function subscribeToSessions(callback: (session: Session) => void): () => void {
  const unsub = client.subscribe(
    `databases.${DB_ID}.collections.${COL_SESSIONS}.documents`,
    (response: RealtimeResponseEvent<Session>) => {
      if (response.events.some((e) => e.includes('create') || e.includes('update'))) {
        callback(response.payload);
      }
    }
  );
  return unsub;
}

export function subscribeToSettings(callback: (blocked: boolean) => void): () => void {
  const unsub = client.subscribe(
    `databases.${DB_ID}.collections.${COL_SETTINGS}.documents`,
    (response: RealtimeResponseEvent<any>) => {
      if (response.events.some((e) => e.includes('update') || e.includes('create'))) {
        const payload = response.payload;
        if (payload.settingType === 'blockInternetAccess') {
          callback(payload.settingValue === 'true');
        }
      }
    }
  );
  return unsub;
}

export { client, databases };
