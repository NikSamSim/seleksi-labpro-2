import { sql } from "drizzle-orm";
import {
    index,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar
} from "drizzle-orm/pg-core";

export const localSessions = pgTable(
    "local_sessions",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        sessionTokenHash: varchar("session_token_hash", { length: 64 }).notNull(),
        externalUserId: uuid("external_user_id").notNull(),
        centralSessionId: uuid("central_session_id").notNull(),
        status: varchar("status", { length: 32 }).notNull().default("active"),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
        lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        revokedAt: timestamp("revoked_at", { withTimezone: true }),
        revokeReason: text("revoke_reason")
    },
    (table) => [
        uniqueIndex("local_sessions_session_token_hash_unique").on(table.sessionTokenHash),
        index("local_sessions_external_user_id_idx").on(table.externalUserId),
        index("local_sessions_central_session_id_idx").on(table.centralSessionId),
        index("local_sessions_status_idx").on(table.status)
    ]
);

export const profileCache = pgTable("profile_cache", {
    externalUserId: uuid("external_user_id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    groups: jsonb("groups").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const processedEvents = pgTable(
    "processed_events",
    {
        eventId: uuid("event_id").primaryKey(),
        eventType: varchar("event_type", { length: 64 }).notNull(),
        processedAt: timestamp("processed_at", { withTimezone: true }).defaultNow().notNull(),
        result: varchar("result", { length: 32 }).notNull(),
        action: text("action").notNull()
    },
    (table) => [
        index("processed_events_processed_at_idx").on(table.processedAt)
    ]
);

export const activityLogs = pgTable(
    "activity_logs",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        eventType: varchar("event_type", { length: 64 }).notNull(),
        message: text("message").notNull(),
        externalUserId: uuid("external_user_id"),
        requestId: varchar("request_id", { length: 255 }),
        metadata: jsonb("metadata")
            .$type<Record<string, unknown>>()
            .notNull()
            .default(sql`'{}'::jsonb`),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
    },
    (table) => [
        index("activity_logs_external_user_id_idx").on(table.externalUserId),
        index("activity_logs_created_at_idx").on(table.createdAt)
    ]
);

export const oauthTransactions = pgTable(
    "oauth_transactions",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        stateHash: varchar("state_hash", { length: 64 }).notNull(),
        codeVerifier: varchar("code_verifier", { length: 128 }).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
    },
    (table) => [
        uniqueIndex("oauth_transactions_state_hash_unique").on(table.stateHash),
        index("oauth_transactions_expires_at_idx").on(table.expiresAt)
    ]
);