/**
 * Dashboard Query Helpers
 *
 * すべてのダッシュボードAPIで共通して使うフィルター条件・除外カテゴリ取得を統一する。
 * これにより、Summary / Categories / Matrix / Hourly で除外条件が一致する。
 */

import prisma from '@/lib/prisma';

/**
 * ユーザ設定に基づく除外カテゴリを取得する。
 * ホワイトリスト方式: category_filter_settingsにis_included=trueで登録されたカテゴリのみ集計対象。
 * 登録されていないカテゴリは除外される。
 */
export async function getIncludedCategories(source: string): Promise<string[]> {
  try {
    const query = source !== 'ALL'
      ? `SELECT inquiry_category FROM category_filter_settings WHERE is_included = true AND source_key = $1`
      : `SELECT DISTINCT inquiry_category FROM category_filter_settings WHERE is_included = true`;
    const params = source !== 'ALL' ? [source] : [];
    const rows: any[] = await (prisma as any).$queryRawUnsafe(query, ...params);
    return rows.map((r: any) => r.inquiry_category);
  } catch {
    return [];
  }
}

export async function getExcludedCategories(source: string): Promise<string[]> {
  try {
    const query = source !== 'ALL'
      ? `SELECT inquiry_category FROM category_filter_settings WHERE is_included = false AND source_key = $1`
      : `SELECT DISTINCT inquiry_category FROM category_filter_settings WHERE is_included = false`;
    const params = source !== 'ALL' ? [source] : [];
    const rows: any[] = await (prisma as any).$queryRawUnsafe(query, ...params);
    return rows.map((r: any) => r.inquiry_category);
  } catch {
    return [];
  }
}

/**
 * 共通の Prisma where 条件を構築する。
 *
 * - isExcluded: false (Z始まりステータスはパイプラインで除外済み)
 * - source フィルタ
 * - channel フィルタ
 * - 除外カテゴリ
 * - 日付範囲 (createdAt gte/lt)
 */
export async function buildBaseWhere(
  source: string,
  channel: string,
  dateRange?: { gte: Date; lt: Date },
): Promise<Record<string, unknown>> {
  const sourceWhere = source !== 'ALL' ? { sourceKey: source } : {};
  const channelWhere =
    channel === 'call_center'
      ? { channelType: 'call_center' }
      : channel === 'ticket'
        ? { channelType: 'ticket' }
        : {};

  const includedCats = await getIncludedCategories(source);
  const catWhere = includedCats.length > 0 ? { inquiryCategory: { in: includedCats } } : {};

  const dateWhere = dateRange ? { createdAt: dateRange } : {};

  return {
    isExcluded: false,
    ...sourceWhere,
    ...channelWhere,
    ...catWhere,
    ...dateWhere,
  };
}
