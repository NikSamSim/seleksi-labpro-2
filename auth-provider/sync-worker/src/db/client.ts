import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "../config/env.js";

const client = postgres(env.PRIMARY_DATABASE_URL);

export const db = drizzle(client);

export async function checkDatabase() {
    await db.execute(sql`SELECT 1`);
}

export async function closeDatabase() {
    await client.end();
}