import { ipcMain, BrowserWindow } from 'electron';
import crypto from 'crypto';
import { IPC_CHANNELS } from '../shared/constants';
import { logSecurityEvent } from './securityLog';

let heartbeatNonce: string | null = null;
let lastHeartbeatTime: number = Date.now();
let missedHeartbeats = 0;
let watchdogInterval: NodeJS.Timeout | null = null;
let mainWindow: BrowserWindow | null = null;
let isUnresponsive = false;

export function initOfflineHeartbeat(win: BrowserWindow) {
  mainWindow = win;
  heartbeatNonce = crypto.randomBytes(32).toString('hex');
  lastHeartbeatTime = Date.now();
  missedHeartbeats = 0;
  isUnresponsive = false;

  ipcMain.handle(IPC_CHANNELS.SECURITY_NONCE_REQUEST, () => {
    return heartbeatNonce;
  });

  ipcMain.on(IPC_CHANNELS.SECURITY_HEARTBEAT_PING, (event, nonce) => {
    if (nonce !== heartbeatNonce) {
      console.warn('SECURITY_HEARTBEAT_PING with invalid nonce!');
      return;
    }

    const now = Date.now();
    if (missedHeartbeats > 0) {
      const gap = now - lastHeartbeatTime;
      console.log(`HEARTBEAT_RESUMED after ${gap}ms gap.`);
      logSecurityEvent('HEARTBEAT_RESUMED', `Gap of ${gap}ms`);
    }

    lastHeartbeatTime = now;
    missedHeartbeats = 0;
    isUnresponsive = false;
  });

  if (watchdogInterval) clearInterval(watchdogInterval);
  
  // Check every 10s
  watchdogInterval = setInterval(checkHeartbeat, 10000);
}

function checkHeartbeat() {
  const now = Date.now();
  // Assume a ping comes every 5s. If nothing for 10s+, missed.
  if (now - lastHeartbeatTime > 10000) {
    if (missedHeartbeats === 0) logSecurityEvent('HEARTBEAT_MISSED', 'Renderer failed to check in');
    missedHeartbeats++;
    console.warn(`HEARTBEAT_MISSED (${missedHeartbeats})`);
    
    if (missedHeartbeats >= 3 && !isUnresponsive) {
      isUnresponsive = true;
      console.error('RENDERER_UNRESPONSIVE: Renderer process might be killed or paused.');
      logSecurityEvent('RENDERER_UNRESPONSIVE', `Missed ${missedHeartbeats} heartbeats in a row`);
      // Action to take if unresponsive, like showing dialog or quitting.
    }
  }
}

export function stopOfflineHeartbeat() {
  if (watchdogInterval) clearInterval(watchdogInterval);
  watchdogInterval = null;
}
