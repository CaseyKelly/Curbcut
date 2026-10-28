CREATE TYPE "public"."agent_run_kind" AS ENUM('pipeline', 'agent');--> statement-breakpoint
CREATE TYPE "public"."agent_run_status" AS ENUM('running', 'awaiting_approval', 'ended');--> statement-breakpoint
CREATE TYPE "public"."agent_step_type" AS ENUM('thought', 'tool_call', 'tool_result', 'end');--> statement-breakpoint
CREATE TYPE "public"."impact" AS ENUM('minor', 'moderate', 'serious', 'critical');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."job_type" AS ENUM('scan', 'explain', 'fix', 'rescan');--> statement-breakpoint
CREATE TYPE "public"."run_end_reason" AS ENUM('completed', 'awaiting_approval', 'max_steps', 'cost_cap', 'timeout', 'error');--> statement-breakpoint
CREATE TYPE "public"."scan_status" AS ENUM('queued', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"kind" "agent_run_kind" NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"status" "agent_run_status" DEFAULT 'running' NOT NULL,
	"end_reason" "run_end_reason",
	"steps_used" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 6) DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "agent_runs_end_reason_check" CHECK (("agent_runs"."status" = 'ended') = ("agent_runs"."end_reason" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "agent_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"type" "agent_step_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 6) DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_steps_seq_check" CHECK ("agent_steps"."seq" >= 0)
);
--> statement-breakpoint
CREATE TABLE "explanations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cache_key" text NOT NULL,
	"rule_id" text NOT NULL,
	"body" jsonb NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 6) DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "explanations_cache_key_unique" UNIQUE("cache_key")
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"rule_id" text NOT NULL,
	"impact" "impact" NOT NULL,
	"help" text NOT NULL,
	"help_url" text NOT NULL,
	"wcag" text[] NOT NULL,
	"page_url" text NOT NULL,
	"selector" text NOT NULL,
	"html" text NOT NULL,
	"failure_summary" text,
	"fingerprint" text NOT NULL,
	"group_key" text NOT NULL,
	"priority" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "job_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_attempts_check" CHECK ("jobs"."attempts" >= 0 AND "jobs"."max_attempts" >= 1)
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"targets" text[] NOT NULL,
	"auth_profile_id" uuid,
	"repo_id" uuid,
	"parent_scan_id" uuid,
	"status" "scan_status" DEFAULT 'queued' NOT NULL,
	"error" text,
	"axe_version" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 6) DEFAULT 0 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "scans_targets_not_empty" CHECK (cardinality("scans"."targets") >= 1)
);
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_steps" ADD CONSTRAINT "agent_steps_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_parent_scan_id_scans_id_fk" FOREIGN KEY ("parent_scan_id") REFERENCES "public"."scans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_runs_scan_id_idx" ON "agent_runs" USING btree ("scan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_steps_run_seq_idx" ON "agent_steps" USING btree ("run_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "issues_scan_page_fingerprint_idx" ON "issues" USING btree ("scan_id","page_url","fingerprint");--> statement-breakpoint
CREATE INDEX "issues_fingerprint_idx" ON "issues" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "issues_scan_group_idx" ON "issues" USING btree ("scan_id","group_key");--> statement-breakpoint
CREATE INDEX "jobs_claim_idx" ON "jobs" USING btree ("run_at") WHERE "jobs"."status" = 'queued';--> statement-breakpoint
CREATE INDEX "jobs_stale_idx" ON "jobs" USING btree ("locked_at") WHERE "jobs"."status" = 'running';--> statement-breakpoint
CREATE INDEX "scans_created_at_idx" ON "scans" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "scans_parent_scan_id_idx" ON "scans" USING btree ("parent_scan_id");