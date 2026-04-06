import type { TrackCommandPayload } from '../types';
import { EventQueue } from '../transport/queue';
import { Logger } from '../utils/logger';
import { validateCommand } from '../utils/validators';

/**
 * Command tracking module.
 * Queues command usage events for batch delivery to the Cordia API.
 */
export class CommandsModule {
  private queue: EventQueue;
  private logger: Logger;

  constructor(queue: EventQueue, logger: Logger) {
    this.queue = queue;
    this.logger = logger;
  }

  /**
   * Track a command execution.
   *
   * @param payload - Command tracking data
   * @example
   * ```ts
   * commands.track({
   *   command: 'play',
   *   userId: '123456789',
   *   guildId: '987654321',
   *   metadata: { query: 'never gonna give you up' }
   * });
   * ```
   */
  track(payload: TrackCommandPayload): void {
    try {
      validateCommand(payload.command);

      this.queue.enqueue({
        endpoint: '/track-command',
        payload: {
          event: 'command_used',
          command: payload.command,
          userId: payload.userId,
          guildId: payload.guildId,
          metadata: payload.metadata,
          timestamp: new Date().toISOString(),
        },
      });

      this.logger.debug(`Command tracked: ${payload.command}`);
    } catch (error) {
      this.logger.error(`Failed to track command: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
