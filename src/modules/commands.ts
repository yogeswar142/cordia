import type { ResolvedCordiaConfig, TrackCommandPayload } from '../types';
import { EventQueue } from '../transport/queue';
import { Logger } from '../utils/logger';
import { validateCommand } from '../utils/validators';
import { resolveShardMeta } from '../utils/sharding';

/**
 * Command tracking module.
 * Queues command usage events for batch delivery to the Cordia API.
 */
export class CommandsModule {
  private queue: EventQueue;
  private logger: Logger;
  private config: ResolvedCordiaConfig;

  constructor(queue: EventQueue, logger: Logger, config: ResolvedCordiaConfig) {
    this.queue = queue;
    this.logger = logger;
    this.config = config;
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
          ...resolveShardMeta(this.config, {
            shardId: payload.shardId,
            totalShards: payload.totalShards,
          }),
        },
      });

      this.logger.debug(`Command tracked: ${payload.command}`);
    } catch (error) {
      this.logger.error(`Failed to track command: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
