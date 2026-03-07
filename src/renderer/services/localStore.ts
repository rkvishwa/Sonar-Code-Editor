// Wrapper around localStorage for renderer-side persistence
// electron-store is used in main process; renderer uses localStorage

const CACHE_KEY = 'sonar_auth_cache';
const QUEUE_KEY = 'sonar_offline_queue';

export interface CachedAuth {
  teamName: string;
  teamId: string;
  role: 'team' | 'admin';
  passwordHash: string;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

export function cacheCredentials(teamName: string, password: string, teamId: string, role: 'team' | 'admin'): void {
  const cache: CachedAuth = {
    teamName,
    teamId,
    role,
    passwordHash: simpleHash(password),
  };
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export function getCachedAuth(): CachedAuth | null {
  const raw = localStorage.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function validateCachedAuth(teamName: string, password: string): CachedAuth | null {
  const cache = getCachedAuth();
  if (!cache) return null;
  if (cache.teamName === teamName && cache.passwordHash === simpleHash(password)) return cache;
  return null;
}

export function clearCache(): void {
  localStorage.removeItem(CACHE_KEY);
}

// Offline queue
export interface QueuedLog {
  type: 'activityLog' | 'session';
  payload: unknown;
  queuedAt: string;
}

export function enqueueLog(log: QueuedLog): void {
  const queue = getQueue();
  queue.push(log);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function getQueue(): QueuedLog[] {
  const raw = localStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}
