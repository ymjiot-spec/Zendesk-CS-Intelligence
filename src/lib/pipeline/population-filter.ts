/**
 * Population Filter - 母集団フィルタリング関数
 *
 * Ticket_Statusが "Z" で始まる、または "Z :" で始まるチケットを除外し、
 * is_excluded フラグを設定する。除外件数・集計対象件数を返却する。
 *
 * Requirements: 1.2, 1.3, 1.4, 1.5
 */

import type { RawTicket, FilteredTicket, PopulationFilterResult } from '@/types';

/**
 * Determine if a ticket should be excluded from the aggregation population.
 * Excluded when:
 * - ticketStatus starts with "Z" or "Z :" (case-insensitive)
 * - inquiryCategory starts with "z：" or "z:" (case-insensitive)
 * - inquiryCategory is a system/automation category (not a real customer inquiry)
 */

const SYSTEM_CATEGORIES = new Set([
  'call_code',
  'ar_suggest_true',
  'ar_suggest_false',
  'ar_marked_helpful',
  'ar_marked_unhelpful',
  'ab_suggest_true',
  'created_ticket',
  'closed_by_merge',
  'system_email_notification_failure',
  'ai_agent_automated_resolution',
  'reply',
  'x',
]);

export function isExcludedStatus(ticketStatus: string): boolean {
  const s = ticketStatus.trimStart();
  if (s.startsWith('Z :') || s.startsWith('z :')) return true;
  if (s.startsWith('Z') || s.startsWith('z')) {
    // "Z" alone or "Z：" etc. but not "Zendesk" etc.
    if (s.length === 1 || s[1] === '：' || s[1] === ':' || s[1] === ' ') return true;
  }
  return false;
}

export function isExcludedCategory(inquiryCategory: string): boolean {
  const c = inquiryCategory.trim().toLowerCase();
  if (c.startsWith('z：') || c.startsWith('z:')) return true;
  if (SYSTEM_CATEGORIES.has(c)) return true;
  return false;
}

export function isExcluded(ticketStatus: string, inquiryCategory: string): boolean {
  return isExcludedStatus(ticketStatus) || isExcludedCategory(inquiryCategory);
}

/**
 * Filter the population of tickets, marking excluded tickets and returning counts.
 */
export function filterPopulation(tickets: RawTicket[]): PopulationFilterResult {
  let excludedCount = 0;

  const filtered: FilteredTicket[] = tickets.map((ticket) => {
    const excluded = isExcluded(ticket.ticketStatus, ticket.inquiryCategory);
    if (excluded) {
      excludedCount++;
    }
    return {
      id: ticket.id,
      zendeskTicketId: ticket.zendeskTicketId,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      inquiryCategory: ticket.inquiryCategory,
      ticketStatus: ticket.ticketStatus,
      subject: ticket.subject,
      description: ticket.description,
      isExcluded: excluded,
    };
  });

  return {
    totalCount: tickets.length,
    populationCount: tickets.length - excludedCount,
    excludedCount,
    filtered,
  };
}
