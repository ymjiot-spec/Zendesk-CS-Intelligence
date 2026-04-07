import { describe, it, expect, vi } from 'vitest';
import {
  formatNotificationMessage,
  generateTicketUrl,
  formatPlainTextMessage,
} from './message-formatter';
import {
  NotificationDispatcher,
  retryWithBackoff,
} from './dispatcher';
import {
  NotificationRuleManager,
  createInMemoryRuleStore,
} from './rule-manager';
import type { AnomalyEvent } from '@/types/anomaly';
import type { AIAnalysisResult, ActionSuggestion } from '@/types/ai';
import type { NotificationRule } from '@/types/notification';

// --- Fixtures ---
const anomalyEvent: AnomalyEvent = {
  id: 'anom_1',
  detectedAt: new Date('2024-01-15'),
  type: 'threshold',
  metric: 'total',
  currentValue: 150,
  thresholdOrBaseline: 100,
  deviation: 50,
  severity: 'critical',
};

const analysis: AIAnalysisResult = {
  anomalyEventId: 'anom_1',
  categoryBreakdown: [
    { category: '料金', count: 50, percentage: 33.3, increaseRate: 80 },
    { category: '契約', count: 40, percentage: 26.7, increaseRate: 60 },
    { category: '技術', count: 30, percentage: 20, increaseRate: 40 },
    { category: 'その他', count: 30, percentage: 20, increaseRate: 10 },
  ],
  commonPatterns: '料金関連の問い合わせが急増',
  hypotheses: [
    { rank: 1, description: '料金改定の影響', evidence: [{ metric: '料金カテゴリ', value: 80, unit: '%' }], confidence: 'high' },
  ],
  representativeTicketIds: ['T001', 'T002', 'T003', 'T004', 'T005', 'T006'],
  generatedAt: new Date(),
};

const actionSuggestions: ActionSuggestion[] = [
  { id: 'a1', anomalyEventId: 'anom_1', actionType: 'faq_create_update', title: 'FAQ更新', description: '料金FAQを更新', priority: 'high', reasoning: '根拠', responseStatus: 'pending', createdAt: new Date() },
  { id: 'a2', anomalyEventId: 'anom_1', actionType: 'announcement_post', title: 'お知らせ掲載', description: '料金変更のお知らせ', priority: 'medium', reasoning: '根拠', responseStatus: 'pending', createdAt: new Date() },
  { id: 'a3', anomalyEventId: 'anom_1', actionType: 'internal_escalation', title: 'エスカレーション', description: '経理部門へ連絡', priority: 'low', reasoning: '根拠', responseStatus: 'pending', createdAt: new Date() },
  { id: 'a4', anomalyEventId: 'anom_1', actionType: 'system_investigation', title: '調査', description: 'システム調査', priority: 'low', reasoning: '根拠', responseStatus: 'pending', createdAt: new Date() },
];

// --- Message Formatter Tests ---
describe('Message Formatter', () => {
  it('generates correct Zendesk ticket URLs', () => {
    expect(generateTicketUrl('mycompany', '12345')).toBe(
      'https://mycompany.zendesk.com/agent/tickets/12345',
    );
  });

  it('formats notification message with all required fields', () => {
    const msg = formatNotificationMessage({
      anomalyEvent,
      analysis,
      actionSuggestions,
      zendeskSubdomain: 'test',
    });

    expect(msg.anomalyMetric).toBe('total');
    expect(msg.detectedValue).toBe(150);
    expect(msg.averageValue).toBe(100);
    expect(msg.deviationFromAverage).toBe(50);
    expect(msg.topCategories).toHaveLength(3);
    expect(msg.topCategories[0].category).toBe('料金');
    expect(msg.representativeTicketIds).toHaveLength(5); // max 5
    expect(msg.ticketUrls).toHaveLength(5);
    expect(msg.ticketUrls[0]).toBe('https://test.zendesk.com/agent/tickets/T001');
    expect(msg.aiAnalysisSummary).toContain('料金関連');
    expect(msg.aiAnalysisSummary).toContain('FAQ更新');
  });

  it('limits action suggestions to top 3 in summary', () => {
    const msg = formatNotificationMessage({
      anomalyEvent,
      analysis,
      actionSuggestions,
      zendeskSubdomain: 'test',
    });

    // Should contain first 3 but not 4th
    expect(msg.aiAnalysisSummary).toContain('FAQ更新');
    expect(msg.aiAnalysisSummary).toContain('お知らせ掲載');
    expect(msg.aiAnalysisSummary).toContain('エスカレーション');
    expect(msg.aiAnalysisSummary).not.toContain('調査');
  });

  it('formats plain text message', () => {
    const msg = formatNotificationMessage({
      anomalyEvent,
      analysis,
      zendeskSubdomain: 'test',
    });
    const text = formatPlainTextMessage(msg);

    expect(text).toContain('異常検知: total');
    expect(text).toContain('150');
    expect(text).toContain('100');
    expect(text).toContain('料金');
  });
});

// --- Dispatcher Tests ---
describe('NotificationDispatcher', () => {
  it('dispatches to enabled rules only', async () => {
    const sendSlack = vi.fn().mockResolvedValue({ success: true });
    const sendEmail = vi.fn().mockResolvedValue({ success: true });
    const sendChatwork = vi.fn().mockResolvedValue({ success: true });

    const dispatcher = new NotificationDispatcher({
      adapters: { sendSlack, sendEmail, sendChatwork },
    });

    const rules: NotificationRule[] = [
      { id: 'r1', channel: 'slack', destination: '#alerts', triggerConditions: [], enabled: true },
      { id: 'r2', channel: 'email', destination: 'a@b.com', triggerConditions: [], enabled: false },
    ];

    const msg = formatNotificationMessage({
      anomalyEvent,
      analysis,
      zendeskSubdomain: 'test',
    });

    const noDelay = async () => {};
    const results = await dispatcher.dispatch(msg, rules, noDelay);

    expect(results).toHaveLength(1);
    expect(results[0].channel).toBe('slack');
    expect(results[0].success).toBe(true);
    expect(sendSlack).toHaveBeenCalledTimes(1);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('retries with backoff on failure', async () => {
    let callCount = 0;
    const sendFn = async () => {
      callCount++;
      if (callCount < 3) return { success: false, error: 'timeout' };
      return { success: true };
    };

    const noDelay = async () => {};
    const { result, retryCount } = await retryWithBackoff(sendFn, 3, noDelay);

    expect(result.success).toBe(true);
    expect(retryCount).toBe(2);
    expect(callCount).toBe(3);
  });

  it('returns failure after max retries', async () => {
    const sendFn = async () => ({ success: false, error: 'fail' });
    const noDelay = async () => {};
    const { result, retryCount } = await retryWithBackoff(sendFn, 2, noDelay);

    expect(result.success).toBe(false);
    expect(retryCount).toBe(2);
  });
});

// --- Rule Manager Tests ---
describe('NotificationRuleManager', () => {
  it('creates and lists rules', async () => {
    const manager = new NotificationRuleManager(createInMemoryRuleStore());

    const rule = await manager.create({
      channel: 'slack',
      destination: '#alerts',
      triggerConditions: [{ type: 'anomaly' }],
    });

    expect(rule.id).toBeTruthy();
    expect(rule.enabled).toBe(true);

    const all = await manager.list();
    expect(all).toHaveLength(1);
  });

  it('updates a rule', async () => {
    const manager = new NotificationRuleManager(createInMemoryRuleStore());
    const rule = await manager.create({
      channel: 'slack',
      destination: '#alerts',
      triggerConditions: [{ type: 'anomaly' }],
    });

    const updated = await manager.update(rule.id, { enabled: false });
    expect(updated.enabled).toBe(false);
  });

  it('deletes a rule', async () => {
    const manager = new NotificationRuleManager(createInMemoryRuleStore());
    const rule = await manager.create({
      channel: 'email',
      destination: 'a@b.com',
      triggerConditions: [{ type: 'threshold' }],
    });

    await manager.delete(rule.id);
    const all = await manager.list();
    expect(all).toHaveLength(0);
  });

  it('throws on update/delete of non-existent rule', async () => {
    const manager = new NotificationRuleManager(createInMemoryRuleStore());
    await expect(manager.update('nope', {})).rejects.toThrow('not found');
    await expect(manager.delete('nope')).rejects.toThrow('not found');
  });

  it('filters by trigger type', async () => {
    const manager = new NotificationRuleManager(createInMemoryRuleStore());
    await manager.create({ channel: 'slack', destination: '#a', triggerConditions: [{ type: 'anomaly' }] });
    await manager.create({ channel: 'email', destination: 'b@c.com', triggerConditions: [{ type: 'threshold' }] });

    const anomalyRules = await manager.getByTriggerType('anomaly');
    expect(anomalyRules).toHaveLength(1);
    expect(anomalyRules[0].channel).toBe('slack');
  });
});
