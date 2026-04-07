/**
 * RateLimitManager - Zendesk APIレート制限マネージャー
 *
 * Zendesk APIレスポンスヘッダーから残りリクエスト数を追跡し、
 * 使用率80%以上でスロットリングを発動する。
 * 指数バックオフによるリトライ遅延計算を提供する。
 *
 * Requirements: 16.4, 16.5
 */

export interface RateLimitState {
  remainingRequests: number;
  totalRequests: number;
  resetAt: Date;
  usagePercent: number;
}

export interface ZendeskResponseHeaders {
  'x-rate-limit': string;
  'x-rate-limit-remaining': string;
  'retry-after'?: string;
}

export interface RateLimitConfig {
  /** Base delay in ms for exponential backoff (default: 1000) */
  baseDelayMs: number;
  /** Maximum delay cap in ms (default: 60000) */
  maxDelayMs: number;
  /** Maximum number of retries (default: 5) */
  maxRetries: number;
  /** Throttle threshold as a percentage (default: 80) */
  throttleThresholdPercent: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  baseDelayMs: 1000,
  maxDelayMs: 60000,
  maxRetries: 5,
  throttleThresholdPercent: 80,
};

export class RateLimitManager {
  private state: RateLimitState;
  private config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      remainingRequests: 0,
      totalRequests: 0,
      resetAt: new Date(0),
      usagePercent: 0,
    };
  }

  /**
   * Update rate limit state from Zendesk API response headers.
   */
  updateFromHeaders(headers: ZendeskResponseHeaders): void {
    const total = parseInt(headers['x-rate-limit'], 10);
    const remaining = parseInt(headers['x-rate-limit-remaining'], 10);

    if (isNaN(total) || isNaN(remaining)) {
      return;
    }

    const retryAfterSeconds = headers['retry-after']
      ? parseInt(headers['retry-after'], 10)
      : 60;

    this.state = {
      totalRequests: total,
      remainingRequests: remaining,
      resetAt: new Date(Date.now() + retryAfterSeconds * 1000),
      usagePercent: total > 0 ? ((total - remaining) / total) * 100 : 0,
    };
  }

  /**
   * Returns true if throttling is required (usage >= 80%).
   */
  isThrottleRequired(): boolean {
    return this.state.usagePercent >= this.config.throttleThresholdPercent;
  }

  /**
   * Compute exponential backoff delay: baseDelay * 2^retryCount, capped at maxDelay.
   * Returns -1 if retryCount exceeds maxRetries (signals stop retrying).
   */
  getBackoffDelay(retryCount: number): number {
    if (retryCount >= this.config.maxRetries) {
      return -1;
    }
    const delay = this.config.baseDelayMs * Math.pow(2, retryCount);
    return Math.min(delay, this.config.maxDelayMs);
  }

  /**
   * Check rate limit state and wait if throttling is required.
   * Waits until the reset time if throttled.
   */
  async checkAndWait(): Promise<void> {
    if (!this.isThrottleRequired()) {
      return;
    }

    const now = Date.now();
    const resetTime = this.state.resetAt.getTime();
    const waitMs = Math.max(0, resetTime - now);

    if (waitMs > 0) {
      await this.sleep(waitMs);
    }
  }

  /**
   * Get the current rate limit state (read-only copy).
   */
  getState(): Readonly<RateLimitState> {
    return { ...this.state };
  }

  /**
   * Get the current configuration (read-only copy).
   */
  getConfig(): Readonly<RateLimitConfig> {
    return { ...this.config };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
