import type { ResolvedCordiaConfig } from '../types';
import { HttpTransport } from '../transport/http';
import { Logger } from '../utils/logger';
import { resolveShardMeta } from '../utils/sharding';

/**
 * Heartbeat module — sends periodic heartbeat pings to the Cordia API.
 * Used to calculate bot uptime percentage.
 *
 * The heartbeat runs on a configurable interval (default: 30 seconds).
 * It includes the bot's uptime in the payload so the server can
 * calculate uptime percentages.
 */
export class HeartbeatModule {
  private config: ResolvedCordiaConfig;
  private http: HttpTransport;
  private logger: Logger;
  private timer: ReturnType<typeof setInterval> | null = null;
  private startTime: number;
  private isRunning = false;

  constructor(config: ResolvedCordiaConfig, http: HttpTransport, logger: Logger) {
    this.config = config;
    this.http = http;
    this.logger = logger;
    this.startTime = Date.now();
  }

  /**
   * Start sending heartbeat pings at the configured interval.
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn('Heartbeat is already running');
      return;
    }

    this.isRunning = true;
    this.startTime = Date.now();
    this.logger.info(`Heartbeat started (interval: ${this.config.heartbeatInterval}ms)`);

    // Send initial heartbeat immediately
    void this.sendHeartbeat();

    // Set up periodic heartbeat
    this.timer = setInterval(() => {
      void this.sendHeartbeat();
    }, this.config.heartbeatInterval);

    // Prevent the timer from keeping the Node.js process alive
    if (this.timer && typeof this.timer === 'object' && 'unref' in this.timer) {
      this.timer.unref();
    }
  }

  /**
   * Stop sending heartbeat pings.
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.logger.info('Heartbeat stopped');
  }

  /**
   * Get the current uptime in milliseconds.
   */
  getUptime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Check if the heartbeat is currently running.
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Send a single heartbeat ping.
   */
  private async sendHeartbeat(): Promise<void> {
    const payload = {
      timestamp: new Date().toISOString(),
      uptime: this.getUptime(),
      ...resolveShardMeta(this.config),
    };

    this.logger.debug('Sending heartbeat...', payload);

    await this.http.postFireAndForget('/heartbeat', payload);
  }
}
