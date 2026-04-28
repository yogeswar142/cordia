import type { ResolvedCordiaConfig, ShardMeta } from '../types';
import { Logger } from './logger';

let loggedShardDetection = false;
let warnedShardMissing = false;

export const logShardDetectionOnce = (logger: Logger, shardMeta: ShardMeta): void => {
  if (loggedShardDetection) return;
  loggedShardDetection = true;
  logger.info(`Detected shard meta: shardId=${shardMeta.shardId}, totalShards=${shardMeta.totalShards}`);
};

export const debugWarnIfShardInfoMissing = (
  config: ResolvedCordiaConfig,
  logger: Logger,
  shardMeta: ShardMeta
): void => {
  if (!config.debug) return;
  if (!config.discordClient) return;
  if (warnedShardMissing) return;

  const shard = config.discordClient.shard;
  const ids = shard?.ids;
  const count = shard?.count;
  const missingShardInfo = !shard || !Array.isArray(ids) || ids.length === 0 || !Number.isInteger(count) || (count as number) <= 0;

  // Only warn if we appear to be falling back to config defaults while a discord client was supplied.
  const usingFallback = shardMeta.shardId === config.shardId && shardMeta.totalShards === config.totalShards;

  if (missingShardInfo && usingFallback) {
    warnedShardMissing = true;
    logger.warn(
      'Discord client provided but shard info is not available yet. ' +
      'Cordia will keep resolving shard meta lazily, but if you see shardId=0/totalShards=1 unexpectedly, ' +
      'initialize Cordia after the client is ready or pass shardId/totalShards overrides.'
    );
  }
};

