/**
 * Date Range Resolver
 * Converts QuickSelect presets to concrete DateRange (startDate, endDate).
 * Default preset is 'today'.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

export type QuickSelect =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export const DEFAULT_QUICK_SELECT: QuickSelect = 'today';

/**
 * Get the start of day (00:00:00.000) for a given date.
 */
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the end of day (23:59:59.999) for a given date.
 */
function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Resolve a QuickSelect preset to a DateRange based on a reference date.
 *
 * - today: reference date only
 * - yesterday: day before reference date
 * - this_week: Monday through Sunday of the current week
 * - last_week: Monday through Sunday of the previous week
 * - this_month: 1st through last day of the current month
 * - last_month: 1st through last day of the previous month
 *
 * @param preset - QuickSelect preset value
 * @param referenceDate - The reference date (defaults to now)
 * @returns DateRange with startDate and endDate
 */
export function resolveDateRange(
  preset: QuickSelect,
  referenceDate: Date = new Date(),
): DateRange {
  const ref = new Date(referenceDate);

  switch (preset) {
    case 'today':
      return {
        startDate: startOfDay(ref),
        endDate: endOfDay(ref),
      };

    case 'yesterday': {
      const yesterday = new Date(ref);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        startDate: startOfDay(yesterday),
        endDate: endOfDay(yesterday),
      };
    }

    case 'this_week': {
      // Week starts on Monday (ISO standard)
      const dayOfWeek = ref.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(ref);
      monday.setDate(ref.getDate() - diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return {
        startDate: startOfDay(monday),
        endDate: endOfDay(sunday),
      };
    }

    case 'last_week': {
      const dayOfWeek = ref.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const thisMonday = new Date(ref);
      thisMonday.setDate(ref.getDate() - diffToMonday);
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(thisMonday.getDate() - 7);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      return {
        startDate: startOfDay(lastMonday),
        endDate: endOfDay(lastSunday),
      };
    }

    case 'this_month': {
      const firstDay = new Date(ref.getFullYear(), ref.getMonth(), 1);
      const lastDay = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
      return {
        startDate: startOfDay(firstDay),
        endDate: endOfDay(lastDay),
      };
    }

    case 'last_month': {
      const firstDay = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
      const lastDay = new Date(ref.getFullYear(), ref.getMonth(), 0);
      return {
        startDate: startOfDay(firstDay),
        endDate: endOfDay(lastDay),
      };
    }

    default: {
      // Fallback to today for unknown presets
      return {
        startDate: startOfDay(ref),
        endDate: endOfDay(ref),
      };
    }
  }
}
