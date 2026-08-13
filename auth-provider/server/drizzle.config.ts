import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

const envPath = fileURLToPath(new URL("../../.env", import.meta.url));

dotenv.config({
    path: envPath
});

if (!process.env.PRIMARY_DATABASE_URL) {
    throw new Error("PRIMARY_DATABASE_URL is required");
}

export default defineConfig({
    dialect: "postgresql",
    schema: "./src/db/schema/**/*.ts",
    out: "./drizzle",
    dbCredentials: {
        url: process.env.PRIMARY_DATABASE_URL
    }
});