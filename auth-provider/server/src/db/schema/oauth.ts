import {
    pgTable,
    text,
    timestamp,
    uuid,
    varchar
} from "drizzle-orm/pg-core";

import { applications } from "./applications.js";
import { ssoSessions } from "./sessions.js";
import { users } from "./users.js";

export const authorizationCodes = pgTable("authorization_codes", {
    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    codeHash: varchar("code_hash", {
        length: 255
    })
        .notNull()
        .unique(),

    userId: uuid("user_id")
        .notNull()
        .references(() => users.id),

    applicationId: uuid("application_id")
        .notNull()
        .references(() => applications.id),

    ssoSessionId: uuid("sso_session_id")
        .notNull()
        .references(() => ssoSessions.id),

    redirectUri: text("redirect_uri")
        .notNull(),

    codeChallenge: varchar("code_challenge", {
        length: 255
    }).notNull(),

    codeChallengeMethod: varchar("code_challenge_method", {
        length: 32
    })
        .default("S256")
        .notNull(),

    createdAt: timestamp("created_at", {
        withTimezone: true
    })
        .defaultNow()
        .notNull(),

    expiresAt: timestamp("expires_at", {
        withTimezone: true
    }).notNull(),

    usedAt: timestamp("used_at", {
        withTimezone: true
    })
});

export const accessTokens = pgTable("access_tokens", {
    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    tokenHash: varchar("token_hash", {
        length: 255
    })
        .notNull()
        .unique(),

    userId: uuid("user_id")
        .notNull()
        .references(() => users.id),

    applicationId: uuid("application_id")
        .notNull()
        .references(() => applications.id),

    ssoSessionId: uuid("sso_session_id")
        .notNull()
        .references(() => ssoSessions.id),

    scopes: text("scopes"),

    status: varchar("status", {
        length: 32
    })
        .default("active")
        .notNull(),

    issuedAt: timestamp("issued_at", {
        withTimezone: true
    })
        .defaultNow()
        .notNull(),

    expiresAt: timestamp("expires_at", {
        withTimezone: true
    }).notNull(),

    revokedAt: timestamp("revoked_at", {
        withTimezone: true
    })
});