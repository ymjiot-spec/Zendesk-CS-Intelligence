/**
 * JST Date Utilities
 *
 * すべてのチケット集計でJST基準の日時変換・期間算出を統一するための共通モジュール。
 * サーバーのタイムゾーンに依存せず、常にJST (UTC+9) で正しく動作する。
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 現在のJST日付文字列 (YYYY-MM-DD) を返す。
 */
export function todayJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  return jst.toISOString().split('T')[0];
}

/**
 * YYYY-MM-DD 文字列からJST 00:00:00 の UTC Date を返す。
 * 例: "2026-04-15" → 2026-04-14T15:00:00.000Z (= JST 2026-04-15 00:00:00)
 */
export function jstStartOfDay(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00+09:00');
}

/**
 * YYYY-MM-DD 文字列からJST 翌日00:00:00 の UTC Date を返す（lt 用）。
 * 例: "2026-04-15" → 2026-04-15T15:00:00.000Z (= JST 2026-04-16 00:00:00)
 */
export function jstEndOfDayExclusive(dateStr: string): Date {
  const d = new Date(dateStr + 'T00:00:00+09:00');
  d.setDate(d.getDate() + 1);
  return d;
}

/**
 * 2つのYYYY-MM-DD文字列からDB問い合わせ用の範囲を返す。
 * { gte: startDate JST 00:00, lt: endDate+1 JST 00:00 }
 */
export function jstDateRange(startDateStr: string, endDateStr: string): { gte: Date; lt: Date } {
  return {
    gte: jstStartOfDay(startDateStr),
    lt: jstEndOfDayExclusive(endDateStr),
  };
}

/**
 * YYYY-MM-DD 文字列のN日前を YYYY-MM-DD で返す（JST基準）。
 */
export function shiftDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00+09:00'); // 正午基準で日付ズレ防止
  d.setDate(d.getDate() + days);
  // JSTでの年月日を取得
  const jst = new Date(d.getTime() + JST_OFFSET_MS);
  return jst.toISOString().split('T')[0];
}

/**
 * YYYY-MM-DD の前日を返す。
 */
export function prevDay(dateStr: string): string {
  return shiftDays(dateStr, -1);
}

/**
 * YYYY-MM-DD の7日前を返す。
 */
export function weekAgo(dateStr: string): string {
  return shiftDays(dateStr, -7);
}

/**
 * startDate〜endDateの日数を返す（両端含む）。
 */
export function dayCount(startDateStr: string, endDateStr: string): number {
  const start = jstStartOfDay(startDateStr).getTime();
  const end = jstStartOfDay(endDateStr).getTime();
  return Math.round((end - start) / 86400000) + 1;
}

/**
 * startDate〜endDateの各日をYYYY-MM-DD配列で返す（両端含む）。
 */
export function enumerateDays(startDateStr: string, endDateStr: string): string[] {
  const days: string[] = [];
  let current = startDateStr;
  const endTime = jstStartOfDay(endDateStr).getTime();
  while (jstStartOfDay(current).getTime() <= endTime) {
    days.push(current);
    current = shiftDays(current, 1);
  }
  return days;
}

/**
 * 今週（月曜始まり）の開始日を YYYY-MM-DD で返す。
 * referenceはJST日付文字列。
 */
export function thisWeekMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00+09:00');
  const dayOfWeek = d.getDay(); // 0=Sun
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return shiftDays(dateStr, -diff);
}

/**
 * 今月の初日を YYYY-MM-DD で返す。
 */
export function thisMonthFirst(dateStr: string): string {
  return dateStr.slice(0, 8) + '01';
}

/**
 * 先月の初日〜末日を返す。
 */
export function lastMonthRange(dateStr: string): { startDate: string; endDate: string } {
  const year = parseInt(dateStr.slice(0, 4), 10);
  const month = parseInt(dateStr.slice(5, 7), 10); // 1-indexed
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear -= 1;
  }
  const startDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
  // 末日 = 当月1日の前日
  const lastDay = new Date(year, month - 1, 0).getDate();
  const endDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { startDate, endDate };
}
