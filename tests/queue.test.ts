import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventQueue } from '../src/transport/queue';
import { HttpTransport } from '../src/transport/http';
import type { ResolvedCordiaConfig } from '../src/types';
import { Logger } from '../src/utils/logger';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockConfig: ResolvedCordiaConfig = {
  apiKey: 'test-key',
  botId: 'test-bot',
  baseUrl: 'http://localhost:5000/api/v1',
  heartbeatInterval: 30000,
  autoHeartbeat: false,
  debug: false,
  batchSize: 3,
  flushInterval: 60000, // Long interval so auto-flush doesn't interfere
  maxRetries: 1,
  timeout: 5000,
};

describe('EventQueue', () => {
  let queue: EventQueue;
  let http: HttpTransport;
  let logger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    logger = new Logger(false);
    http = new HttpTransport(mockConfig, logger);
    queue = new EventQueue(mockConfig, http, logger);
  });

  afterEach(async () => {
    await queue.destroy();
  });

  it('should enqueue events', () => {
    queue.enqueue({ endpoint: '/test', payload: { data: 1 } });
    expect(queue.size).toBe(1);
  });

  it('should flush events on manual flush', async () => {
    queue.enqueue({ endpoint: '/test', payload: { data: 1 } });
    queue.enqueue({ endpoint: '/test', payload: { data: 2 } });

    expect(queue.size).toBe(2);

    await queue.flush();

    expect(queue.size).toBe(0);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should auto-flush when batch size is reached', async () => {
    // batchSize is 3
    queue.enqueue({ endpoint: '/test', payload: { data: 1 } });
    queue.enqueue({ endpoint: '/test', payload: { data: 2 } });
    queue.enqueue({ endpoint: '/test', payload: { data: 3 } });

    // Give the async flush a moment to complete
    await new Promise((r) => setTimeout(r, 100));

    expect(queue.size).toBe(0);
  });

  it('should group events by endpoint', async () => {
    queue.enqueue({ endpoint: '/track-command', payload: { command: 'play' } });
    queue.enqueue({ endpoint: '/track-user', payload: { userId: '123' } });

    // Wait for possible auto-flush (batchSize is 3, we only have 2)
    await queue.flush();

    // Should have made 2 individual requests (one per event)
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Verify the endpoints were called correctly
    const urls = mockFetch.mock.calls.map((call) => call[0] as string);
    expect(urls).toContain('http://localhost:5000/api/v1/track-command');
    expect(urls).toContain('http://localhost:5000/api/v1/track-user');
  });

  it('should not enqueue after destroy', async () => {
    await queue.destroy();

    queue.enqueue({ endpoint: '/test', payload: { data: 1 } });
    expect(queue.size).toBe(0);
  });

  it('should flush remaining events on destroy', async () => {
    queue.enqueue({ endpoint: '/test', payload: { data: 1 } });
    queue.enqueue({ endpoint: '/test', payload: { data: 2 } });

    await queue.destroy();

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
