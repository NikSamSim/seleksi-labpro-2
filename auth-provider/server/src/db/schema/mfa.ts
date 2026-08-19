import {
    index,
    integer,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar
} from "drizzle-orm/pg-core";

import { users } from "./users.js";

export const userMfaMethods = pgTable(
    "user_mfa_methods",
    {
        id: uuid("id")
            .defaultRandom()
            .primaryKey(),

        userId: uuid("user_id")
            .notNull()
            .references(() => users.id),

        type: varchar("type", {
            length: 32
        })
            .default("totp")
            .notNull(),

        secretCiphertext: text("secret_ciphertext")
            .notNull(),

        secretIv: text("secret_iv")
            .notNull(),

        secretAuthTag: text("secret_auth_tag")
            .notNull(),

        enabledAt: timestamp("enabled_at", {
            withTimezone: true
        }),

        createdAt: timestamp("created_at", {
            withTimezone: true
        })
            .defaultNow()
            .notNull(),

        updatedAt: timestamp("updated_at", {
            withTimezone: true
        })
            .defaultNow()
            .notNull()
    },
    (table) => [
        uniqueIndex(
            "user_mfa_methods_user_type_unique"
        ).on(
            table.userId,
            table.type
        )
    ]
);

export const mfaChallenges = pgTable(
    "mfa_challenges",
    {
        id: uuid("id")
            .defaultRandom()
            .primaryKey(),

        userId: uuid("user_id")
            .notNull()
            .references(() => users.id),

        challengeTokenHash: varchar(
            "challenge_token_hash",
            {
                length: 64
            }
        )
            .notNull()
            .unique(),

        returnTo: text("return_to"),

        attemptCount: integer("attempt_count")
            .default(0)
            .notNull(),

        expiresAt: timestamp("expires_at", {
            withTimezone: true
        }).notNull(),

        consumedAt: timestamp("consumed_at", {
            withTimezone: true
        }),

        createdAt: timestamp("created_at", {
            withTimezone: true
        })
            .defaultNow()
            .notNull()
    }
);

export const mfaRecoveryCodes = pgTable(
    "mfa_recovery_codes",
    {
        id: uuid("id")
            .defaultRandom()
            .primaryKey(),

        mfaMethodId: uuid("mfa_method_id")
            .notNull()
            .references(() => userMfaMethods.id),

        codeHash: varchar("code_hash", {
            length: 64
        })
            .notNull()
            .unique(),

        usedAt: timestamp("used_at", {
            withTimezone: true
        }),

        createdAt: timestamp("created_at", {
            withTimezone: true
        })
            .defaultNow()
            .notNull()
    },
    (table) => [
        index(
            "mfa_recovery_codes_method_id_idx"
        ).on(table.mfaMethodId)
    ]
);