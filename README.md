<div align="center">

# 📊 Cordia

**The official analytics SDK for Discord bots**

Track commands, users, server count, and uptime — all in one package.

[![npm version](https://img.shields.io/npm/v/cordia.svg?style=flat-square)](https://www.npmjs.com/package/cordia)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?style=flat-square)](https://www.typescriptlang.org/)

[Documentation](https://docs.cordia.dev) · [GitHub](https://github.com/yogeswar142/cordia) · [Report Bug](https://github.com/yogeswar142/cordia/issues)

</div>

---

## ✨ Features

- 📡 **Auto Heartbeat** — Automatic uptime monitoring every 30 seconds
- ⚡ **Event Batching** — Commands & user events are batched for optimal performance
- 🔄 **Retry Logic** — Exponential backoff with jitter on failed requests
- 🛡️ **Graceful Errors** — Never crashes your bot, even if the API is down
- 📦 **Tiny Footprint** — Zero dependencies, uses native `fetch`
- 🔷 **TypeScript First** — Full type definitions included
- 🎯 **ESM + CJS** — Works with both import and require

## 📦 Installation

```bash
npm install cordia
```

```bash
yarn add cordia
```

```bash
pnpm add cordia
```

## 🚀 Quick Start

```typescript
import { CordiaClient } from 'cordia';

const cordia = new CordiaClient({
  apiKey: process.env.CORDIA_API_KEY,
  botId: process.env.CORDIA_BOT_ID,
});

// Track a command
cordia.trackCommand({
  command: 'play',
  userId: '123456789',
});

// Report server count
await cordia.postGuildCount(150);

// Heartbeat starts automatically! ❤️
```

## 🤖 Discord.js Integration

```typescript
import { Client, GatewayIntentBits } from 'discord.js';
import { CordiaClient } from 'cordia';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const cordia = new CordiaClient({
  apiKey: process.env.CORDIA_API_KEY,
  botId: process.env.CORDIA_BOT_ID,
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

// Graceful shutdown
process.on('SIGINT', async () => {
  await cordia.destroy();
  client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
```

## ⚙️ Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | **required** | Your bot's API key from the Cordia dashboard |
| `botId` | `string` | **required** | Your bot's unique ID |
| `baseUrl` | `string` | `https://api.cordia.dev/api/v1` | API base URL (or set `CORDIA_API_URL` env var) |
| `heartbeatInterval` | `number` | `30000` | Heartbeat interval in ms |
| `autoHeartbeat` | `boolean` | `true` | Auto-start heartbeat on init |
| `debug` | `boolean` | `false` | Enable debug console logging |
| `batchSize` | `number` | `10` | Max events before auto-flush |
| `flushInterval` | `number` | `5000` | Auto-flush interval in ms |
| `maxRetries` | `number` | `3` | Max retry attempts |
| `timeout` | `number` | `10000` | Request timeout in ms |

## 🌐 Environment Variables

| Variable | Description |
|----------|-------------|
| `CORDIA_API_URL` | Override the default API base URL |
| `CORDIA_API_KEY` | Your bot's API key |
| `CORDIA_BOT_ID` | Your bot's unique ID |

**Development:**
```env
CORDIA_API_URL=http://localhost:5000/api/v1
```

**Production:**
```env
CORDIA_API_URL=https://api.cordia.dev/api/v1
```

## 📖 API Reference

### `trackCommand(payload)`
Track a command execution. Events are batched.

```typescript
cordia.trackCommand({
  command: 'ban',
  userId: '123',
  guildId: '456',
  metadata: { reason: 'spam' },
});
```

### `trackUser(payload)`
Track an active user. Events are batched.

```typescript
cordia.trackUser({
  userId: '123',
  guildId: '456',
  action: 'message',
});
```

### `postGuildCount(count)`
Report server count. Sent immediately.

```typescript
await cordia.postGuildCount(client.guilds.cache.size);
```

### `startHeartbeat()` / `stopHeartbeat()`
Manually control the heartbeat system.

### `flush()`
Force-flush all queued events.

### `destroy()`
Gracefully shut down — stops heartbeat and flushes remaining events.

```typescript
await cordia.destroy();
```

## 📚 Full Documentation

Visit **[docs.cordia.dev](https://docs.cordia.dev)** for complete documentation, guides, and API reference.

## 📄 License

MIT © [Yogeswar](https://github.com/yogeswar142)
