/**
 * Notification Rule Manager - Requirement 9.2
 *
 * CRUD operations for notification rules.
 * Uses in-memory store with interface for DB abstraction.
 */

import type { NotificationRule, TriggerCondition } from '@/types/notification';

export interface NotificationRuleStore {
  getAll: () => Promise<NotificationRule[]>;
  getById: (id: string) => Promise<NotificationRule | null>;
  save: (rule: NotificationRule) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export interface CreateNotificationRuleInput {
  channel: NotificationRule['channel'];
  destination: string;
  triggerConditions: TriggerCondition[];
  enabled?: boolean;
}

export interface UpdateNotificationRuleInput {
  channel?: NotificationRule['channel'];
  destination?: string;
  triggerConditions?: TriggerCondition[];
  enabled?: boolean;
}

function generateId(): string {
  return `nrule_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** In-memory implementation of NotificationRuleStore */
export function createInMemoryRuleStore(): NotificationRuleStore {
  const rules = new Map<string, NotificationRule>();

  return {
    getAll: async () => Array.from(rules.values()),
    getById: async (id) => rules.get(id) ?? null,
    save: async (rule) => { rules.set(rule.id, rule); },
    remove: async (id) => { rules.delete(id); },
  };
}

export class NotificationRuleManager {
  constructor(private store: NotificationRuleStore) {}

  async create(input: CreateNotificationRuleInput): Promise<NotificationRule> {
    const rule: NotificationRule = {
      id: generateId(),
      channel: input.channel,
      destination: input.destination,
      triggerConditions: input.triggerConditions,
      enabled: input.enabled ?? true,
    };
    await this.store.save(rule);
    return rule;
  }

  async update(
    id: string,
    input: UpdateNotificationRuleInput,
  ): Promise<NotificationRule> {
    const existing = await this.store.getById(id);
    if (!existing) throw new Error(`Notification rule ${id} not found`);

    const updated: NotificationRule = {
      ...existing,
      ...(input.channel !== undefined && { channel: input.channel }),
      ...(input.destination !== undefined && { destination: input.destination }),
      ...(input.triggerConditions !== undefined && {
        triggerConditions: input.triggerConditions,
      }),
      ...(input.enabled !== undefined && { enabled: input.enabled }),
    };

    await this.store.save(updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const existing = await this.store.getById(id);
    if (!existing) throw new Error(`Notification rule ${id} not found`);
    await this.store.remove(id);
  }

  async list(): Promise<NotificationRule[]> {
    return this.store.getAll();
  }

  async getById(id: string): Promise<NotificationRule> {
    const rule = await this.store.getById(id);
    if (!rule) throw new Error(`Notification rule ${id} not found`);
    return rule;
  }

  /** Get rules matching a specific trigger type */
  async getByTriggerType(
    type: TriggerCondition['type'],
  ): Promise<NotificationRule[]> {
    const all = await this.store.getAll();
    return all.filter(
      (r) => r.enabled && r.triggerConditions.some((tc) => tc.type === type),
    );
  }
}
