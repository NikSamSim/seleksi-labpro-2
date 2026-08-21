ALTER TABLE "sso_sessions" ADD COLUMN "mfa_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sso_sessions" ADD COLUMN "mfa_method" varchar(32);