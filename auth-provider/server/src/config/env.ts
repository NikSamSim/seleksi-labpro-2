import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const envPath = fileURLToPath(new URL("../../../../.env", import.meta.url));

dotenv.config({
    path: envPath
});

const schema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    AUTH_SERVER_PORT: z.coerce.number().int().positive().default(3000),
    SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),

    PRIMARY_DATABASE_URL: z.string().min(1),
    RABBITMQ_URL: z.string().min(1),

    CONTROL_PANEL_ORIGIN: z.string().url(),

    SSO_COOKIE_NAME: z.string().min(1),
    SSO_SESSION_TTL_SECONDS: z.coerce.number().int().positive(),

    AUTHORIZATION_CODE_TTL_SECONDS: z.coerce.number().int().positive(),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive(),

    APP_A_CLIENT_ID: z.string().min(1),
    APP_A_CLIENT_SECRET: z.string().min(1),
    APP_A_REDIRECT_URI: z.string().url(),
    APP_A_LAUNCH_URL: z.string().url(),
    APP_A_LOGOUT_NOTIFICATION_URL: z.string().url(),

    APP_B_CLIENT_ID: z.string().min(1),
    APP_B_CLIENT_SECRET: z.string().min(1),
    APP_B_REDIRECT_URI: z.string().url(),
    APP_B_LAUNCH_URL: z.string().url(),
    APP_B_LOGOUT_NOTIFICATION_URL: z.string().url(),

    SEED_USER_PASSWORD: z.string().min(1),

    MFA_ISSUER: z.string().min(1),
    MFA_PENDING_COOKIE_NAME: z.string().min(1),
    MFA_CHALLENGE_TTL_SECONDS: z.coerce.number().int().positive(),
    MFA_ENCRYPTION_KEY_BASE64: z.string().min(1).refine(
        (value) => {
            const decoded = Buffer.from(value, "base64");

            return decoded.length === 32 && decoded.toString("base64") === value;
        },
        {
            message: "MFA_ENCRYPTION_KEY_BASE64 must be a valid Base64-encoded 32-byte key"
        }
    )
});

export const env = schema.parse(process.env);