/**
 * Ticket-related type definitions
 * Based on Zendesk ticket data and population filtering
 */

/** Raw ticket data as fetched from Zendesk API */
export interface RawTicket {
  id: string;
  zendeskTicketId: string;
  createdAt: Date;
  updatedAt: Date;
  inquiryCategory: string;
  ticketStatus: string;
  subject: string;
  description: string;
  fetchedAt: Date;
}

/** Ticket after population filtering (excluded tickets removed) */
export interface FilteredTicket {
  id: string;
  zendeskTicketId: string;
  createdAt: Date;
  updatedAt: Date;
  inquiryCategory: string;
  ticketStatus: string;
  subject: string;
  description: string;
  isExcluded: boolean;
}

/** Result of population filtering operation */
export interface PopulationFilterResult {
  totalCount: number;
  populationCount: number;
  excludedCount: number;
  filtered: FilteredTicket[];
}
