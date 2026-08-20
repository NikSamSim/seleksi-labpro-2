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
    APP_B_DATABASE_URL: z.string().min(1),

    AUTH_SERVER_PUBLIC_URL: z.string().url(),
    AUTH_SERVER_INTERNAL_URL: z.string().url(),
    AUTH_SERVER_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive(),

    APP_B_CLIENT_ID: z.string().min(1),
    APP_B_CLIENT_SECRET: z.string().min(1),
    APP_B_REDIRECT_URI: z.string().url(),

    APP_B_COOKIE_NAME: z.string().min(1),
    APP_B_SESSION_TTL_SECONDS: z.coerce.number().int().positive(),
    APP_B_OAUTH_TRANSACTION_TTL_SECONDS: z.coerce.number().int().positive(),
    APP_B_INTERNAL_LOGOUT_SECRET: z.string().min(32)
});

export const env = schema.parse(process.env);