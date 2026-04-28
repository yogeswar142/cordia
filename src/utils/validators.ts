import type { CordiaConfig, ResolvedCordiaConfig } from '../types';

/** Default API base URL — can be overridden via env or config */
const DEFAULT_BASE_URL = 'https://cordlane-brain.onrender.com/api/v1';

/** Default heartbeat interval: 30 seconds */
const DEFAULT_HEARTBEAT_INTERVAL = 30_000;

/** Default batch size for event queue */
const DEFAULT_BATCH_SIZE = 10;

/** Default flush interval: 60 seconds */
const DEFAULT_FLUSH_INTERVAL = 60_000;

/** Default max retries on failure */
const DEFAULT_MAX_RETRIES = 3;

/** Default request timeout: 10 seconds */
const DEFAULT_TIMEOUT = 10_000;

/**
 * Validate and resolve the Cordia config, applying defaults.
 * Throws descriptive errors for invalid configuration.
 */
export function validateConfig(config: CordiaConfig): ResolvedCordiaConfig {
  if (!config) {
    throw new Error('[Cordia] Config object is required. Pass at least { apiKey, botId }.');
  }

  if (!config.apiKey || typeof config.apiKey !== 'string' || config.apiKey.trim() === '') {
    throw new Error('[Cordia] "apiKey" is required and must be a non-empty string.');
  }

  if (!config.botId || typeof config.botId !== 'string' || config.botId.trim() === '') {
    throw new Error('[Cordia] "botId" is required and must be a non-empty string.');
  }

  if (config.heartbeatInterval !== undefined) {
    if (typeof config.heartbeatInterval !== 'number' || config.heartbeatInterval < 30000) {
      throw new Error('[Cordia] "heartbeatInterval" must be a number >= 30000 (30 seconds).');
    }
  }

  if (config.batchSize !== undefined) {
    if (typeof config.batchSize !== 'number' || config.batchSize < 1 || config.batchSize > 100) {
      throw new Error('[Cordia] "batchSize" must be a number between 1 and 100.');
    }
  }

  if (config.flushInterval !== undefined) {
    if (typeof config.flushInterval !== 'number' || config.flushInterval < 60000) {
      throw new Error('[Cordia] "flushInterval" must be a number >= 60000 (60 seconds).');
    }
  }

  if (config.maxRetries !== undefined) {
    if (typeof config.maxRetries !== 'number' || config.maxRetries < 0 || config.maxRetries > 10) {
      throw new Error('[Cordia] "maxRetries" must be a number between 0 and 10.');
    }
  }

  if (config.timeout !== undefined) {
    if (typeof config.timeout !== 'number' || config.timeout < 1000) {
      throw new Error('[Cordia] "timeout" must be a number >= 1000 (1 second).');
    }
  }

  // Resolve base URL: config > env > default
  const baseUrl = (
    config.baseUrl ||
    getEnvVar('CORDIA_API_URL') ||
    DEFAULT_BASE_URL
  ).replace(/\/+$/, ''); // Strip trailing slashes

  return {
    apiKey: config.apiKey.trim(),
    botId: config.botId.trim(),
    baseUrl,
    heartbeatInterval: config.heartbeatInterval ?? DEFAULT_HEARTBEAT_INTERVAL,
    autoHeartbeat: config.autoHeartbeat ?? true,
    debug: config.debug ?? false,
    batchSize: config.batchSize ?? DEFAULT_BATCH_SIZE,
    flushInterval: config.flushInterval ?? DEFAULT_FLUSH_INTERVAL,
    maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
    timeout: config.timeout ?? DEFAULT_TIMEOUT,
    autoScale: config.autoScale ?? false,
  };
}

/**
 * Validate a command name string.
 */
export function validateCommand(command: string): void {
  if (!command || typeof command !== 'string' || command.trim() === '') {
    throw new Error('[Cordia] "command" must be a non-empty string.');
  }
}

/**
 * Validate a user ID string.
 */
export function validateUserId(userId: string): void {
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    throw new Error('[Cordia] "userId" must be a non-empty string.');
  }
}

/**
 * Validate a guild count number.
 */
export function validateGuildCount(count: number): void {
  if (typeof count !== 'number' || count < 0 || !Number.isFinite(count)) {
    throw new Error('[Cordia] "count" must be a non-negative finite number.');
  }
}

/**
 * Safely read an environment variable (works in Node.js).
 */
function getEnvVar(name: string): string | undefined {
  try {
    return process.env[name];
  } catch {
    return undefined;
  }
}
