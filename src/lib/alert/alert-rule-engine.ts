/**
 * Alert Rule Engine - Requirements 20.1-20.5, 20.8, 20.10
 *
 * Custom alert rules with:
 * - CRUD + createFromPreset (3 presets)
 * - Enable/disable toggle
 * - Per-rule notification channels
 * - Condition evaluation: day_over_day_rate, sigma_deviation, fixed_count
 * - Per-category monitoring
 * - Cooldown suppression
 * - Firing history and status management
 */

import type {
  AlertRule,
  AlertCondition,
  AlertFiringRecord,
  AlertPresetType,
  AlertNotificationChannel,
} from '@/types/alert';

export interface AlertRuleStore {
  getAllRules: () => Promise<AlertRule[]>;
  getRuleById: (id: string) => Promise<AlertRule | null>;
  saveRule: (rule: AlertRule) => Promise<void>;
  removeRule: (id: string) => Promise<void>;
  getAllFirings: () => Promise<AlertFiringRecord[]>;
  getFiringById: (id: string) => Promise<AlertFiringRecord | null>;
  saveFiring: (record: AlertFiringRecord) => Promise<void>;
}

export interface AlertEvaluationData {
  /** Today's total ticket count */
  todayTotal: number;
  /** Yesterday's total ticket count */
  yesterdayTotal: number;
  /** Moving average of total tickets */
  movingAverage: number;
  /** Standard deviation of total tickets */
  standardDeviation: number;
  /** Per-category counts for today */
  todayByCategory: Record<string, number>;
  /** Per-category counts for yesterday */
  yesterdayByCategory: Record<string, number>;
  /** Per-category moving averages */
  movingAverageByCategory: Record<string, number>;
  /** Per-category standard deviations */
  standardDeviationByCategory: Record<string, number>;
  /** Representative ticket IDs */
  representativeTicketIds: string[];
}

export interface AlertHistoryFilters {
  ruleId?: string;
  status?: AlertFiringRecord['status'];
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** In-memory store implementation */
export function createInMemoryAlertStore(): AlertRuleStore {
  const rules = new Map<string, AlertRule>();
  const firings = new Map<string, AlertFiringRecord>();

  return {
    getAllRules: async () => Array.from(rules.values()),
    getRuleById: async (id) => rules.get(id) ?? null,
    saveRule: async (rule) => { rules.set(rule.id, rule); },
    removeRule: async (id) => { rules.delete(id); },
    getAllFirings: async () => Array.from(firings.values()),
    getFiringById: async (id) => firings.get(id) ?? null,
    saveFiring: async (record) => { firings.set(record.id, record); },
  };
}

/** Preset definitions (Req 20.10) */
const ALERT_PRESETS: Record<AlertPresetType, Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt' | 'notificationChannels'>> = {
  total_surge: {
    name: '問い合わせ急増アラート',
    triggerType: 'total_surge',
    conditions: [{ method: 'day_over_day_rate', value: 150 }],
    cooldownMinutes: 60,
    enabled: true,
  },
  category_surge: {
    name: '特定カテゴリ急増アラート',
    triggerType: 'category_surge',
    conditions: [{ method: 'sigma_deviation', value: 2.0 }],
    cooldownMinutes: 60,
    enabled: true,
  },
  anomaly_detection: {
    name: '異常検知アラート',
    triggerType: 'total_surge',
    conditions: [{ method: 'sigma_deviation', value: 2.0 }],
    cooldownMinutes: 60,
    enabled: true,
  },
};

/**
 * Evaluate a single condition against data (Req 20.2)
 */
export function evaluateCondition(
  condition: AlertCondition,
  currentValue: number,
  yesterdayValue: number,
  movingAvg: number,
  stdDev: number,
): { fired: boolean; detectedValue: number; baselineValue: number; deviation: number } {
  switch (condition.method) {
    case 'day_over_day_rate': {
      // Fire if today/yesterday ratio >= threshold percentage
      const rate = yesterdayValue > 0
        ? (currentValue / yesterdayValue) * 100
        : currentValue > 0 ? Infinity : 0;
      return {
        fired: rate >= condition.value,
        detectedValue: currentValue,
        baselineValue: yesterdayValue,
        deviation: rate,
      };
    }
    case 'sigma_deviation': {
      // Fire if deviation from moving average >= N sigma
      const sigmaDeviation = stdDev > 0
        ? (currentValue - movingAvg) / stdDev
        : 0;
      return {
        fired: sigmaDeviation >= condition.value,
        detectedValue: currentValue,
        baselineValue: movingAvg,
        deviation: sigmaDeviation,
      };
    }
    case 'fixed_count': {
      // Fire if current value exceeds fixed count
      return {
        fired: currentValue >= condition.value,
        detectedValue: currentValue,
        baselineValue: condition.value,
        deviation: currentValue - condition.value,
      };
    }
  }
}

export class AlertRuleEngine {
  constructor(private store: AlertRuleStore) {}

  /** Create a new alert rule (Req 20.1) */
  async create(input: {
    name: string;
    triggerType: AlertRule['triggerType'];
    conditions: AlertCondition[];
    targetCategory?: string;
    notificationChannels: AlertNotificationChannel[];
    cooldownMinutes?: number;
    enabled?: boolean;
  }): Promise<AlertRule> {
    const now = new Date();
    const rule: AlertRule = {
      id: generateId('alert'),
      name: input.name,
      triggerType: input.triggerType,
      conditions: input.conditions,
      targetCategory: input.targetCategory,
      notificationChannels: input.notificationChannels,
      cooldownMinutes: input.cooldownMinutes ?? 60,
      enabled: input.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    };
    await this.store.saveRule(rule);
    return rule;
  }

  /** Create from preset (Req 20.10) */
  async createFromPreset(
    preset: AlertPresetType,
    channels: AlertNotificationChannel[] = [],
    targetCategory?: string,
  ): Promise<AlertRule> {
    const template = ALERT_PRESETS[preset];
    if (!template) throw new Error(`Unknown preset: ${preset}`);

    const now = new Date();
    const rule: AlertRule = {
      ...template,
      id: generateId('alert'),
      notificationChannels: channels,
      ...(targetCategory && { targetCategory }),
      createdAt: now,
      updatedAt: now,
    };
    await this.store.saveRule(rule);
    return rule;
  }

  /** Update an alert rule */
  async update(
    id: string,
    input: Partial<Omit<AlertRule, 'id' | 'createdAt'>>,
  ): Promise<AlertRule> {
    const existing = await this.store.getRuleById(id);
    if (!existing) throw new Error(`Alert rule ${id} not found`);

    const updated: AlertRule = {
      ...existing,
      ...input,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    await this.store.saveRule(updated);
    return updated;
  }

  /** Delete an alert rule */
  async delete(id: string): Promise<void> {
    const existing = await this.store.getRuleById(id);
    if (!existing) throw new Error(`Alert rule ${id} not found`);
    await this.store.removeRule(id);
  }

  /** List all alert rules */
  async list(): Promise<AlertRule[]> {
    return this.store.getAllRules();
  }

  /**
   * Evaluate all enabled rules against current data (Req 20.2, 20.3, 20.5)
   */
  async evaluate(
    data: AlertEvaluationData,
    evaluationDate: Date = new Date(),
  ): Promise<AlertFiringRecord[]> {
    const rules = await this.store.getAllRules();
    const enabledRules = rules.filter((r) => r.enabled);
    const records: AlertFiringRecord[] = [];

    for (const rule of enabledRules) {
      // Check cooldown (Req 20.5)
      const cooldownActive = await this.isCooldownActive(rule.id, evaluationDate);
      if (cooldownActive) continue;

      const result = this.evaluateRule(rule, data);
      if (result) {
        const record: AlertFiringRecord = {
          id: generateId('firing'),
          alertRuleId: rule.id,
          firedAt: evaluationDate,
          detectedValue: result.detectedValue,
          baselineValue: result.baselineValue,
          deviation: result.deviation,
          representativeTicketIds: data.representativeTicketIds.slice(0, 5),
          status: 'unresolved',
        };
        await this.store.saveFiring(record);
        records.push(record);
      }
    }

    return records;
  }

  /**
   * Check if cooldown is active for a rule (Req 20.5)
   */
  async isCooldownActive(
    ruleId: string,
    referenceDate: Date = new Date(),
  ): Promise<boolean> {
    const rule = await this.store.getRuleById(ruleId);
    if (!rule) return false;

    const allFirings = await this.store.getAllFirings();
    const ruleFirings = allFirings
      .filter((f) => f.alertRuleId === ruleId)
      .sort((a, b) => b.firedAt.getTime() - a.firedAt.getTime());

    if (ruleFirings.length === 0) return false;

    const lastFiring = ruleFirings[0];
    const cooldownMs = rule.cooldownMinutes * 60 * 1000;
    const elapsed = referenceDate.getTime() - lastFiring.firedAt.getTime();

    return elapsed < cooldownMs;
  }

  /**
   * Get firing history with filters (Req 20.8)
   */
  async getFiringHistory(
    filters: AlertHistoryFilters = {},
  ): Promise<{ items: AlertFiringRecord[]; total: number }> {
    const all = await this.store.getAllFirings();
    let filtered = all;

    if (filters.ruleId) {
      filtered = filtered.filter((f) => f.alertRuleId === filters.ruleId);
    }
    if (filters.status) {
      filtered = filtered.filter((f) => f.status === filters.status);
    }
    if (filters.startDate) {
      const start = filters.startDate.getTime();
      filtered = filtered.filter((f) => f.firedAt.getTime() >= start);
    }
    if (filters.endDate) {
      const end = filters.endDate.getTime();
      filtered = filtered.filter((f) => f.firedAt.getTime() <= end);
    }

    // Sort by firedAt descending
    filtered.sort((a, b) => b.firedAt.getTime() - a.firedAt.getTime());

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return { items, total: filtered.length };
  }

  /**
   * Update firing status (Req 20.8)
   */
  async updateFiringStatus(
    firingId: string,
    status: AlertFiringRecord['status'],
  ): Promise<void> {
    const firing = await this.store.getFiringById(firingId);
    if (!firing) throw new Error(`Firing record ${firingId} not found`);

    const updated: AlertFiringRecord = {
      ...firing,
      status,
      ...(status === 'resolved' && { resolvedAt: new Date() }),
    };
    await this.store.saveFiring(updated);
  }

  /**
   * Evaluate a single rule against data
   */
  private evaluateRule(
    rule: AlertRule,
    data: AlertEvaluationData,
  ): { detectedValue: number; baselineValue: number; deviation: number } | null {
    // Determine which values to use based on rule type (Req 20.3)
    let currentValue: number;
    let yesterdayValue: number;
    let movingAvg: number;
    let stdDev: number;

    if (rule.triggerType === 'category_surge' && rule.targetCategory) {
      // Per-category monitoring
      const cat = rule.targetCategory;
      currentValue = data.todayByCategory[cat] ?? 0;
      yesterdayValue = data.yesterdayByCategory[cat] ?? 0;
      movingAvg = data.movingAverageByCategory[cat] ?? 0;
      stdDev = data.standardDeviationByCategory[cat] ?? 0;
    } else {
      // Total monitoring
      currentValue = data.todayTotal;
      yesterdayValue = data.yesterdayTotal;
      movingAvg = data.movingAverage;
      stdDev = data.standardDeviation;
    }

    // All conditions must be met (AND logic)
    let worstResult: { detectedValue: number; baselineValue: number; deviation: number } | null = null;

    for (const condition of rule.conditions) {
      const result = evaluateCondition(
        condition,
        currentValue,
        yesterdayValue,
        movingAvg,
        stdDev,
      );
      if (!result.fired) return null;
      // Track the result with highest deviation
      if (!worstResult || Math.abs(result.deviation) > Math.abs(worstResult.deviation)) {
        worstResult = {
          detectedValue: result.detectedValue,
          baselineValue: result.baselineValue,
          deviation: result.deviation,
        };
      }
    }

    return worstResult;
  }
}
