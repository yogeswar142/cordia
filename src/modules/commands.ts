import type { ResolvedCordiaConfig, TrackCommandPayload } from '../types';
import { EventQueue } from '../transport/queue';
import { Logger } from '../utils/logger';
import { validateCommand } from '../utils/validators';
import { resolveShardMeta } from '../utils/sharding';
import { debugWarnIfShardInfoMissing } from '../utils/shardDebug';

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
      const shardMeta = resolveShardMeta(this.config, {
        shardId: payload.shardId,
        totalShards: payload.totalShards,
      });
      debugWarnIfShardInfoMissing(this.config, this.logger, shardMeta);

      this.queue.enqueue({
        endpoint: '/track-command',
        payload: {
          event: 'command_used',
          command: payload.command,
          userId: payload.userId,
          guildId: payload.guildId,
          guildName: payload.guildName,
          locale: payload.locale,
          timestamp: new Date().toISOString(),
          ...shardMeta,
        },
      });

      this.logger.debug(`Command tracked: ${payload.command}`);
    } catch (error) {
      this.logger.error(`Failed to track command: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Automatically extracts data from a Discord interaction object and tracks the command.
   * Supports discord.js Interaction objects.
   *
   * @param interaction - The Discord interaction object
   */
  trackFromInteraction(interaction: any): void {
    try {
      if (!interaction) return;

      const command = interaction.commandName || interaction.name;
      if (!command) {
        this.logger.warn('Could not detect command name from interaction');
        return;
      }

      this.track({
        command,
        userId: interaction.user?.id || interaction.member?.user?.id || interaction.author?.id,
        guildId: interaction.guildId || interaction.guild?.id,
        guildName: interaction.guild?.name,
        locale: interaction.locale,
      });
    } catch (error) {
      this.logger.debug(`Auto-detection failed for interaction: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Automatically extracts data from a Discord message object and tracks the command.
   * Supports discord.js Message objects.
   *
   * @param message - The Discord message object
   * @param commandName - The name of the command being executed (e.g. "play")
   */
  trackFromMessage(message: any, commandName: string): void {
    try {
      if (!message) return;

      this.track({
        command: commandName,
        userId: message.author?.id,
        guildId: message.guild?.id,
        guildName: message.guild?.name,
      });
    } catch (error) {
      this.logger.debug(`Auto-detection failed for message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
