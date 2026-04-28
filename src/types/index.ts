// ─────────────────────────────────────────────────────────────
// Cordia SDK — TypeScript Types & Interfaces
// ─────────────────────────────────────────────────────────────

/**
 * Configuration options for the Cordia client.
 */
export interface CordiaConfig {
  /**
   * Your bot's API key from the Cordia dashboard.
   * Required for authenticating all requests.
   */
  apiKey: string;

  /**
   * Optional bot ID override.
   * By default, Cordia auto-detects this from discordClient.user.id.
   */
  botId?: string;

  /**
   * Interval (in milliseconds) between heartbeat pings.
   * @default 30000 (30 seconds)
   */
  heartbeatInterval?: number;

  /**
   * Whether to automatically start sending heartbeats on client creation.
   * @default true
   */
  autoHeartbeat?: boolean;

  /**
   * Enable debug logging to console.
   * @default false
   */
  debug?: boolean;

  /**
   * Maximum number of events to batch before flushing.
   * @default 10
   */
  batchSize?: number;

  /**
   * Interval (in milliseconds) between automatic queue flushes.
   * @default 5000 (5 seconds)
   */
  flushInterval?: number;

  /**
   * Maximum number of retry attempts for failed requests.
   * @default 3
   */
  maxRetries?: number;

  /**
   * Request timeout in milliseconds.
   * @default 10000 (10 seconds)
   */
  timeout?: number;

  /**
   * Automatically scale batchSize and flushInterval if rate limited.
   * @default false
   */
  autoScale?: boolean;

  /**
   * Optional discord.js client reference for shard auto-detection.
   */
  discordClient?: {
    user?: {
      id?: string;
    };
    shard?: {
      ids?: number[];
      count?: number;
    };
  };

  /**
   * Override shard metadata manually (rarely needed).
   */
  shardId?: number;
  totalShards?: number;
  baseUrl?: string;
}

/**
 * Resolved config with all defaults applied.
 */
export interface ResolvedCordiaConfig {
  apiKey: string;
  botId?: string;
  baseUrl: string;
  heartbeatInterval: number;
  autoHeartbeat: boolean;
  debug: boolean;
  batchSize: number;
  flushInterval: number;
  maxRetries: number;
  timeout: number;
  autoScale: boolean;
  discordClient?: CordiaConfig['discordClient'];
  shardId: number;
  totalShards: number;
}

export interface ShardMeta {
  shardId: number;
  totalShards: number;
}

// ─────────────────────────────────────────────────────────────
// Event Payloads
// ─────────────────────────────────────────────────────────────

/**
 * Payload for tracking a command execution.
 */
export interface TrackCommandPayload {
  /** The command name that was executed (e.g., "play", "ban", "help") */
  command: string;
  /** The Discord user ID who executed the command */
  userId?: string;
  /** The guild/server ID where the command was executed */
  guildId?: string;
  /** Additional metadata about the command execution */
  metadata?: Record<string, unknown>;
  shardId?: number;
  totalShards?: number;
}

/**
 * Payload for tracking an active user.
 */
export interface TrackUserPayload {
  /** The Discord user ID */
  userId: string;
  /** The guild/server ID where the user is active */
  guildId?: string;
  /** The type of action performed (e.g., "message", "reaction", "voice_join") */
  action?: string;
  shardId?: number;
  totalShards?: number;
}

/**
 * Payload for reporting guild/server count.
 */
export interface GuildCountPayload {
  /** Current number of guilds/servers the bot is in */
  count: number;
  shardId?: number;
  totalShards?: number;
}

/**
 * Internal heartbeat payload.
 */
export interface HeartbeatPayload {
  /** ISO timestamp of the heartbeat */
  timestamp: string;
  /** Bot uptime in milliseconds */
  uptime: number;
  shardId?: number;
  totalShards?: number;
}

// ─────────────────────────────────────────────────────────────
// API Types
// ─────────────────────────────────────────────────────────────

/**
 * Standard API response from the Cordia server.
 */
export interface ApiResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: unknown;
  status?: number;
}

/**
 * Internal event structure used in the queue.
 */
export interface QueuedEvent {
  /** API endpoint path (e.g., "/track-command") */
  endpoint: string;
  /** Event payload */
  payload: Record<string, unknown>;
  /** Timestamp when the event was queued */
  queuedAt: number;
  /** Number of retry attempts */
  retries: number;
}

// ─────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────

export enum CordiaEvent {
  COMMAND_USED = 'command_used',
  USER_ACTIVE = 'user_active',
  GUILD_COUNT = 'guild_count',
  HEARTBEAT = 'heartbeat',
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}
