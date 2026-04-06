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
  private isFlushing = false;
  private isDestroyed = false;

  constructor(config: ResolvedCordiaConfig, http: HttpTransport, logger: Logger) {
    this.config = config;
    this.http = http;
    this.logger = logger;

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

    // Auto-flush if batch size reached
    if (this.queue.length >= this.config.batchSize) {
      this.logger.debug('Batch size reached, flushing...');
      void this.flush();
    }
  }

  /**
   * Flush all queued events to the API.
   * Sends events grouped by endpoint.
   */
  async flush(): Promise<void> {
    if (this.isFlushing || this.queue.length === 0) {
      return;
    }

    this.isFlushing = true;

    try {
      // Take current queue and reset
      const events = [...this.queue];
      this.queue = [];

      this.logger.debug(`Flushing ${events.length} events...`);

      // Group events by endpoint for batch sending
      const grouped = this.groupByEndpoint(events);

      // Send each group
      const promises = Object.entries(grouped).map(async ([endpoint, endpointEvents]) => {
        for (const event of endpointEvents) {
          try {
            await this.http.post(endpoint, event.payload);
          } catch {
            this.logger.error(`Failed to send event to ${endpoint}`);
            // Don't re-queue on failure to prevent infinite loops
          }
        }
      });

      await Promise.allSettled(promises);
      this.logger.debug('Flush complete');
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
    }, this.config.flushInterval);

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

  /**
   * Group events by their endpoint.
   */
  private groupByEndpoint(events: QueuedEvent[]): Record<string, QueuedEvent[]> {
    const groups: Record<string, QueuedEvent[]> = {};

    for (const event of events) {
      if (!groups[event.endpoint]) {
        groups[event.endpoint] = [];
      }
      groups[event.endpoint].push(event);
    }

    return groups;
  }
}
