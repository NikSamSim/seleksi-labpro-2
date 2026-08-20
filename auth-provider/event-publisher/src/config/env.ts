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
    EVENT_PUBLISHER_PORT: z.coerce.number().int().positive().default(5001),
    PRIMARY_DATABASE_URL: z.string().min(1),
    RABBITMQ_URL: z.string().min(1),

    SYNC_EXCHANGE_NAME: z.string().min(1),
    SYNC_MAIN_QUEUE_NAME: z.string().min(1),
    SYNC_MAIN_ROUTING_KEY: z.string().min(1),
    SYNC_DLQ_NAME: z.string().min(1),
    SYNC_DLQ_ROUTING_KEY: z.string().min(1),
    SYNC_RETRY_DELAYS_MS: z.string().regex(retryDelaysPattern),

    EVENT_PUBLISHER_POLL_INTERVAL_MS: z.coerce.number().int().positive(),
    EVENT_PUBLISHER_BATCH_SIZE: z.coerce.number().int().positive(),
    SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10000)
});

export const env = schema.parse(process.env);