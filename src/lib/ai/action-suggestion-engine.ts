/**
 * Action Suggestion Engine - Requirement 21
 * Suggests concrete actions when anomalies are detected.
 * Max 5 actions from 6 ActionTypes with priority and reasoning.
 */
import type {
  ActionSuggestion,
  ActionType,
  AIAnalysisResult,
} from '@/types/ai';
import type { AnomalyEvent } from '@/types/anomaly';
import type { LLMClient } from './llm-client';

const ALL_ACTION_TYPES: ActionType[] = [
  'faq_create_update',
  'announcement_post',
  'partner_notification',
  'internal_escalation',
  'template_reply_create',
  'system_investigation',
];

const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  faq_create_update: 'FAQ作成・更新',
  announcement_post: 'お知らせ掲載',
  partner_notification: '代理店・パートナー通知',
  internal_escalation: '社内エスカレーション',
  template_reply_create: 'テンプレート回答作成',
  system_investigation: 'システム調査',
};

export interface ActionSuggestionEngineDeps {
  llmClient: LLMClient;
  getPastEffectiveActions: (
    category: string,
  ) => Promise<ActionSuggestion[]>;
  saveAction: (action: ActionSuggestion) => Promise<void>;
  getAction: (id: string) => Promise<ActionSuggestion | null>;
  updateAction: (action: ActionSuggestion) => Promise<void>;
  getActionHistory: (anomalyEventId?: string) => Promise<ActionSuggestion[]>;
  getTicketCountForPeriod: (start: Date, end: Date) => Promise<number>;
}

/** Generate a unique ID for action suggestions */
function generateId(): string {
  return `action_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Build prompt for LLM-based action suggestion */
function buildSuggestionPrompt(
  anomalyEvent: AnomalyEvent,
  analysis: AIAnalysisResult,
  pastActions: ActionSuggestion[],
): string {
  const breakdownText = analysis.categoryBreakdown
    .slice(0, 5)
    .map((b) => `${b.category}: ${b.count}件 (${b.percentage}%, +${b.increaseRate}%)`)
    .join('\n');

  const hypothesesText = analysis.hypotheses
    .map((h) => `${h.rank}. ${h.description} (信頼度: ${h.confidence})`)
    .join('\n');

  const pastActionsText =
    pastActions.length > 0
      ? pastActions
          .slice(0, 3)
          .map((a) => `- ${ACTION_TYPE_LABELS[a.actionType]}: ${a.title} (効果: ${a.effectMetrics ? `${a.effectMetrics.changeRate}%` : '未測定'})`)
          .join('\n')
      : 'なし';

  return `異常検知に対するアクション提案を生成してください。

異常情報:
- 指標: ${anomalyEvent.metric}
- 検知値: ${anomalyEvent.currentValue}
- 基準値: ${anomalyEvent.thresholdOrBaseline}
- 重要度: ${anomalyEvent.severity}

カテゴリ別内訳:
${breakdownText}

推定原因:
${hypothesesText}

過去の効果的なアクション:
${pastActionsText}

利用可能なアクション種別: ${ALL_ACTION_TYPES.map((t) => ACTION_TYPE_LABELS[t]).join('、')}

以下のJSON配列形式で最大5件のアクション提案を出力してください:
[{ "actionType": "...", "title": "短い具体的なタイトル", "description": "すぐ実行可能な具体的な指示", "priority": "high|medium|low", "reasoning": "数値根拠付きの推奨理由", "relatedCategory": "関連カテゴリ名" }]

「短く、具体的で、すぐ実行可能な」文章形式で出力してください。`;
}

/** Parse LLM response into action suggestions */
function parseSuggestions(
  raw: string,
  anomalyEventId: string,
): Omit<ActionSuggestion, 'id' | 'createdAt' | 'responseStatus'>[] {
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>[];

    return parsed.slice(0, 5).map((item) => {
      const actionType = ALL_ACTION_TYPES.includes(item.actionType as ActionType)
        ? (item.actionType as ActionType)
        : 'system_investigation';

      const priority = ['high', 'medium', 'low'].includes(String(item.priority))
        ? (item.priority as ActionSuggestion['priority'])
        : 'medium';

      return {
        anomalyEventId,
        actionType,
        title: String(item.title ?? ''),
        description: String(item.description ?? ''),
        priority,
        reasoning: String(item.reasoning ?? ''),
        relatedCategory: item.relatedCategory
          ? String(item.relatedCategory)
          : undefined,
      };
    });
  } catch {
    return [];
  }
}

/**
 * ActionSuggestionEngine class (Req 21.1-21.4, 21.9)
 * - Suggest max 5 actions from 6 ActionTypes
 * - Each with priority and reasoning with numeric evidence
 * - Reference past effective actions for priority
 * - Short, specific, immediately actionable text
 */
export class ActionSuggestionEngine {
  constructor(private deps: ActionSuggestionEngineDeps) {}

  /** Suggest actions for an anomaly event (Req 21.1-21.4, 21.9) */
  async suggest(
    anomalyEvent: AnomalyEvent,
    analysis: AIAnalysisResult,
  ): Promise<ActionSuggestion[]> {
    // Get past effective actions for top categories (Req 21.4)
    const topCategory = analysis.categoryBreakdown[0]?.category ?? '';
    const pastActions = topCategory
      ? await this.deps.getPastEffectiveActions(topCategory)
      : [];

    const prompt = buildSuggestionPrompt(anomalyEvent, analysis, pastActions);

    let rawResponse: string;
    try {
      rawResponse = await this.deps.llmClient.analyze(prompt, 30_000);
    } catch {
      rawResponse = '[]';
    }

    const parsed = parseSuggestions(rawResponse, anomalyEvent.id);
    const now = new Date();

    const suggestions: ActionSuggestion[] = parsed.map((s) => ({
      ...s,
      id: generateId(),
      responseStatus: 'pending' as const,
      createdAt: now,
    }));

    // Persist suggestions
    for (const s of suggestions) {
      await this.deps.saveAction(s);
    }

    return suggestions;
  }

  /** Respond to an action suggestion (Req 21.5) */
  async respond(
    suggestionId: string,
    response: 'accepted' | 'deferred' | 'rejected',
  ): Promise<void> {
    const action = await this.deps.getAction(suggestionId);
    if (!action) throw new Error(`Action ${suggestionId} not found`);
    action.responseStatus = response;
    if (response === 'accepted') {
      action.executionStatus = 'not_started';
    }
    await this.deps.updateAction(action);
  }

  /** Update execution status (Req 21.6) */
  async updateExecutionStatus(
    suggestionId: string,
    status: NonNullable<ActionSuggestion['executionStatus']>,
  ): Promise<void> {
    const action = await this.deps.getAction(suggestionId);
    if (!action) throw new Error(`Action ${suggestionId} not found`);
    if (action.responseStatus !== 'accepted') {
      throw new Error('Only accepted actions can have execution status updated');
    }
    action.executionStatus = status;
    await this.deps.updateAction(action);
  }

  /** Track effect of an action after execution (Req 21.7, 21.10) */
  async trackEffect(
    suggestionId: string,
  ): Promise<ActionSuggestion['effectMetrics']> {
    const action = await this.deps.getAction(suggestionId);
    if (!action) throw new Error(`Action ${suggestionId} not found`);

    const actionDate = action.createdAt;
    const preStart = new Date(actionDate);
    preStart.setDate(preStart.getDate() - 3);
    const postEnd = new Date(actionDate);
    postEnd.setDate(postEnd.getDate() + 3);
    postEnd.setHours(23, 59, 59, 999);

    const [preCount, postCount] = await Promise.all([
      this.deps.getTicketCountForPeriod(preStart, actionDate),
      this.deps.getTicketCountForPeriod(actionDate, postEnd),
    ]);

    const changeRate =
      preCount > 0
        ? Math.round(((postCount - preCount) / preCount) * 100 * 100) / 100
        : 0;

    const effectMetrics = {
      preActionCount: preCount,
      postActionCount: postCount,
      changeRate,
    };

    action.effectMetrics = effectMetrics;
    await this.deps.updateAction(action);

    return effectMetrics;
  }

  /** Get action history (Req 21.7) */
  async getHistory(anomalyEventId?: string): Promise<ActionSuggestion[]> {
    return this.deps.getActionHistory(anomalyEventId);
  }
}
