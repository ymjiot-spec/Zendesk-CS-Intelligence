# 実装計画: Zendesk CSダッシュボード

## 概要

Zendeskチケットデータを活用したCS管理ダッシュボードの実装計画。データ取得パイプライン → 集計エンジン → 異常検知 → AI分析 → 通知 → イベントログ → レポート → アラートルール → REST API → フロントエンドの順に、依存関係に沿って段階的に構築する。TypeScript / Next.js / PostgreSQL / Redis / Recharts / fast-check を使用。

## タスク

- [x] 1. プロジェクト基盤セットアップとデータモデル定義
  - [x] 1.1 Next.jsプロジェクト初期化とディレクトリ構成作成
    - Next.js (App Router) プロジェクトを作成し、`src/lib/`, `src/app/api/`, `src/components/`, `src/types/` のディレクトリ構成を作成
    - PostgreSQL接続（Prisma or Drizzle）、Redisクライアント、fast-checkテスト環境をセットアップ
    - _Requirements: 全体基盤_

  - [x] 1.2 データベーススキーマとマイグレーション作成
    - 設計書のER図に基づき、tickets, daily_aggregations, category_aggregations, hourly_aggregations, anomaly_events, ai_analyses, event_logs, event_tags, notification_rules, notification_logs, anomaly_settings, auto_reports, report_settings, pipeline_state, ai_event_suggestions, alert_rules, alert_firing_records の全テーブルを定義
    - インデックス（`tickets(created_at, is_excluded)`, `tickets(inquiry_category, created_at)` 等）を設定
    - _Requirements: 1.4, 11.1, 16.6, 17.2_

  - [x] 1.3 共通型定義とインターフェース作成
    - `src/types/` に設計書の全インターフェース（RawTicket, FilteredTicket, DailySummary, CategoryBreakdown, MatrixRow, HeatmapData, AnomalyEvent, AIAnalysisResult, NotificationMessage, EventLog, AutoReport, AlertRule, AlertFiringRecord, ApiResponse 等）を定義
    - EventType列挙型（7種別）、QuickSelectプリセット型を定義
    - _Requirements: 1.4, 11.2, 6.2_

- [x] 2. データ取得パイプラインとレート制限
  - [x] 2.1 レート制限マネージャー実装
    - `src/lib/pipeline/rate-limit-manager.ts` に RateLimitManager クラスを実装
    - Zendesk APIレスポンスヘッダーから残りリクエスト数を取得し、使用率80%以上でスロットリング発動
    - 指数バックオフ遅延計算（`baseDelay * 2^retryCount`、最大遅延上限あり）を実装
    - _Requirements: 16.4, 16.5_

  - [ ]* 2.2 レート制限のプロパティテスト
    - **Property 25: レート制限スロットリングの発動条件** — 使用率80%以上でのみスロットリング有効化を検証
    - **Validates: Requirements 16.4**

  - [ ]* 2.3 指数バックオフのプロパティテスト
    - **Property 18: 指数バックオフリトライの正確性** — `baseDelay * 2^n` の計算と最大リトライ回数超過時の停止を検証
    - **Validates: Requirements 9.10, 16.5**

  - [x] 2.4 母集団フィルタリング関数実装
    - `src/lib/pipeline/population-filter.ts` に `filterPopulation` 関数を実装
    - Ticket_Statusが "Z" で始まる、または "Z :" で始まるチケットを除外し、`is_excluded` フラグを設定
    - 除外件数・集計対象件数を返却
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

  - [ ]* 2.5 母集団フィルタのプロパティテスト
    - **Property 1: 母集団フィルタの正確性** — "Z" / "Z :" 開始のステータスのみ除外されることを検証
    - **Property 2: 除外件数の整合性** — 除外件数 + 集計対象件数 = 全チケット件数を検証
    - **Validates: Requirements 1.2, 1.3, 1.5**

  - [x] 2.6 バッチパイプライン実装
    - `src/lib/pipeline/batch-pipeline.ts` に BatchPipeline クラスを実装
    - Zendesk REST API（Tickets API / Search API）から全チケットデータを取得
    - 取得フィールド: 作成日時・更新日時・Inquiry_Category・Ticket_Status・チケット番号・件名・説明文
    - filterPopulation を適用し、DBに保存。最終更新日時を記録
    - _Requirements: 16.1, 16.6, 17.1, 17.2_

  - [x] 2.7 増分取得パイプライン実装
    - `src/lib/pipeline/incremental-pipeline.ts` に IncrementalPipeline クラスを実装
    - Zendesk Incremental Exports API を使用し、前回カーソル以降の更新チケットのみ取得
    - カーソル管理（pipeline_stateテーブル）、マージ処理を実装
    - _Requirements: 16.2, 16.3, 17.1_

  - [ ]* 2.8 増分取得のプロパティテスト
    - **Property 24: カーソルベース増分取得の正確性** — カーソル以降のチケットのみ返却されることを検証
    - **Validates: Requirements 16.3**

- [x] 3. チェックポイント - データパイプライン検証
  - 全テストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 4. 集計エンジン
  - [x] 4.1 日別サマリー集計実装
    - `src/lib/aggregation/daily-summary.ts` に `computeDailySummary` を実装
    - 当日合計件数、前日比（件数差・増減率）、7日平均、30日平均を計算
    - トレンド分類（increase / decrease / flat）を実装
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 4.2 日別サマリーのプロパティテスト
    - **Property 3: 前日比の計算正確性** — `today - yesterday` の件数差と増減率を検証
    - **Property 4: N日平均の計算正確性** — N個の値の合計/Nとの一致を検証
    - **Property 5: トレンド分類の正確性** — 正の値→increase、負→decrease、ゼロ→flatを検証
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.7, 3.8, 4.3, 4.4**

  - [x] 4.3 カテゴリ別分析集計実装
    - `src/lib/aggregation/category-breakdown.ts` に `computeCategoryBreakdown` を実装
    - カテゴリ別件数・割合・前日差・前週同曜日差を計算
    - 件数降順ランキング、6種類超の場合は上位5+「その他」集約を実装
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ]* 4.4 カテゴリ別集計のプロパティテスト
    - **Property 6: カテゴリ別集計の整合性** — カテゴリ別件数合計 = 全体合計、割合合計 ≈ 100%を検証
    - **Property 7: カテゴリランキングのソート不変量** — 件数降順ソートを検証
    - **Property 8: 上位5項目+その他の集約ルール** — 6種超で正確に6エントリ出力を検証
    - **Validates: Requirements 3.1, 3.2, 3.5, 3.6**

  - [x] 4.5 日別×項目別マトリクス集計実装
    - `src/lib/aggregation/matrix.ts` に `computeMatrix` を実装
    - 日付範囲内の各日について、合計件数とカテゴリ別件数・割合・前日差を計算
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 4.6 マトリクスのプロパティテスト
    - **Property 9: マトリクス行の合計不変量** — 各行のカテゴリ件数合計 = 当該日の合計件数を検証
    - **Validates: Requirements 4.1, 4.2**

  - [x] 4.7 時間帯分析・ヒートマップ集計実装
    - `src/lib/aggregation/hourly.ts` に `computeHourlyDistribution` と `computeHeatmap` を実装
    - 時間別（0〜23時）件数集計、曜日×時間帯の7×24マトリクス集計
    - minCount / maxCount の算出
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 4.8 時間帯・ヒートマップのプロパティテスト
    - **Property 10: 時間帯別集計の正確性** — 時間帯別件数合計 = 全体合計、各件数 >= 0を検証
    - **Property 11: ヒートマップデータの正確性** — 7×24セル合計 = 全体合計、min/maxの正確性を検証
    - **Validates: Requirements 5.1, 5.2**

  - [x] 4.9 期間フィルタ（クイック選択）実装
    - `src/lib/aggregation/date-range-resolver.ts` に QuickSelect → DateRange 変換関数を実装
    - today / yesterday / this_week / last_week / this_month / last_month の各プリセットに対応
    - デフォルト値は「today」
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 4.10 クイック選択のプロパティテスト
    - **Property 12: クイック選択の日付範囲計算** — 開始日 <= 終了日、各プリセットの正しい範囲を検証
    - **Validates: Requirements 6.2**

- [x] 5. チェックポイント - 集計エンジン検証
  - 全テストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 6. 異常検知エンジン
  - [x] 6.1 閾値方式異常検知実装
    - `src/lib/anomaly/threshold-detector.ts` に `checkThreshold` 関数を実装
    - カテゴリ別・合計のチケット件数に対して固定しきい値との比較を実行
    - 異常イベント（AnomalyEvent）の生成・DB保存を実装
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 6.2 閾値検知のプロパティテスト
    - **Property 13: 閾値異常検知の正確性** — 値 > しきい値の場合にのみtrueを返すことを検証
    - **Validates: Requirements 7.1, 7.2, 7.3**

  - [x] 6.3 トレンドベース方式異常検知実装
    - `src/lib/anomaly/trend-detector.ts` に移動平均・曜日別移動平均・標準偏差の計算関数を実装
    - `checkTrendAnomaly`: |current - mean| >= sigmaMultiplier * stdDev で異常判定
    - 設定可能パラメータ: 移動平均期間（デフォルト14日）、σ倍数（デフォルト2.0）、曜日性考慮
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 6.4 トレンド検知のプロパティテスト
    - **Property 14: 移動平均の計算正確性** — 直近N個の値の合計/Nとの一致を検証
    - **Property 15: σ偏差異常検知の正確性** — |current - mean| >= σ * stdDev の場合にのみtrueを検証
    - **Validates: Requirements 8.3, 8.1, 8.2, 8.5**

  - [x] 6.5 異常検知統合（detect関数）実装
    - `src/lib/anomaly/anomaly-detector.ts` に閾値方式とトレンド方式を統合した `detect` 関数を実装
    - anomaly_settingsテーブルから設定を読み込み、両方式で検知を実行
    - 異常イベントをDBに保存し、メッセージキュー（Redis）に発行
    - _Requirements: 7.3, 7.5, 8.5, 8.7_

- [x] 7. AI分析エンジン
  - [x] 7.1 AI原因分析実装
    - `src/lib/ai/cause-analyzer.ts` に `analyzeCause` を実装
    - 異常検知時に増加チケット群を抽出し、カテゴリ別寄与度（件数・割合・増加率）を計算
    - LLM APIを呼び出し、共通パターン要約・推定原因仮説（最大3件、各数値根拠付き）・代表チケットID（最大5件）を生成
    - 30秒タイムアウト処理を実装
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.10_

  - [ ]* 7.2 AI分析出力のプロパティテスト
    - **Property 19: AI分析出力の制約不変量** — 仮説最大3件、各仮説に数値根拠あり、代表チケット最大5件、カテゴリ寄与度合計≈100%を検証
    - **Validates: Requirements 10.2, 10.4, 10.5, 10.6**

  - [x] 7.3 Impact_Score算出実装
    - `src/lib/ai/impact-score.ts` に `computeImpactScore` を実装
    - イベント前3日間平均 vs イベント後3日間平均の変化率を計算
    - カテゴリ別寄与度を加味し、0〜100の範囲にクランプ
    - _Requirements: 12.1, 12.2, 12.3_

  - [ ]* 7.4 Impact_Scoreのプロパティテスト
    - **Property 20: Impact_Scoreの計算と範囲制約** — 0〜100の範囲、変化率とカテゴリ寄与度からの算出を検証
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.5**

  - [x] 7.5 複数イベント重複分析実装
    - `src/lib/ai/overlap-analyzer.ts` に `analyzeOverlappingEvents` を実装
    - 前後3日ウィンドウが重複するイベントを検出し、各イベントの個別Impact_Scoreと相対寄与度を算出
    - 寄与度の高い順にランキング、過去の同種イベント影響パターンを考慮
    - _Requirements: 13.1, 13.2, 13.3, 13.5_

  - [ ]* 7.6 重複イベント分析のプロパティテスト
    - **Property 21: 重複イベント検出と寄与度合計** — 重複検出の正確性、相対寄与度合計≈100%を検証
    - **Validates: Requirements 13.1, 13.5**

  - [x] 7.7 AI自動イベント提案実装
    - `src/lib/ai/event-suggestion.ts` に `suggestEventRegistration` を実装
    - 異常検知時に該当期間に登録済みイベントがない場合のみ提案を生成
    - 推定Event_Type候補を提示、「無視する」選択時の再提案抑制ロジックを実装
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [ ]* 7.8 イベント提案のプロパティテスト
    - **Property 22: イベント提案トリガーと抑制ロジック** — 登録済みイベントなし時のみ提案生成、無視後の再提案抑制を検証
    - **Validates: Requirements 14.1, 14.5**

  - [x] 7.9 イベント相関分析実装
    - `src/lib/ai/event-correlation.ts` に `analyzeEventCorrelation` を実装
    - イベント後に増加したInquiry_Categoryを特定し、増加件数・増加率を算出
    - 「イベントX → Category Y が Z% 増加」形式で出力
    - 登録済みイベントなし時は「該当期間に登録済みイベントなし」と明示
    - _Requirements: 15.1, 15.2, 15.6_

  - [x] 7.10 ナレッジ学習・予測提案実装
    - `src/lib/ai/knowledge-predictor.ts` に `predictImpact` を実装
    - 過去の同種Event_Type / 類似Event_Tagのイベント履歴を検索
    - 予想チケット増加数・影響Inquiry_Categoryを予測、同種イベント2件未満で信頼度 `'low'` を設定
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.7_

  - [ ]* 7.11 ナレッジ検索のプロパティテスト
    - **Property 26: 類似イベント検索と信頼度判定** — 同一タイプ/重複タグの検索正確性、2件未満で信頼度lowを検証
    - **Validates: Requirements 18.2, 18.7**

  - [x] 7.12 AIアクション提案エンジン実装
    - `src/lib/ai/action-suggestion-engine.ts` に ActionSuggestionEngine クラスを実装
    - 異常検知時にInquiry_Category・チケット文面を分析し、具体的な対応アクションを最大5件提案
    - ActionType 6種別（FAQ作成・お知らせ掲載・代理店通知・エスカレーション・テンプレート回答作成・システム調査）に対応
    - 各提案に優先度（高・中・低）と推奨理由（数値根拠付き）を付与
    - 過去の類似異常時に効果があったアクション履歴を参照し、優先的に提案
    - 「短く、具体的で、すぐ実行可能な」文章形式で出力
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.9_

  - [x] 7.13 アクション提案の応答・ステータス管理実装
    - respond（accepted/deferred/rejected）、updateExecutionStatus（not_started/in_progress/completed）を実装
    - 応答履歴の蓄積、将来の提案精度向上用データとして保存
    - アクション実行後のチケット数変化を追跡する trackEffect を実装
    - _Requirements: 21.5, 21.6, 21.7, 21.10_

  - [ ]* 7.14 アクション提案のプロパティテスト
    - **Property 32: アクション提案の制約不変量** — 最大5件、有効なActionType・優先度・推奨理由を検証
    - **Property 33: アクション提案の応答ステータス遷移** — pending→accepted/deferred/rejected、acceptedのみ実行ステータス設定可能を検証
    - **Validates: Requirements 21.1, 21.2, 21.3, 21.5, 21.6**

- [x] 8. チェックポイント - 異常検知・AI分析検証
  - 全テストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 9. 通知ディスパッチャー
  - [x] 9.1 通知メッセージフォーマッター実装
    - `src/lib/notification/message-formatter.ts` に通知メッセージのフォーマット関数を実装
    - 異常指標名・検知値・平均値・差分・上位3カテゴリ（割合付き）・代表チケットID（最大5件）・AI分析要約を含むメッセージを生成
    - AIアクション提案の上位3件を通知メッセージに含める
    - ZendeskチケットURL生成: `https://{subdomain}.zendesk.com/agent/tickets/{ticketId}`
    - _Requirements: 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 21.8_

  - [ ]* 9.2 通知メッセージのプロパティテスト
    - **Property 16: 通知メッセージの完全性** — 全必須フィールドの存在を検証
    - **Property 17: ZendeskチケットURL生成の正確性** — URL形式の正確性を検証
    - **Validates: Requirements 9.4, 9.5, 9.6, 9.7, 9.8, 9.9**

  - [x] 9.3 Slack・メール・Chatwork送信実装
    - `src/lib/notification/dispatcher.ts` に NotificationDispatcher クラスを実装
    - Slack API、メール（SES/SMTP）、Chatwork APIへの送信処理を各チャネル別に実装
    - 送信失敗時の指数バックオフリトライ（デフォルト3回）、エラーログ記録を実装
    - _Requirements: 9.1, 9.3, 9.10_

  - [x] 9.4 通知ルールCRUD実装
    - `src/lib/notification/rule-manager.ts` に通知ルールのCRUD操作を実装
    - 送信先チャネル・アドレス・トリガー条件の管理
    - _Requirements: 9.2_

- [x] 10. イベントログエンジン
  - [x] 10.1 イベントログCRUD実装
    - `src/lib/event/event-log-engine.ts` に EventLogEngine クラスを実装
    - create / update / delete / list / getById / getOverlappingEvents / getByTypeAndTags を実装
    - EventType 7種別、デフォルトEvent_Tag（キャンペーン・障害・システム変更・料金変更・代理店施策・マーケ施策）の初期データ投入
    - タグ必須バリデーション（1つ以上）、メモ・URL複数件保存対応
    - _Requirements: 11.1, 11.2, 11.3, 11.8, 11.9, 11.11, 11.12_

  - [ ]* 10.2 イベントフィルタ・バリデーションのプロパティテスト
    - **Property 23: イベントフィルタとタグバリデーション** — フィルタ結果の正確性、タグ空時のバリデーションエラーを検証
    - **Validates: Requirements 11.8, 11.10**

  - [x] 10.3 イベント一覧フィルタリング実装
    - EventListFilters（Event_Type・Tag・期間）によるフィルタリング、ソート（occurredAt / impactScore）を実装
    - 時系列順一覧表示、Impact_Score・Tag・メモ有無の併記データ取得
    - _Requirements: 11.10, 11.13_

- [x] 11. レポート生成エンジン
  - [x] 11.1 自動レポート生成実装
    - `src/lib/report/report-generator.ts` に ReportGenerator クラスを実装
    - 週次（月曜）・月次（1日）のスケジュール判定ロジックを実装
    - レポートコンテンツ: チケット合計・前期間比較・カテゴリハイライト・異常イベント一覧・イベントログ一覧・予測・AI生成ナラティブ
    - LLM APIで「短く、根拠の数字を添えた」文章を生成
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7_

  - [ ]* 11.2 レポート生成のプロパティテスト
    - **Property 27: レポートコンテンツの完全性** — 全必須フィールドの存在を検証
    - **Property 28: レポートスケジュール計算の正確性** — 月曜→週次、1日→月次の判定を検証
    - **Validates: Requirements 19.1, 19.2, 19.3, 19.4, 19.5, 19.6**

  - [x] 11.3 レポート配信・履歴管理実装
    - NotificationDispatcher経由でSlack・Chatwork・メールへ配信
    - レポート履歴一覧取得、再送信機能を実装
    - _Requirements: 19.8, 19.10, 19.11_

- [x] 12. カスタムアラートルールエンジン
  - [x] 12.1 アラートルールCRUD・プリセット実装
    - `src/lib/alert/alert-rule-engine.ts` に AlertRuleEngine クラスを実装
    - create / createFromPreset / update / delete / list を実装
    - プリセット3種（問い合わせ急増・特定カテゴリ急増・異常検知）のテンプレート定義
    - 有効/無効切り替え、通知先チャネル個別設定
    - _Requirements: 20.1, 20.4, 20.5, 20.10_

  - [x] 12.2 アラート条件評価・クールダウン実装
    - `evaluate` 関数: day_over_day_rate / sigma_deviation / fixed_count の3条件メソッドを実装
    - 特定Inquiry_Category指定時の個別監視を実装
    - クールダウン抑制（最後の発火からcooldownMinutes以内は再発火抑制）を実装
    - 発火履歴（AlertFiringRecord）のDB保存、対応ステータス管理（未対応・対応中・対応済み）
    - _Requirements: 20.2, 20.3, 20.5, 20.8_

  - [ ]* 12.3 アラートルールのプロパティテスト
    - **Property 29: アラートルール条件評価の正確性** — 各条件メソッドの発火条件を検証
    - **Property 30: アラートクールダウン抑制の正確性** — cooldownMinutes以内の再発火抑制を検証
    - **Validates: Requirements 20.1, 20.2, 20.5**

  - [x] 12.4 アラート通知メッセージ生成実装
    - `src/lib/alert/alert-notification-formatter.ts` にアラート発火時の通知メッセージフォーマッターを実装
    - ルール名・条件・検知値・基準値差分・代表チケット番号（最大5件）・Zendeskリンクを含む
    - _Requirements: 20.6, 20.7_

  - [ ]* 12.5 アラート通知メッセージのプロパティテスト
    - **Property 31: アラート通知メッセージの完全性** — 全必須フィールドの存在を検証
    - **Validates: Requirements 20.6, 20.7**

- [x] 13. チェックポイント - バックエンドロジック全体検証
  - 全テストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 14. REST APIエンドポイント実装
  - [x] 14.1 ダッシュボード系APIエンドポイント実装
    - `src/app/api/dashboard/` 配下に以下のRoute Handlerを実装:
    - `GET /api/dashboard/summary` — 日別サマリー取得（AggregationEngine.computeDailySummary呼び出し）
    - `GET /api/dashboard/categories` — 項目別分析取得（computeCategoryBreakdown呼び出し）
    - `GET /api/dashboard/matrix` — マトリクス取得（computeMatrix呼び出し）
    - `GET /api/dashboard/hourly` — 時間帯分析取得（computeHourlyDistribution呼び出し）
    - `GET /api/dashboard/heatmap` — ヒートマップ取得（computeHeatmap呼び出し）
    - `GET /api/dashboard/population` — 集計母集団情報取得
    - 共通DateRangeQueryパラメータ、QuickSelectプリセット対応、ApiResponse形式で返却
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 6.2, 6.3, 6.4_

  - [x] 14.2 異常検知・AI分析系APIエンドポイント実装
    - `GET /api/anomalies` — 異常イベント一覧取得
    - `GET /api/anomalies/:id/analysis` — AI分析結果取得
    - `GET /api/anomalies/:id/suggestion` — AI自動イベント提案取得
    - `POST /api/anomalies/:id/suggestion/respond` — AI提案への応答（登録する/後で確認/無視する）
    - `GET /api/anomalies/:id/actions` — AIアクション提案一覧取得
    - `POST /api/anomalies/:id/actions/:actionId/respond` — アクション提案への応答
    - `PUT /api/anomalies/:id/actions/:actionId/status` — アクション実行ステータス更新
    - `GET /api/anomalies/:id/actions/:actionId/effect` — アクション実行効果取得
    - _Requirements: 7.5, 8.7, 10.9, 14.3, 14.4, 21.5, 21.6, 21.10_

  - [x] 14.3 設定系APIエンドポイント実装
    - `GET/PUT /api/settings/thresholds` — 閾値設定の取得・更新
    - `GET/PUT /api/settings/trend` — トレンド検知設定の取得・更新
    - `GET/PUT /api/settings/reports` — レポート設定の取得・更新
    - `GET /api/pipeline/status` — パイプラインステータス・データソース取得ステータス表示
    - _Requirements: 7.4, 8.6, 16.6, 17.5, 19.9_

  - [x] 14.4 イベントログ系APIエンドポイント実装
    - `GET/POST/PUT/DELETE /api/events` — イベントログCRUD
    - `GET /api/events/:id/impact` — イベント影響度分析取得
    - `GET /api/events/:id/correlation` — イベント相関分析取得
    - `GET /api/events/overlap` — 複数イベント重複分析取得
    - `GET /api/events/:id/prediction` — ナレッジ予測取得
    - _Requirements: 11.1, 11.3, 12.4, 15.3, 13.4, 18.5_

  - [x] 14.5 通知・レポート・アラート系APIエンドポイント実装
    - `GET/POST/PUT/DELETE /api/notifications/rules` — 通知ルールCRUD
    - `GET /api/reports` — レポート履歴一覧取得
    - `POST /api/reports/generate` — 手動レポート生成
    - `POST /api/reports/:id/resend` — レポート再送信
    - `GET/POST/PUT/DELETE /api/alerts/rules` — アラートルールCRUD
    - `POST /api/alerts/rules/preset` — プリセットからアラートルール作成
    - `GET /api/alerts/history` — アラート発火履歴一覧取得
    - `PUT /api/alerts/history/:id/status` — アラート対応ステータス更新
    - _Requirements: 9.2, 19.9, 19.10, 19.11, 20.1, 20.8, 20.10_

- [x] 15. チェックポイント - REST API検証
  - 全テストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 16. フロントエンド - ダッシュボードメインビュー
  - [x] 16.1 共通レイアウト・期間フィルタコンポーネント実装
    - `src/components/layout/` にダッシュボードレイアウト（ヘッダー・サイドバー・メインエリア）を実装
    - `src/components/filters/DateRangeFilter.tsx` に日付範囲フィルタ（開始日・終了日ピッカー）を実装
    - クイック選択ボタン（今日・昨日・今週・先週・今月・先月）を実装
    - フィルタ変更時に全コンポーネントのデータ再描画をトリガー
    - デフォルト値「今日」を設定
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 16.2 日別サマリーカード実装
    - `src/components/dashboard/DailySummaryCard.tsx` を実装
    - 当日合計件数、前日比（件数差・増減率）、7日平均、30日平均を表示
    - 増加→赤系上向き矢印、減少→緑系下向き矢印、横ばい→グレー横向き矢印
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 16.3 集計母集団定義表示コンポーネント実装
    - `src/components/dashboard/PopulationInfo.tsx` を実装
    - 対象条件・除外条件・使用フィールドの常時表示、除外件数の併記
    - _Requirements: 1.1, 1.5_

  - [x] 16.4 カテゴリ別分析コンポーネント実装
    - `src/components/dashboard/CategoryBreakdown.tsx` を実装
    - カテゴリ別件数・割合・前日差・前週同曜日差をランキング形式で表示
    - 上位5+「その他」集約、増加バッジ（赤系）・減少バッジ（緑系）を表示
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 16.5 日別×項目別マトリクステーブル実装
    - `src/components/dashboard/MatrixTable.tsx` を実装
    - 日付ごとの合計件数・カテゴリ別件数・割合を一覧テーブルで表示
    - 前日比の増減差分表示（バッジ・色・矢印）、列ソート機能、日付降順初期表示
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 16.6 時間帯分析・ヒートマップコンポーネント実装
    - `src/components/dashboard/HourlyChart.tsx` にRecharts棒グラフ（0〜23時）を実装
    - `src/components/dashboard/Heatmap.tsx` に曜日×時間帯ヒートマップを実装
    - 色の濃淡（薄い→少ない、濃い→多い）、マウスオーバーツールチップ（曜日・時間帯・件数）、色スケール凡例
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 17. フロントエンド - 異常検知・AI分析ビュー
  - [x] 17.1 異常検知表示・異常バッジ実装
    - `src/components/anomaly/AnomalyBadge.tsx` に赤色ハイライト・異常バッジコンポーネントを実装
    - サマリーカード・カテゴリ別分析に異常バッジを統合表示
    - _Requirements: 7.5, 8.7_

  - [x] 17.2 AI分析結果詳細画面実装
    - `src/components/anomaly/AIAnalysisDetail.tsx` を実装
    - カテゴリ別寄与度、共通パターン要約、推定原因仮説（最大3件、数値根拠付き）、代表チケットID（Zendeskリンク付き）を表示
    - イベント相関分析結果をイベントタイムライン付きで表示
    - 30秒以内未完了時の「分析中」ローディング表示、完了後自動更新
    - _Requirements: 10.7, 10.8, 10.9, 10.10, 15.5_

  - [x] 17.3 AIイベント提案UIコンポーネント実装
    - `src/components/anomaly/EventSuggestionBanner.tsx` を実装
    - 「この期間にイベントを登録しますか？」提案バナー、推定Event_Type候補表示
    - 「登録する」「後で確認」「無視する」の3択応答UI
    - 「登録する」→ イベント登録画面に遷移（推定Event_Type・日時自動入力）
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [x] 17.4 AIアクション提案UIコンポーネント実装
    - `src/components/anomaly/ActionSuggestionCards.tsx` を実装
    - 異常検知詳細画面にアクション提案をカード形式で表示（最大5件）
    - 各カードにActionType・タイトル・説明・優先度（高→赤、中→黄、低→青）・推奨理由を表示
    - 「実行する」「後で対応」「不要」の3択応答UI
    - 「実行する」選択後の対応ステータス管理（未着手・対応中・完了）UI
    - アクション実行効果（実行後のチケット数変化）の表示
    - _Requirements: 21.1, 21.5, 21.6, 21.9, 21.10_

- [x] 18. フロントエンド - イベントログ管理ビュー
  - [x] 18.1 イベント登録・編集フォーム実装
    - `src/components/event/EventForm.tsx` を実装
    - イベント名・Event_Type（7種別セレクト）・発生日時・説明・タグ（複数選択、カスタムタグ追加可）・メモ・URL複数件入力
    - デフォルトEvent_Tag選択肢の表示
    - _Requirements: 11.1, 11.2, 11.8, 11.9, 11.11, 11.12_

  - [x] 18.2 イベント一覧・フィルタ画面実装
    - `src/components/event/EventList.tsx` を実装
    - 時系列順一覧表示、各イベントのImpact_Score・Event_Tag・メモ有無を併記
    - Event_Tag・Event_Type・期間でのフィルタリング機能
    - 編集・削除操作
    - _Requirements: 11.3, 11.10, 11.13_

  - [x] 18.3 イベントマーカー・タイムライン表示実装
    - `src/components/event/EventMarker.tsx` を実装
    - 時系列チケット数グラフ上にイベントマーカー（縦線・アイコン）を重畳表示
    - Event_Typeごとに異なる色/アイコン、マウスオーバーツールチップ（イベント名・Type・日時・説明）
    - イベント前後のチケット数変化（前N日平均 vs 後N日平均）を数値表示
    - 複数イベント重複期間のハイライト表示
    - _Requirements: 11.4, 11.5, 11.6, 11.7, 13.4_

  - [x] 18.4 イベント詳細・影響度分析画面実装
    - `src/components/event/EventDetail.tsx` を実装
    - Impact_Scoreのプログレスバー/ゲージ表示（0〜100%）
    - イベント前3日間 vs 後3日間の日別チケット数比較表示
    - Inquiry_Category別件数変化のランキング表示
    - 重複イベント分析結果（「イベントA：寄与度XX%」形式）の表示
    - 過去の類似イベントセクション（メモ・Impact_Score・影響Category一覧）
    - _Requirements: 12.4, 12.5, 12.6, 12.7, 13.5, 15.3, 18.5_

- [x] 19. フロントエンド - 設定・管理ビュー
  - [x] 19.1 異常検知設定画面実装
    - `src/components/settings/AnomalySettings.tsx` を実装
    - 閾値設定（カテゴリ別・合計の固定しきい値）の設定・変更UI
    - トレンド検知設定（移動平均期間N日・σ倍数）の設定・変更UI
    - _Requirements: 7.4, 8.6_

  - [x] 19.2 通知ルール設定画面実装
    - `src/components/settings/NotificationSettings.tsx` を実装
    - 通知ルール（チャネル・送信先・トリガー条件）のCRUD UI
    - _Requirements: 9.2_

  - [x] 19.3 レポート設定・履歴画面実装
    - `src/components/settings/ReportSettings.tsx` を実装
    - レポート生成スケジュール（週次・月次・カスタム）と配信先チャネルの設定UI
    - 過去レポート履歴一覧、閲覧・再送信機能
    - 手動レポート生成トリガーボタン
    - _Requirements: 19.9, 19.10, 19.11_

  - [x] 19.4 パイプラインステータス・データソース表示実装
    - `src/components/settings/PipelineStatus.tsx` を実装
    - データ最終更新日時の表示、使用データソース（API種別）と取得ステータスの表示
    - _Requirements: 16.6, 17.5_

- [x] 20. フロントエンド - アラートルール管理ビュー
  - [x] 20.1 アラートルール作成・管理画面実装
    - `src/components/alert/AlertRuleForm.tsx` を実装
    - トリガー条件の組み合わせ設定（合計急増・特定カテゴリ急増・特定時間帯急増）
    - 「急増」定義の設定（前日比率・σ偏差・固定件数）
    - 通知先チャネル個別設定、有効/無効切り替え、通知頻度制限設定
    - プリセットテンプレート（問い合わせ急増・特定カテゴリ急増・異常検知）からのワンクリック作成
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.10_

  - [x] 20.2 アラート発火履歴・リアルタイムバナー実装
    - `src/components/alert/AlertHistory.tsx` にアラート発火履歴一覧を実装
    - 発火日時・ルール名・検知値・対応ステータス（未対応・対応中・対応済み）の管理UI
    - `src/components/alert/AlertBanner.tsx` にダッシュボード画面上部のリアルタイムバナー通知を実装
    - _Requirements: 20.8, 20.9_

  - [x] 20.3 ナレッジ予測バナー実装
    - `src/components/event/PredictionBanner.tsx` を実装
    - 新規イベント登録画面での予測提案アラートバナー表示
    - 「詳細を見る」で過去イベント詳細に遷移
    - _Requirements: 18.6_

- [x] 21. フロントエンド統合とワイヤリング
  - [x] 21.1 ページルーティングとデータフェッチ統合
    - `src/app/page.tsx` にメインダッシュボードページを実装（サマリー・カテゴリ分析・マトリクス・時間帯分析を統合）
    - `src/app/anomalies/page.tsx` に異常検知一覧ページを実装
    - `src/app/events/page.tsx` にイベントログ管理ページを実装
    - `src/app/alerts/page.tsx` にアラートルール管理ページを実装
    - `src/app/settings/page.tsx` に設定ページを実装
    - `src/app/reports/page.tsx` にレポート履歴ページを実装
    - 各ページでAPIクライアントフック（SWR or React Query）を使用してデータフェッチ
    - 期間フィルタ変更時の全コンポーネント連動再描画を実装
    - _Requirements: 6.4, 全体統合_

  - [ ]* 21.2 フロントエンドユニットテスト
    - 主要コンポーネント（DailySummaryCard, CategoryBreakdown, MatrixTable, Heatmap）のレンダリングテスト
    - 期間フィルタのデフォルト値「今日」の確認テスト
    - AI提案の3択応答オプション存在確認テスト
    - _Requirements: 2.1, 6.5, 14.4_

- [x] 22. 最終チェックポイント - 全体統合検証
  - 全テストが通ることを確認し、不明点があればユーザーに質問する。

## 備考

- `*` マーク付きタスクはオプションであり、MVP優先時はスキップ可能
- 各タスクは対応する要件番号を参照しており、トレーサビリティを確保
- チェックポイントで段階的に品質を検証
- プロパティテストは普遍的な正当性を保証し、ユニットテストは具体的なエッジケースを検証
