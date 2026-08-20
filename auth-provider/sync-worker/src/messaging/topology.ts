import type { Channel } from "amqplib";

import { env } from "../config/env.js";

export const retryDelaysMs = env.SYNC_RETRY_DELAYS_MS
    .split(",")
    .map((value) => Number(value));

export function getRetryQueueName(delayMs: number) {
    return `${env.SYNC_EXCHANGE_NAME}.retry.${delayMs}`;
}

export function getRetryRoutingKey(delayMs: number) {
    return `retry.${delayMs}`;
}

export async function assertSyncTopology(channel: Channel) {
    await channel.assertExchange(
        env.SYNC_EXCHANGE_NAME,
        "direct",
        {
            durable: true
        }
    );

    await channel.assertQueue(
        env.SYNC_MAIN_QUEUE_NAME,
        {
            durable: true
        }
    );

    await channel.bindQueue(
        env.SYNC_MAIN_QUEUE_NAME,
        env.SYNC_EXCHANGE_NAME,
        env.SYNC_MAIN_ROUTING_KEY
    );

    await channel.assertQueue(
        env.SYNC_DLQ_NAME,
        {
            durable: true
        }
    );

    await channel.bindQueue(
        env.SYNC_DLQ_NAME,
        env.SYNC_EXCHANGE_NAME,
        env.SYNC_DLQ_ROUTING_KEY
    );

    for (const delayMs of retryDelaysMs) {
        const queueName = getRetryQueueName(delayMs);
        const routingKey = getRetryRoutingKey(delayMs);

        await channel.assertQueue(
            queueName,
            {
                durable: true,
                arguments: {
                    "x-message-ttl": delayMs,
                    "x-dead-letter-exchange": env.SYNC_EXCHANGE_NAME,
                    "x-dead-letter-routing-key": env.SYNC_MAIN_ROUTING_KEY
                }
            }
        );

        await channel.bindQueue(
            queueName,
            env.SYNC_EXCHANGE_NAME,
            routingKey
        );
    }
}