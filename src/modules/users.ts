import type { ResolvedCordiaConfig, TrackUserPayload } from '../types';
import { EventQueue } from '../transport/queue';
import { Logger } from '../utils/logger';
import { validateUserId } from '../utils/validators';
import { resolveShardMeta } from '../utils/sharding';

/**
 * User tracking module.
 * Queues active user events for batch delivery to the Cordia API.
 */
export class UsersModule {
  private queue: EventQueue;
  private logger: Logger;
  private config: ResolvedCordiaConfig;

  constructor(queue: EventQueue, logger: Logger, config: ResolvedCordiaConfig) {
    this.queue = queue;
    this.logger = logger;
    this.config = config;
  }

  /**
   * Track an active user interaction.
   *
   * @param payload - User tracking data
   * @example
   * ```ts
   * users.track({
   *   userId: '123456789',
   *   guildId: '987654321',
   *   action: 'message'
   * });
   * ```
   */
  track(payload: TrackUserPayload): void {
    try {
      validateUserId(payload.userId);

      this.queue.enqueue({
        endpoint: '/track-user',
        payload: {
          event: 'user_active',
          userId: payload.userId,
          guildId: payload.guildId,
          action: payload.action || 'interaction',
          timestamp: new Date().toISOString(),
          ...resolveShardMeta(this.config, {
            shardId: payload.shardId,
            totalShards: payload.totalShards,
          }),
        },
      });

      this.logger.debug(`User tracked: ${payload.userId}`);
    } catch (error) {
      this.logger.error(`Failed to track user: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
