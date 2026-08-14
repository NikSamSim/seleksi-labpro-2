import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const envPath = fileURLToPath(new URL("../../../../.env", import.meta.url));

dotenv.config({
    path: envPath
});

const schema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_B_PORT: z.coerce.number().int().positive().default(4001),
    APP_B_DATABASE_URL: z.string().min(1)
});

export const env = schema.parse(process.env);