# Requirements Document

## Introduction

現在のCS Dashboardのイベント管理画面を拡張し、会社別イベントタイムライン・チケット/コール数の相関グラフ・イベント影響分析パネルを統合した管理ダッシュボードを構築する。CS管理者が、どの会社で・いつ・どんなイベントがあり、その結果としてチケット数やコール数がどう増減したかを一画面で把握できるようにする。

## Glossary

- **Dashboard**: イベントタイムライン・相関グラフ・影響分析パネルを統合した管理画面全体
- **Timeline**: 縦軸に会社、横軸に日付を配置し、イベントをバー形式で表示するガントチャート風ビュー
- **Correlation_Graph**: チケット数（棒グラフ）とコール数（折れ線グラフ）をタイムラインと同一日付軸で表示する相関グラフ
- **Impact_Panel**: イベント選択時に表示される、前後3日間の平均チケット数・コール数・変化率・増加カテゴリ等を含む影響分析パネル
- **Impact_Score**: チケット増加率・コール増加率・増加カテゴリ数・異常検知フラグに基づく0〜100のスコア
- **EventLog**: イベント情報を格納するデータモデル（Prisma EventLog テーブル）
- **Ticket**: Zendeskから取得したチケットデータモデル（sourceKey で会社識別、channelType で ticket/call_center 区別）
- **Source_Key**: 会社を識別するZendeskサブドメイン文字列（例: "jtbc", "jcn", "mpca", "star-service"）
- **Company_Color**: 会社ごとに割り当てられた識別色（JTBC: ピンク、JCN: 紺、MPCA: 緑、STAR: オレンジ、その他: グレー）
- **Event_Type**: イベント種別（campaign_start, email_delivery, system_release, incident, terms_change, pricing_change, other）
- **Tab_Navigation**: タイムライン・一覧・相関分析の3タブによる画面切り替えUI
- **AI_Summary**: LLMを用いてイベント影響を自然言語で要約したコメント

## Requirements

### Requirement 1: EventLog への会社識別フィールド追加

**User Story:** CS管理者として、イベントを特定の会社に紐づけて登録したい。これにより、会社別のイベントタイムラインを表示できるようになる。

#### Acceptance Criteria

1. THE EventLog SHALL have a `sourceKey` field of type `String` (nullable) that identifies the target company
2. WHEN a `sourceKey` value is `null` or `"ALL"`, THE Dashboard SHALL treat the EventLog as a company-wide event applicable to all companies
3. WHEN an EventLog is created or updated, THE EventForm SHALL provide a company selection dropdown containing the four registered Source_Key values and an "ALL" option
4. THE EventLog `sourceKey` field SHALL accept only valid Source_Key values registered in the system configuration or the value `"ALL"` or `null`
5. WHEN the database migration is applied, THE existing EventLog records SHALL retain their data with `sourceKey` set to `null`

### Requirement 2: タブナビゲーションによる画面統合

**User Story:** CS管理者として、タイムライン・イベント一覧・相関分析を同一画面内でタブ切り替えにより閲覧したい。これにより、画面遷移なしで複数の視点からイベント状況を把握できる。

#### Acceptance Criteria

1. THE Tab_Navigation SHALL display three tabs labeled "タイムライン", "一覧", "相関分析"
2. WHEN the events page is loaded, THE Dashboard SHALL display the "タイムライン" tab as the default active tab
3. WHEN a tab is selected, THE Dashboard SHALL display the corresponding view without a full page reload
4. THE existing EventList component and EventForm component SHALL remain functional within the "一覧" tab without modification to their current behavior
5. THE Tab_Navigation SHALL preserve the selected date range filter state across tab switches

### Requirement 3: 会社別イベントタイムライン表示

**User Story:** CS管理者として、会社ごとのイベントを時系列のガントチャート形式で一覧したい。これにより、複数会社のイベント発生状況を視覚的に比較できる。

#### Acceptance Criteria

1. THE Timeline SHALL display companies on the vertical axis and dates on the horizontal axis
2. THE Timeline SHALL display each EventLog as a horizontal bar positioned at the corresponding company row and date
3. THE Timeline SHALL apply Company_Color to each event bar for company identification (JTBC: ピンク, JCN: 紺, MPCA: 緑, STAR: オレンジ, その他: グレー)
4. THE Timeline SHALL distinguish Event_Type by label text or border color on each event bar
5. WHEN an EventLog has `sourceKey` of `null` or `"ALL"`, THE Timeline SHALL display the event bar spanning all company rows
6. THE Timeline SHALL provide a view period toggle with three options: 1ヶ月表示, 3ヶ月表示, カスタム期間指定
7. WHEN the "カスタム期間指定" option is selected, THE Timeline SHALL display date picker inputs for start and end dates
8. WHEN an event bar on the Timeline is clicked, THE Dashboard SHALL display the Impact_Panel for the selected event

### Requirement 4: タイムラインデータ集約API

**User Story:** CS管理者として、指定期間内の会社別イベントデータを効率的に取得したい。これにより、タイムライン表示に必要なデータをサーバーサイドで集約できる。

#### Acceptance Criteria

1. THE Dashboard SHALL provide a `GET /api/events/timeline` endpoint that accepts `startDate`, `endDate`, and optional `sourceKey` query parameters
2. WHEN the timeline API is called, THE endpoint SHALL return EventLog records grouped by Source_Key, including each event's `id`, `name`, `eventType`, `occurredAt`, `sourceKey`, and `impactScore`
3. WHEN the `sourceKey` parameter is provided, THE endpoint SHALL filter results to only the specified company
4. WHEN the `sourceKey` parameter is omitted, THE endpoint SHALL return events for all companies
5. IF the `startDate` or `endDate` parameter is missing, THEN THE endpoint SHALL return a 400 error with a descriptive message

### Requirement 5: チケット・コール数相関グラフ表示

**User Story:** CS管理者として、チケット数とコール数の推移をイベント発生日と重ねて確認したい。これにより、イベントが問い合わせ数に与えた影響を視覚的に把握できる。

#### Acceptance Criteria

1. THE Correlation_Graph SHALL share the same horizontal date axis as the Timeline
2. THE Correlation_Graph SHALL display daily Zendesk ticket counts as a bar chart
3. THE Correlation_Graph SHALL display daily call center counts as a line chart overlaid on the bar chart
4. THE Correlation_Graph SHALL display vertical marker lines on dates where EventLog records exist
5. WHEN a company filter is applied, THE Correlation_Graph SHALL display ticket and call counts filtered by the selected Source_Key
6. THE Correlation_Graph SHALL provide a toggle to switch between "全社合算" (all companies combined) and "会社別" (per-company) display modes
7. WHEN "会社別" mode is selected, THE Correlation_Graph SHALL use Company_Color to distinguish each company's data series

### Requirement 6: 相関グラフデータ集約API

**User Story:** CS管理者として、指定期間の日別チケット数・コール数データを取得したい。これにより、相関グラフの描画に必要な集約データを効率的に提供できる。

#### Acceptance Criteria

1. THE Dashboard SHALL provide a `GET /api/events/timeline/correlation` endpoint that accepts `startDate`, `endDate`, and optional `sourceKey` query parameters
2. WHEN the correlation API is called, THE endpoint SHALL return daily aggregated data containing `date`, `ticketCount`, `callCount`, and `eventMarkers` for each day
3. WHEN the `sourceKey` parameter is provided, THE endpoint SHALL filter Ticket records by the specified Source_Key and `channelType`
4. WHEN the `sourceKey` parameter is omitted, THE endpoint SHALL return aggregated counts across all companies
5. THE endpoint SHALL use `firstCommentAt` for call center channel date aggregation when available, falling back to `createdAt` when `firstCommentAt` is null
6. THE endpoint SHALL exclude Ticket records where `isExcluded` is `true`
7. IF the `startDate` or `endDate` parameter is missing, THEN THE endpoint SHALL return a 400 error with a descriptive message

### Requirement 7: イベント影響分析パネル表示

**User Story:** CS管理者として、特定のイベントを選択した際に、そのイベントがチケット数・コール数に与えた影響の詳細を確認したい。これにより、イベントの影響度を定量的に評価できる。

#### Acceptance Criteria

1. WHEN an event is selected, THE Impact_Panel SHALL display the event name, target company name, Event_Type label, and event date
2. WHEN an event is selected, THE Impact_Panel SHALL display the pre-event 3-day average ticket count and post-event 3-day average ticket count
3. WHEN an event is selected, THE Impact_Panel SHALL display the pre-event 3-day average call count and post-event 3-day average call count
4. WHEN an event is selected, THE Impact_Panel SHALL display the ticket change rate as a percentage
5. WHEN an event is selected, THE Impact_Panel SHALL display the call change rate as a percentage
6. WHEN an event is selected, THE Impact_Panel SHALL display the top increased inquiry categories sorted by increase rate in descending order
7. WHEN an event is selected, THE Impact_Panel SHALL display up to 5 representative ticket numbers from the post-event period
8. WHEN an event is selected, THE Impact_Panel SHALL display an AI_Summary comment generated by the LLM describing the event impact in natural language
9. WHEN an event is selected, THE Impact_Panel SHALL display the Impact_Score as a numeric value between 0 and 100

### Requirement 8: 影響分析データAPI

**User Story:** CS管理者として、イベント選択時に影響分析に必要なデータを一括取得したい。これにより、Impact_Panelの表示に必要な全データを単一のAPIコールで取得できる。

#### Acceptance Criteria

1. THE Dashboard SHALL provide a `GET /api/events/[id]/analysis` endpoint that returns the complete impact analysis data for a specified EventLog
2. WHEN the analysis API is called, THE endpoint SHALL return pre-event 3-day average and post-event 3-day average for both ticket count and call count, computed separately using the EventLog's `sourceKey`
3. WHEN the analysis API is called, THE endpoint SHALL return the ticket change rate and call change rate as percentages
4. WHEN the analysis API is called, THE endpoint SHALL return the top increased inquiry categories with their pre-event count, post-event count, and increase rate
5. WHEN the analysis API is called, THE endpoint SHALL return up to 5 representative ticket IDs from the post-event 3-day period, selected from the most increased categories
6. WHEN the analysis API is called, THE endpoint SHALL return an AI_Summary comment generated by the LLM
7. WHEN the analysis API is called, THE endpoint SHALL return the Impact_Score value
8. IF the specified EventLog ID does not exist, THEN THE endpoint SHALL return a 404 error with a descriptive message

### Requirement 9: Impact Score 算出ロジック

**User Story:** CS管理者として、イベントの影響度を0〜100の数値で定量的に把握したい。これにより、イベント間の影響度比較や優先度判断が容易になる。

#### Acceptance Criteria

1. THE Impact_Score calculation SHALL use the following four factors: ticket increase rate, call increase rate, number of increased inquiry categories, and anomaly detection flag
2. THE Impact_Score SHALL produce a value in the range of 0 to 100 inclusive
3. WHEN the ticket increase rate and call increase rate are both 0 and no inquiry categories increased and no anomaly is detected, THE Impact_Score SHALL be 0
4. WHEN the Impact_Score is computed, THE calculation SHALL weight ticket increase rate and call increase rate as the primary contributing factors
5. WHEN an anomaly detection flag is present for the event period, THE Impact_Score calculation SHALL increase the score by a defined bonus factor
6. THE Impact_Score calculation SHALL clamp the final result to the range 0 to 100

### Requirement 10: 会社カラー定義と適用

**User Story:** CS管理者として、会社ごとに固定の識別色が適用された状態でデータを閲覧したい。これにより、複数会社のデータが混在する画面でも即座に会社を識別できる。

#### Acceptance Criteria

1. THE Dashboard SHALL define the following Company_Color mapping: JTBC maps to pink, JCN maps to navy/indigo, MPCA maps to green, STAR maps to orange, and unregistered companies map to gray
2. THE Timeline SHALL apply Company_Color to event bars based on the EventLog's `sourceKey`
3. THE Correlation_Graph SHALL apply Company_Color to data series in "会社別" display mode
4. THE Impact_Panel SHALL display the company name with the corresponding Company_Color indicator

### Requirement 11: 相関分析タブビュー

**User Story:** CS管理者として、タイムラインと相関グラフを上下に並べた統合ビューで分析したい。これにより、イベント発生とチケット/コール数の増減の関係を一目で把握できる。

#### Acceptance Criteria

1. WHEN the "相関分析" tab is selected, THE Dashboard SHALL display the Timeline in the upper section and the Correlation_Graph in the lower section, sharing the same date axis
2. WHEN the date range is changed in the "相関分析" tab, THE Timeline and Correlation_Graph SHALL update synchronously
3. WHEN a company filter is applied in the "相関分析" tab, THE Timeline and Correlation_Graph SHALL both filter to the selected company
4. WHEN an event bar is clicked in the "相関分析" tab, THE Impact_Panel SHALL appear as a side panel or overlay displaying the selected event's analysis data

### Requirement 12: 将来拡張を考慮した設計

**User Story:** 開発者として、メール配信数・LINEメッセージ数・キャンペーン比較・AI原因仮説・次回イベント予測などの将来機能を追加しやすい設計にしたい。これにより、段階的な機能拡張が低コストで実現できる。

#### Acceptance Criteria

1. THE Correlation_Graph data structure SHALL include an extensible `metrics` array that accommodates additional data series beyond ticket count and call count
2. THE Impact_Panel data structure SHALL include an extensible `additionalMetrics` field for future metric types
3. THE timeline API response format SHALL include a `metadata` field for future extension attributes
4. THE Company_Color mapping SHALL be defined in a centralized configuration that is reusable across all Dashboard components
