import {
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar
} from "drizzle-orm/pg-core";

import { users } from "./users.js";

export const groups = pgTable("groups", {
    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    name: varchar("name", {
        length: 255
    })
        .notNull()
        .unique(),

    description: text("description"),

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

export const userGroups = pgTable(
    "user_groups",
    {
        id: uuid("id")
            .defaultRandom()
            .primaryKey(),

        userId: uuid("user_id")
            .notNull()
            .references(() => users.id),

        groupId: uuid("group_id")
            .notNull()
            .references(() => groups.id),

        createdAt: timestamp("created_at", {
            withTimezone: true
        })
            .defaultNow()
            .notNull()
    },
    (table) => [
        uniqueIndex("user_groups_user_id_group_id_unique")
            .on(table.userId, table.groupId)
    ]
);