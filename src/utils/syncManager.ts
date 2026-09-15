import mqtt, { type MqttClient } from 'mqtt';
import Peer, { type DataConnection } from 'peerjs';
import type { PrizeKey, Participant } from '../data/participants';
import type { WonRecord } from './exportExcel';

export type ScreenMode = 'standard' | 'left' | 'right';
export type Page = 'home' | 'prize-selection' | 'draw' | 'summary';

export type SyncAction =
  | { type: 'NAVIGATE'; page: Page }
  | { type: 'SELECT_PRIZE'; prizeKey: PrizeKey }
  | { type: 'SET_DRAW_READY'; isDrawReady: boolean }
  | {
      type: 'START_SPIN';
      timestamp: number;
    }
  | {
      type: 'STOP_SPIN';
      winningParticipant: Participant;
      timestamp: number;
    }
  | { type: 'CONFIRM_WINNER'; winnersHistory: WonRecord[] }
  | { type: 'REDRAW'; timestamp: number }
  | { type: 'REQUEST_SYNC'; timestamp: number }
  | {
      type: 'FULL_STATE_SYNC';
      page: Page;
      selectedPrizeKey: PrizeKey;
      isDrawReady: boolean;
      winnersHistory: WonRecord[];
    };

export interface SyncMessage {
  id: string;
  senderScreen: ScreenMode;
  timestamp: number;
  action: SyncAction;
}

type SyncListener = (action: SyncAction, senderScreen: ScreenMode) => void;

class SyncManager {
  private listeners: Set<SyncListener> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private currentScreenMode: ScreenMode = 'left';
  private clientInstanceId: string = Math.random().toString(36).substring(2, 9);

  // Cloud MQTT State (cross-laptop / different networks)
  private mqttClient: MqttClient | null = null;
  private mqttTopic: string = 'genesis/luckydraw/v1/live';

  // WebRTC PeerJS State
  private peer: Peer | null = null;
  private p2pConnections: Set<DataConnection> = new Set();
  private slaveToMasterConn: DataConnection | null = null;
  private p2pReconnectTimer: any = null;
  private roomId: string = 'genesis-luckydraw-live';
  private isPeerInitialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const customRoom = params.get('room');
      if (customRoom) {
        this.roomId = customRoom;
      }
    }

    this.mqttTopic = `genesis/luckydraw/v1/${this.roomId}`;

    // 1. Initialize Cloud MQTT over WebSockets (works across different laptops & networks anywhere)
    this.initMqtt();

    // 2. Initialize BroadcastChannel (for same machine / multi-window)
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('genesis_luckydraw_sync_channel');
        this.broadcastChannel.onmessage = (event: MessageEvent<SyncMessage>) => {
          this.handleIncomingMessage(event.data);
        };
      } catch (err) {
        console.warn('BroadcastChannel not supported or error:', err);
      }
    }

    // 3. Initialize localStorage storage listener (backup cross-tab)
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === '__genesis_luckydraw_sync_evt__' && e.newValue) {
          try {
            const data: SyncMessage = JSON.parse(e.newValue);
            this.handleIncomingMessage(data);
          } catch {
            // Ignore parse errors
          }
        }
      });
    }

    // 4. Initialize Vite Dev Server HMR WebSocket relay (for local dev LAN sync)
    if (typeof import.meta !== 'undefined' && (import.meta as any).hot) {
      const hot = (import.meta as any).hot;
      hot.on('luckydraw:sync-relay', (data: SyncMessage) => {
        this.handleIncomingMessage(data);
      });
    }

    // 5. Initialize WebRTC P2P DataChannel via PeerJS (optional local P2P layer)
    this.initPeerJS();
  }

  private initMqtt() {
    if (typeof window === 'undefined') return;

    try {
      // Connect to global, high-availability public WebSocket MQTT broker
      const client = mqtt.connect('wss://broker.emqx.io:8084/mqtt', {
        clientId: `genesis_draw_${this.clientInstanceId}_${Math.random().toString(36).substring(2, 6)}`,
        keepalive: 30,
        clean: true,
        reconnectPeriod: 2000,
        connectTimeout: 5000,
      });

      this.mqttClient = client;

      client.on('connect', () => {
        console.log(`[Cloud Sync] Connected to Cloud MQTT Broker! Topic: ${this.mqttTopic}`);
        client.subscribe(this.mqttTopic, { qos: 1 }, (err) => {
          if (!err) {
            console.log(`[Cloud Sync] Subscribed to ${this.mqttTopic}`);
            if (!this.isMaster()) {
              this.broadcast({
                type: 'REQUEST_SYNC',
                timestamp: Date.now(),
              });
            } else {
              this.handleIncomingMessage({
                id: `internal-master-mqtt-${Date.now()}`,
                senderScreen: 'left',
                timestamp: Date.now(),
                action: { type: 'REQUEST_SYNC', timestamp: Date.now() },
              });
            }
          }
        });
      });

      client.on('message', (_topic, payload) => {
        try {
          const data: SyncMessage = JSON.parse(payload.toString());
          this.handleIncomingMessage(data);
        } catch {
          // ignore parse errors
        }
      });

      client.on('error', (err) => {
        console.warn('[Cloud Sync] MQTT Error:', err);
      });

      client.on('close', () => {
        console.log('[Cloud Sync] MQTT disconnected, reconnecting...');
      });
    } catch (err) {
      console.warn('[Cloud Sync] Failed to initialize MQTT:', err);
    }
  }

  public setScreenMode(mode: ScreenMode) {
    const prevMode = this.currentScreenMode;
    this.currentScreenMode = mode;

    if (prevMode !== mode && this.isPeerInitialized) {
      // Re-initialize peer with new role
      this.initPeerJS();
    }
  }

  public getScreenMode(): ScreenMode {
    return this.currentScreenMode;
  }

  public isMaster(): boolean {
    return this.currentScreenMode === 'left' || this.currentScreenMode === 'standard';
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onAction(listener: (action: SyncAction) => void): () => void {
    const wrapper: SyncListener = (action) => listener(action);
    this.listeners.add(wrapper);
    return () => {
      this.listeners.delete(wrapper);
    };
  }

  public broadcast(action: SyncAction) {
    const message: SyncMessage = {
      id: `${this.clientInstanceId}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      senderScreen: this.currentScreenMode,
      timestamp: Date.now(),
      action,
    };

    // 1. Cloud MQTT over WebSockets (guaranteed cross-laptop, cross-network sync)
    if (this.mqttClient && this.mqttClient.connected) {
      try {
        this.mqttClient.publish(this.mqttTopic, JSON.stringify(message), { qos: 1 });
      } catch (err) {
        console.warn('Error publishing to MQTT:', err);
      }
    }

    // 2. BroadcastChannel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(message);
      } catch (err) {
        console.warn('Error posting to BroadcastChannel:', err);
      }
    }

    // 3. WebRTC P2P DataChannel
    if (this.isMaster()) {
      for (const conn of this.p2pConnections) {
        if (conn.open) {
          try {
            conn.send(message);
          } catch (err) {
            console.warn('Error sending P2P message to slave:', err);
          }
        }
      }
    } else {
      if (this.slaveToMasterConn && this.slaveToMasterConn.open) {
        try {
          this.slaveToMasterConn.send(message);
        } catch (err) {
          console.warn('Error sending P2P message to master:', err);
        }
      }
    }

    // 3. localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('__genesis_luckydraw_sync_evt__' + this.clientInstanceId, JSON.stringify(message));
      } catch {
        // Storage might be restricted
      }
    }

    // 4. Vite WebSocket Relay
    if (typeof import.meta !== 'undefined' && (import.meta as any).hot) {
      try {
        (import.meta as any).hot.send('luckydraw:sync', message);
      } catch {
        // Socket might be closed
      }
    }
  }

  private handleIncomingMessage(message: SyncMessage) {
    if (!message || !message.action) return;
    // Don't process our own messages
    if (message.id && message.id.startsWith(this.clientInstanceId)) return;

    for (const listener of this.listeners) {
      try {
        listener(message.action, message.senderScreen);
      } catch (err) {
        console.error('Error in sync listener:', err);
      }
    }
  }

  // --- WebRTC PeerJS Implementation ---
  private initPeerJS() {
    if (typeof window === 'undefined') return;

    // Clean up previous peer if any
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        // ignore
      }
      this.peer = null;
      this.p2pConnections.clear();
      this.slaveToMasterConn = null;
    }

    if (this.p2pReconnectTimer) {
      clearTimeout(this.p2pReconnectTimer);
      this.p2pReconnectTimer = null;
    }

    const isMaster = this.isMaster();
    const masterPeerId = `${this.roomId}-master`;
    const myPeerId = isMaster ? masterPeerId : `${this.roomId}-slave-${this.clientInstanceId}`;

    try {
      this.peer = new Peer(myPeerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      });

      this.isPeerInitialized = true;

      this.peer.on('open', (id) => {
        console.log(`[WebRTC Sync] Peer opened successfully. ID: ${id}, Role: ${isMaster ? 'MASTER' : 'SLAVE'}`);

        if (!isMaster) {
          this.connectToMaster(masterPeerId);
        } else {
          // Master opened: broadcast presence and sync trigger
          this.handleIncomingMessage({
            id: `internal-master-open-${Date.now()}`,
            senderScreen: 'left',
            timestamp: Date.now(),
            action: { type: 'REQUEST_SYNC', timestamp: Date.now() },
          });
        }
      });

      // Master listens for incoming Slave connections
      if (isMaster) {
        this.peer.on('connection', (conn) => {
          console.log('[WebRTC Sync] Slave connected to Master:', conn.peer);
          this.p2pConnections.add(conn);

          conn.on('open', () => {
            console.log('[WebRTC Sync] Connection opened with slave:', conn.peer);
            // Immediately trigger master to send current full state to newly connected slave
            this.handleIncomingMessage({
              id: `internal-conn-open-${Date.now()}`,
              senderScreen: 'right',
              timestamp: Date.now(),
              action: { type: 'REQUEST_SYNC', timestamp: Date.now() },
            });
          });

          conn.on('data', (data) => {
            this.handleIncomingMessage(data as SyncMessage);
          });

          conn.on('close', () => {
            this.p2pConnections.delete(conn);
            console.log('[WebRTC Sync] Slave disconnected:', conn.peer);
          });

          conn.on('error', (err) => {
            console.warn('[WebRTC Sync] Master connection error with slave:', err);
            this.p2pConnections.delete(conn);
          });
        });
      }

      this.peer.on('error', (err: any) => {
        console.warn('[WebRTC Sync] Peer error:', err?.type || err);

        // If ID taken (e.g. master refreshed tab before timeout), fallback with suffix
        if (err?.type === 'unavailable-id' && isMaster) {
          console.log('[WebRTC Sync] Master ID is currently held by previous session. Reconnecting in 2s...');
          this.p2pReconnectTimer = setTimeout(() => {
            this.initPeerJS();
          }, 2000);
        } else if (!isMaster) {
          // Retry slave connection
          this.scheduleReconnect(masterPeerId);
        }
      });
    } catch (err) {
      console.warn('[WebRTC Sync] Could not initialize PeerJS:', err);
    }
  }

  private connectToMaster(masterPeerId: string) {
    if (!this.peer || this.peer.destroyed) return;

    try {
      console.log(`[WebRTC Sync] Connecting Slave to Master: ${masterPeerId}...`);
      const conn = this.peer.connect(masterPeerId, {
        reliable: true,
      });

      this.slaveToMasterConn = conn;

      conn.on('open', () => {
        console.log('[WebRTC Sync] Connected to Master via WebRTC DataChannel!');

        // Immediately request full state from master
        this.broadcast({
          type: 'REQUEST_SYNC',
          timestamp: Date.now(),
        });
      });

      conn.on('data', (data) => {
        this.handleIncomingMessage(data as SyncMessage);
      });

      conn.on('close', () => {
        console.log('[WebRTC Sync] Connection to Master closed. Reconnecting...');
        this.scheduleReconnect(masterPeerId);
      });

      conn.on('error', (err) => {
        console.warn('[WebRTC Sync] Slave DataConnection error:', err);
        this.scheduleReconnect(masterPeerId);
      });
    } catch (err) {
      console.warn('[WebRTC Sync] Error connecting to Master:', err);
      this.scheduleReconnect(masterPeerId);
    }
  }

  private scheduleReconnect(masterPeerId: string) {
    if (this.p2pReconnectTimer) return;
    this.p2pReconnectTimer = setTimeout(() => {
      this.p2pReconnectTimer = null;
      if (!this.isMaster() && (!this.slaveToMasterConn || !this.slaveToMasterConn.open)) {
        this.connectToMaster(masterPeerId);
      }
    }, 1800);
  }
}

export const syncManager = new SyncManager();
