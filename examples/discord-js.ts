/**
 * Example: Using the Cordia SDK with discord.js
 *
 * This shows how to integrate the Cordia analytics SDK
 * into a Discord.js bot for tracking commands, users,
 * guild counts, and uptime.
 */

import { Client, GatewayIntentBits } from 'discord.js';
import { CordiaClient } from 'cordia';

// ─────────────────────────────────────────────────────────────
// 1. Create your Discord client
// ─────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ─────────────────────────────────────────────────────────────
// 2. Initialize the Cordia SDK
// ─────────────────────────────────────────────────────────────
const cordia = new CordiaClient({
  apiKey: process.env.CORDIA_API_KEY!,
  botId: process.env.CORDIA_BOT_ID!,
  // baseUrl defaults to CORDIA_API_URL env var or https://api.cordia.dev/api/v1
  debug: process.env.NODE_ENV === 'development',
});

// ─────────────────────────────────────────────────────────────
// 3. Report guild count when bot is ready
// ─────────────────────────────────────────────────────────────
client.on('ready', async () => {
  console.log(`Logged in as ${client.user?.tag}!`);

  // Report initial guild count
  await cordia.postGuildCount(client.guilds.cache.size);

  // Optionally, report guild count on an interval
  setInterval(async () => {
    await cordia.postGuildCount(client.guilds.cache.size);
  }, 5 * 60 * 1000); // Every 5 minutes
});

// ─────────────────────────────────────────────────────────────
// 4. Track guild changes
// ─────────────────────────────────────────────────────────────
client.on('guildCreate', async () => {
  await cordia.postGuildCount(client.guilds.cache.size);
});

client.on('guildDelete', async () => {
  await cordia.postGuildCount(client.guilds.cache.size);
});

// ─────────────────────────────────────────────────────────────
// 5. Track commands
// ─────────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // Track the command with Cordia
  cordia.trackCommand({
    command: interaction.commandName,
    userId: interaction.user.id,
    guildId: interaction.guildId ?? undefined,
  });

  // Handle commands as usual
  if (interaction.commandName === 'ping') {
    await interaction.reply('Pong! 🏓');
  }
});

// ─────────────────────────────────────────────────────────────
// 6. Track active users (on message)
// ─────────────────────────────────────────────────────────────
client.on('messageCreate', (message) => {
  if (message.author.bot) return;

  // Track user activity
  cordia.trackUser({
    userId: message.author.id,
    guildId: message.guildId ?? undefined,
    action: 'message',
  });
});

// ─────────────────────────────────────────────────────────────
// 7. Graceful shutdown
// ─────────────────────────────────────────────────────────────
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await cordia.destroy(); // Flush remaining events & stop heartbeat
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await cordia.destroy();
  client.destroy();
  process.exit(0);
});

// ─────────────────────────────────────────────────────────────
// 8. Login
// ─────────────────────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN);
