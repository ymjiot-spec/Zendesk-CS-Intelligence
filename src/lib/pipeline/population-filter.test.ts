import { describe, it, expect } from 'vitest';
import { filterPopulation, isExcludedStatus } from './population-filter';
import type { RawTicket } from '@/types';

function makeTicket(overrides: Partial<RawTicket> = {}): RawTicket {
  return {
    id: '1',
    zendeskTicketId: '1001',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    inquiryCategory: 'billing',
    ticketStatus: 'open',
    subject: 'Test',
    description: 'Test description',
    fetchedAt: new Date(),
    ...overrides,
  };
}

describe('isExcludedStatus', () => {
  it('should exclude status starting with "Z"', () => {
    expect(isExcludedStatus('Z完了')).toBe(true);
    expect(isExcludedStatus('Zclosed')).toBe(true);
    expect(isExcludedStatus('Z')).toBe(true);
  });

  it('should exclude status starting with "Z :"', () => {
    expect(isExcludedStatus('Z : 完了')).toBe(true);
    expect(isExcludedStatus('Z : closed')).toBe(true);
  });

  it('should not exclude normal statuses', () => {
    expect(isExcludedStatus('open')).toBe(false);
    expect(isExcludedStatus('pending')).toBe(false);
    expect(isExcludedStatus('solved')).toBe(false);
    expect(isExcludedStatus('closed')).toBe(false);
  });

  it('should not exclude statuses with "Z" not at start', () => {
    expect(isExcludedStatus('AZ完了')).toBe(false);
    expect(isExcludedStatus('openZ')).toBe(false);
  });

  it('should handle empty string', () => {
    expect(isExcludedStatus('')).toBe(false);
  });
});

describe('filterPopulation', () => {
  it('should return correct counts for mixed tickets', () => {
    const tickets: RawTicket[] = [
      makeTicket({ id: '1', ticketStatus: 'open' }),
      makeTicket({ id: '2', ticketStatus: 'Z完了' }),
      makeTicket({ id: '3', ticketStatus: 'pending' }),
      makeTicket({ id: '4', ticketStatus: 'Z : closed' }),
    ];

    const result = filterPopulation(tickets);

    expect(result.totalCount).toBe(4);
    expect(result.excludedCount).toBe(2);
    expect(result.populationCount).toBe(2);
    expect(result.totalCount).toBe(result.populationCount + result.excludedCount);
  });

  it('should set isExcluded flag correctly', () => {
    const tickets: RawTicket[] = [
      makeTicket({ id: '1', ticketStatus: 'open' }),
      makeTicket({ id: '2', ticketStatus: 'Z完了' }),
    ];

    const result = filterPopulation(tickets);

    expect(result.filtered[0].isExcluded).toBe(false);
    expect(result.filtered[1].isExcluded).toBe(true);
  });

  it('should handle empty array', () => {
    const result = filterPopulation([]);

    expect(result.totalCount).toBe(0);
    expect(result.excludedCount).toBe(0);
    expect(result.populationCount).toBe(0);
    expect(result.filtered).toHaveLength(0);
  });

  it('should handle all excluded tickets', () => {
    const tickets: RawTicket[] = [
      makeTicket({ id: '1', ticketStatus: 'Z完了' }),
      makeTicket({ id: '2', ticketStatus: 'Z : closed' }),
    ];

    const result = filterPopulation(tickets);

    expect(result.totalCount).toBe(2);
    expect(result.excludedCount).toBe(2);
    expect(result.populationCount).toBe(0);
  });

  it('should handle no excluded tickets', () => {
    const tickets: RawTicket[] = [
      makeTicket({ id: '1', ticketStatus: 'open' }),
      makeTicket({ id: '2', ticketStatus: 'pending' }),
    ];

    const result = filterPopulation(tickets);

    expect(result.totalCount).toBe(2);
    expect(result.excludedCount).toBe(0);
    expect(result.populationCount).toBe(2);
  });

  it('should preserve ticket fields in filtered output', () => {
    const ticket = makeTicket({
      id: '42',
      zendeskTicketId: '9999',
      inquiryCategory: 'billing',
      subject: 'Help me',
    });

    const result = filterPopulation([ticket]);

    expect(result.filtered[0].id).toBe('42');
    expect(result.filtered[0].zendeskTicketId).toBe('9999');
    expect(result.filtered[0].inquiryCategory).toBe('billing');
    expect(result.filtered[0].subject).toBe('Help me');
  });
});
