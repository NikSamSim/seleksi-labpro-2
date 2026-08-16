import {
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    uuid,
    varchar
} from "drizzle-orm/pg-core";

import { applications } from "./applications.js";
import { ssoSessions } from "./sessions.js";
import { users } from "./users.js";

export const events = pgTable("events", {
    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    eventType: varchar("event_type", {
        length: 255
    }).notNull(),

    userId: uuid("user_id")
        .references(() => users.id),

    centralSessionId: uuid("central_session_id")
        .references(() => ssoSessions.id),

    applicationId: uuid("application_id")
        .references(() => applications.id),

    payload: jsonb("payload")
        .$type<Record<string, unknown>>()
        .notNull(),

    status: varchar("status", {
        length: 32
    })
        .default("pending")
        .notNull(),

    createdAt: timestamp("created_at", {
        withTimezone: true
    })
        .defaultNow()
        .notNull(),

    publishedAt: timestamp("published_at", {
        withTimezone: true
    })
});

export const eventDeliveries = pgTable("event_deliveries", {
    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    eventId: uuid("event_id")
        .notNull()
        .references(() => events.id),

    applicationId: uuid("application_id")
        .notNull()
        .references(() => applications.id),

    status: varchar("status", {
        length: 32
    })
        .default("pending")
        .notNull(),

    attemptCount: integer("attempt_count")
        .default(0)
        .notNull(),

    lastAttemptAt: timestamp("last_attempt_at", {
        withTimezone: true
    }),

    nextRetryAt: timestamp("next_retry_at", {
        withTimezone: true
    }),

    processedAt: timestamp("processed_at", {
        withTimezone: true
    }),

    lastError: text("last_error")
});