import { z } from "zod";

export const outboxEventPayloadSchema = z.object({
    schemaVersion: z.literal(1),
    eventId: z.string().uuid(),
    eventType: z.enum([
        "SessionRevoked",
        "PasswordChanged",
        "AccessPolicyChanged"
    ]),
    userId: z.string().uuid(),
    centralSessionId: z.string().uuid().nullable(),
    applicationId: z.string().uuid().nullable(),
    reason: z.string().min(1).max(255),
    occurredAt: z.string().datetime({
        offset: true
    }),
    metadata: z.record(
        z.string(),
        z.unknown()
    )
}).strict();

export type OutboxEventPayload =
    z.infer<typeof outboxEventPayloadSchema>;

export const syncQueueMessageSchema = z.object({
    schemaVersion: z.literal(1),
    deliveryId: z.string().uuid(),
    eventId: z.string().uuid(),
    applicationId: z.string().uuid(),
    event: outboxEventPayloadSchema
}).strict();

export type SyncQueueMessage =
    z.infer<typeof syncQueueMessageSchema>;

export type QueueMessageParseResult =
    | {
        success: true;
        data: SyncQueueMessage;
    }
    | {
        success: false;
        reason:
            | "INVALID_JSON"
            | "INVALID_SCHEMA";
    };

export function parseSyncQueueMessage(
    content: Buffer
): QueueMessageParseResult {
    let parsed: unknown;

    try {
        parsed = JSON.parse(
            content.toString("utf8")
        );
    } catch {
        return {
            success: false,
            reason: "INVALID_JSON"
        };
    }

    const result =
        syncQueueMessageSchema.safeParse(parsed);

    if (!result.success) {
        return {
            success: false,
            reason: "INVALID_SCHEMA"
        };
    }

    return {
        success: true,
        data: result.data
    };
}

export function isQueueMessageInternallyConsistent(
    message: SyncQueueMessage
) {
    return (
        message.eventId === message.event.eventId &&
        (
            message.event.applicationId === null ||
            message.event.applicationId ===
                message.applicationId
        )
    );
}