import type { FastifyBaseLogger } from "fastify";

import { env } from "../config/env.js";
import {
    getUnpublishedEventBatch,
    markEventsPublished
} from "../db/queries.js";
import {
    createSyncQueueMessage
} from "../messaging/message.js";
import {
    getPublisherConfirmChannel
} from "../messaging/rabbitmq.js";

type PublishBatchResult = {
    eventCount: number;
    deliveryCount: number;
};

let running = false;
let loopPromise: Promise<void> | null = null;
let currentCyclePromise:
    Promise<PublishBatchResult> | null = null;

function sleep(milliseconds: number) {
    return new Promise<void>((resolve) => {
        setTimeout(resolve, milliseconds);
    });
}

export async function publishOutboxBatch():
Promise<PublishBatchResult> {
    const events =
        await getUnpublishedEventBatch(
            env.EVENT_PUBLISHER_BATCH_SIZE
        );

    if (events.length === 0) {
        return {
            eventCount: 0,
            deliveryCount: 0
        };
    }

    const channel =
        await getPublisherConfirmChannel();

    let deliveryCount = 0;

    for (const event of events) {
        for (const delivery of event.deliveries) {
            const message =
                createSyncQueueMessage({
                    deliveryId:
                        delivery.deliveryId,
                    eventId:
                        event.eventId,
                    applicationId:
                        delivery.applicationId,
                    event:
                        event.payload
                });

            channel.publish(
                env.SYNC_EXCHANGE_NAME,
                env.SYNC_MAIN_ROUTING_KEY,
                Buffer.from(
                    JSON.stringify(message)
                ),
                {
                    persistent: true,
                    contentType:
                        "application/json",
                    messageId:
                        delivery.deliveryId,
                    correlationId:
                        event.eventId,
                    type:
                        event.eventType,
                    timestamp:
                        Math.floor(
                            Date.now() / 1000
                        )
                }
            );

            deliveryCount += 1;
        }
    }

    await channel.waitForConfirms();

    await markEventsPublished(
        events.map(({ eventId }) => eventId)
    );

    return {
        eventCount: events.length,
        deliveryCount
    };
}

async function runPublisherLoop(
    logger: FastifyBaseLogger
) {
    while (running) {
        try {
            currentCyclePromise =
                publishOutboxBatch();

            const result =
                await currentCyclePromise;

            if (result.eventCount > 0) {
                logger.info(
                    {
                        eventCount:
                            result.eventCount,
                        deliveryCount:
                            result.deliveryCount
                    },
                    "Published outbox batch"
                );
            }
        } catch (error) {
            logger.error(
                {
                    err: error
                },
                "Event publisher cycle failed"
            );
        } finally {
            currentCyclePromise = null;
        }

        if (running) {
            await sleep(
                env.EVENT_PUBLISHER_POLL_INTERVAL_MS
            );
        }
    }
}

export function startPublisherLoop(
    logger: FastifyBaseLogger
) {
    if (running) {
        return;
    }

    running = true;

    loopPromise =
        runPublisherLoop(logger)
            .finally(() => {
                loopPromise = null;
            });
}

export async function stopPublisherLoop() {
    running = false;

    if (currentCyclePromise) {
        await currentCyclePromise
            .catch(() => undefined);
    }

    if (loopPromise) {
        await loopPromise;
    }
}