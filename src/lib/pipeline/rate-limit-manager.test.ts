import { describe, it, expect } from 'vitest';
import { RateLimitManager, type ZendeskResponseHeaders } from './rate-limit-manager';

describe('RateLimitManager', () => {
  describe('updateFromHeaders', () => {
    it('should update state from valid headers', () => {
      const manager = new RateLimitManager();
      const headers: ZendeskResponseHeaders = {
        'x-rate-limit': '200',
        'x-rate-limit-remaining': '50',
      };

      manager.updateFromHeaders(headers);
      const state = manager.getState();

      expect(state.totalRequests).toBe(200);
      expect(state.remainingRequests).toBe(50);
      expect(state.usagePercent).toBe(75); // (200-50)/200 * 100
    });

    it('should ignore invalid header values', () => {
      const manager = new RateLimitManager();
      const headers: ZendeskResponseHeaders = {
        'x-rate-limit': 'invalid',
        'x-rate-limit-remaining': 'bad',
      };

      manager.updateFromHeaders(headers);
      const state = manager.getState();

      expect(state.totalRequests).toBe(0);
      expect(state.remainingRequests).toBe(0);
    });
  });

  describe('isThrottleRequired', () => {
    it('should return true when usage >= 80%', () => {
      const manager = new RateLimitManager();
      manager.updateFromHeaders({
        'x-rate-limit': '100',
        'x-rate-limit-remaining': '20', // 80% used
      });

      expect(manager.isThrottleRequired()).toBe(true);
    });

    it('should return true when usage > 80%', () => {
      const manager = new RateLimitManager();
      manager.updateFromHeaders({
        'x-rate-limit': '100',
        'x-rate-limit-remaining': '10', // 90% used
      });

      expect(manager.isThrottleRequired()).toBe(true);
    });

    it('should return false when usage < 80%', () => {
      const manager = new RateLimitManager();
      manager.updateFromHeaders({
        'x-rate-limit': '100',
        'x-rate-limit-remaining': '30', // 70% used
      });

      expect(manager.isThrottleRequired()).toBe(false);
    });

    it('should return false with no data (0% usage)', () => {
      const manager = new RateLimitManager();
      expect(manager.isThrottleRequired()).toBe(false);
    });
  });

  describe('getBackoffDelay', () => {
    it('should compute baseDelay * 2^retryCount', () => {
      const manager = new RateLimitManager({ baseDelayMs: 1000 });

      expect(manager.getBackoffDelay(0)).toBe(1000);  // 1000 * 2^0
      expect(manager.getBackoffDelay(1)).toBe(2000);  // 1000 * 2^1
      expect(manager.getBackoffDelay(2)).toBe(4000);  // 1000 * 2^2
      expect(manager.getBackoffDelay(3)).toBe(8000);  // 1000 * 2^3
      expect(manager.getBackoffDelay(4)).toBe(16000); // 1000 * 2^4
    });

    it('should cap delay at maxDelayMs', () => {
      const manager = new RateLimitManager({
        baseDelayMs: 1000,
        maxDelayMs: 5000,
      });

      expect(manager.getBackoffDelay(0)).toBe(1000);
      expect(manager.getBackoffDelay(1)).toBe(2000);
      expect(manager.getBackoffDelay(2)).toBe(4000);
      expect(manager.getBackoffDelay(3)).toBe(5000); // capped
      expect(manager.getBackoffDelay(4)).toBe(5000); // capped
    });

    it('should return -1 when retryCount >= maxRetries', () => {
      const manager = new RateLimitManager({ maxRetries: 5 });

      expect(manager.getBackoffDelay(5)).toBe(-1);
      expect(manager.getBackoffDelay(6)).toBe(-1);
    });
  });

  describe('checkAndWait', () => {
    it('should resolve immediately when no throttling needed', async () => {
      const manager = new RateLimitManager();
      // No headers set, usage is 0%
      await expect(manager.checkAndWait()).resolves.toBeUndefined();
    });
  });
});
