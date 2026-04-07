import { describe, it, expect } from 'vitest';
import {
  AlertRuleEngine,
  createInMemoryAlertStore,
  evaluateCondition,
} from './alert-rule-engine';
import {
  formatAlertNotification,
  formatAlertPlainText,
} from './alert-notification-formatter';
import type { AlertFiringRecord } from '@/types/alert';

// --- Condition Evaluation Tests ---
describe('evaluateCondition', () => {
  it('day_over_day_rate fires when ratio exceeds threshold', () => {
    const result = evaluateCondition(
      { method: 'day_over_day_rate', value: 150 },
      150, 100, 0, 0,
    );
    expect(result.fired).toBe(true);
    expect(result.deviation).toBe(150); // 150/100 * 100
  });

  it('day_over_day_rate does not fire below threshold', () => {
    const result = evaluateCondition(
      { method: 'day_over_day_rate', value: 150 },
      120, 100, 0, 0,
    );
    expect(result.fired).toBe(false);
  });

  it('sigma_deviation fires when deviation exceeds N sigma', () => {
    // mean=100, stddev=10, current=125 => 2.5 sigma
    const result = evaluateCondition(
      { method: 'sigma_deviation', value: 2.0 },
      125, 0, 100, 10,
    );
    expect(result.fired).toBe(true);
    expect(result.deviation).toBe(2.5);
  });

  it('sigma_deviation does not fire below threshold', () => {
    const result = evaluateCondition(
      { method: 'sigma_deviation', value: 2.0 },
      115, 0, 100, 10,
    );
    expect(result.fired).toBe(false);
  });

  it('fixed_count fires when count exceeds threshold', () => {
    const result = evaluateCondition(
      { method: 'fixed_count', value: 100 },
      150, 0, 0, 0,
    );
    expect(result.fired).toBe(true);
  });

  it('fixed_count does not fire below threshold', () => {
    const result = evaluateCondition(
      { method: 'fixed_count', value: 100 },
      50, 0, 0, 0,
    );
    expect(result.fired).toBe(false);
  });
});

// --- AlertRuleEngine Tests ---
describe('AlertRuleEngine', () => {
  function createEngine() {
    return new AlertRuleEngine(createInMemoryAlertStore());
  }

  const baseData = {
    todayTotal: 150,
    yesterdayTotal: 100,
    movingAverage: 100,
    standardDeviation: 10,
    todayByCategory: { '料金': 80, '契約': 70 },
    yesterdayByCategory: { '料金': 40, '契約': 60 },
    movingAverageByCategory: { '料金': 50, '契約': 55 },
    standardDeviationByCategory: { '料金': 10, '契約': 8 },
    representativeTicketIds: ['T1', 'T2', 'T3'],
  };

  it('creates a rule', async () => {
    const engine = createEngine();
    const rule = await engine.create({
      name: 'Test Rule',
      triggerType: 'total_surge',
      conditions: [{ method: 'day_over_day_rate', value: 150 }],
      notificationChannels: [{ channel: 'slack', destination: '#alerts' }],
    });

    expect(rule.id).toBeTruthy();
    expect(rule.cooldownMinutes).toBe(60);
    expect(rule.enabled).toBe(true);
  });

  it('creates from preset', async () => {
    const engine = createEngine();
    const rule = await engine.createFromPreset('total_surge', [
      { channel: 'slack', destination: '#alerts' },
    ]);

    expect(rule.name).toBe('問い合わせ急増アラート');
    expect(rule.conditions[0].method).toBe('day_over_day_rate');
  });

  it('updates a rule', async () => {
    const engine = createEngine();
    const rule = await engine.create({
      name: 'Test',
      triggerType: 'total_surge',
      conditions: [{ method: 'fixed_count', value: 100 }],
      notificationChannels: [],
    });

    const updated = await engine.update(rule.id, { enabled: false });
    expect(updated.enabled).toBe(false);
  });

  it('deletes a rule', async () => {
    const engine = createEngine();
    const rule = await engine.create({
      name: 'Test',
      triggerType: 'total_surge',
      conditions: [{ method: 'fixed_count', value: 100 }],
      notificationChannels: [],
    });

    await engine.delete(rule.id);
    const all = await engine.list();
    expect(all).toHaveLength(0);
  });

  it('evaluates rules and creates firing records', async () => {
    const engine = createEngine();
    await engine.create({
      name: 'Surge',
      triggerType: 'total_surge',
      conditions: [{ method: 'day_over_day_rate', value: 150 }],
      notificationChannels: [],
    });

    const records = await engine.evaluate(baseData);
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('unresolved');
    expect(records[0].detectedValue).toBe(150);
  });

  it('evaluates category_surge with targetCategory', async () => {
    const engine = createEngine();
    await engine.create({
      name: 'Category Surge',
      triggerType: 'category_surge',
      conditions: [{ method: 'day_over_day_rate', value: 150 }],
      targetCategory: '料金',
      notificationChannels: [],
    });

    const records = await engine.evaluate(baseData);
    expect(records).toHaveLength(1);
    // 料金: 80/40 = 200%
    expect(records[0].detectedValue).toBe(80);
  });

  it('does not fire when conditions are not met', async () => {
    const engine = createEngine();
    await engine.create({
      name: 'High Threshold',
      triggerType: 'total_surge',
      conditions: [{ method: 'fixed_count', value: 500 }],
      notificationChannels: [],
    });

    const records = await engine.evaluate(baseData);
    expect(records).toHaveLength(0);
  });

  it('respects cooldown suppression', async () => {
    const engine = createEngine();
    const rule = await engine.create({
      name: 'Cooldown Test',
      triggerType: 'total_surge',
      conditions: [{ method: 'day_over_day_rate', value: 150 }],
      notificationChannels: [],
      cooldownMinutes: 60,
    });

    const t1 = new Date('2024-01-15T10:00:00Z');
    const records1 = await engine.evaluate(baseData, t1);
    expect(records1).toHaveLength(1);

    // 30 minutes later - should be suppressed
    const t2 = new Date('2024-01-15T10:30:00Z');
    const records2 = await engine.evaluate(baseData, t2);
    expect(records2).toHaveLength(0);

    // 2 hours later - should fire again
    const t3 = new Date('2024-01-15T12:00:00Z');
    const records3 = await engine.evaluate(baseData, t3);
    expect(records3).toHaveLength(1);
  });

  it('manages firing status', async () => {
    const engine = createEngine();
    await engine.create({
      name: 'Status Test',
      triggerType: 'total_surge',
      conditions: [{ method: 'day_over_day_rate', value: 150 }],
      notificationChannels: [],
    });

    const records = await engine.evaluate(baseData);
    const firingId = records[0].id;

    await engine.updateFiringStatus(firingId, 'in_progress');
    const history = await engine.getFiringHistory({ status: 'in_progress' });
    expect(history.items).toHaveLength(1);

    await engine.updateFiringStatus(firingId, 'resolved');
    const resolved = await engine.getFiringHistory({ status: 'resolved' });
    expect(resolved.items).toHaveLength(1);
    expect(resolved.items[0].resolvedAt).toBeDefined();
  });

  it('skips disabled rules', async () => {
    const engine = createEngine();
    const rule = await engine.create({
      name: 'Disabled',
      triggerType: 'total_surge',
      conditions: [{ method: 'day_over_day_rate', value: 150 }],
      notificationChannels: [],
      enabled: false,
    });

    const records = await engine.evaluate(baseData);
    expect(records).toHaveLength(0);
  });
});

// --- Alert Notification Formatter Tests ---
describe('Alert Notification Formatter', () => {
  it('formats alert notification with all fields', () => {
    const rule = {
      id: 'r1',
      name: '問い合わせ急増',
      triggerType: 'total_surge' as const,
      conditions: [{ method: 'day_over_day_rate' as const, value: 150 }],
      notificationChannels: [],
      cooldownMinutes: 60,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const firing: AlertFiringRecord = {
      id: 'f1',
      alertRuleId: 'r1',
      firedAt: new Date(),
      detectedValue: 150,
      baselineValue: 100,
      deviation: 150,
      representativeTicketIds: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'],
      status: 'unresolved',
    };

    const msg = formatAlertNotification(rule, firing, 'mycompany');

    expect(msg.ruleName).toBe('問い合わせ急増');
    expect(msg.conditions).toContain('前日比');
    expect(msg.representativeTicketIds).toHaveLength(5); // max 5
    expect(msg.ticketUrls[0]).toBe('https://mycompany.zendesk.com/agent/tickets/T1');
  });

  it('formats plain text alert message', () => {
    const msg = {
      ruleName: 'テストルール',
      conditions: '前日比 150% 以上',
      detectedValue: 150,
      baselineValue: 100,
      deviation: 150,
      representativeTicketIds: ['T1'],
      ticketUrls: ['https://test.zendesk.com/agent/tickets/T1'],
    };

    const text = formatAlertPlainText(msg);
    expect(text).toContain('アラート発火: テストルール');
    expect(text).toContain('150');
    expect(text).toContain('T1');
  });
});
