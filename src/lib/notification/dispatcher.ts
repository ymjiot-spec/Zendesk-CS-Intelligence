/**
 * Notification Dispatcher - Requirements 9.1, 9.3, 9.10
 *
 * Multi-channel notification dispatch with:
 * - Slack, Email, Chatwork channel support
 * - Exponential backoff retry (default 3 retries)
 * - Error logging
 */

import type {
  NotificationRule,
  NotificationMessage,
  DispatchResult,
} from '@/types/notification';
import { formatPlainTextMessage } from './message-formatter';

/** Formatted message ready for channel-specific sending */
export interface FormattedMessage {
  subject: string;
  body: string;
}

/** Result of a single send attempt */
export interface SendResult {
  success: boolean;
  error?: string;
}

/** Abstractions for actual API calls - allows DI for testing */
export interface NotificationChannelAdapters {
  sendSlack: (destination: string, message: FormattedMessage) => Promise<SendResult>;
  sendEmail: (destination: string, message: FormattedMessage) => Promise<SendResult>;
  sendChatwork: (destination: string, message: FormattedMessage) => Promise<SendResult>;
}

export interface NotificationDispatcherDeps {
  adapters: NotificationChannelAdapters;
  logger?: {
    error: (message: string, context?: Record<string, unknown>) => void;
    info: (message: string, context?: Record<string, unknown>) => void;
  };
  maxRetries?: number;
}

const DEFAULT_MAX_RETRIES = 3;

/**
 * Exponential backoff retry (Req 9.10)
 * Retries with delays: 1s, 2s, 4s, ...
 */
export async function retryWithBackoff(
  sendFn: () => Promise<SendResult>,
  maxRetries: number,
  delayFn: (attempt: number) => Promise<void> = defaultDelay,
): Promise<{ result: SendResult; retryCount: number }> {
  let lastResult: SendResult = { success: false, error: 'No attempts made' };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    lastResult = await sendFn();
    if (lastResult.success) {
      return { result: lastResult, retryCount: attempt };
    }
    if (attempt < maxRetries) {
      await delayFn(attempt);
    }
  }

  return { result: lastResult, retryCount: maxRetries };
}

async function defaultDelay(attempt: number): Promise<void> {
  const ms = Math.pow(2, attempt) * 1000;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * NotificationDispatcher class (Req 9.1, 9.3, 9.10)
 */
export class NotificationDispatcher {
  private adapters: NotificationChannelAdapters;
  private logger: NonNullable<NotificationDispatcherDeps['logger']>;
  private maxRetries: number;

  constructor(deps: NotificationDispatcherDeps) {
    this.adapters = deps.adapters;
    this.logger = deps.logger ?? {
      error: () => {},
      info: () => {},
    };
    this.maxRetries = deps.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  /**
   * Dispatch a notification message to all matching rules (Req 9.3)
   */
  async dispatch(
    message: NotificationMessage,
    rules: NotificationRule[],
    delayFn?: (attempt: number) => Promise<void>,
  ): Promise<DispatchResult[]> {
    const enabledRules = rules.filter((r) => r.enabled);
    const formatted = this.formatForChannel(message);
    const results: DispatchResult[] = [];

    for (const rule of enabledRules) {
      const sendFn = this.getSendFunction(rule.channel, rule.destination, formatted);
      const { result, retryCount } = await retryWithBackoff(
        sendFn,
        this.maxRetries,
        delayFn,
      );

      if (!result.success) {
        this.logger.error('Notification send failed', {
          ruleId: rule.id,
          channel: rule.channel,
          destination: rule.destination,
          error: result.error,
          retryCount,
        });
      } else {
        this.logger.info('Notification sent', {
          ruleId: rule.id,
          channel: rule.channel,
        });
      }

      results.push({
        ruleId: rule.id,
        channel: rule.channel,
        success: result.success,
        error: result.error,
        retryCount,
      });
    }

    return results;
  }

  /** Send to Slack (Req 9.1) */
  async sendSlack(
    destination: string,
    message: FormattedMessage,
  ): Promise<SendResult> {
    return this.adapters.sendSlack(destination, message);
  }

  /** Send to Email (Req 9.1) */
  async sendEmail(
    destination: string,
    message: FormattedMessage,
  ): Promise<SendResult> {
    return this.adapters.sendEmail(destination, message);
  }

  /** Send to Chatwork (Req 9.1) */
  async sendChatwork(
    destination: string,
    message: FormattedMessage,
  ): Promise<SendResult> {
    return this.adapters.sendChatwork(destination, message);
  }

  private formatForChannel(message: NotificationMessage): FormattedMessage {
    return {
      subject: `⚠️ 異常検知: ${message.anomalyMetric}`,
      body: formatPlainTextMessage(message),
    };
  }

  private getSendFunction(
    channel: NotificationRule['channel'],
    destination: string,
    formatted: FormattedMessage,
  ): () => Promise<SendResult> {
    switch (channel) {
      case 'slack':
        return () => this.sendSlack(destination, formatted);
      case 'email':
        return () => this.sendEmail(destination, formatted);
      case 'chatwork':
        return () => this.sendChatwork(destination, formatted);
    }
  }
}
