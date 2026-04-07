/**
 * AI Cause Analyzer - Requirement 10
 * Analyzes anomaly events to determine root causes by extracting
 * increased tickets, computing category breakdowns, and calling LLM.
 */
import type { AnomalyEvent } from '@/types/anomaly';
import type { FilteredTicket } from '@/types/ticket';
import type { AIAnalysisResult, CauseHypothesis } from '@/types/ai';
import type { LLMClient } from './llm-client';

export interface CauseAnalyzerDeps {
  llmClient: LLMClient;
  getTicketsForPeriod: (start: Date, end: Date) => Promise<FilteredTicket[]>;
  getBaselineTickets: (start: Date, end: Date) => Promise<FilteredTicket[]>;
}

/** Compute category breakdown from increased tickets (Req 10.2) */
export function computeCategoryBreakdown(
  currentTickets: FilteredTicket[],
  baselineTickets: FilteredTicket[],
): AIAnalysisResult['categoryBreakdown'] {
  const currentCounts = countByCategory(currentTickets);
  const baselineCounts = countByCategory(baselineTickets);
  const totalCurrent = currentTickets.length;

  const categories = new Set([
    ...Object.keys(currentCounts),
    ...Object.keys(baselineCounts),
  ]);

  const breakdown: AIAnalysisResult['categoryBreakdown'] = [];

  for (const category of categories) {
    const count = currentCounts[category] ?? 0;
    const baselineCount = baselineCounts[category] ?? 0;
    const percentage = totalCurrent > 0 ? (count / totalCurrent) * 100 : 0;
    const increaseRate =
      baselineCount > 0
        ? ((count - baselineCount) / baselineCount) * 100
        : count > 0
          ? 100
          : 0;

    breakdown.push({
      category,
      count,
      percentage: Math.round(percentage * 100) / 100,
      increaseRate: Math.round(increaseRate * 100) / 100,
    });
  }

  return breakdown.sort((a, b) => b.count - a.count);
}

function countByCategory(tickets: FilteredTicket[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of tickets) {
    counts[t.inquiryCategory] = (counts[t.inquiryCategory] ?? 0) + 1;
  }
  return counts;
}

/** Build the LLM prompt for cause analysis */
function buildAnalysisPrompt(
  anomalyEvent: AnomalyEvent,
  breakdown: AIAnalysisResult['categoryBreakdown'],
  tickets: FilteredTicket[],
): string {
  const breakdownText = breakdown
    .map(
      (b) =>
        `- ${b.category}: ${b.count}件 (${b.percentage}%, 増加率${b.increaseRate}%)`,
    )
    .join('\n');

  const sampleTexts = tickets
    .slice(0, 20)
    .map((t) => `[${t.zendeskTicketId}] ${t.subject}`)
    .join('\n');

  return `異常検知イベント分析:
指標: ${anomalyEvent.metric}, 検知値: ${anomalyEvent.currentValue}, 基準値: ${anomalyEvent.thresholdOrBaseline}
重要度: ${anomalyEvent.severity}

カテゴリ別内訳:
${breakdownText}

代表チケット件名:
${sampleTexts}

以下をJSON形式で出力してください:
1. commonPatterns: チケット群の共通パターン要約（短く、断定しすぎず、根拠の数字を添えた文章）
2. hypotheses: 推定原因仮説（最大3件）。各仮説に rank, description, evidence（metric/value/unit配列）, confidence を含む
3. representativeTicketIds: 目視確認用の代表チケットID（最大5件）`;
}

/** Parse LLM response into structured data */
function parseLLMResponse(
  raw: string,
  fallbackTickets: FilteredTicket[],
): {
  commonPatterns: string;
  hypotheses: CauseHypothesis[];
  representativeTicketIds: string[];
} {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    const parsed = JSON.parse(jsonMatch[0]);

    const hypotheses: CauseHypothesis[] = (
      parsed.hypotheses ?? []
    )
      .slice(0, 3)
      .map((h: Record<string, unknown>, i: number) => ({
        rank: (h.rank as number) ?? i + 1,
        description: String(h.description ?? ''),
        evidence: Array.isArray(h.evidence)
          ? h.evidence.map((e: Record<string, unknown>) => ({
              metric: String(e.metric ?? ''),
              value: Number(e.value ?? 0),
              unit: String(e.unit ?? ''),
            }))
          : [],
        confidence: (['high', 'medium', 'low'].includes(
          String(h.confidence),
        )
          ? h.confidence
          : 'medium') as CauseHypothesis['confidence'],
      }));

    const representativeTicketIds: string[] = (
      parsed.representativeTicketIds ?? []
    )
      .slice(0, 5)
      .map(String);

    return {
      commonPatterns: String(parsed.commonPatterns ?? '分析結果を取得できませんでした'),
      hypotheses,
      representativeTicketIds:
        representativeTicketIds.length > 0
          ? representativeTicketIds
          : fallbackTickets.slice(0, 5).map((t) => t.zendeskTicketId),
    };
  } catch {
    return {
      commonPatterns: '分析結果のパースに失敗しました',
      hypotheses: [],
      representativeTicketIds: fallbackTickets
        .slice(0, 5)
        .map((t) => t.zendeskTicketId),
    };
  }
}

/**
 * Analyze the cause of an anomaly event (Req 10.1-10.7, 10.10)
 * - Extracts increased tickets
 * - Computes category breakdown
 * - Calls LLM with 30s timeout
 * - Returns structured analysis result
 */
export async function analyzeCause(
  anomalyEvent: AnomalyEvent,
  deps: CauseAnalyzerDeps,
): Promise<AIAnalysisResult> {
  const detectedDate = new Date(anomalyEvent.detectedAt);
  const dayStart = new Date(detectedDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(detectedDate);
  dayEnd.setHours(23, 59, 59, 999);

  // Baseline: previous 7 days average
  const baselineStart = new Date(dayStart);
  baselineStart.setDate(baselineStart.getDate() - 7);
  const baselineEnd = new Date(dayStart);
  baselineEnd.setMilliseconds(-1);

  const [currentTickets, baselineTickets] = await Promise.all([
    deps.getTicketsForPeriod(dayStart, dayEnd),
    deps.getBaselineTickets(baselineStart, baselineEnd),
  ]);

  const breakdown = computeCategoryBreakdown(currentTickets, baselineTickets);
  const prompt = buildAnalysisPrompt(anomalyEvent, breakdown, currentTickets);

  // 30-second timeout (Req 10.10)
  const LLM_TIMEOUT_MS = 30_000;
  let llmResult: string;
  try {
    llmResult = await deps.llmClient.analyze(prompt, LLM_TIMEOUT_MS);
  } catch {
    llmResult = JSON.stringify({
      commonPatterns: 'LLM分析がタイムアウトしました。カテゴリ別内訳を参照してください。',
      hypotheses: [],
      representativeTicketIds: currentTickets
        .slice(0, 5)
        .map((t) => t.zendeskTicketId),
    });
  }

  const parsed = parseLLMResponse(llmResult, currentTickets);

  return {
    anomalyEventId: anomalyEvent.id,
    categoryBreakdown: breakdown,
    commonPatterns: parsed.commonPatterns,
    hypotheses: parsed.hypotheses,
    representativeTicketIds: parsed.representativeTicketIds,
    generatedAt: new Date(),
  };
}
