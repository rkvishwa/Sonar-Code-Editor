import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export type SecurityEvent =
  | 'APP_STARTED'
  | 'APP_QUIT'
  | 'TAMPERING_DETECTED'
  | 'HEARTBEAT_MISSED'
  | 'HEARTBEAT_RESUMED'
  | 'RENDERER_UNRESPONSIVE'
  | 'DEVTOOLS_OPENED'
  | 'INTEGRITY_CHECK_PASSED'
  | 'INTEGRITY_CHECK_FAILED'
  | 'UNATTESTED_CLIENT_BLOCKED'
  | 'DEV_MODE_CLIENT'
  | 'BUILD_ATTESTED';

export interface SecurityLogEntry {
  seq: number;
  timestamp: string;
  event: SecurityEvent;
  details?: string;
  hmac: string;
}

let logFilePath = '';
let machineSecret = '';
let currentSeq = 0;
let lastHmac = '';

export function initSecurityLog() {
  logFilePath = path.join(app.getPath('userData'), 'security-log.json');
  
  // Use a stable but unique-per-machine secret
  const machineIdHash = crypto.createHash('sha256').update(app.getPath('userData')).digest('hex');
  machineSecret = `sonar-log-secret-${machineIdHash}`;

  if (fs.existsSync(logFilePath)) {
    try {
      const content = fs.readFileSync(logFilePath, 'utf8');
      const logs: SecurityLogEntry[] = JSON.parse(content);
      if (logs.length > 0) {
        const lastLog = logs[logs.length - 1];
        currentSeq = lastLog.seq;
        lastHmac = lastLog.hmac;
      }
    } catch (e) {
      console.error('Failed to parse existing security log:', e);
      // If corrupted, rename and start fresh
      fs.renameSync(logFilePath, `${logFilePath}.corrupted.${Date.now()}`);
    }
  }

  logSecurityEvent('APP_STARTED');
}

function generateHmac(seq: number, timestamp: string, event: string, details: string, prevHmac: string): string {
  const payload = `${seq}|${timestamp}|${event}|${details}|${prevHmac}`;
  return crypto.createHmac('sha256', machineSecret).update(payload).digest('hex');
}

export function logSecurityEvent(event: SecurityEvent, details: string = '') {
  currentSeq++;
  const timestamp = new Date().toISOString();
  
  const hmac = generateHmac(currentSeq, timestamp, event, details, lastHmac);
  
  const entry: SecurityLogEntry = {
    seq: currentSeq,
    timestamp,
    event,
    details,
    hmac
  };

  lastHmac = hmac;

  let logs: SecurityLogEntry[] = [];
  if (fs.existsSync(logFilePath)) {
    try {
      logs = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
    } catch {}
  }
  
  logs.push(entry);
  
  try {
    fs.writeFileSync(logFilePath, JSON.stringify(logs, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to write security log:', e);
  }
}

export function getSecurityLog(): SecurityLogEntry[] {
  if (!fs.existsSync(logFilePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
  } catch {
    return [];
  }
}
