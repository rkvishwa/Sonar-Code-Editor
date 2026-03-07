import { BrowserWindow } from 'electron';
import { APP_CONFIG } from '../shared/constants';
import { HeartbeatPayload } from '../shared/types';

export class MonitoringService {
  private teamName: string = '';
  private teamId: string = '';
  private currentFile: string = '';
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private offlineQueue: HeartbeatPayload[] = [];
  private isOnline: boolean = true;
  private mainWindow: BrowserWindow | null = null;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  init(teamName: string, teamId: string): void {
    this.teamName = teamName;
    this.teamId = teamId;
    this.startHeartbeat();
  }

  setCurrentFile(filePath: string): void {
    this.currentFile = filePath;
  }

  setOnlineStatus(online: boolean): void {
    this.isOnline = online;
    if (online) {
      this.flushOfflineQueue();
    }
  }

  startHeartbeat(): void {
    if (this.heartbeatInterval) return;
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, APP_CONFIG.HEARTBEAT_INTERVAL_MS);
    // Send immediately on start
    this.sendHeartbeat();
  }

  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    // Send offline event
    if (this.teamName && this.mainWindow && !this.mainWindow.isDestroyed()) {
      const payload: HeartbeatPayload = {
        teamName: this.teamName,
        teamId: this.teamId,
        currentWindow: 'Sonar Code Editor',
        currentFile: this.currentFile,
        status: 'offline',
        timestamp: new Date().toISOString(),
        appName: 'Sonar Code Editor',
      };
      this.mainWindow.webContents.send('monitoring:heartbeat', payload);
    }
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this.teamName) return;

    const payload: HeartbeatPayload = {
      teamName: this.teamName,
      teamId: this.teamId,
      currentWindow: 'Sonar Code Editor',
      currentFile: this.currentFile,
      status: 'online',
      timestamp: new Date().toISOString(),
      appName: 'Sonar Code Editor',
    };

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('monitoring:heartbeat', payload);
    }

    if (!this.isOnline) {
      this.offlineQueue.push(payload);
    }
  }

  private flushOfflineQueue(): void {
    if (this.offlineQueue.length === 0) return;
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('monitoring:flushQueue', this.offlineQueue);
      this.offlineQueue = [];
    }
  }

  getOfflineQueue(): HeartbeatPayload[] {
    return [...this.offlineQueue];
  }
}
