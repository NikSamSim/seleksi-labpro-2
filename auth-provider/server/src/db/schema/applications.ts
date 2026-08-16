import {
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar
} from "drizzle-orm/pg-core";

import { groups } from "./groups.js";

export const applications = pgTable("applications", {
    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    name: varchar("name", {
        length: 255
    }).notNull(),

    clientId: varchar("client_id", {
        length: 255
    })
        .notNull()
        .unique(),

    clientSecretHash: varchar("client_secret_hash", {
        length: 255
    }).notNull(),

    status: varchar("status", {
        length: 32
    })
        .default("active")
        .notNull(),

    launchUrl: text("launch_url"),

    logoutNotificationUrl: text("logout_notification_url")
        .notNull(),

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
});

export const applicationRedirectUris = pgTable(
    "application_redirect_uris",
    {
        id: uuid("id")
            .defaultRandom()
            .primaryKey(),

        applicationId: uuid("application_id")
            .notNull()
            .references(() => applications.id),

        redirectUri: text("redirect_uri")
            .notNull(),

        createdAt: timestamp("created_at", {
            withTimezone: true
        })
            .defaultNow()
            .notNull()
    },
    (table) => [
        uniqueIndex("application_redirect_uris_application_id_redirect_uri_unique")
            .on(table.applicationId, table.redirectUri)
    ]
);

export const applicationGroupPolicies = pgTable(
    "application_group_policies",
    {
        id: uuid("id")
            .defaultRandom()
            .primaryKey(),

        applicationId: uuid("application_id")
            .notNull()
            .references(() => applications.id),

        groupId: uuid("group_id")
            .notNull()
            .references(() => groups.id),

        effect: varchar("effect", {
            length: 32
        })
            .default("allow")
            .notNull(),

        createdAt: timestamp("created_at", {
            withTimezone: true
        })
            .defaultNow()
            .notNull()
    },
    (table) => [
        uniqueIndex("application_group_policies_application_id_group_id_effect_unique")
            .on(
                table.applicationId,
                table.groupId,
                table.effect
            )
    ]
);