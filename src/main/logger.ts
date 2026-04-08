export interface LogEntry {
  ts: string;
  level: 'info' | 'warn' | 'error';
  msg: string;
}

type LogListener = (entry: LogEntry) => void;

const MAX_ENTRIES = 200;

class Logger {
  private entries: LogEntry[] = [];
  private listeners: LogListener[] = [];

  log(level: LogEntry['level'], msg: string): void {
    const entry: LogEntry = { ts: new Date().toISOString(), level, msg };
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) this.entries.shift();
    for (const l of this.listeners) l(entry);
    console.log(`[${level.toUpperCase()}] ${msg}`);
  }

  info(msg: string): void { this.log('info', msg); }
  warn(msg: string): void { this.log('warn', msg); }
  error(msg: string): void { this.log('error', msg); }

  getHistory(): LogEntry[] { return [...this.entries]; }

  onEntry(listener: LogListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}

export const logger = new Logger();
