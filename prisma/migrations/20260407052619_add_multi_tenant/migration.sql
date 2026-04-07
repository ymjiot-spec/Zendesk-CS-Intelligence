-- CreateTable
CREATE TABLE "tickets" (
    "id" BIGSERIAL NOT NULL,
    "source_key" VARCHAR(50) NOT NULL DEFAULT 'default',
    "zendesk_ticket_id" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "inquiry_category" VARCHAR(255) NOT NULL,
    "ticket_status" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(1000) NOT NULL,
    "description" TEXT NOT NULL,
    "is_excluded" BOOLEAN NOT NULL DEFAULT false,
    "fetched_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_aggregations" (
    "id" BIGSERIAL NOT NULL,
    "source_key" VARCHAR(50) NOT NULL DEFAULT 'ALL',
    "aggregation_date" DATE NOT NULL,
    "total_count" INTEGER NOT NULL,
    "excluded_count" INTEGER NOT NULL,
    "avg_7days" DOUBLE PRECISION NOT NULL,
    "avg_30days" DOUBLE PRECISION NOT NULL,
    "computed_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "daily_aggregations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_aggregations" (
    "id" BIGSERIAL NOT NULL,
    "source_key" VARCHAR(50) NOT NULL DEFAULT 'ALL',
    "aggregation_date" DATE NOT NULL,
    "inquiry_category" VARCHAR(255) NOT NULL,
    "count" INTEGER NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "prev_day_diff" INTEGER NOT NULL,
    "prev_week_same_day_diff" INTEGER NOT NULL,
    "computed_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "category_aggregations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hourly_aggregations" (
    "id" BIGSERIAL NOT NULL,
    "source_key" VARCHAR(50) NOT NULL DEFAULT 'ALL',
    "aggregation_date" DATE NOT NULL,
    "hour" SMALLINT NOT NULL,
    "day_of_week" SMALLINT NOT NULL,
    "count" INTEGER NOT NULL,
    "computed_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "hourly_aggregations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anomaly_events" (
    "id" UUID NOT NULL,
    "detected_at" TIMESTAMPTZ NOT NULL,
    "detection_type" VARCHAR(50) NOT NULL,
    "metric" VARCHAR(255) NOT NULL,
    "current_value" DOUBLE PRECISION NOT NULL,
    "baseline_value" DOUBLE PRECISION NOT NULL,
    "deviation" DOUBLE PRECISION NOT NULL,
    "severity" VARCHAR(50) NOT NULL,
    "is_acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anomaly_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_analyses" (
    "id" UUID NOT NULL,
    "anomaly_event_id" UUID NOT NULL,
    "category_breakdown" JSONB NOT NULL,
    "common_patterns" TEXT NOT NULL,
    "hypotheses" JSONB NOT NULL,
    "representative_ticket_ids" JSONB NOT NULL,
    "event_correlation" JSONB NOT NULL,
    "generated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_logs" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "description" TEXT NOT NULL,
    "memo" TEXT,
    "urls" JSONB NOT NULL DEFAULT '[]',
    "tags" JSONB NOT NULL DEFAULT '[]',
    "impact_score" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_tags" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_rules" (
    "id" UUID NOT NULL,
    "channel" VARCHAR(50) NOT NULL,
    "destination" VARCHAR(500) NOT NULL,
    "trigger_conditions" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" UUID NOT NULL,
    "notification_rule_id" UUID NOT NULL,
    "anomaly_event_id" UUID NOT NULL,
    "channel" VARCHAR(50) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "sent_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anomaly_settings" (
    "id" UUID NOT NULL,
    "thresholds" JSONB NOT NULL,
    "moving_average_days" INTEGER NOT NULL,
    "sigma_multiplier" DOUBLE PRECISION NOT NULL,
    "day_of_week_seasonality" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "anomaly_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auto_reports" (
    "id" UUID NOT NULL,
    "period" VARCHAR(50) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "content" JSONB NOT NULL,
    "narrative_summary" TEXT NOT NULL,
    "generated_at" TIMESTAMPTZ NOT NULL,
    "distributed_at" TIMESTAMPTZ,

    CONSTRAINT "auto_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_settings" (
    "id" UUID NOT NULL,
    "schedule" JSONB NOT NULL,
    "distribution_channels" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "report_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_state" (
    "id" VARCHAR(255) NOT NULL,
    "last_incremental_cursor" BIGINT NOT NULL DEFAULT 0,
    "last_batch_run_at" TIMESTAMPTZ,
    "last_incremental_run_at" TIMESTAMPTZ,
    "data_source_status" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "pipeline_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_event_suggestions" (
    "id" UUID NOT NULL,
    "anomaly_event_id" UUID NOT NULL,
    "suggested_event_type" VARCHAR(50) NOT NULL,
    "suggested_date" TIMESTAMPTZ NOT NULL,
    "reason" TEXT NOT NULL,
    "response_status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_event_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "trigger_type" VARCHAR(50) NOT NULL,
    "conditions" JSONB NOT NULL,
    "target_category" VARCHAR(255),
    "notification_channels" JSONB NOT NULL,
    "cooldown_minutes" INTEGER NOT NULL DEFAULT 60,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_firing_records" (
    "id" UUID NOT NULL,
    "alert_rule_id" UUID NOT NULL,
    "fired_at" TIMESTAMPTZ NOT NULL,
    "detected_value" DOUBLE PRECISION NOT NULL,
    "baseline_value" DOUBLE PRECISION NOT NULL,
    "deviation" DOUBLE PRECISION NOT NULL,
    "representative_ticket_ids" JSONB NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'unresolved',
    "resolved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_firing_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_suggestions" (
    "id" UUID NOT NULL,
    "anomaly_event_id" UUID NOT NULL,
    "action_type" VARCHAR(100) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "priority" VARCHAR(20) NOT NULL,
    "reasoning" TEXT NOT NULL,
    "related_category" VARCHAR(255),
    "response_status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "execution_status" VARCHAR(50) NOT NULL DEFAULT 'not_started',
    "effect_metrics" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "action_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_tickets_source_created_at" ON "tickets"("source_key", "created_at", "is_excluded");

-- CreateIndex
CREATE INDEX "idx_tickets_source_category_created_at" ON "tickets"("source_key", "inquiry_category", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_source_key_zendesk_ticket_id_key" ON "tickets"("source_key", "zendesk_ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_aggregations_source_key_aggregation_date_key" ON "daily_aggregations"("source_key", "aggregation_date");

-- CreateIndex
CREATE UNIQUE INDEX "category_aggregations_source_key_aggregation_date_inquiry_c_key" ON "category_aggregations"("source_key", "aggregation_date", "inquiry_category");

-- CreateIndex
CREATE INDEX "idx_hourly_aggregations_source_date" ON "hourly_aggregations"("source_key", "aggregation_date");

-- CreateIndex
CREATE UNIQUE INDEX "hourly_aggregations_source_key_aggregation_date_hour_key" ON "hourly_aggregations"("source_key", "aggregation_date", "hour");

-- CreateIndex
CREATE INDEX "idx_anomaly_events_detected_at" ON "anomaly_events"("detected_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_analyses_anomaly_event_id_key" ON "ai_analyses"("anomaly_event_id");

-- CreateIndex
CREATE INDEX "idx_event_logs_occurred_at" ON "event_logs"("occurred_at");

-- CreateIndex
CREATE INDEX "idx_event_logs_event_type" ON "event_logs"("event_type");

-- CreateIndex
CREATE UNIQUE INDEX "event_tags_name_key" ON "event_tags"("name");

-- CreateIndex
CREATE INDEX "idx_notification_logs_anomaly_event_id" ON "notification_logs"("anomaly_event_id");

-- CreateIndex
CREATE INDEX "idx_auto_reports_generated_at" ON "auto_reports"("generated_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_event_suggestions_anomaly_event_id_key" ON "ai_event_suggestions"("anomaly_event_id");

-- CreateIndex
CREATE INDEX "idx_alert_firing_records_alert_rule_id" ON "alert_firing_records"("alert_rule_id");

-- CreateIndex
CREATE INDEX "idx_alert_firing_records_fired_at" ON "alert_firing_records"("fired_at");

-- CreateIndex
CREATE INDEX "idx_action_suggestions_anomaly_event_id" ON "action_suggestions"("anomaly_event_id");

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_anomaly_event_id_fkey" FOREIGN KEY ("anomaly_event_id") REFERENCES "anomaly_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_notification_rule_id_fkey" FOREIGN KEY ("notification_rule_id") REFERENCES "notification_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_anomaly_event_id_fkey" FOREIGN KEY ("anomaly_event_id") REFERENCES "anomaly_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_event_suggestions" ADD CONSTRAINT "ai_event_suggestions_anomaly_event_id_fkey" FOREIGN KEY ("anomaly_event_id") REFERENCES "anomaly_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_firing_records" ADD CONSTRAINT "alert_firing_records_alert_rule_id_fkey" FOREIGN KEY ("alert_rule_id") REFERENCES "alert_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_suggestions" ADD CONSTRAINT "action_suggestions_anomaly_event_id_fkey" FOREIGN KEY ("anomaly_event_id") REFERENCES "anomaly_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
