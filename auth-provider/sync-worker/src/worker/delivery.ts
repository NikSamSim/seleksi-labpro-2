import { env } from "../config/env.js";
import type {
    OutboxEventPayload
} from "../messaging/message.js";
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
            return {
                result: "success",
                statusCode: response.status
            };
        }

        return {
            result: "http_error",
            statusCode: response.status
        };
    } catch (error) {
        if (isTimeoutError(error)) {
            return {
                result: "timeout"
            };
        }

        return {
            result: "network_error"
        };
    }
}