import { sql } from "drizzle-orm";

import {
    outboxEventPayloadSchema,
    type OutboxEventPayload
} from "../messaging/message.js";
import { db } from "./client.js";

type UnpublishedEventRow = {
    eventId: string;
    eventType: string;
    payload: unknown;
    deliveryId: string | null;
    applicationId: string | null;
};

export type UnpublishedEventDelivery = {
    deliveryId: string;
    applicationId: string;
};

export type UnpublishedEvent = {
    eventId: string;
    eventType: OutboxEventPayload["eventType"];
    payload: OutboxEventPayload;
    deliveries: UnpublishedEventDelivery[];
};

export async function getUnpublishedEventBatch(
    batchSize: number
) {
    const rows =
        await db.execute<UnpublishedEventRow>(sql`
            WITH selected_events AS (
                SELECT
                    id,
                    event_type,
                    payload,
                    created_at
                FROM events
                WHERE status = 'pending'
                  AND published_at IS NULL
                ORDER BY created_at, id
                LIMIT ${batchSize}
            )
            SELECT
                selected_events.id
                    AS "eventId",
                selected_events.event_type
                    AS "eventType",
                selected_events.payload
                    AS "payload",
                event_deliveries.id
                    AS "deliveryId",
                event_deliveries.application_id
                    AS "applicationId"
            FROM selected_events
            LEFT JOIN event_deliveries
                ON event_deliveries.event_id =
                    selected_events.id
            ORDER BY
                selected_events.created_at,
                selected_events.id,
                event_deliveries.id
        `);

    const groupedEvents =
        new Map<string, UnpublishedEvent>();

    for (const row of rows) {
        let event =
            groupedEvents.get(row.eventId);

        if (!event) {
            const payload =
                outboxEventPayloadSchema.parse(
                    row.payload
                );

            if (
                payload.eventId !== row.eventId ||
                payload.eventType !== row.eventType
            ) {
                throw new Error(
                    "Outbox event payload does not match its database row"
                );
            }

            event = {
                eventId: row.eventId,
                eventType: payload.eventType,
                payload,
                deliveries: []
            };

            groupedEvents.set(
                row.eventId,
                event
            );
        }

        if (
            row.deliveryId !== null &&
            row.applicationId !== null
        ) {
            event.deliveries.push({
                deliveryId:
                    row.deliveryId,
                applicationId:
                    row.applicationId
            });
        }
    }

    return [...groupedEvents.values()];
}

export async function markEventsPublished(
    eventIds: string[]
) {
    if (eventIds.length === 0) {
        return;
    }

    const eventIdList = sql.join(
        eventIds.map(
            (eventId) => sql`${eventId}::uuid`
        ),
        sql`, `
    );

    await db.execute(sql`
        UPDATE events
        SET
            status = 'published',
            published_at = NOW()
        WHERE status = 'pending'
          AND published_at IS NULL
          AND id IN (${eventIdList})
    `);
}