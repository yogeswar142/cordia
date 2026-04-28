# Cordia

The official JavaScript/TypeScript analytics SDK for Discord bots.

Track commands, users, server count, and uptime with minimal setup. Events are batched and sent automatically. The heartbeat system monitors uptime out of the box.

[![npm](https://img.shields.io/npm/v/cordia)](https://www.npmjs.com/package/cordia)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

## Install

```bash
npm install cordia
```

## Quick Start

```typescript
import { Client, GatewayIntentBits } from 'discord.js';
import { CordiaClient } from 'cordia';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const cordia = new CordiaClient({
  apiKey: process.env.CORDIA_API_KEY,
  discordClient: client, // botId auto-detected from client.user.id
});

// Track a command
cordia.trackCommand({ command: 'play', userId: '123456789' });

// Report server count
await cordia.postGuildCount(150);

// Heartbeat runs automatically
```

## Discord.js Example

```typescript
import { Client, GatewayIntentBits } from 'discord.js';
import { CordiaClient } from 'cordia';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const cordia = new CordiaClient({
  apiKey: process.env.CORDIA_API_KEY,
  discordClient: client, // auto-detects botId + shard metadata
});

client.on('ready', async () => {
  await cordia.postGuildCount(client.guilds.cache.size);
});

client.on('interactionCreate', (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  cordia.trackCommand({
    command: interaction.commandName,
    userId: interaction.user.id,
    guildId: interaction.guildId,
  });
});

process.on('SIGINT', async () => {
  await cordia.destroy();
  client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | required | API key from the Cordia dashboard |
| `discordClient` | `Client` | required | Discord.js client used for botId/shard auto-detection |
| `botId` | `string` | optional | Manual bot ID override (rarely needed) |
| `baseUrl` | `string` | `https://api.cordialane.com/api/v1` | API endpoint |
| `heartbeatInterval` | `number` | `30000` | Heartbeat interval (ms) |
| `autoHeartbeat` | `boolean` | `true` | Start heartbeat on init |
| `batchSize` | `number` | `10` | Events before auto-flush |
| `flushInterval` | `number` | `5000` | Auto-flush interval (ms) |
| `maxRetries` | `number` | `3` | Retry attempts on failure |
| `timeout` | `number` | `10000` | Request timeout (ms) |
| `debug` | `boolean` | `false` | Enable debug logging |

## API

| Method | Description |
|--------|-------------|
| `trackCommand(payload)` | Queue a command event (batched) |
| `trackUser(payload)` | Queue a user activity event (batched) |
| `postGuildCount(count)` | Report server count (immediate) |
| `startHeartbeat()` | Start heartbeat manually |
| `stopHeartbeat()` | Stop heartbeat |
| `getUptime()` | Returns uptime in ms |
| `flush()` | Force-flush queued events |
| `destroy()` | Stop heartbeat, flush, and clean up |

## Documentation

Full guides and API reference at [docs.cordialane.com](https://docs.cordialane.com).

## License

MIT
