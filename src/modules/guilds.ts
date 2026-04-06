import type { ResolvedCordiaConfig } from '../types';
import { HttpTransport } from '../transport/http';
import { Logger } from '../utils/logger';
import { validateGuildCount } from '../utils/validators';

/**
 * Guild/server count tracking module.
 * Reports the current number of guilds/servers the bot is in.
 *
 * Unlike commands and users, guild count is sent immediately
 * (not queued) since it's typically called infrequently.
 */
export class GuildsModule {
  private config: ResolvedCordiaConfig;
  private http: HttpTransport;
  private logger: Logger;

  constructor(config: ResolvedCordiaConfig, http: HttpTransport, logger: Logger) {
    this.config = config;
    this.http = http;
    this.logger = logger;
  }

  /**
   * Report the current guild/server count.
   * This is typically called on the bot's `ready` event
   * and whenever guilds are added or removed.
   *
   * @param count - Current number of guilds/servers
   * @example
   * ```ts
   * // On bot ready
   * client.on('ready', () => {
   *   guilds.postCount(client.guilds.cache.size);
   * });
   *
   * // On guild changes
   * client.on('guildCreate', () => {
   *   guilds.postCount(client.guilds.cache.size);
   * });
   * ```
   */
  async postCount(count: number): Promise<void> {
    try {
      validateGuildCount(count);

      this.logger.debug(`Posting guild count: ${count}`);

      const response = await this.http.post('/guild-count', {
        count,
        timestamp: new Date().toISOString(),
      });

      if (response.success) {
        this.logger.info(`Guild count reported: ${count}`);
      } else {
        this.logger.warn(`Failed to report guild count: ${response.error}`);
      }
    } catch (error) {
      this.logger.error(`Failed to post guild count: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
