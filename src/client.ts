import type {
  CordiaConfig,
  ResolvedCordiaConfig,
  TrackCommandPayload,
  TrackUserPayload,
  ShardMeta,
} from './types';
import { validateConfig } from './utils/validators';
import { Logger } from './utils/logger';
import { HttpTransport } from './transport/http';
import { EventQueue } from './transport/queue';
import { HeartbeatModule } from './modules/heartbeat';
import { CommandsModule } from './modules/commands';
import { UsersModule } from './modules/users';
import { GuildsModule } from './modules/guilds';

/**
 * The main Cordia SDK client.
 *
 * Provides a simple, intuitive API for tracking Discord bot analytics:
 * - Command usage
 * - Active users
 * - Guild/server count
 * - Heartbeat/uptime monitoring
 *
 * @example
 * ```ts
 * import { CordiaClient } from 'cordia';
 *
 * const cordia = new CordiaClient({
 *   apiKey: 'your-api-key',
 *   discordClient: client,
 * });
 *
 * // Track a command
 * cordia.trackCommand({ command: 'play', userId: '123' });
 *
 * // Post guild count
 * await cordia.postGuildCount(150);
 *
 * // Heartbeat auto-starts by default!
 * ```
 */
export class CordiaClient {
  private config: ResolvedCordiaConfig;
  private logger: Logger;
  private http: HttpTransport;
  private queue: EventQueue;
  private heartbeat: HeartbeatModule;
  private commands: CommandsModule;
  private users: UsersModule;
  private guilds: GuildsModule;
  private destroyed = false;

  constructor(config: CordiaConfig) {
    // Validate and resolve config with defaults
    this.config = validateConfig(config);

    // Initialize internal systems
    this.logger = new Logger(this.config.debug);
    this.http = new HttpTransport(this.config, this.logger);
    this.queue = new EventQueue(this.config, this.http, this.logger);

    // Initialize modules
    this.heartbeat = new HeartbeatModule(this.config, this.http, this.logger);
    this.commands = new CommandsModule(this.queue, this.logger, this.config);
    this.users = new UsersModule(this.queue, this.logger, this.config);
    this.guilds = new GuildsModule(this.config, this.http, this.logger);

    // Auto-start heartbeat if configured
    if (this.config.autoHeartbeat) {
      this.heartbeat.start();
    }

    // Verify credentials in background
    this.verifyCredentials();

    // Graceful shutdown on process exit
    if (typeof process !== 'undefined' && process.on) {
      const handleShutdown = async () => {
        if (!this.destroyed) {
          this.logger.info('Received shutdown signal, flushing Cordia events...');
          await this.destroy();
        }
      };
      process.on('SIGINT', handleShutdown);
      process.on('SIGTERM', handleShutdown);
    }

    this.logger.info(`Cordia SDK initialized (bot id is auto-detected at runtime)`);
    this.logger.debug('Config:', {
      baseUrl: this.config.baseUrl,
      heartbeatInterval: this.config.heartbeatInterval,
      autoHeartbeat: this.config.autoHeartbeat,
      batchSize: this.config.batchSize,
      flushInterval: this.config.flushInterval,
    });
  }

  // ─────────────────────────────────────────────────────────
  // Command Tracking
  // ─────────────────────────────────────────────────────────

  /**
   * Track a command execution.
   * Events are batched and sent periodically.
   *
   * @param payload - Command tracking data
   * @example
   * ```ts
   * cordia.trackCommand({
   *   command: 'play',
   *   userId: '123456789',
   *   guildId: '987654321',
   * });
   * ```
   */
  trackCommand(payload: TrackCommandPayload): void {
    this.ensureNotDestroyed();
    this.commands.track(payload);
  }

  // ─────────────────────────────────────────────────────────
  // User Tracking
  // ─────────────────────────────────────────────────────────

  /**
   * Track an active user interaction.
   * Events are batched and sent periodically.
   *
   * @param payload - User tracking data
   * @example
   * ```ts
   * cordia.trackUser({
   *   userId: '123456789',
   *   guildId: '987654321',
   *   action: 'message',
   * });
   * ```
   */
  trackUser(payload: TrackUserPayload): void {
    this.ensureNotDestroyed();
    this.users.track(payload);
  }

  // ─────────────────────────────────────────────────────────
  // Guild Count
  // ─────────────────────────────────────────────────────────

  /**
   * Report the current guild/server count.
   * Sent immediately (not batched).
   *
   * @param count - Number of guilds the bot is in
   * @example
   * ```ts
   * // On bot ready
   * client.on('ready', () => {
   *   cordia.postGuildCount(client.guilds.cache.size);
   * });
   * ```
   */
  async postGuildCount(count: number, shardOverrides?: Partial<ShardMeta>): Promise<void> {
    this.ensureNotDestroyed();
    await this.guilds.postCount(count, shardOverrides);
  }

  // ─────────────────────────────────────────────────────────
  // Heartbeat Control
  // ─────────────────────────────────────────────────────────

  /**
   * Manually start the heartbeat system.
   * Only needed if `autoHeartbeat` is set to `false`.
   */
  startHeartbeat(): void {
    this.ensureNotDestroyed();
    this.heartbeat.start();
  }

  /**
   * Stop the heartbeat system.
   */
  stopHeartbeat(): void {
    this.heartbeat.stop();
  }

  /**
   * Get the current bot uptime in milliseconds.
   */
  getUptime(): number {
    return this.heartbeat.getUptime();
  }

  /**
   * Check if the heartbeat is currently running.
   */
  get isHeartbeatRunning(): boolean {
    return this.heartbeat.running;
  }

  // ─────────────────────────────────────────────────────────
  // Queue Management
  // ─────────────────────────────────────────────────────────

  /**
   * Force flush all queued events immediately.
   * Useful before shutting down the bot.
   */
  async flush(): Promise<void> {
    await this.queue.flush();
  }

  /**
   * Get the current number of queued events.
   */
  get queueSize(): number {
    return this.queue.size;
  }

  // ─────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────

  /**
   * Gracefully shut down the Cordia client.
   * Stops heartbeat, flushes remaining events, and cleans up resources.
   *
   * @example
   * ```ts
   * // Before shutting down the bot
   * process.on('SIGINT', async () => {
   *   await cordia.destroy();
   *   process.exit(0);
   * });
   * ```
   */
  async destroy(): Promise<void> {
    if (this.destroyed) {
      return;
    }

    this.logger.info('Shutting down Cordia SDK...');
    this.destroyed = true;

    // Stop heartbeat
    this.heartbeat.stop();

    // Flush remaining events
    await this.queue.destroy();

    this.logger.info('Cordia SDK shut down successfully');
  }

  /**
   * Check if the client has been destroyed.
   */
  get isDestroyed(): boolean {
    return this.destroyed;
  }

  // ─────────────────────────────────────────────────────────
  // Internal
  // ─────────────────────────────────────────────────────────

  private ensureNotDestroyed(): void {
    if (this.destroyed) {
      this.logger.warn('Attempted to use Cordia client after it was destroyed');
    }
  }

  /**
   * Verify the API credentials with the backend.
   * If verification fails (401/404), the SDK disables itself.
   */
  private async verifyCredentials(): Promise<void> {
    try {
      const response = await this.http.get('/auth/verify');

      if (response.success) {
        this.logger.info(`Cordia SDK verified successfully`);
      } else if (response.status === 401 || response.status === 404) {
        console.error(`\n🚨 CORDIA SDK DISABLED: ${response.error || 'Invalid API Key'}`);
        console.error('Please check your API key and bot identity in the Cordia dashboard.\n');

        // Disable the SDK to prevent useless network spam
        this.heartbeat.stop();
        this.destroyed = true;
        await this.queue.flush().catch(() => {}); // Try one last flush
      } else {
        // Network error or 5xx — don't disable, just warn
        this.logger.warn(`Cordia verification skipped: ${response.error || 'API unreachable'}. The SDK will continue to attempt tracking.`);
      }
    } catch (error) {
      this.logger.debug('Verification error:', error);
    }
  }
}
