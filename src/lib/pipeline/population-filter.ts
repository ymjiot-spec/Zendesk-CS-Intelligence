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
 * Excluded when ticketStatus starts with "Z" or "Z :".
 */
export function isExcludedStatus(ticketStatus: string): boolean {
  if (ticketStatus.startsWith('Z :')) {
    return true;
  }
  if (ticketStatus.startsWith('Z')) {
    return true;
  }
  return false;
}

/**
 * Filter the population of tickets, marking excluded tickets and returning counts.
 */
export function filterPopulation(tickets: RawTicket[]): PopulationFilterResult {
  let excludedCount = 0;

  const filtered: FilteredTicket[] = tickets.map((ticket) => {
    const excluded = isExcludedStatus(ticket.ticketStatus);
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
