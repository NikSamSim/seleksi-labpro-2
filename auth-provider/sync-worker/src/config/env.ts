import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const envPath = fileURLToPath(new URL("../../../../.env", import.meta.url));

dotenv.config({
    path: envPath
});

const retryDelaysPattern = /^[1-9]\d*(,[1-9]\d*)*$/;

const schema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    SYNC_WORKER_PORT: z.coerce.number().int().positive().default(5000),
    PRIMARY_DATABASE_URL: z.string().min(1),
    RABBITMQ_URL: z.string().min(1),

    SYNC_EXCHANGE_NAME: z.string().min(1),
    SYNC_MAIN_QUEUE_NAME: z.string().min(1),
    SYNC_MAIN_ROUTING_KEY: z.string().min(1),
    SYNC_DLQ_NAME: z.string().min(1),
    SYNC_DLQ_ROUTING_KEY: z.string().min(1),
    SYNC_RETRY_DELAYS_MS: z.string().regex(retryDelaysPattern),

    SYNC_WORKER_PREFETCH: z.coerce.number().int().positive(),
    SYNC_WORKER_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive(),

    APP_A_CLIENT_ID: z.string().min(1),
    APP_A_INTERNAL_LOGOUT_SECRET: z.string().min(32),

    APP_B_CLIENT_ID: z.string().min(1),
    APP_B_INTERNAL_LOGOUT_SECRET: z.string().min(32)
});

export const env = schema.parse(process.env);