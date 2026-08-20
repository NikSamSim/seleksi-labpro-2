import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "../config/env.js";
import * as schema from "./schema.js";

const client = postgres(env.APP_B_DATABASE_URL);

export const db = drizzle(client, {
    schema
});

export async function checkDatabase() {
    await db.execute(sql`SELECT 1`);
}

export async function closeDatabase() {
    await client.end();
}