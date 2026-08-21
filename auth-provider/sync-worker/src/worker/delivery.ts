import { env } from "../config/env.js";
import type {
    OutboxEventPayload
} from "../messaging/message.js";
import {
    recordSyncDeliveryMetrics
} from "../observability/worker-metrics.js";
import {
    createInternalSignature
} from "../security/internal-signature.js";

export type InternalLogoutSecretResult =
    | {
        result: "resolved";
        secret: string;
    }
    | {
        result: "unsupported_application";
    };

export type InternalLogoutDeliveryResult =
    | {
        result: "success";
        statusCode: number;
    }
    | {
        result: "http_error";
        statusCode: number;
    }
    | {
        result: "timeout";
    }
    | {
        result: "network_error";
    };

export function getInternalLogoutSecret(
    clientId: string
): InternalLogoutSecretResult {
    if (clientId === env.APP_A_CLIENT_ID) {
        return {
            result: "resolved",
            secret: env.APP_A_INTERNAL_LOGOUT_SECRET
        };
    }

    if (clientId === env.APP_B_CLIENT_ID) {
        return {
            result: "resolved",
            secret: env.APP_B_INTERNAL_LOGOUT_SECRET
        };
    }

    return {
        result: "unsupported_application"
    };
}

function isTimeoutError(error: unknown) {
    return (
        error instanceof Error &&
        (
            error.name === "TimeoutError" ||
            error.name === "AbortError"
        )
    );
}

export async function deliverInternalLogout(input: {
    targetUrl: string;
    secret: string;
    event: OutboxEventPayload;
}): Promise<InternalLogoutDeliveryResult> {
    const timestamp =
        Math.floor(Date.now() / 1000).toString();

    const signature =
        createInternalSignature(
            timestamp,
            input.event,
            input.secret
        );

    const startedAt =
        process.hrtime.bigint();

    const finish = (
        result: InternalLogoutDeliveryResult
    ): InternalLogoutDeliveryResult => {
        const durationSeconds =
            Number(
                process.hrtime.bigint() -
                    startedAt
            ) / 1_000_000_000;

        recordSyncDeliveryMetrics(
            result.result,
            durationSeconds
        );

        return result;
    };

    try {
        const response = await fetch(
            input.targetUrl,
            {
                method: "POST",
                headers: {
                    "content-type":
                        "application/json",
                    "x-event-id":
                        input.event.eventId,
                    "x-timestamp":
                        timestamp,
                    "x-signature":
                        signature
                },
                body: JSON.stringify(
                    input.event
                ),
                signal: AbortSignal.timeout(
                    env.SYNC_WORKER_REQUEST_TIMEOUT_MS
                )
            }
        );

        if (response.ok) {
            return finish({
                result: "success",
                statusCode: response.status
            });
        }

        return finish({
            result: "http_error",
            statusCode: response.status
        });
    } catch (error) {
        if (isTimeoutError(error)) {
            return finish({
                result: "timeout"
            });
        }

        return finish({
            result: "network_error"
        });
    }
}