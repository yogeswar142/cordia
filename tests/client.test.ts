import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CordiaClient } from '../src/client';
import type { CordiaConfig } from '../src/types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const validConfig: CordiaConfig = {
  apiKey: 'test-api-key-123',
  botId: 'test-bot-id-456',
  baseUrl: 'http://localhost:5000/api/v1',
  autoHeartbeat: false, // Disable for testing
  debug: false,
};

describe('CordiaClient', () => {
  let client: CordiaClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
  });

  afterEach(async () => {
    if (client && !client.isDestroyed) {
      await client.destroy();
    }
  });

  describe('Initialization', () => {
    it('should create a client with valid config', () => {
      client = new CordiaClient(validConfig);
      expect(client).toBeDefined();
      expect(client.isDestroyed).toBe(false);
    });

    it('should throw if apiKey is missing', () => {
      expect(() => new CordiaClient({ apiKey: '', botId: 'test' })).toThrow('"apiKey" is required');
    });

    it('should throw if botId is missing', () => {
      expect(() => new CordiaClient({ apiKey: 'test', botId: '' })).toThrow('"botId" is required');
    });

    it('should throw if heartbeatInterval is too low', () => {
      expect(() => new CordiaClient({ ...validConfig, heartbeatInterval: 1000 })).toThrow(
        '"heartbeatInterval" must be a number >= 5000'
      );
    });

    it('should throw if batchSize is out of range', () => {
      expect(() => new CordiaClient({ ...validConfig, batchSize: 0 })).toThrow(
        '"batchSize" must be a number between 1 and 100'
      );
      expect(() => new CordiaClient({ ...validConfig, batchSize: 101 })).toThrow(
        '"batchSize" must be a number between 1 and 100'
      );
    });

    it('should auto-start heartbeat when autoHeartbeat is true', () => {
      client = new CordiaClient({ ...validConfig, autoHeartbeat: true });
      expect(client.isHeartbeatRunning).toBe(true);
    });

    it('should not auto-start heartbeat when autoHeartbeat is false', () => {
      client = new CordiaClient({ ...validConfig, autoHeartbeat: false });
      expect(client.isHeartbeatRunning).toBe(false);
    });
  });

  describe('trackCommand', () => {
    beforeEach(() => {
      client = new CordiaClient(validConfig);
    });

    it('should queue a command event', () => {
      client.trackCommand({ command: 'play', userId: '123' });
      expect(client.queueSize).toBe(1);
    });

    it('should queue multiple command events', () => {
      client.trackCommand({ command: 'play' });
      client.trackCommand({ command: 'skip' });
      client.trackCommand({ command: 'pause' });
      expect(client.queueSize).toBe(3);
    });

    it('should not throw on invalid command (logs error instead)', () => {
      expect(() => client.trackCommand({ command: '' })).not.toThrow();
    });
  });

  describe('trackUser', () => {
    beforeEach(() => {
      client = new CordiaClient(validConfig);
    });

    it('should queue a user event', () => {
      client.trackUser({ userId: '123' });
      expect(client.queueSize).toBe(1);
    });

    it('should not throw on invalid userId (logs error instead)', () => {
      expect(() => client.trackUser({ userId: '' })).not.toThrow();
    });
  });

  describe('postGuildCount', () => {
    beforeEach(() => {
      client = new CordiaClient(validConfig);
    });

    it('should send guild count via HTTP POST', async () => {
      await client.postGuildCount(150);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/v1/guild-count',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key-123',
            'X-Bot-Id': 'test-bot-id-456',
          }),
        })
      );
    });

    it('should include the count in the payload', async () => {
      await client.postGuildCount(42);

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.count).toBe(42);
      expect(body.botId).toBe('test-bot-id-456');
    });

    it('should not throw on negative count (handles gracefully)', async () => {
      await expect(client.postGuildCount(-1)).resolves.not.toThrow();
    });
  });

  describe('Heartbeat', () => {
    it('should start and stop heartbeat manually', () => {
      client = new CordiaClient(validConfig);

      expect(client.isHeartbeatRunning).toBe(false);

      client.startHeartbeat();
      expect(client.isHeartbeatRunning).toBe(true);

      client.stopHeartbeat();
      expect(client.isHeartbeatRunning).toBe(false);
    });

    it('should track uptime', async () => {
      client = new CordiaClient(validConfig);
      client.startHeartbeat();

      // Wait a tiny bit
      await new Promise((r) => setTimeout(r, 50));

      expect(client.getUptime()).toBeGreaterThan(0);
    });
  });

  describe('flush', () => {
    it('should flush queued events', async () => {
      client = new CordiaClient(validConfig);

      client.trackCommand({ command: 'play' });
      client.trackCommand({ command: 'skip' });

      expect(client.queueSize).toBe(2);

      await client.flush();

      expect(client.queueSize).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should stop heartbeat and flush queue on destroy', async () => {
      client = new CordiaClient({ ...validConfig, autoHeartbeat: true });

      client.trackCommand({ command: 'play' });

      expect(client.isHeartbeatRunning).toBe(true);
      expect(client.queueSize).toBe(1);

      await client.destroy();

      expect(client.isDestroyed).toBe(true);
      expect(client.isHeartbeatRunning).toBe(false);
    });

    it('should not throw on double destroy', async () => {
      client = new CordiaClient(validConfig);
      await client.destroy();
      await expect(client.destroy()).resolves.not.toThrow();
    });

    it('should warn when using client after destroy', async () => {
      client = new CordiaClient(validConfig);
      await client.destroy();

      // Should not throw, just warn
      expect(() => client.trackCommand({ command: 'play' })).not.toThrow();
    });
  });
});
