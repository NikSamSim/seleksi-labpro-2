import { env } from "../config/env.js";
import type {
    SyncQueueMessage
} from "../messaging/message.js";
import {
    getPublisherConfirmChannel
} from "../messaging/rabbitmq.js";
import {
    getRetryRoutingKey,
    retryDelaysMs
} from "../messaging/topology.js";
import type {
    InternalLogoutDeliveryResult
} from "./delivery.js";

type FailedDeliveryResult =
    Exclude<
        InternalLogoutDeliveryResult,
        {
            result: "success";
        }
    >;

export type FailureDisposition =
    | {
        type: "retry";
        delayMs: number;
        reason: string;
    }
    | {
        type: "permanent";
        reason: string;
    }
    | {
        type: "exhausted";
        reason: string;
    };

function getFailureReason(
    result: FailedDeliveryResult
) {
    if (result.result === "timeout") {
        return "TIMEOUT";
    }

    if (result.result === "network_error") {
        return "NETWORK_ERROR";
    }

    return `HTTP_${result.statusCode}`;
}

function isTransientFailure(
    result: FailedDeliveryResult
) {
    if (
        result.result === "timeout" ||
        result.result === "network_error"
    ) {
        return true;
    }

    return (
        result.statusCode === 408 ||
        result.statusCode === 429 ||
        (
            result.statusCode >= 500 &&
            result.statusCode <= 599
        )
    );
}

export function classifyDeliveryFailure(
    result: FailedDeliveryResult,
    attemptCount: number
): FailureDisposition {
    const reason =
        getFailureReason(result);

    if (!isTransientFailure(result)) {
        return {
            type: "permanent",
            reason
        };
    }

    const retryIndex =
        attemptCount - 1;

    const delayMs =
        retryDelaysMs[retryIndex];

    if (delayMs === undefined) {
        return {
            type: "exhausted",
            reason
        };
    }

    return {
        type: "retry",
        delayMs,
        reason
    };
}

export async function publishRetryMessage(
    message: SyncQueueMessage,
    delayMs: number
) {
    const channel =
        await getPublisherConfirmChannel();

    const content =
        Buffer.from(
            JSON.stringify(message)
        );

    await new Promise<void>(
        (resolve, reject) => {
            channel.publish(
                env.SYNC_EXCHANGE_NAME,
                getRetryRoutingKey(delayMs),
                content,
                {
                    persistent: true,
                    contentType:
                        "application/json",
                    messageId:
                        message.deliveryId,
                    correlationId:
                        message.eventId,
                    type:
                        message.event.eventType,
                    timestamp:
                        Math.floor(
                            Date.now() / 1000
                        )
                },
                (error) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve();
                }
            );
        }
    );
}

export async function publishDeadLetterMessage(input: {
    content: Buffer;
    reason: string;
    attemptCount?: number;
    messageId?: string;
    correlationId?: string;
    eventType?: string;
}) {
    const channel =
        await getPublisherConfirmChannel();

    const headers: Record<string, string | number> = {
        "x-failure-reason": input.reason
    };

    if (input.attemptCount !== undefined) {
        headers["x-attempt-count"] =
            input.attemptCount;
    }

    await new Promise<void>(
        (resolve, reject) => {
            channel.publish(
                env.SYNC_EXCHANGE_NAME,
                env.SYNC_DLQ_ROUTING_KEY,
                input.content,
                {
                    persistent: true,
                    contentType:
                        "application/json",
                    messageId:
                        input.messageId,
                    correlationId:
                        input.correlationId,
                    type:
                        input.eventType,
                    timestamp:
                        Math.floor(
                            Date.now() / 1000
                        ),
                    headers
                },
                (error) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve();
                }
            );
        }
    );
}