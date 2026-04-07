# 要件定義書

## はじめに

Zendeskチケットデータを活用し、CS責任者が「1秒で状況把握 → 5秒で原因当たり → 即アクション」を実現するための管理ダッシュボードを設計・実装する。上場企業レベルの品質を備え、AI異常検知・原因分析・トレンド分析・プッシュ通知を統合した次世代CSダッシュボードである。

## 用語集

- **Dashboard**: Zendeskチケットデータを可視化・分析するWebアプリケーション
- **Ticket**: Zendeskに登録された顧客からの問い合わせ1件を表すデータ単位
- **Inquiry_Category**: Zendeskカスタムフィールド「お問い合わせ項目」（ドロップダウン型）
- **Ticket_Status**: Zendeskカスタムフィールド「チケットステータス」（ドロップダウン型）
- **Aggregation_Population**: 集計対象となるチケットの母集団。Ticket_Statusが "Z" または "Z :" で始まる値を持つチケットを除外した全チケット
- **Anomaly_Detector**: 閾値方式およびトレンドベース方式でチケット数の異常を検知するサブシステム
- **AI_Analyzer**: 異常検知時にチケット群を分析し、原因仮説・要約・代表チケットを生成するAIサブシステム
- **Notification_Dispatcher**: Slack・メール・Chatworkへ通知を送信するサブシステム
- **Data_Pipeline**: Zendesk APIからデータを取得し、蓄積・集計・可視化に供給するデータ処理基盤
- **Heatmap**: 曜日×時間帯のチケット件数を色の濃淡で表現する可視化コンポーネント
- **Threshold_Detection**: 固定しきい値を超えた場合に異常と判定する検知方式
- **Trend_Detection**: 移動平均との差分および曜日性を考慮して異常と判定する検知方式
- **Incremental_Fetch**: 前回取得以降の更新分のみを取得するデータ取得方式
- **Event_Log**: キャンペーン開始・システムリリース・障害・メール配信・料金変更・規約変更等のビジネスイベントを記録・管理するサブシステム
- **Event_Type**: イベントログに登録可能なイベント種別（キャンペーン開始・システムリリース・障害・メール配信・料金変更・規約変更・その他）
- **Event_Tag**: イベントを分類するためのタグ（キャンペーン・障害・システム変更・料金変更・代理店施策・マーケ施策等）。1イベントに複数タグ付与可能
- **Event_Correlation**: 登録されたイベントとチケット数の時系列的な相関を分析する機能
- **Impact_Score**: イベントがチケット数変動に与えた影響度を0〜100%で表すスコア。イベント前後のチケット数変化率・Inquiry_Category別寄与度から自動算出
- **Auto_Report**: AIが週次・月次で自動生成する問い合わせ状況レポート。問い合わせ増減・原因分析・イベント影響・今後予測を含む
- **Alert_Rule**: アラート発火条件（トリガー条件・対象指標・通知先・通知頻度制限）を定義するカスタムルール
- **Action_Suggestion**: AIが異常検知時に提案する具体的な対応アクション（FAQ作成、お知らせ掲載、代理店通知、エスカレーション等）。優先度・推奨理由・実行ステータスを持つ

## 要件

### 要件 1: 集計母集団の定義と表示

**ユーザーストーリー:** CS責任者として、集計対象の定義を明確に把握したい。それにより、数値の信頼性を確認し、正確な意思決定ができる。

#### 受け入れ基準

1. THE Dashboard SHALL Aggregation_Populationの定義（対象条件・除外条件・使用フィールド）をダッシュボード画面上に常時表示する
2. WHEN Ticket_Statusの値が "Z" で始まる場合、THE Data_Pipeline SHALL 当該Ticketを集計母集団から除外する
3. WHEN Ticket_Statusの値が "Z :" で始まる場合、THE Data_Pipeline SHALL 当該Ticketを集計母集団から除外する
4. THE Data_Pipeline SHALL 集計対象として作成日時、Inquiry_Category、Ticket_Status、チケット番号の4フィールドを使用する
5. WHEN 除外条件に該当するTicketが存在する場合、THE Dashboard SHALL 除外件数を集計母集団の定義表示に併記する

### 要件 2: 日別チケットサマリー

**ユーザーストーリー:** CS責任者として、当日のチケット状況を1秒で把握したい。それにより、異常の有無を即座に判断できる。

#### 受け入れ基準

1. THE Dashboard SHALL 当日のチケット合計件数を画面上部に表示する
2. THE Dashboard SHALL 前日比（件数差および増減率）を当日合計の隣に表示する
3. THE Dashboard SHALL 直近7日間の1日あたり平均件数を表示する
4. THE Dashboard SHALL 直近30日間の1日あたり平均件数を表示する
5. WHEN 前日比が増加の場合、THE Dashboard SHALL 増加を示す上向き矢印と赤系の色で表示する
6. WHEN 前日比が減少の場合、THE Dashboard SHALL 減少を示す下向き矢印と緑系の色で表示する
7. WHEN 前日比が変化なしの場合、THE Dashboard SHALL 横ばいを示す横向き矢印とグレー系の色で表示する

### 要件 3: お問い合わせ項目別分析（当日）

**ユーザーストーリー:** CS責任者として、当日どの問い合わせ項目が多いかを5秒で把握したい。それにより、対応リソースの優先配分を判断できる。

#### 受け入れ基準

1. THE Dashboard SHALL 当日のInquiry_Category別の件数を表示する
2. THE Dashboard SHALL 当日のInquiry_Category別の割合（当日合計に対するパーセンテージ）を表示する
3. THE Dashboard SHALL Inquiry_Category別の前日差（件数差）を表示する
4. THE Dashboard SHALL Inquiry_Category別の前週同曜日差（件数差）を表示する
5. THE Dashboard SHALL Inquiry_Categoryを件数の多い順にランキング形式で表示する
6. WHEN Inquiry_Categoryの種類が6件を超える場合、THE Dashboard SHALL 上位5項目を個別表示し、残りを「その他」として集約表示する
7. WHEN 前日差または前週同曜日差が増加の場合、THE Dashboard SHALL 増加バッジ（赤系の色・上向き矢印）を該当項目に付与する
8. WHEN 前日差または前週同曜日差が減少の場合、THE Dashboard SHALL 減少バッジ（緑系の色・下向き矢印）を該当項目に付与する

### 要件 4: 一覧ビュー（日別×項目別マトリクス）

**ユーザーストーリー:** CS責任者として、過去の日別推移を項目別に一覧で確認したい。それにより、増加傾向にある項目を早期に発見できる。

#### 受け入れ基準

1. THE Dashboard SHALL 日付ごとのチケット合計件数を一覧テーブルで表示する
2. THE Dashboard SHALL 各日付のInquiry_Category別の件数と割合を一覧テーブルに表示する
3. WHEN ある日のInquiry_Category件数が前日より増加している場合、THE Dashboard SHALL 該当セルに増加を示す差分表示（バッジ・色・矢印のいずれか）を付与する
4. WHEN ある日のInquiry_Category件数が前日より減少している場合、THE Dashboard SHALL 該当セルに減少を示す差分表示（バッジ・色・矢印のいずれか）を付与する
5. THE Dashboard SHALL 一覧テーブルのヘッダー行にInquiry_Categoryの列名を表示し、列ごとにソート可能にする
6. THE Dashboard SHALL 一覧テーブルを日付の降順（最新日が上）で初期表示する

### 要件 5: 時間帯分析

**ユーザーストーリー:** CS責任者として、問い合わせが集中する時間帯を把握したい。それにより、シフト配置やリソース計画を最適化できる。

#### 受け入れ基準

1. THE Dashboard SHALL 選択された期間の時間別（0時〜23時）チケット件数を棒グラフで表示する
2. THE Dashboard SHALL 曜日（月〜日）×時間帯（0時〜23時）のチケット件数をHeatmapで表示する
3. THE Heatmap SHALL 件数の多寡を色の濃淡（薄い色＝少ない、濃い色＝多い）で表現する
4. WHEN Heatmapのセルにマウスオーバーした場合、THE Dashboard SHALL 該当セルの曜日・時間帯・件数をツールチップで表示する
5. THE Dashboard SHALL Heatmapの色スケールの凡例を表示する

### 要件 6: 期間フィルタ

**ユーザーストーリー:** CS責任者として、任意の期間でデータを絞り込みたい。それにより、特定期間の傾向を分析できる。

#### 受け入れ基準

1. THE Dashboard SHALL 開始日と終了日を指定できる日付範囲フィルタを提供する
2. THE Dashboard SHALL 「今日」「昨日」「今週」「先週」「今月」「先月」のクイック選択ボタンを提供する
3. WHEN クイック選択ボタンが押された場合、THE Dashboard SHALL 対応する日付範囲を自動設定し、画面全体のデータを再描画する
4. WHEN 日付範囲フィルタが変更された場合、THE Dashboard SHALL 全ての表示コンポーネント（サマリー・項目別分析・一覧ビュー・時間帯分析）のデータを選択期間に基づいて再描画する
5. THE Dashboard SHALL 初期表示時に「今日」を期間フィルタのデフォルト値として設定する

### 要件 7: 異常検知（閾値方式）

**ユーザーストーリー:** CS責任者として、チケット数が異常に多い場合に自動で気づきたい。それにより、問題の早期発見と迅速な対応ができる。

#### 受け入れ基準

1. THE Anomaly_Detector SHALL Inquiry_Category別のチケット件数に対してThreshold_Detectionを実行する
2. THE Anomaly_Detector SHALL チケット合計件数に対してThreshold_Detectionを実行する
3. WHEN Inquiry_Category別または合計のチケット件数が設定された固定しきい値を超えた場合、THE Anomaly_Detector SHALL 異常イベントを発行する
4. THE Dashboard SHALL 管理画面からInquiry_Category別および合計の固定しきい値を設定・変更できるインターフェースを提供する
5. WHEN 異常イベントが発行された場合、THE Dashboard SHALL 該当指標を赤色のハイライトと異常バッジで強調表示する

### 要件 8: 異常検知（トレンドベース方式）

**ユーザーストーリー:** CS責任者として、通常のパターンから逸脱した変動を自動検知したい。それにより、固定しきい値では捉えられない異常にも対応できる。

#### 受け入れ基準

1. THE Anomaly_Detector SHALL Inquiry_Category別のチケット件数に対してTrend_Detectionを実行する
2. THE Anomaly_Detector SHALL チケット合計件数に対してTrend_Detectionを実行する
3. THE Trend_Detection SHALL 直近N日間（設定可能、デフォルト14日）の移動平均を基準値として算出する
4. THE Trend_Detection SHALL 曜日性を考慮し、同一曜日の過去データに基づく曜日別移動平均も基準値として算出する
5. WHEN チケット件数が移動平均から設定された標準偏差倍数（デフォルト2σ）以上乖離した場合、THE Anomaly_Detector SHALL 異常イベントを発行する
6. THE Dashboard SHALL 管理画面から移動平均の期間（N日）および標準偏差倍数を設定・変更できるインターフェースを提供する
7. WHEN 異常イベントが発行された場合、THE Dashboard SHALL 該当指標を赤色のハイライトと異常バッジで強調表示する

### 要件 9: 通知配信

**ユーザーストーリー:** CS責任者として、異常検知時に即座に通知を受け取りたい。それにより、ダッシュボードを常時監視しなくても問題に気づける。

#### 受け入れ基準

1. THE Notification_Dispatcher SHALL Slack・メール・Chatworkの3チャネルへの通知送信に対応する
2. THE Dashboard SHALL 通知ルール（送信先チャネル・送信先アドレス/チャンネル・トリガー条件）を管理画面から設定できるインターフェースを提供する
3. WHEN 異常イベントが発行された場合、THE Notification_Dispatcher SHALL 設定された通知ルールに基づき該当チャネルへ通知を送信する
4. THE Notification_Dispatcher SHALL 通知メッセージに異常が検知された指標名と検知値を含める
5. THE Notification_Dispatcher SHALL 通知メッセージに該当指標の平均値と平均との差分を含める
6. THE Notification_Dispatcher SHALL 通知メッセージに件数が多いInquiry_Categoryの上位3項目と各割合を含める
7. THE Notification_Dispatcher SHALL 通知メッセージに代表Ticket番号を最大5件含める
8. THE Notification_Dispatcher SHALL 通知メッセージ内の各代表Ticket番号にZendeskチケット画面へのリンクURLを付与する
9. THE Notification_Dispatcher SHALL 通知メッセージにAI_Analyzerが生成した推定原因の要約を含める
10. IF 通知送信に失敗した場合、THEN THE Notification_Dispatcher SHALL 送信失敗をログに記録し、設定された再試行回数（デフォルト3回）まで再送を試みる

### 要件 10: AI原因分析

**ユーザーストーリー:** CS責任者として、異常の原因を分析に行かなくても把握したい。それにより、即座にアクション判断ができる。

#### 受け入れ基準

1. WHEN 異常イベントが発行された場合、THE AI_Analyzer SHALL 異常が検知された日または時間帯に増加したTicket群を抽出する
2. THE AI_Analyzer SHALL 増加の内訳（どのInquiry_Categoryが寄与したか）を件数と割合で生成する
3. THE AI_Analyzer SHALL 抽出されたTicket群の顧客文面から共通パターンを要約する
4. THE AI_Analyzer SHALL 推定原因仮説を最大3つ生成する
5. THE AI_Analyzer SHALL 各推定原因仮説に根拠となる数値（件数・割合・増加率）を添える
6. THE AI_Analyzer SHALL 目視確認用の代表Ticket IDを最大5件選出する
7. THE AI_Analyzer SHALL 分析結果を「短く、断定しすぎず、根拠の数字を添えた」文章形式で出力する
8. THE AI_Analyzer SHALL Event_Logに登録済みイベントが存在する場合、イベントとの相関分析結果を原因仮説に統合する
9. THE Dashboard SHALL AI_Analyzerの分析結果を異常検知の詳細画面に表示する
10. WHEN AI_Analyzerの分析処理が30秒以内に完了しない場合、THE Dashboard SHALL 「分析中」のローディング表示を行い、完了後に結果を自動更新する

### 要件 11: イベントログ管理

**ユーザーストーリー:** CS責任者として、キャンペーンやリリース等のビジネスイベントを記録し、チケット数の変動との関連を把握したい。それにより、チケット増加の外的要因を即座に特定できる。

#### 受け入れ基準

1. THE Dashboard SHALL Event_Logの登録画面を提供し、イベント名・Event_Type・発生日時・説明を入力できるインターフェースを提供する
2. THE Dashboard SHALL Event_Typeとして「キャンペーン開始」「システムリリース」「障害」「メール配信」「料金変更」「規約変更」「その他」の7種別を選択可能にする
3. THE Dashboard SHALL 登録済みイベントの一覧表示・編集・削除機能を提供する
4. THE Dashboard SHALL 時系列チケット数グラフ上に登録済みイベントをマーカー（縦線・アイコン）として重畳表示する
5. THE Dashboard SHALL イベントマーカーにマウスオーバーした場合、イベント名・Event_Type・発生日時・説明をツールチップで表示する
6. THE Dashboard SHALL Event_Typeごとに異なる色またはアイコンでマーカーを区別表示する
7. THE Dashboard SHALL イベント前後のチケット数の変化（イベント前N日平均 vs イベント後N日平均）を数値で表示する
8. THE Dashboard SHALL イベント登録時にEvent_Tagを1つ以上付与できるインターフェースを提供する
9. THE Dashboard SHALL Event_Tagとして「キャンペーン」「障害」「システム変更」「料金変更」「代理店施策」「マーケ施策」を既定値として提供し、カスタムタグの追加も可能にする
10. THE Dashboard SHALL イベント一覧画面をEvent_Tag・Event_Type・期間でフィルタリング可能にする
11. THE Dashboard SHALL イベントごとに詳細メモ（自由記述テキスト）を保存できるフィールドを提供する
12. THE Dashboard SHALL イベントごとにURL・資料リンクを複数件保存できるフィールドを提供する
13. THE Dashboard SHALL イベント一覧画面で過去イベントを時系列順に一覧表示し、各イベントのImpact_Score・Event_Tag・メモ有無を併記する

### 要件 12: イベント影響度分析

**ユーザーストーリー:** CS責任者として、各イベントがチケット数にどの程度影響したかを定量的に把握したい。それにより、今後の施策判断やリスク評価に活用できる。

#### 受け入れ基準

1. THE AI_Analyzer SHALL 各イベントに対してImpact_Scoreを自動算出する
2. THE AI_Analyzer SHALL Impact_Scoreの算出にイベント前3日間の平均チケット数とイベント後3日間の平均チケット数の変化率を使用する
3. THE AI_Analyzer SHALL Impact_Scoreの算出にイベント後に増加したInquiry_Categoryの寄与度を加味する
4. THE Dashboard SHALL 各イベントのImpact_Scoreをイベント一覧画面およびイベント詳細画面に表示する
5. THE Dashboard SHALL Impact_Scoreを0〜100%のスケールでプログレスバーまたはゲージで視覚表示する
6. THE Dashboard SHALL イベント前3日間とイベント後3日間のチケット数を日別に比較表示する
7. THE Dashboard SHALL イベント前後比較にInquiry_Category別の件数変化を含める

### 要件 13: 複数イベント重複分析

**ユーザーストーリー:** CS責任者として、同時期に複数イベントが重なった場合にどのイベントの影響が大きいかを判定したい。それにより、正確な原因特定ができる。

#### 受け入れ基準

1. WHEN 同一期間（前後3日が重複）に複数のイベントが登録されている場合、THE AI_Analyzer SHALL 各イベントの個別Impact_Scoreと相対的寄与度を算出する
2. THE AI_Analyzer SHALL 複数イベント重複時に、各イベントがチケット増加に寄与した割合を推定し、寄与度の高い順にランキング表示する
3. THE AI_Analyzer SHALL 重複イベント分析において、各イベントのEvent_Typeおよび過去の同種イベントの影響パターンを考慮する
4. THE Dashboard SHALL 複数イベント重複期間を時系列グラフ上でハイライト表示する
5. THE Dashboard SHALL 重複イベント分析の結果を「イベントA：寄与度XX%、イベントB：寄与度YY%」の形式で表示する

### 要件 14: AI自動イベント提案

**ユーザーストーリー:** CS責任者として、異常検知時にイベント登録の漏れを防ぎたい。それにより、イベントログの網羅性を高め、将来の分析精度を向上できる。

#### 受け入れ基準

1. WHEN 異常イベントが発行され、かつ該当期間に登録済みイベントが存在しない場合、THE AI_Analyzer SHALL 「この期間にイベントを登録しますか？」という提案をダッシュボード上に表示する
2. THE AI_Analyzer SHALL 提案時にチケット内容の分析結果に基づき、推定されるEvent_Typeを候補として提示する
3. THE Dashboard SHALL AI提案からワンクリックでイベント登録画面に遷移し、推定Event_Type・推定日時が自動入力された状態で表示する
4. THE Dashboard SHALL AI提案を「登録する」「後で確認」「無視する」の3択で応答できるインターフェースを提供する
5. WHEN 「無視する」が選択された場合、THE Dashboard SHALL 同一異常イベントに対する再提案を抑制する

### 要件 15: イベントと問い合わせ項目の相関分析

**ユーザーストーリー:** CS責任者として、特定のイベントがどの問い合わせ項目の増加を引き起こしたかを把握したい。それにより、イベント種別ごとの影響パターンを学習し、事前対策に活かせる。

#### 受け入れ基準

1. THE AI_Analyzer SHALL 各イベントについて、イベント後に増加したInquiry_Categoryを特定し、増加件数・増加率を算出する
2. THE AI_Analyzer SHALL イベントとInquiry_Categoryの相関を「イベントX → Inquiry_Category Y が Z% 増加」の形式で出力する
3. THE Dashboard SHALL イベント詳細画面にInquiry_Category別の影響分析結果をランキング形式で表示する
4. THE AI_Analyzer SHALL 過去の同種Event_Typeのイベントにおける影響パターン（どのInquiry_Categoryが増えやすいか）を学習し、傾向として提示する
5. THE Dashboard SHALL イベント相関分析の結果を異常検知の詳細画面にイベントタイムライン付きで表示する
6. WHEN 登録済みイベントが存在しない期間に異常が検知された場合、THE AI_Analyzer SHALL 「該当期間に登録済みイベントなし」と明示し、他の分析結果のみを提示する

### 要件 16: データ取得パイプライン

**ユーザーストーリー:** CS責任者として、最新のデータに基づいた分析結果を確認したい。それにより、リアルタイムに近い状況把握ができる。

#### 受け入れ基準

1. THE Data_Pipeline SHALL 日次バッチ処理で全Aggregation_Populationの集計を実行する
2. THE Data_Pipeline SHALL 準リアルタイム更新（15分間隔以内）でIncremental_Fetchを実行する
3. THE Data_Pipeline SHALL Incremental_Fetchにおいて前回取得時刻以降に更新されたTicketのみを取得する
4. THE Data_Pipeline SHALL Zendesk APIのレート制限（1分あたりのリクエスト数上限）を監視し、上限の80%に達した場合にリクエスト間隔を自動調整する
5. IF Zendesk APIからのデータ取得に失敗した場合、THEN THE Data_Pipeline SHALL エラーをログに記録し、指数バックオフ方式で最大5回まで再試行する
6. THE Data_Pipeline SHALL 取得したデータの最終更新日時をダッシュボード画面上に表示する
7. WHEN Zendesk監査ログまたはイベントデータが利用可能な場合、THE Data_Pipeline SHALL チケットの状態変更履歴を取得し、原因追跡用データとして蓄積する

### 要件 17: Zendeskデータ範囲の調査と定義

**ユーザーストーリー:** 開発者として、Zendeskから取得可能なデータ範囲を明確にしたい。それにより、ダッシュボードの機能設計に必要なデータソースを確定できる。

#### 受け入れ基準

1. THE Data_Pipeline SHALL Zendesk REST API（Tickets API・Search API・Incremental Exports API）からチケットデータを取得する
2. THE Data_Pipeline SHALL Zendesk APIから取得するフィールドとして、作成日時・更新日時・Inquiry_Category・Ticket_Status・チケット番号・件名・説明文を含める
3. THE Data_Pipeline SHALL Zendesk Explore APIが利用可能な場合、既存レポートデータを補助データソースとして取得する
4. THE Data_Pipeline SHALL Zendesk監査ログAPIが利用可能な場合、チケットのフィールド変更履歴を取得する
5. THE Dashboard SHALL 使用しているデータソース（API種別）と各データソースの取得ステータスを管理画面に表示する

### 要件 18: イベントナレッジ学習と予測提案

**ユーザーストーリー:** CS責任者として、過去のイベント経験をAIに学習させ、類似イベント発生前に問い合わせ増加の予測と事前対策の提案を受けたい。それにより、プロアクティブなCS体制を構築できる。

#### 受け入れ基準

1. THE AI_Analyzer SHALL 過去のイベントに紐づくメモ・Impact_Score・Inquiry_Category別影響データをナレッジとして蓄積・学習する
2. THE AI_Analyzer SHALL 新規イベント登録時に、過去の同種Event_Typeまたは類似Event_Tagのイベント履歴を検索し、過去の影響パターンを提示する
3. THE AI_Analyzer SHALL 過去の類似イベントに基づき、予想されるチケット増加数・増加が見込まれるInquiry_Categoryを予測として提示する
4. THE AI_Analyzer SHALL 予測提案を「去年の同種イベント時は問い合わせがX%増加（主にInquiry_Category Y）」の形式で、根拠となる過去データを添えて出力する
5. THE Dashboard SHALL 新規イベント登録画面に「過去の類似イベント」セクションを表示し、過去イベントのメモ・Impact_Score・影響Inquiry_Categoryを一覧表示する
6. THE Dashboard SHALL イベント登録前の予測提案をアラートバナーとして表示し、「詳細を見る」で過去イベントの詳細に遷移可能にする
7. THE AI_Analyzer SHALL 学習データが不足する場合（同種イベントが2件未満）、予測の信頼度が低い旨を明示し、参考情報として提示する

### 要件 19: 自動レポート生成・配信

**ユーザーストーリー:** CS責任者として、定期的な問い合わせ状況レポートを自動で受け取りたい。それにより、手動集計の手間を省き、チーム全体の状況共有を効率化できる。

#### 受け入れ基準

1. THE AI_Analyzer SHALL 週次（毎週月曜）および月次（毎月1日）に自動レポートを生成する
2. THE AI_Analyzer SHALL 自動レポートに対象期間のチケット合計件数・前期間比（増減数・増減率）を含める
3. THE AI_Analyzer SHALL 自動レポートにInquiry_Category別の件数推移と増減が顕著な項目のハイライトを含める
4. THE AI_Analyzer SHALL 自動レポートに対象期間中に発行された異常イベントの一覧と各原因分析の要約を含める
5. THE AI_Analyzer SHALL 自動レポートに対象期間中のイベントログとそのImpact_Scoreの一覧を含める
6. THE AI_Analyzer SHALL 自動レポートに今後1週間の問い合わせ数予測（トレンド・曜日性・登録済みイベントを考慮）を含める
7. THE AI_Analyzer SHALL 自動レポートの文章を「短く、根拠の数字を添えた」形式で生成する
8. THE Notification_Dispatcher SHALL 自動レポートをSlack・Chatwork・メールの設定済みチャネルへ配信する
9. THE Dashboard SHALL 管理画面からレポートの生成スケジュール（週次・月次・カスタム）と配信先チャネルを設定できるインターフェースを提供する
10. THE Dashboard SHALL 過去に生成された自動レポートの履歴を一覧表示し、各レポートの閲覧・再送信を可能にする
11. THE Dashboard SHALL 任意のタイミングで手動レポート生成をトリガーできるボタンを提供する

### 要件 20: カスタムアラートルール

**ユーザーストーリー:** CS責任者として、問い合わせ急増・特定カテゴリ急増などの具体的なアラート条件を柔軟に設定し、即座に通知を受け取りたい。それにより、状況に応じた迅速な対応体制を構築できる。

#### 受け入れ基準

1. THE Dashboard SHALL アラートルールの作成画面を提供し、以下のトリガー条件を組み合わせて設定できるインターフェースを提供する：チケット合計の急増、特定Inquiry_Categoryの急増、特定時間帯の急増
2. THE Anomaly_Detector SHALL アラートルールごとに「急増」の定義を設定可能にする（例：前日比150%以上、移動平均の2σ超過、固定件数超過）
3. THE Anomaly_Detector SHALL 特定のInquiry_Categoryを指定したアラートルールに対して、当該カテゴリの件数変動を個別に監視する
4. THE Dashboard SHALL アラートルールごとに通知先チャネル（Slack・Chatwork・メール）と送信先を個別に設定できるインターフェースを提供する
5. THE Dashboard SHALL アラートルールごとに有効・無効の切り替え、通知頻度の制限（例：同一ルールで1時間以内の再通知を抑制）を設定できるインターフェースを提供する
6. THE Notification_Dispatcher SHALL アラート発火時の通知メッセージに、どのルールが発火したか（ルール名・条件）、検知値、基準値との差分を含める
7. THE Notification_Dispatcher SHALL アラート通知に該当する代表チケット番号（最大5件）とZendeskリンクを含める
8. THE Dashboard SHALL アラート発火履歴を一覧表示し、各アラートの発火日時・ルール名・検知値・対応ステータス（未対応・対応中・対応済み）を管理できるインターフェースを提供する
9. THE Dashboard SHALL アラート発火時にダッシュボード画面上部にリアルタイムバナー通知を表示する
10. THE Dashboard SHALL アラートルールのテンプレート（「問い合わせ急増」「特定カテゴリ急増」「異常検知」）をプリセットとして提供し、ワンクリックで作成できるインターフェースを提供する

### 要件 21: AIアクション提案

**ユーザーストーリー:** CS責任者として、異常検知や問い合わせ急増時にAIから具体的な対応アクションの提案を受けたい。それにより、分析結果を見てから「次に何をすべきか」を考える時間を省き、即座にアクションに移れる。

#### 受け入れ基準

1. WHEN 異常イベントが発行された場合、THE AI_Analyzer SHALL 検知された異常の内容・Inquiry_Category・チケット文面を分析し、具体的な対応アクションを最大5件提案する
2. THE AI_Analyzer SHALL 提案するアクションの種別として以下を含む：FAQ作成・更新の推奨、お知らせ・告知の掲載推奨、代理店・パートナーへの通知推奨、社内エスカレーション推奨、テンプレート回答の作成推奨、システム調査の推奨
3. THE AI_Analyzer SHALL 各アクション提案に優先度（高・中・低）と推奨理由（根拠となる数値・チケット内容の要約）を添える
4. THE AI_Analyzer SHALL 過去の類似異常時に実行されたアクションの履歴を参照し、効果があったアクションを優先的に提案する
5. THE Dashboard SHALL AI提案アクションを異常検知の詳細画面にカード形式で表示し、各アクションに「実行する」「後で対応」「不要」の3択で応答できるインターフェースを提供する
6. THE Dashboard SHALL 「実行する」が選択されたアクションの対応ステータス（未着手・対応中・完了）を管理できるインターフェースを提供する
7. THE Dashboard SHALL アクション提案への応答履歴（どのアクションを実行し、どの程度効果があったか）を蓄積し、AI_Analyzerの将来の提案精度向上に活用する
8. THE Notification_Dispatcher SHALL 異常検知通知メッセージにAI提案アクションの上位3件を含める
9. THE AI_Analyzer SHALL アクション提案を「短く、具体的で、すぐ実行可能な」文章形式で出力する（例：「FAQ『○○の手続き方法』を更新してください — 関連問い合わせが前日比+45%」）
10. THE Dashboard SHALL アクション提案の実行効果（アクション実行後のチケット数変化）を追跡し、効果レポートとして表示する
