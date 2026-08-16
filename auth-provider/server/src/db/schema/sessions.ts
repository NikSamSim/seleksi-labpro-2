import {
    pgTable,
    text,
    timestamp,
    uuid,
    varchar
} from "drizzle-orm/pg-core";

import { users } from "./users.js";

export const ssoSessions = pgTable("sso_sessions", {
    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    userId: uuid("user_id")
        .notNull()
        .references(() => users.id),

    sessionTokenHash: varchar("session_token_hash", {
        length: 255
    })
        .notNull()
        .unique(),

    status: varchar("status", {
        length: 32
    })
        .default("active")
        .notNull(),

    createdAt: timestamp("created_at", {
        withTimezone: true
    })
        .defaultNow()
        .notNull(),

    expiresAt: timestamp("expires_at", {
        withTimezone: true
    }).notNull(),

    lastActivityAt: timestamp("last_activity_at", {
        withTimezone: true
    }),

    revokedAt: timestamp("revoked_at", {
        withTimezone: true
    }),

    revokeReason: varchar("revoke_reason", {
        length: 255
    }),

    ipAddress: varchar("ip_address", {
        length: 45
    }),

    userAgent: text("user_agent")
});