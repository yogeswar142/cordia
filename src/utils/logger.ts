import { LogLevel } from '../types';

/**
 * Internal logger for the Cordia SDK.
 * Silent by default — only outputs when debug mode is enabled.
 * Never throws errors to avoid crashing the host application.
 */
export class Logger {
  private enabled: boolean;
  private prefix = '[Cordia]';

  constructor(enabled: boolean = false) {
    this.enabled = enabled;
  }

  /** Enable or disable debug logging */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Log a debug message (only when debug mode is on) */
  debug(message: string, ...args: unknown[]): void {
    if (this.enabled) {
      this.log(LogLevel.DEBUG, message, ...args);
    }
  }

  /** Log an informational message (only when debug mode is on) */
  info(message: string, ...args: unknown[]): void {
    if (this.enabled) {
      this.log(LogLevel.INFO, message, ...args);
    }
  }

  /** Log a warning (always shown) */
  warn(message: string, ...args: unknown[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  /** Log an error (always shown) */
  error(message: string, ...args: unknown[]): void {
    this.log(LogLevel.ERROR, message, ...args);
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = `${this.prefix} ${timestamp} [${level.toUpperCase()}] ${message}`;

    try {
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(formattedMessage, ...args);
          break;
        case LogLevel.INFO:
          console.info(formattedMessage, ...args);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage, ...args);
          break;
        case LogLevel.ERROR:
          console.error(formattedMessage, ...args);
          break;
      }
    } catch {
      // Never let logging crash the host application
    }
  }
}
