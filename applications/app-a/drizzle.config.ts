import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

const envPath = fileURLToPath(new URL("../../.env", import.meta.url));

dotenv.config({
    path: envPath
});

if (!process.env.APP_A_DATABASE_URL) {
    throw new Error("APP_A_DATABASE_URL is required");
}

export default defineConfig({
    dialect: "postgresql",
    schema: "./src/db/schema.ts",
    out: "./drizzle",
    dbCredentials: {
        url: process.env.APP_A_DATABASE_URL
    }
});