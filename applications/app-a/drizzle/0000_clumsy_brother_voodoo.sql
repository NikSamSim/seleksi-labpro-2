CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"message" text NOT NULL,
	"external_user_id" uuid,
	"request_id" varchar(255),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "local_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_token_hash" varchar(64) NOT NULL,
	"external_user_id" uuid NOT NULL,
	"central_session_id" uuid NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoke_reason" text
);
--> statement-breakpoint
CREATE TABLE "oauth_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_hash" varchar(64) NOT NULL,
	"code_verifier" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processed_events" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"result" varchar(32) NOT NULL,
	"action" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_cache" (
	"external_user_id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(320) NOT NULL,
	"groups" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "activity_logs_external_user_id_idx" ON "activity_logs" USING btree ("external_user_id");--> statement-breakpoint
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "local_sessions_session_token_hash_unique" ON "local_sessions" USING btree ("session_token_hash");--> statement-breakpoint
CREATE INDEX "local_sessions_external_user_id_idx" ON "local_sessions" USING btree ("external_user_id");--> statement-breakpoint
CREATE INDEX "local_sessions_central_session_id_idx" ON "local_sessions" USING btree ("central_session_id");--> statement-breakpoint
CREATE INDEX "local_sessions_status_idx" ON "local_sessions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_transactions_state_hash_unique" ON "oauth_transactions" USING btree ("state_hash");--> statement-breakpoint
CREATE INDEX "oauth_transactions_expires_at_idx" ON "oauth_transactions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "processed_events_processed_at_idx" ON "processed_events" USING btree ("processed_at");