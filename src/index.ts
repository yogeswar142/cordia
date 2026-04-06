// ─────────────────────────────────────────────────────────────
// Cordia SDK — Official analytics SDK for Discord bots
// https://docs.cordia.dev
// ─────────────────────────────────────────────────────────────

export { CordiaClient } from './client';

// Re-export all types for consumers
export type {
  CordiaConfig,
  ResolvedCordiaConfig,
  TrackCommandPayload,
  TrackUserPayload,
  GuildCountPayload,
  HeartbeatPayload,
  ApiResponse,
  QueuedEvent,
} from './types';

export { CordiaEvent, LogLevel } from './types';

// ─────────────────────────────────────────────────────────────
// Convenience factory function
// ─────────────────────────────────────────────────────────────

import { CordiaClient } from './client';
import type { CordiaConfig } from './types';

/**
 * Create a new Cordia client instance.
 *
 * This is a convenience wrapper around `new CordiaClient(config)`.
 *
 * @param config - Cordia configuration options
 * @returns A new CordiaClient instance
 *
 * @example
 * ```ts
 * import { createClient } from 'cordia';
 *
 * const cordia = createClient({
 *   apiKey: 'your-api-key',
 *   botId: 'your-bot-id',
 * });
 * ```
 */
export function createClient(config: CordiaConfig): CordiaClient {
  return new CordiaClient(config);
}
