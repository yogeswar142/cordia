import type { QueuedEvent, ResolvedCordiaConfig } from '../types';
import { HttpTransport } from './http';
import { Logger } from '../utils/logger';

/**
 * Event queue with batching and periodic flushing.
 * Buffers events and sends them in batches to reduce network overhead.
 */
export class EventQueue {
  private queue: QueuedEvent[] = [];
  private config: ResolvedCordiaConfig;
  private http: HttpTransport;
  private logger: Logger;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private currentFlushInterval: number;
  private isFlushing = false;
  private isDestroyed = false;

  constructor(config: ResolvedCordiaConfig, http: HttpTransport, logger: Logger) {
    this.config = config;
    this.http = http;
    this.logger = logger;
    this.currentFlushInterval = config.flushInterval;

    // Start auto-flush timer
    this.startFlushTimer();
  }

  /**
   * Add an event to the queue.
   * If the queue reaches batchSize, it will be flushed immediately.
   */
  enqueue(event: Omit<QueuedEvent, 'queuedAt' | 'retries'>): void {
    if (this.isDestroyed) {
      this.logger.warn('Cannot enqueue events after client is destroyed');
      return;
    }

    const queuedEvent: QueuedEvent = {
      ...event,
      queuedAt: Date.now(),
      retries: 0,
    };

    this.queue.push(queuedEvent);
    this.logger.debug(`Event queued for ${event.endpoint}. Queue size: ${this.queue.length}`);

    // ADAPTIVE LOGIC: If we are getting events fast, flush sooner.
    if (this.queue.length >= this.config.batchSize) {
      this.logger.debug('Batch size reached, triggering adaptive flush...');
      
      // If we hit the batch limit before the timer, the bot is "Busy".
      // Temporarily speed up the flush interval (min 15s).
      if (this.currentFlushInterval > 15000) {
        this.currentFlushInterval = Math.max(15000, this.currentFlushInterval - 5000);
        this.startFlushTimer(); // Apply new interval
      }
      
      void this.flush();
    }
  }

  /**
   * Flush all queued events to the API via track-batch.
   */
  async flush(): Promise<void> {
    if (this.isFlushing || this.queue.length === 0) {
      // If queue is empty, slowly return to the user's base interval
      if (this.queue.length === 0 && this.currentFlushInterval < this.config.flushInterval) {
        this.currentFlushInterval = Math.min(this.config.flushInterval, this.currentFlushInterval + 2000);
        this.startFlushTimer();
      }
      return;
    }

    this.isFlushing = true;

    try {
      // Enforce backpressure (max 1000 items to avoid memory leaks)
      if (this.queue.length > 1000) {
        this.logger.warn(`Queue exceeded 1000 items, dropping oldest ${this.queue.length - 1000} items.`);
        this.queue = this.queue.slice(this.queue.length - 1000);
      }

      // Take current queue and reset immediately
      // Hard limit of 500 events per batch to stay under API validation limits
      const batchLimit = 500;
      const events = this.queue.slice(0, batchLimit);
      this.queue = this.queue.slice(batchLimit);

      this.logger.debug(`Flushing ${events.length} events (Remaining in queue: ${this.queue.length})...`);

      const batchPayloads = events.map(e => e.payload);

      // Batch optimization: if all events share the same shard meta, hoist it to the root.
      // The API supports root-level shardId/totalShards as a default for all events.
      let rootShardId: number | undefined;
      let rootTotalShards: number | undefined;
      let allSameShard = true;
      for (const payload of batchPayloads) {
        const shardId = (payload as any).shardId;
        const totalShards = (payload as any).totalShards;
        if (!Number.isInteger(shardId) || !Number.isInteger(totalShards) || totalShards <= 0) {
          allSameShard = false;
          break;
        }
        if (rootShardId === undefined && rootTotalShards === undefined) {
          rootShardId = shardId as number;
          rootTotalShards = totalShards as number;
          continue;
        }
        if (rootShardId !== shardId || rootTotalShards !== totalShards) {
          allSameShard = false;
          break;
        }
      }

      const eventsForBatch = allSameShard && rootShardId !== undefined && rootTotalShards !== undefined
        ? batchPayloads.map(p => {
          const copy: Record<string, unknown> = { ...p };
          delete (copy as any).shardId;
          delete (copy as any).totalShards;
          return copy;
        })
        : batchPayloads;

      try {
        const result = await this.http.post('/track-batch', {
          botId: this.config.botId,
          shardId: allSameShard ? rootShardId : undefined,
          totalShards: allSameShard ? rootTotalShards : undefined,
          events: eventsForBatch
        });
        
        if (!result.success) {
          if (result.error?.includes('429')) {
            if (this.config.autoScale) {
              this.config.batchSize = Math.floor(this.config.batchSize * 1.5) + 10;
              this.config.flushInterval += 10000;
              this.startFlushTimer(); // Restart timer with new interval
              this.logger.warn(`Rate limited! Auto-scaled batchSize to ${this.config.batchSize} and flushInterval to ${this.config.flushInterval}ms`);
            } else {
              this.logger.warn('Rate limit exceeded. Consider increasing batchSize or enabling autoScale.');
            }
          }
          throw new Error(result.error || 'Failed to send batch');
        }
        
        this.logger.debug('Flush complete');
      } catch (error) {
        this.logger.error('Failed to send batch, re-queuing events', error);
        // Backoff: put them back at the front of the queue
        this.queue = [...events, ...this.queue];
      }
    } catch (error) {
      this.logger.error('Flush failed', error);
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Get the current queue length.
   */
  get size(): number {
    return this.queue.length;
  }

  /**
   * Start the periodic flush timer.
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.currentFlushInterval);

    // Prevent the timer from keeping the Node.js process alive
    if (this.flushTimer && typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      this.flushTimer.unref();
    }
  }

  /**
   * Stop the flush timer and flush remaining events.
   */
  async destroy(): Promise<void> {
    this.isDestroyed = true;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Final flush
    if (this.queue.length > 0) {
      this.logger.debug('Performing final flush before destroy...');
      await this.flush();
    }
  }


}
