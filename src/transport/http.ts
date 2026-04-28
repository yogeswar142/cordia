import type { ApiResponse, ResolvedCordiaConfig } from '../types';
import { Logger } from '../utils/logger';

/**
 * HTTP transport layer for the Cordia SDK.
 * Handles authenticated requests with retry + exponential backoff.
 * Uses native fetch (Node.js 18+).
 */
export class HttpTransport {
  private config: ResolvedCordiaConfig;
  private logger: Logger;

  constructor(config: ResolvedCordiaConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Send a GET request to the Cordia API.
   * Includes automatic retry with exponential backoff.
   */
  async get(endpoint: string): Promise<ApiResponse> {
    const url = `${this.config.baseUrl}${endpoint}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.getBackoffDelay(attempt);
          await this.sleep(delay);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        try {
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${this.config.apiKey}`,
              'X-Bot-Id': this.config.botId,
              'User-Agent': `cordia-sdk/1.0.0 node/${process.version}`,
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            return await response.json() as ApiResponse;
          }

          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            const errorData = await response.json().catch(() => ({})) as Record<string, string>;
            return {
              success: false,
              error: errorData.error || response.statusText,
              status: response.status,
            };
          }

          lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
        } catch (fetchError) {
          clearTimeout(timeoutId);
          throw fetchError;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    return { success: false, error: lastError?.message || 'Unknown error' };
  }

  /**
   * Send a POST request to the Cordia API.
   * Includes automatic retry with exponential backoff.
   */
  async post(endpoint: string, payload: Record<string, unknown>): Promise<ApiResponse> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const body = JSON.stringify({
      botId: this.config.botId,
      ...payload,
    });

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.getBackoffDelay(attempt);
          this.logger.debug(`Retry attempt ${attempt}/${this.config.maxRetries} after ${delay}ms`);
          await this.sleep(delay);
        }

        this.logger.debug(`POST ${url}`, { attempt });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.config.apiKey}`,
              'X-Bot-Id': this.config.botId,
              'User-Agent': `cordia-sdk/1.0.0 node/${process.version}`,
            },
            body,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json() as ApiResponse;
            this.logger.debug(`Response OK from ${endpoint}`, data);
            return data;
          }

          // Don't retry on client errors (4xx) except 429 (rate limit)
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            const errorData = await response.json().catch(() => ({})) as Record<string, string>;
            this.logger.error(`Client error ${response.status} on ${endpoint}: ${errorData.error || response.statusText}`);
            return {
              success: false,
              error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
            };
          }

          // Retry on 429 or 5xx
          lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
          this.logger.warn(`Retryable error ${response.status} on ${endpoint}`);
        } catch (fetchError) {
          clearTimeout(timeoutId);
          throw fetchError;
        }
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            lastError = new Error(`Request to ${endpoint} timed out after ${this.config.timeout}ms`);
            this.logger.warn(lastError.message);
          } else {
            lastError = error;
            this.logger.warn(`Network error on ${endpoint}: ${error.message}`);
          }
        } else {
          lastError = new Error(String(error));
        }
      }
    }

    // All retries exhausted
    this.logger.error(`All ${this.config.maxRetries + 1} attempts failed for ${endpoint}`);
    return {
      success: false,
      error: lastError?.message || 'Unknown error after all retries',
    };
  }

  /**
   * Send a POST request without retry (used for heartbeats).
   * Fires and forgets — does not throw.
   */
  async postFireAndForget(endpoint: string, payload: Record<string, unknown>): Promise<void> {
    try {
      await this.post(endpoint, payload);
    } catch {
      // Silently ignore — heartbeats should never crash the bot
    }
  }

  /**
   * Calculate exponential backoff delay with jitter.
   */
  private getBackoffDelay(attempt: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30_000; // 30 seconds
    const exponential = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000;
    return Math.min(exponential + jitter, maxDelay);
  }

  /**
   * Sleep for a specified duration.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
