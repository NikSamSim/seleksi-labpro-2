import { sql } from "drizzle-orm";

import { db } from "./client.js";

export type DeliveryClaimResult =
    | {
        result: "claimed";
        attemptCount: number;
    }
    | {
        result: "not_found";
    }
    | {
        result: "identity_mismatch";
        status: string;
        attemptCount: number;
    }
    | {
        result: "already_succeeded";
        attemptCount: number;
    }
    | {
        result: "already_failed";
        attemptCount: number;
    }
    | {
        result: "already_processing";
        attemptCount: number;
    }
    | {
        result: "not_claimable";
        status: string;
        attemptCount: number;
    };

type DeliveryClaimRow = {
    result:
        | "claimed"
        | "not_found"
        | "identity_mismatch"
        | "already_succeeded"
        | "already_failed"
        | "already_processing"
        | "not_claimable";

    attemptCount: number | null;
    existingStatus: string | null;
};

export async function claimDelivery(input: {
    deliveryId: string;
    eventId: string;
    applicationId: string;
    redelivered: boolean;
}): Promise<DeliveryClaimResult> {
    const rows =
        await db.execute<DeliveryClaimRow>(sql`
            WITH claimed AS (
                UPDATE event_deliveries
                SET
                    status = 'processing',
                    attempt_count = attempt_count + 1,
                    last_attempt_at = NOW(),
                    next_retry_at = NULL
                WHERE id = ${input.deliveryId}::uuid
                  AND event_id = ${input.eventId}::uuid
                  AND application_id = ${input.applicationId}::uuid
                  AND (
                      status IN ('pending', 'retrying')
                      OR (
                          ${input.redelivered}::boolean
                          AND status = 'processing'
                      )
                  )
                RETURNING attempt_count
            )
            SELECT
                CASE
                    WHEN claimed.attempt_count IS NOT NULL
                        THEN 'claimed'

                    WHEN delivery.id IS NULL
                        THEN 'not_found'

                    WHEN delivery.event_id <> ${input.eventId}::uuid
                      OR delivery.application_id <> ${input.applicationId}::uuid
                        THEN 'identity_mismatch'

                    WHEN delivery.status = 'succeeded'
                        THEN 'already_succeeded'

                    WHEN delivery.status = 'failed'
                        THEN 'already_failed'

                    WHEN delivery.status = 'processing'
                        THEN 'already_processing'

                    ELSE 'not_claimable'
                END AS "result",

                COALESCE(
                    claimed.attempt_count,
                    delivery.attempt_count
                ) AS "attemptCount",

                delivery.status AS "existingStatus"
            FROM (SELECT 1) AS anchor
            LEFT JOIN claimed
                ON TRUE
            LEFT JOIN event_deliveries AS delivery
                ON delivery.id = ${input.deliveryId}::uuid
            LIMIT 1
        `);

    const row = rows[0];

    if (!row) {
        throw new Error(
            "Delivery claim query returned no result"
        );
    }

    if (row.result === "not_found") {
        return {
            result: "not_found"
        };
    }

    if (row.attemptCount === null) {
        throw new Error(
            "Delivery claim returned no attempt count"
        );
    }

    if (row.result === "claimed") {
        return {
            result: "claimed",
            attemptCount: row.attemptCount
        };
    }

    if (row.result === "already_succeeded") {
        return {
            result: "already_succeeded",
            attemptCount: row.attemptCount
        };
    }

    if (row.result === "already_failed") {
        return {
            result: "already_failed",
            attemptCount: row.attemptCount
        };
    }

    if (row.result === "already_processing") {
        return {
            result: "already_processing",
            attemptCount: row.attemptCount
        };
    }

    if (row.existingStatus === null) {
        throw new Error(
            "Delivery claim returned no existing status"
        );
    }

    return {
        result: row.result,
        status: row.existingStatus,
        attemptCount: row.attemptCount
    };
}

type ApplicationTargetRow = {
    applicationId: string;
    clientId: string;
    logoutNotificationUrl: string;
};

export type ApplicationTargetResult =
    | {
        result: "resolved";
        applicationId: string;
        clientId: string;
        logoutNotificationUrl: string;
    }
    | {
        result: "not_found";
    }
    | {
        result: "invalid_target";
        clientId: string;
    };

export async function getApplicationTarget(
    applicationId: string
): Promise<ApplicationTargetResult> {
    const rows =
        await db.execute<ApplicationTargetRow>(sql`
            SELECT
                id AS "applicationId",
                client_id AS "clientId",
                logout_notification_url
                    AS "logoutNotificationUrl"
            FROM applications
            WHERE id = ${applicationId}::uuid
            LIMIT 1
        `);

    const row = rows[0];

    if (!row) {
        return {
            result: "not_found"
        };
    }

    let targetUrl: URL;

    try {
        targetUrl =
            new URL(row.logoutNotificationUrl);
    } catch {
        return {
            result: "invalid_target",
            clientId: row.clientId
        };
    }

    if (
        targetUrl.protocol !== "http:" &&
        targetUrl.protocol !== "https:"
    ) {
        return {
            result: "invalid_target",
            clientId: row.clientId
        };
    }

    return {
        result: "resolved",
        applicationId: row.applicationId,
        clientId: row.clientId,
        logoutNotificationUrl:
            targetUrl.toString()
    };
}

type UpdatedDeliveryRow = {
    id: string;
};

export async function markDeliverySucceeded(input: {
    deliveryId: string;
    eventId: string;
    applicationId: string;
}) {
    const rows =
        await db.execute<UpdatedDeliveryRow>(sql`
            UPDATE event_deliveries
            SET
                status = 'succeeded',
                processed_at = NOW(),
                next_retry_at = NULL,
                last_error = NULL
            WHERE id = ${input.deliveryId}::uuid
              AND event_id = ${input.eventId}::uuid
              AND application_id = ${input.applicationId}::uuid
              AND status = 'processing'
            RETURNING id
        `);

    if (rows.length !== 1) {
        throw new Error(
            "Could not mark delivery as succeeded"
        );
    }
}

export async function markDeliveryRetrying(input: {
    deliveryId: string;
    eventId: string;
    applicationId: string;
    attemptCount: number;
    delayMs: number;
    lastError: string;
}) {
    const rows =
        await db.execute<UpdatedDeliveryRow>(sql`
            UPDATE event_deliveries
            SET
                status = 'retrying',
                next_retry_at =
                    NOW()
                    + (
                        ${input.delayMs}
                        * INTERVAL '1 millisecond'
                    ),
                last_error = ${input.lastError}
            WHERE id = ${input.deliveryId}::uuid
              AND event_id = ${input.eventId}::uuid
              AND application_id = ${input.applicationId}::uuid
              AND status = 'processing'
              AND attempt_count = ${input.attemptCount}
            RETURNING id
        `);

    if (rows.length !== 1) {
        throw new Error(
            "Could not mark delivery as retrying"
        );
    }
}

export async function markDeliveryFailed(input: {
    deliveryId: string;
    eventId: string;
    applicationId: string;
    attemptCount: number;
    lastError: string;
}) {
    const rows =
        await db.execute<UpdatedDeliveryRow>(sql`
            UPDATE event_deliveries
            SET
                status = 'failed',
                processed_at = NOW(),
                next_retry_at = NULL,
                last_error = ${input.lastError}
            WHERE id = ${input.deliveryId}::uuid
              AND event_id = ${input.eventId}::uuid
              AND application_id = ${input.applicationId}::uuid
              AND status = 'processing'
              AND attempt_count = ${input.attemptCount}
            RETURNING id
        `);

    if (rows.length !== 1) {
        throw new Error(
            "Could not mark delivery as failed"
        );
    }
}