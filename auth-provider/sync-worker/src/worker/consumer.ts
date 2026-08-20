import type {
    Channel,
    ConsumeMessage
} from "amqplib";
import type {
    FastifyBaseLogger
} from "fastify";

import { env } from "../config/env.js";
import {
    claimDelivery,
    getApplicationTarget,
    markDeliveryFailed,
    markDeliveryRetrying,
    markDeliverySucceeded
} from "../db/queries.js";
import {
    closeConsumerChannel,
    getConsumerChannel,
    setupRabbitMQTopology
} from "../messaging/rabbitmq.js";
import {
    isQueueMessageInternallyConsistent,
    parseSyncQueueMessage,
    type SyncQueueMessage
} from "../messaging/message.js";
import {
    deliverInternalLogout,
    getInternalLogoutSecret
} from "./delivery.js";
import {
    classifyDeliveryFailure,
    publishDeadLetterMessage,
    publishRetryMessage
} from "./retry.js";

const CONSUMER_RECONNECT_DELAY_MS = 1000;

let consumerActive = false;
let recoveryRunning = false;
let recoveryPromise: Promise<void> | null = null;

function sleep(ms: number) {
    return new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });
}

export function isConsumerActive() {
    return consumerActive;
}

async function deadLetterRawMessage(input: {
    channel: Channel;
    rawMessage: ConsumeMessage;
    reason: string;
    logger: FastifyBaseLogger;
}) {
    await publishDeadLetterMessage({
        content: input.rawMessage.content,
        reason: input.reason,
        messageId:
            input.rawMessage.properties.messageId,
        correlationId:
            input.rawMessage.properties.correlationId,
        eventType:
            input.rawMessage.properties.type
    });

    input.channel.ack(
        input.rawMessage
    );

    input.logger.warn(
        {
            reason: input.reason
        },
        "Invalid sync message moved to DLQ"
    );
}

async function deadLetterClaimedDelivery(input: {
    channel: Channel;
    rawMessage: ConsumeMessage;
    message: SyncQueueMessage;
    attemptCount: number;
    reason: string;
    logger: FastifyBaseLogger;
}) {
    await publishDeadLetterMessage({
        content: input.rawMessage.content,
        reason: input.reason,
        attemptCount:
            input.attemptCount,
        messageId:
            input.message.deliveryId,
        correlationId:
            input.message.eventId,
        eventType:
            input.message.event.eventType
    });

    await markDeliveryFailed({
        deliveryId:
            input.message.deliveryId,
        eventId:
            input.message.eventId,
        applicationId:
            input.message.applicationId,
        attemptCount:
            input.attemptCount,
        lastError:
            input.reason
    });

    input.channel.ack(
        input.rawMessage
    );

    input.logger.warn(
        {
            deliveryId:
                input.message.deliveryId,
            eventId:
                input.message.eventId,
            applicationId:
                input.message.applicationId,
            attemptCount:
                input.attemptCount,
            reason:
                input.reason
        },
        "Sync delivery moved to DLQ"
    );
}

async function processMessage(
    channel: Channel,
    rawMessage: ConsumeMessage,
    logger: FastifyBaseLogger
) {
    const parsed =
        parseSyncQueueMessage(
            rawMessage.content
        );

    if (!parsed.success) {
        await deadLetterRawMessage({
            channel,
            rawMessage,
            reason: parsed.reason,
            logger
        });

        return;
    }

    const message = parsed.data;

    if (
        !isQueueMessageInternallyConsistent(
            message
        )
    ) {
        await deadLetterRawMessage({
            channel,
            rawMessage,
            reason:
                "INCONSISTENT_MESSAGE",
            logger
        });

        return;
    }

    const claim =
        await claimDelivery({
            deliveryId:
                message.deliveryId,
            eventId:
                message.eventId,
            applicationId:
                message.applicationId,
            redelivered:
                rawMessage.fields.redelivered
        });

    if (
        claim.result === "already_succeeded" ||
        claim.result === "already_failed" ||
        claim.result === "already_processing"
    ) {
        channel.ack(rawMessage);

        logger.info(
            {
                deliveryId:
                    message.deliveryId,
                result:
                    claim.result
            },
            "Duplicate sync delivery acknowledged"
        );

        return;
    }

    if (claim.result === "not_found") {
        await deadLetterRawMessage({
            channel,
            rawMessage,
            reason:
                "DELIVERY_NOT_FOUND",
            logger
        });

        return;
    }

    if (
        claim.result ===
        "identity_mismatch"
    ) {
        await deadLetterRawMessage({
            channel,
            rawMessage,
            reason:
                "DELIVERY_IDENTITY_MISMATCH",
            logger
        });

        return;
    }

    if (claim.result === "not_claimable") {
        await deadLetterRawMessage({
            channel,
            rawMessage,
            reason:
                "DELIVERY_NOT_CLAIMABLE",
            logger
        });

        return;
    }

    const target =
        await getApplicationTarget(
            message.applicationId
        );

    if (target.result === "not_found") {
        await deadLetterClaimedDelivery({
            channel,
            rawMessage,
            message,
            attemptCount:
                claim.attemptCount,
            reason:
                "APPLICATION_NOT_FOUND",
            logger
        });

        return;
    }

    if (
        target.result ===
        "invalid_target"
    ) {
        await deadLetterClaimedDelivery({
            channel,
            rawMessage,
            message,
            attemptCount:
                claim.attemptCount,
            reason:
                "INVALID_TARGET",
            logger
        });

        return;
    }

    const secret =
        getInternalLogoutSecret(
            target.clientId
        );

    if (
        secret.result !== "resolved"
    ) {
        await deadLetterClaimedDelivery({
            channel,
            rawMessage,
            message,
            attemptCount:
                claim.attemptCount,
            reason:
                "UNSUPPORTED_APPLICATION",
            logger
        });

        return;
    }

    const deliveryResult =
        await deliverInternalLogout({
            targetUrl:
                target.logoutNotificationUrl,
            secret:
                secret.secret,
            event:
                message.event
        });

    if (
        deliveryResult.result !==
        "success"
    ) {
        const disposition =
            classifyDeliveryFailure(
                deliveryResult,
                claim.attemptCount
            );

        if (
            disposition.type === "retry"
        ) {
            await publishRetryMessage(
                message,
                disposition.delayMs
            );

            await markDeliveryRetrying({
                deliveryId:
                    message.deliveryId,
                eventId:
                    message.eventId,
                applicationId:
                    message.applicationId,
                attemptCount:
                    claim.attemptCount,
                delayMs:
                    disposition.delayMs,
                lastError:
                    disposition.reason
            });

            channel.ack(rawMessage);

            logger.warn(
                {
                    deliveryId:
                        message.deliveryId,
                    attemptCount:
                        claim.attemptCount,
                    retryDelayMs:
                        disposition.delayMs,
                    reason:
                        disposition.reason
                },
                "Sync delivery scheduled for retry"
            );

            return;
        }

        const finalReason =
            disposition.type === "exhausted"
                ? `RETRY_EXHAUSTED_${disposition.reason}`
                : disposition.reason;

        await deadLetterClaimedDelivery({
            channel,
            rawMessage,
            message,
            attemptCount:
                claim.attemptCount,
            reason:
                finalReason,
            logger
        });

        return;
    }

    await markDeliverySucceeded({
        deliveryId:
            message.deliveryId,
        eventId:
            message.eventId,
        applicationId:
            message.applicationId
    });

    channel.ack(rawMessage);

    logger.info(
        {
            deliveryId:
                message.deliveryId,
            eventId:
                message.eventId,
            applicationId:
                message.applicationId,
            attemptCount:
                claim.attemptCount
        },
        "Sync delivery succeeded"
    );
}

export async function startConsumer(
    logger: FastifyBaseLogger
) {
    const channel =
        await getConsumerChannel();

    let lost = false;
    let resolveLost!: () => void;

    const lostPromise =
        new Promise<void>((resolve) => {
            resolveLost = resolve;
        });

    const markLost = () => {
        if (lost) {
            return;
        }

        lost = true;
        consumerActive = false;
        resolveLost();
    };

    channel.once("close", markLost);

    try {
        const result =
            await channel.consume(
                env.SYNC_MAIN_QUEUE_NAME,
                (rawMessage) => {
                    if (!rawMessage) {
                        markLost();
                        return;
                    }

                    void processMessage(
                        channel,
                        rawMessage,
                        logger
                    ).catch(async (error) => {
                        logger.error(
                            {
                                err: error
                            },
                            "Unexpected sync delivery processing failure"
                        );

                        try {
                            channel.nack(
                                rawMessage,
                                false,
                                true
                            );
                        } catch {
                            // Channel may already be closed.
                        }

                        try {
                            await channel.close();
                        } catch {
                            // Recovery loop will create a new channel.
                        }
                    });
                },
                {
                    noAck: false
                }
            );

        if (lost) {
            throw new Error(
                "Consumer channel closed during startup"
            );
        }

        consumerActive = true;

        return {
            consumerTag:
                result.consumerTag,
            lost: lostPromise
        };
    } catch (error) {
        consumerActive = false;
        channel.off("close", markLost);
        throw error;
    }
}

async function runConsumerRecoveryLoop(
    logger: FastifyBaseLogger
) {
    while (recoveryRunning) {
        try {
            await setupRabbitMQTopology();

            const consumer =
                await startConsumer(logger);

            logger.info(
                {
                    consumerTag:
                        consumer.consumerTag
                },
                "Sync worker consumer active"
            );

            await consumer.lost;

            if (recoveryRunning) {
                logger.warn(
                    "Sync worker consumer lost; reconnecting"
                );
            }
        } catch (error) {
            consumerActive = false;

            if (recoveryRunning) {
                logger.error(
                    {
                        err: error
                    },
                    "Sync worker consumer setup failed"
                );
            }
        }

        if (!recoveryRunning) {
            break;
        }

        await closeConsumerChannel();
        await sleep(
            CONSUMER_RECONNECT_DELAY_MS
        );
    }

    consumerActive = false;
}

export function startConsumerRecoveryLoop(
    logger: FastifyBaseLogger
) {
    if (recoveryRunning) {
        return;
    }

    recoveryRunning = true;

    recoveryPromise =
        runConsumerRecoveryLoop(logger)
            .finally(() => {
                consumerActive = false;
                recoveryPromise = null;
            });
}

export async function stopConsumerRecoveryLoop() {
    recoveryRunning = false;
    consumerActive = false;

    await closeConsumerChannel();

    if (recoveryPromise) {
        await recoveryPromise;
    }
}