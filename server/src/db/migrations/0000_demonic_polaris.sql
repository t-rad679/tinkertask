CREATE TYPE "public"."device_platform" AS ENUM('ios', 'android');--> statement-breakpoint
CREATE TYPE "public"."task_kind" AS ENUM('task', 'habit');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('open', 'completed', 'archived');--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scope_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"color" text,
	"icon" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "scopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"scope_type_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"color" text,
	"icon" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"scope_id" uuid,
	"title" text NOT NULL,
	"body" text,
	"kind" "task_kind" NOT NULL,
	"status" "task_status" DEFAULT 'open' NOT NULL,
	"due_at" timestamp with time zone,
	"recurrence" jsonb,
	"target_value" integer,
	"target_period" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "tasks_target_coupling" CHECK (("tasks"."target_value" IS NULL) = ("tasks"."target_period" IS NULL)),
	CONSTRAINT "tasks_target_period_enum" CHECK ("tasks"."target_period" IS NULL OR "tasks"."target_period" IN ('day', 'week'))
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"use_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "task_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"task_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"task_id" uuid NOT NULL,
	"completed_on" date NOT NULL,
	"value" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"query" jsonb NOT NULL,
	"icon" text,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "dashboards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text DEFAULT 'Dashboard' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "dashboard_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dashboard_id" uuid NOT NULL,
	"view_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"fcm_token" text NOT NULL,
	"platform" "device_platform" NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_access_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "scope_types" ADD CONSTRAINT "scope_types_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scopes" ADD CONSTRAINT "scopes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scopes" ADD CONSTRAINT "scopes_scope_type_id_scope_types_id_fk" FOREIGN KEY ("scope_type_id") REFERENCES "public"."scope_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scopes" ADD CONSTRAINT "scopes_parent_id_scopes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."scopes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_scope_id_scopes_id_fk" FOREIGN KEY ("scope_id") REFERENCES "public"."scopes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "completions" ADD CONSTRAINT "completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "completions" ADD CONSTRAINT "completions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "views" ADD CONSTRAINT "views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_views" ADD CONSTRAINT "dashboard_views_dashboard_id_dashboards_id_fk" FOREIGN KEY ("dashboard_id") REFERENCES "public"."dashboards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_views" ADD CONSTRAINT "dashboard_views_view_id_views_id_fk" FOREIGN KEY ("view_id") REFERENCES "public"."views"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_access_tokens" ADD CONSTRAINT "personal_access_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "scope_types_user_lower_name_uniq" ON "scope_types" USING btree ("user_id",lower("name")) WHERE "scope_types"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "scope_types_user_position_idx" ON "scope_types" USING btree ("user_id","position") WHERE "scope_types"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "scope_types_user_updated_idx" ON "scope_types" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "scopes_sibling_lower_name_uniq" ON "scopes" USING btree ("user_id","parent_id",lower("name")) WHERE "scopes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "scopes_user_parent_idx" ON "scopes" USING btree ("user_id","parent_id") WHERE "scopes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "scopes_user_type_idx" ON "scopes" USING btree ("user_id","scope_type_id") WHERE "scopes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "scopes_user_updated_idx" ON "scopes" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "tasks_user_updated_idx" ON "tasks" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "tasks_user_scope_idx" ON "tasks" USING btree ("user_id","scope_id") WHERE "tasks"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "tasks_user_kind_idx" ON "tasks" USING btree ("user_id","kind") WHERE "tasks"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "tasks_user_status_idx" ON "tasks" USING btree ("user_id","status") WHERE "tasks"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tags_user_lower_name_uniq" ON "tags" USING btree ("user_id",lower("name")) WHERE "tags"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "tags_user_updated_idx" ON "tags" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "task_tags_pair_uniq" ON "task_tags" USING btree ("task_id","tag_id") WHERE "task_tags"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "task_tags_task_idx" ON "task_tags" USING btree ("task_id") WHERE "task_tags"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "task_tags_tag_idx" ON "task_tags" USING btree ("tag_id") WHERE "task_tags"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "task_tags_user_updated_idx" ON "task_tags" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "completions_user_updated_idx" ON "completions" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "completions_task_date_idx" ON "completions" USING btree ("task_id","completed_on") WHERE "completions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "views_user_updated_idx" ON "views" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "dashboards_user_updated_idx" ON "dashboards" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "dashboard_views_pair_uniq" ON "dashboard_views" USING btree ("dashboard_id","view_id") WHERE "dashboard_views"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "dashboard_views_dashboard_idx" ON "dashboard_views" USING btree ("dashboard_id") WHERE "dashboard_views"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "pats_hash_idx" ON "personal_access_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "pats_user_idx" ON "personal_access_tokens" USING btree ("user_id");