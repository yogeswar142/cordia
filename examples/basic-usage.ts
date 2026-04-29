/**
 * Example: Basic usage of the Cordia SDK
 *
 * This shows the minimum setup needed to get started
 * with the Cordia analytics SDK.
 */

import { createClient } from 'cordia';

// ─────────────────────────────────────────────────────────────
// Create a Cordia client
// ─────────────────────────────────────────────────────────────
const cordia = createClient({
  apiKey: 'your-api-key-here',
  botId: 'your-bot-id-here',

  // Optional: Override the API base URL
  // baseUrl: 'https://api.cordialane.com/v1',

  // Optional: Customize heartbeat interval (default: 30s)
  // heartbeatInterval: 60000,

  // Optional: Disable auto-heartbeat
  // autoHeartbeat: false,

  // Optional: Enable debug logging
  debug: true,

  // Optional: Customize event batching
  // batchSize: 20,
  // flushInterval: 10000,
});

// ─────────────────────────────────────────────────────────────
// Track things
// ─────────────────────────────────────────────────────────────

// Track a command execution
cordia.trackCommand({
  command: 'play',
  userId: '123456789',
  guildId: '987654321',
  metadata: { query: 'lofi beats' },
});

// Track an active user
cordia.trackUser({
  userId: '123456789',
  guildId: '987654321',
  action: 'message',
});

// Report guild count
await cordia.postGuildCount(150);

// ─────────────────────────────────────────────────────────────
// Heartbeat control
// ─────────────────────────────────────────────────────────────

// Check heartbeat status
console.log('Heartbeat running:', cordia.isHeartbeatRunning);
console.log('Bot uptime:', cordia.getUptime(), 'ms');

// Manually control heartbeat
// cordia.stopHeartbeat();
// cordia.startHeartbeat();

// ─────────────────────────────────────────────────────────────
// Queue management
// ─────────────────────────────────────────────────────────────

// Check queue size
console.log('Queued events:', cordia.queueSize);

// Force flush
await cordia.flush();

// ─────────────────────────────────────────────────────────────
// Cleanup
// ─────────────────────────────────────────────────────────────

// Graceful shutdown (stops heartbeat, flushes queue)
await cordia.destroy();
