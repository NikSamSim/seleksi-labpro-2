import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const envPath = fileURLToPath(new URL("../../../../.env", import.meta.url));

dotenv.config({
    path: envPath
});

const schema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_A_PORT: z.coerce.number().int().positive().default(4000),
    APP_A_DATABASE_URL: z.string().min(1),

    AUTH_SERVER_PUBLIC_URL: z.string().url(),
    AUTH_SERVER_INTERNAL_URL: z.string().url(),
    AUTH_SERVER_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive(),

    APP_A_CLIENT_ID: z.string().min(1),
    APP_A_CLIENT_SECRET: z.string().min(1),
    APP_A_REDIRECT_URI: z.string().url(),

    APP_A_COOKIE_NAME: z.string().min(1),
    APP_A_SESSION_TTL_SECONDS: z.coerce.number().int().positive(),
    APP_A_OAUTH_TRANSACTION_TTL_SECONDS: z.coerce.number().int().positive(),
    APP_A_INTERNAL_LOGOUT_SECRET: z.string().min(32)
});

export const env = schema.parse(process.env);