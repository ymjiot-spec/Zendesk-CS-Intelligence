# Implementation Plan: Event Timeline Dashboard

## Overview

既存の `/events` ページをタブベースの3画面構成（タイムライン / 一覧 / 相関分析）に拡張する。EventLog モデルに `sourceKey` フィールドを追加し、会社別イベント管理・タイムライン表示・チケット/コール数相関グラフ・影響分析パネルを統合したダッシュボードを構築する。

## Tasks

- [x] 1. Data model changes and type definitions
  - [x] 1.1 Add `sourceKey` field to EventLog Prisma model and run migration
    - Add `sourceKey String? @map("source_key") @db.VarChar(50)` to EventLog model in `prisma/schema.prisma`
    - Add composite index `@@index([sourceKey, occurredAt], name: "idx_event_logs_source_key_occurred_at")`
    - Run `npx prisma migrate dev` to generate and apply migration
    - Existing records retain `sourceKey = NULL` (treated as all-company events)
    - _Requirements: 1.1, 1.5_

  - [x] 1.2 Update TypeScript type definitions for EventLog
    - Add `sourceKey: string | null` to `EventLog` interface in `src/types/event.ts`
    - Add `sourceKey: string | null` to `EventFormData` interface in `src/components/event/EventForm.tsx`
    - _Requirements: 1.1_

  - [x] 1.3 Add timeline and analysis TypeScript types
    - Create `src/types/timeline.ts` with `TimelineEvent`, `CorrelationDataPoint`, `ImpactAnalysisData`, `TimelineResponse`, `CorrelationResponse`, `AnalysisResponse` interfaces
    - Include `metadata: Record<string, unknown>` in response types for future extensibility
    - Include `metrics?: { key: string; value: number; label: string }[]` in `CorrelationDataPoint`
    - Include `additionalMetrics?: Record<string, unknown>` in `ImpactAnalysisData`
    - _Requirements: 12.1, 12.2, 12.3_

- [x] 2. Company colors centralization
  - [x] 2.1 Create centralized company color configuration
    - Create `src/lib/company-colors.ts` with `CompanyColorConfig` interface
    - Define `COMPANY_COLORS` record mapping sourceKey → color config (tailwind classes + hex values)
    - Export `getCompanyColor(sourceKey)` and `getCompanyName(sourceKey)` helper functions
    - Define `VALID_SOURCE_KEYS` array and `isValidSourceKey(key)` validation function
    - Color mapping: starservicesupport→orange, dmobilehelp→pink, jcnhelp→indigo, mpcahelp→emerald, null/ALL→blue, default→gray
    - _Requirements: 10.1, 10.4, 1.4_

  - [x] 2.2 Refactor `src/app/page.tsx` to use centralized company colors
    - Replace inline `COMPANY_COLORS` object in dashboard page with import from `src/lib/company-colors.ts`
    - _Requirements: 10.4_

  - [ ]* 2.3 Write property tests for company color functions
    - **Property 3: sourceKey validation** — `isValidSourceKey` returns true only for registered keys, "ALL", or null
    - **Property 6: Company color mapping** — `getCompanyColor` returns defined colors for known keys, gray for unknown
    - **Validates: Requirements 1.4, 3.3, 10.1**

- [x] 3. Checkpoint - Ensure data model and color config are correct
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. API endpoints
  - [x] 4.1 Create `GET /api/events/timeline` endpoint
    - Create `src/app/api/events/timeline/route.ts`
    - Accept `startDate`, `endDate` (required), `sourceKey` (optional) query parameters
    - Return 400 if `startDate` or `endDate` missing
    - Query EventLog records within date range, group by `sourceKey`
    - Return `{ success, data: { groups: [...], allCompanyEvents: [...], metadata: {} } }`
    - Events with `sourceKey` null/"ALL" go into `allCompanyEvents` array
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 12.3_

  - [x] 4.2 Create `GET /api/events/timeline/correlation` endpoint
    - Create `src/app/api/events/timeline/correlation/route.ts`
    - Accept `startDate`, `endDate` (required), `sourceKey` (optional) query parameters
    - Return 400 if `startDate` or `endDate` missing
    - Query Ticket records grouped by date, split by `channelType` (ticket vs call_center)
    - Use `firstCommentAt` for call_center date when available, fallback to `createdAt`
    - Exclude tickets where `isExcluded = true`
    - Include event markers for dates with EventLog records
    - Return `{ success, data: { daily: CorrelationDataPoint[], metadata: {} } }`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 12.1_

  - [x] 4.3 Create `GET /api/events/[id]/analysis` endpoint
    - Create `src/app/api/events/[id]/analysis/route.ts`
    - Return 404 if EventLog ID not found
    - Compute pre-event 3-day and post-event 3-day averages for tickets and calls separately using event's `sourceKey`
    - Compute ticket and call change rates
    - Compute top increased inquiry categories sorted by increase rate descending
    - Select up to 5 representative ticket IDs from most increased categories
    - Generate AI_Summary via LLM (with fallback on failure)
    - Compute enhanced 4-factor Impact Score
    - Return `{ success, data: ImpactAnalysisData }`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

  - [x] 4.4 Enhance Impact Score calculator with 4-factor model
    - Modify `src/lib/ai/impact-score.ts` to accept 4 factors: ticketIncreaseRate (35%), callIncreaseRate (35%), increasedCategoryCount (20%), hasAnomalyFlag (10% bonus)
    - Keep existing `computeImpactScore` function backward-compatible
    - Add new `computeEnhancedImpactScore` function with weighted calculation
    - Clamp result to 0-100
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [ ]* 4.5 Write property tests for Impact Score calculator
    - **Property 17: Impact Score range** — output is always 0-100 for any input combination
    - **Property 18: Impact Score sensitivity** — changing any single non-zero factor changes the score
    - **Property 19: Impact Score weighting** — ticket+call only > category+anomaly only; anomaly=true >= anomaly=false
    - **Validates: Requirements 9.1, 9.2, 9.4, 9.5, 9.6**

- [x] 5. Checkpoint - Ensure API endpoints work correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Frontend components
  - [x] 6.1 Create TabNavigation component
    - Create `src/components/event/TabNavigation.tsx`
    - Display 3 tabs: "タイムライン", "一覧", "相関分析"
    - Accept `activeTab` and `onTabChange` props
    - Style active tab with distinct visual indicator
    - _Requirements: 2.1, 2.3_

  - [x] 6.2 Create CompanyTimeline component
    - Create `src/components/event/CompanyTimeline.tsx`
    - Custom div-based gantt chart (not Recharts) with companies on vertical axis, dates on horizontal axis
    - Display event bars with Company_Color from `src/lib/company-colors.ts`
    - Show Event_Type as label text on each bar
    - Events with `sourceKey` null/"ALL" span all company rows
    - Period toggle: 1ヶ月 / 3ヶ月 / カスタム with date pickers for custom mode
    - Horizontal scroll for long periods
    - Click handler on event bars to trigger Impact_Panel
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 10.2_

  - [x] 6.3 Create CorrelationChart component
    - Create `src/components/event/CorrelationChart.tsx`
    - Use Recharts `ComposedChart` with `Bar` (ticket count) + `Line` (call count)
    - Add `ReferenceLine` vertical markers on dates with events
    - Toggle between "全社合算" and "会社別" display modes
    - Apply Company_Color hex values to series in per-company mode
    - Support `mini` prop for compact display in timeline tab
    - Click handler on event markers
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 10.3_

  - [x] 6.4 Create ImpactAnalysisPanel component
    - Create `src/components/event/ImpactAnalysisPanel.tsx`
    - Display event name, company name with Company_Color indicator, Event_Type label, event date
    - Display pre/post 3-day averages for tickets and calls
    - Display ticket and call change rates as percentages
    - Display top increased categories sorted by increase rate
    - Display up to 5 representative ticket numbers
    - Display AI_Summary text
    - Display Impact_Score (0-100)
    - Loading state and close button
    - Error fallback with retry button
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 10.4_

- [x] 7. EventForm enhancement
  - [x] 7.1 Add sourceKey dropdown to EventForm
    - Add company selection dropdown to `src/components/event/EventForm.tsx`
    - Options: 全社 (null), STAR (starservicesupport), JTBC (dmobilehelp), JCN (jcnhelp), MPCA (mpcahelp)
    - Use company names and colors from `src/lib/company-colors.ts`
    - Include `sourceKey` in form submission data
    - Pre-populate dropdown when editing existing event
    - _Requirements: 1.3, 1.4_

- [x] 8. Page integration - Refactor events/page.tsx with tabs
  - [x] 8.1 Refactor `src/app/events/page.tsx` with tab-based layout
    - Import TabNavigation, CompanyTimeline, CorrelationChart, ImpactAnalysisPanel
    - Add shared state: `dateRange`, `selectedEvent`, `sourceKeyFilter`, `activeTab`
    - Default to "タイムライン" tab on page load
    - Preserve date range filter state across tab switches
    - "一覧" tab: render existing EventList + EventForm + EventDetail (unchanged behavior)
    - "タイムライン" tab: render CompanyTimeline + mini CorrelationChart
    - "相関分析" tab: render CompanyTimeline (top) + CorrelationChart (bottom) + ImpactAnalysisPanel (side)
    - Fetch timeline data from `/api/events/timeline` for timeline/correlation tabs
    - Fetch correlation data from `/api/events/timeline/correlation` for correlation tab
    - Fetch analysis data from `/api/events/[id]/analysis` when event is clicked
    - Synchronize date range and company filter between Timeline and CorrelationChart in correlation tab
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.8, 11.1, 11.2, 11.3, 11.4_

  - [x] 8.2 Update `src/components/event/index.ts` barrel export
    - Add exports for TabNavigation, CompanyTimeline, CorrelationChart, ImpactAnalysisPanel
    - _Requirements: N/A (wiring)_

- [x] 9. Checkpoint - Ensure full integration works
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 10. Property-based tests for data logic
  - [ ]* 10.1 Write property tests for timeline grouping and filtering
    - **Property 2: ALL events span all groups** — events with null/"ALL" sourceKey appear in every company group
    - **Property 7: sourceKey grouping** — each group's events match the group's sourceKey or are null/"ALL"
    - **Property 8: sourceKey filtering** — filtered results contain only matching sourceKey records plus null/"ALL"
    - **Validates: Requirements 1.2, 3.5, 4.2, 4.3, 5.5, 6.3**

  - [ ]* 10.2 Write property tests for correlation data aggregation
    - **Property 10: daily aggregation** — ticketCount matches channelType="ticket" count, callCount matches channelType="call_center" count per day
    - **Property 11: call center date resolution** — uses firstCommentAt when non-null, createdAt when null
    - **Property 12: excluded ticket filtering** — no isExcluded=true tickets in aggregation results
    - **Validates: Requirements 6.2, 6.5, 6.6**

  - [ ]* 10.3 Write property tests for impact analysis calculations
    - **Property 13: 3-day average computation** — pre/post averages match arithmetic mean of respective 3-day windows
    - **Property 14: change rate computation** — rate equals `(post - pre) / pre * 100` with special handling for pre=0
    - **Property 15: category correlation sorting** — output sorted by increaseRate descending
    - **Property 16: representative ticket constraint** — returns 0-5 tickets
    - **Validates: Requirements 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 8.2, 8.3, 8.4, 8.5**

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout — all implementations use TypeScript
- Existing EventList, EventForm, EventDetail components remain functional in the "一覧" tab
- Company colors are centralized in `src/lib/company-colors.ts` and shared across dashboard and events pages
