import {
    jsonb,
    pgTable,
    timestamp,
    uuid,
    varchar
} from "drizzle-orm/pg-core";

import { applications } from "./applications.js";
import { ssoSessions } from "./sessions.js";
import { users } from "./users.js";

export const auditLogs = pgTable("audit_logs", {
    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    eventType: varchar("event_type", {
        length: 255
    }).notNull(),

    actorId: uuid("actor_id")
        .references(() => users.id),

    userId: uuid("user_id")
        .references(() => users.id),

    applicationId: uuid("application_id")
        .references(() => applications.id),

    sessionId: uuid("session_id")
        .references(() => ssoSessions.id),

    result: varchar("result", {
        length: 64
    }).notNull(),

    metadata: jsonb("metadata")
        .$type<Record<string, unknown>>(),

    ipAddress: varchar("ip_address", {
        length: 45
    }),

    createdAt: timestamp("created_at", {
        withTimezone: true
    })
        .defaultNow()
        .notNull()
});