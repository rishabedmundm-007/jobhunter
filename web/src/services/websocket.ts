export class JobWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private listeners: Map<string, Set<Function>> = new Map();

  constructor(url: string = import.meta.env.VITE_WS_URL || 'ws://localhost:3002') {
    this.url = url;
  }

  connect(accessToken: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${this.url}?token=${accessToken}`;
        this.ws = new WebSocket(wsUrl);
        this.ws.onopen = () => resolve();
        this.ws.onmessage = (event) => this.handleMessage(event.data);
        this.ws.onerror = () => reject(new Error('WebSocket error'));
        this.ws.onclose = () => this.ws = null;
      } catch (err) {
        reject(err);
      }
    });
  }

  disconnect() {
    this.ws?.close();
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback);
  }

  private handleMessage(data: string) {
    try {
      const message = JSON.parse(data);
      const callbacks = this.listeners.get(message.type) || new Set();
      callbacks.forEach(cb => cb(message.payload));
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
    }
  }

  send(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}

export const ws = new JobWebSocket();
