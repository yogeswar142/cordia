import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  batchSize: 10,
  flushInterval: 5000,
  maxRetries: 2,
  timeout: 5000,
};

describe('HttpTransport', () => {
  let http: HttpTransport;
  let logger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = new Logger(false);
    http = new HttpTransport(mockConfig, logger);
  });

  it('should send a POST request with correct headers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    await http.post('/test', { data: 'value' });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5000/api/v1/test',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key',
          'X-Bot-Id': 'test-bot',
        }),
      })
    );
  });

  it('should include botId in the request body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    await http.post('/test', { foo: 'bar' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.botId).toBe('test-bot');
    expect(body.foo).toBe('bar');
  });

  it('should retry on 5xx errors', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error' })
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error' })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

    const result = await http.post('/test', {});
    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('should not retry on 4xx errors (except 429)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ error: 'Invalid payload' }),
    });

    const result = await http.post('/test', {});
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid payload');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should return error after all retries exhausted', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const result = await http.post('/test', {});
    expect(result.success).toBe(false);
    // maxRetries is 2, so 3 total attempts
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('should handle network errors gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await http.post('/test', {});
    expect(result.success).toBe(false);
  });

  it('postFireAndForget should not throw on error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    await expect(http.postFireAndForget('/test', {})).resolves.not.toThrow();
  });
});
