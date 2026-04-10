import WebSocket from 'ws';
import { stateManager } from './state';
import { logger } from './logger';

type WsStatus = 'connected' | 'disconnected' | 'reconnecting';
type StatusListener = (status: WsStatus) => void;

class WsClient {
  private ws: WebSocket | null = null;
  private enabled = false;
  private url = '';
  private secret = '';
  private authenticated = false;
  private reconnectDelay = 1000;
  private maxDelay = 30000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private statusListeners: StatusListener[] = [];
  private stateDebounceTimer: NodeJS.Timeout | null = null;
  private destroyed = false;

  configure(enabled: boolean, url: string, secret: string): void {
    this.enabled = enabled;
    this.url = url;
    this.secret = secret;

    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.terminate();
      this.ws = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.authenticated = false;
    this.reconnectDelay = 1000;

    if (enabled && url) {
      logger.info(`WS configured — connecting to ${url}`);
      this.connect();
    } else {
      logger.info('WS disabled');
      stateManager.setWsConnected(false);
      this.emitStatus('disconnected');
    }
  }

  private connect(): void {
    if (this.destroyed || !this.enabled) return;

    logger.info(`WS connecting to ${this.url} ...`);
    this.emitStatus('reconnecting');

    try {
      this.ws = new WebSocket(this.url);
    } catch (err: any) {
      logger.error(`WS create error: ${err?.message ?? err}`);
      this.scheduleReconnect();
      return;
    }

    this.ws.on('open', () => {
      this.reconnectDelay = 1000;
      logger.info('WS open — sending auth');
      this.sendRaw({ type: 'auth', secret: this.secret, plugin: 'elite-dangerous' });
    });

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'auth_ok') {
          this.authenticated = true;
          stateManager.setWsConnected(true);
          this.emitStatus('connected');
          logger.info('WS authenticated — connected');
          // Send current state on connect
          this.sendStateUpdate();
        } else {
          logger.warn(`WS unexpected message: ${msg.type}`);
        }
      } catch {
        // ignore
      }
    });

    this.ws.on('close', (code, reason) => {
      this.authenticated = false;
      stateManager.setWsConnected(false);
      this.emitStatus('disconnected');
      logger.warn(`WS closed (code ${code}${reason?.length ? ': ' + reason.toString() : ''})`);
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      logger.error(`WS error: ${err.message}`);
      // error is always followed by close
    });
  }

  private scheduleReconnect(): void {
    if (this.destroyed || !this.enabled) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    logger.info(`WS reconnecting in ${this.reconnectDelay / 1000}s ...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxDelay);
      this.connect();
    }, this.reconnectDelay);
  }

  private sendRaw(obj: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  sendEvent(type: string, payload: object): void {
    if (!this.authenticated) {
      if (type !== 'state_update') {
        logger.warn(`Event dropped (not connected): ${type}`);
      }
      return;
    }
    if (type !== 'state_update') {
      logger.info(`-> ${type}`);
    }
    this.sendRaw({
      type,
      timestamp: new Date().toISOString(),
      payload,
    });
  }

  sendStateUpdate(): void {
    if (!this.authenticated) return;
    const state = stateManager.get();
    this.sendEvent('state_update', state);
  }

  scheduleStateUpdate(): void {
    if (this.stateDebounceTimer) clearTimeout(this.stateDebounceTimer);
    this.stateDebounceTimer = setTimeout(() => {
      this.sendStateUpdate();
    }, 500);
  }

  async testConnection(url: string, secret: string): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        ws.terminate();
        resolve({ success: false, message: 'Connection timed out' });
      }, 5000);

      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch (err: any) {
        clearTimeout(timeout);
        resolve({ success: false, message: err.message || 'Invalid URL' });
        return;
      }

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'auth', secret, plugin: 'elite-dangerous' }));
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          clearTimeout(timeout);
          ws.terminate();
          if (msg.type === 'auth_ok') {
            resolve({ success: true, message: 'Connected and authenticated successfully' });
          } else {
            resolve({ success: false, message: `Unexpected response: ${msg.type}` });
          }
        } catch {
          clearTimeout(timeout);
          ws.terminate();
          resolve({ success: false, message: 'Invalid server response' });
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        resolve({ success: false, message: err.message });
      });

      ws.on('close', () => {
        clearTimeout(timeout);
        resolve({ success: false, message: 'Connection closed before auth' });
      });
    });
  }

  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  private emitStatus(status: WsStatus): void {
    for (const l of this.statusListeners) l(status);
  }

  destroy(): void {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.stateDebounceTimer) clearTimeout(this.stateDebounceTimer);
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.terminate();
    }
  }
}

export const wsClient = new WsClient();
