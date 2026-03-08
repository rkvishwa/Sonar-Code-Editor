import { execSync } from 'child_process';
import * as dgram from 'dgram';
import WebSocket, { WebSocketServer } from 'ws';
import * as http from 'http';
import * as os from 'os';
import { BrowserWindow } from 'electron';

const COLLAB_PORT = 1234;

export interface CollaborationUser {
  id: string;
  name: string;
  color: string;
}

export interface CollaborationStatus {
  isActive: boolean;
  mode: 'host' | 'client' | null;
  hostIp: string | null;
  port: number;
  connectedUsers: CollaborationUser[];
  networkName?: string;
}

// Store connections by room
interface Room {
  name: string;
  clients: Set<WebSocket>;
  // Store last awareness message from each client to replay for new connections
  awarenessStates: Map<WebSocket, Buffer>;
}

class CollaborationManager {
  private wss: WebSocketServer | null = null;
  private httpServer: http.Server | null = null;
  private mainWindow: BrowserWindow | null = null;
  private rooms: Map<string, Room> = new Map();
  private clientRooms: Map<WebSocket, string> = new Map();
  private status: CollaborationStatus = {
    isActive: false,
    mode: null,
    hostIp: null,
    port: COLLAB_PORT,
    connectedUsers: [],
    networkName: undefined,
  };

  constructor() {}

  /**
   * Check local network access by sending a UDP multicast packet.
   * On macOS, this triggers the Local Network permission prompt if not yet granted.
   * Returns true if the network operation succeeded.
   */
  async checkLocalNetworkAccess(): Promise<boolean> {
    if (process.platform !== 'darwin') {
      return true;
    }

    return new Promise((resolve) => {
      const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      const message = Buffer.from('ping');
      const timeout = setTimeout(() => {
        try { socket.close(); } catch (_) { /* ignore */ }
        // Timeout likely means the OS blocked the packet (permission denied)
        resolve(false);
      }, 3000);

      socket.on('error', () => {
        clearTimeout(timeout);
        try { socket.close(); } catch (_) { /* ignore */ }
        resolve(false);
      });

      // Sending to mDNS multicast address triggers macOS Local Network permission
      socket.send(message, 0, message.length, 5353, '224.0.0.251', (err) => {
        clearTimeout(timeout);
        try { socket.close(); } catch (_) { /* ignore */ }
        resolve(!err);
      });
    });
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Get the local IP address of the machine
   */
  getLocalIpAddress(): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        // Skip internal (loopback) and non-IPv4 addresses
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return '127.0.0.1';
  }

  /**
   * Get all available network interfaces with their IPs
   */
  getNetworkInterfaces(): { name: string; ip: string }[] {
    const interfaces = os.networkInterfaces();
    const result: { name: string; ip: string }[] = [];
    
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          result.push({ name, ip: iface.address });
        }
      }
    }
    return result;
  }

  /**
   * Start a hosted network (Windows only)
   * This creates an ad-hoc network that other devices can connect to
   */
  async startHostedNetwork(ssid: string, password: string): Promise<{ success: boolean; error?: string }> {
    if (process.platform !== 'win32') {
      return { 
        success: false, 
        error: 'Hosted network is only supported on Windows. On macOS/Linux, use your OS network sharing features.' 
      };
    }

    try {
      // Configure the hosted network
      execSync(`netsh wlan set hostednetwork mode=allow ssid="${ssid}" key="${password}"`, { encoding: 'utf-8' });
      
      // Start the hosted network
      execSync('netsh wlan start hostednetwork', { encoding: 'utf-8' });
      
      this.status.networkName = ssid;
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: `Failed to start hosted network: ${(error as Error).message}` 
      };
    }
  }

  /**
   * Stop the hosted network (Windows only)
   */
  async stopHostedNetwork(): Promise<void> {
    if (process.platform !== 'win32') return;
    
    try {
      execSync('netsh wlan stop hostednetwork', { encoding: 'utf-8' });
      this.status.networkName = undefined;
    } catch (error) {
      // Network might not be running, ignore errors
      console.log('Stop hosted network:', (error as Error).message);
    }
  }

  /**
   * Start the WebSocket collaboration server (Host mode)
   * Implements y-websocket compatible protocol
   */
  async startHost(userName: string): Promise<CollaborationStatus> {
    if (this.status.isActive) {
      throw new Error('Collaboration session already active');
    }

    return new Promise((resolve, reject) => {
      try {
        // Create HTTP server for the WebSocket to attach to
        this.httpServer = http.createServer();
        
        // Create WebSocket server - y-websocket expects room name in URL path
        this.wss = new WebSocketServer({ server: this.httpServer });
        
        this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
          // Extract room name from URL path (e.g., /monaco-collab)
          const roomName = req.url?.slice(1) || 'default';
          console.log(`New collaboration client connected to room: ${roomName}`);
          
          // Get or create room
          if (!this.rooms.has(roomName)) {
            this.rooms.set(roomName, { name: roomName, clients: new Set(), awarenessStates: new Map() });
          }
          const room = this.rooms.get(roomName)!;
          room.clients.add(ws);
          this.clientRooms.set(ws, roomName);
          
          console.log(`Room ${roomName} now has ${room.clients.size} client(s)`);
          
          // When a new client joins, notify existing clients to resend their awareness
          // This ensures the new client receives everyone's presence info
          // We do this after a short delay to let the new client initialize
          setTimeout(() => {
            // Send all stored awareness states to the new client
            room.awarenessStates.forEach((awarenessData, clientWs) => {
              if (clientWs !== ws && ws.readyState === WebSocket.OPEN) {
                console.log(`Sending stored awareness to new client (${awarenessData.length} bytes)`);
                ws.send(awarenessData, { binary: true });
              }
            });
            
            // Also ask existing clients to resend by broadcasting an awareness query from the new client
            // This triggers y-websocket to respond with awareness updates
            const awarenessQuery = Buffer.from([3]); // Message type 3 = awareness query
            room.clients.forEach((client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                console.log('Sending awareness query to existing client');
                client.send(awarenessQuery, { binary: true });
              }
            });
          }, 100);

          // Handle messages - broadcast to all other clients in the same room
          // y-websocket handles all the sync protocol in binary format
          ws.on('message', (data: Buffer | ArrayBuffer | Buffer[], isBinary: boolean) => {
            const room = this.rooms.get(this.clientRooms.get(ws) || '');
            if (!room) return;
            
            // Convert to Buffer for consistent handling
            const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
            
            // Debug: log message type (first byte indicates message type in y-websocket)
            if (isBinary && buffer.length > 0) {
              const msgType = buffer[0];
              // 0 = sync step 1, 1 = sync step 2, 2 = update, 3 = awareness query, 4 = awareness update
              const typeNames = ['sync1', 'sync2', 'update', 'awareness-query', 'awareness'];
              console.log(`Broadcasting ${typeNames[msgType] || `type${msgType}`} (${buffer.length} bytes) to ${room.clients.size - 1} other client(s)`);
              
              // Store awareness messages for replay to future clients
              if (msgType === 4) { // awareness update
                room.awarenessStates.set(ws, buffer);
              }
            }
            
            // Broadcast to all other clients in the room
            let sentCount = 0;
            room.clients.forEach((client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                if (isBinary) {
                  client.send(buffer, { binary: true });
                } else {
                  client.send(data);
                }
                sentCount++;
              }
            });
            
            if (sentCount === 0 && room.clients.size > 1) {
              console.log('Warning: No clients to send to despite multiple clients in room');
            }
          });

          ws.on('close', () => {
            console.log('Client disconnected from collaboration');
            const roomName = this.clientRooms.get(ws);
            if (roomName) {
              const room = this.rooms.get(roomName);
              if (room) {
                room.clients.delete(ws);
                room.awarenessStates.delete(ws); // Clean up stored awareness
                console.log(`Room ${roomName} now has ${room.clients.size} client(s)`);
                if (room.clients.size === 0) {
                  this.rooms.delete(roomName);
                }
              }
              this.clientRooms.delete(ws);
            }
          });

          ws.on('error', (error) => {
            console.error('WebSocket error:', error);
          });
        });

        this.httpServer.listen(COLLAB_PORT, '0.0.0.0', () => {
          const localIp = this.getLocalIpAddress();
          
          this.status = {
            isActive: true,
            mode: 'host',
            hostIp: localIp,
            port: COLLAB_PORT,
            connectedUsers: [], // Users tracked via Yjs awareness in renderer
            networkName: this.status.networkName,
          };
          
          console.log(`Collaboration server started on ${localIp}:${COLLAB_PORT}`);
          this.notifyStatusChange();
          resolve(this.status);
        });

        this.httpServer.on('error', (error) => {
          reject(new Error(`Failed to start server: ${error.message}`));
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Notify the renderer about status changes
   */
  private notifyStatusChange(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('collaboration:statusChange', this.status);
    }
  }

  /**
   * Stop the collaboration session
   */
  async stopSession(): Promise<void> {
    // Close all WebSocket connections
    if (this.wss) {
      this.wss.clients.forEach((client) => {
        client.close();
      });
      this.wss.close();
      this.wss = null;
    }

    // Clear rooms
    this.rooms.clear();
    this.clientRooms.clear();

    // Close HTTP server
    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
    }

    // Stop hosted network if we created one
    await this.stopHostedNetwork();

    // Reset status
    this.status = {
      isActive: false,
      mode: null,
      hostIp: null,
      port: COLLAB_PORT,
      connectedUsers: [],
    };

    this.notifyStatusChange();
  }

  /**
   * Get current collaboration status
   */
  getStatus(): CollaborationStatus {
    return { ...this.status };
  }

  /**
   * Join a collaboration session as a client
   * Note: The actual Yjs WebSocket connection is handled in the renderer
   * This just updates the local status
   */
  joinAsClient(hostIp: string, userName: string): CollaborationStatus {
    this.status = {
      isActive: true,
      mode: 'client',
      hostIp,
      port: COLLAB_PORT,
      connectedUsers: [{
        id: 'self',
        name: userName,
        color: this.generateUserColor(),
      }],
    };
    
    this.notifyStatusChange();
    return this.status;
  }

  /**
   * Update connected users from client perspective
   */
  updateConnectedUsers(users: CollaborationUser[]): void {
    this.status.connectedUsers = users;
    this.notifyStatusChange();
  }

  /**
   * Generate a random color for user identification
   */
  private generateUserColor(): string {
    const colors = [
      '#3b82f6', // blue
      '#10b981', // green
      '#f59e0b', // amber
      '#ef4444', // red
      '#8b5cf6', // purple
      '#ec4899', // pink
      '#06b6d4', // cyan
      '#84cc16', // lime
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}

// Singleton instance
export const collaborationManager = new CollaborationManager();
