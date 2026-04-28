import type { ResolvedCordiaConfig, ShardMeta } from '../types';

export const resolveShardMeta = (
  config: ResolvedCordiaConfig,
  overrides?: Partial<ShardMeta>
): ShardMeta => {
  const clientShardId = config.discordClient?.shard?.ids?.[0];
  const clientTotalShards = config.discordClient?.shard?.count;

  const shardId = Number.isInteger(overrides?.shardId)
    ? (overrides?.shardId as number)
    : Number.isInteger(clientShardId)
      ? (clientShardId as number)
      : config.shardId;

  const totalShards = Number.isInteger(overrides?.totalShards) && (overrides?.totalShards as number) > 0
    ? (overrides?.totalShards as number)
    : Number.isInteger(clientTotalShards) && (clientTotalShards as number) > 0
      ? (clientTotalShards as number)
      : config.totalShards;

  return {
    shardId,
    totalShards,
  };
};
