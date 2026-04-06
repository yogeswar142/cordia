import type { TrackUserPayload } from '../types';
import { EventQueue } from '../transport/queue';
import { Logger } from '../utils/logger';
import { validateUserId } from '../utils/validators';

/**
 * User tracking module.
 * Queues active user events for batch delivery to the Cordia API.
 */
export class UsersModule {
  private queue: EventQueue;
  private logger: Logger;

  constructor(queue: EventQueue, logger: Logger) {
    this.queue = queue;
    this.logger = logger;
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
        },
      });

      this.logger.debug(`User tracked: ${payload.userId}`);
    } catch (error) {
      this.logger.error(`Failed to track user: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
