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

export function createSyncQueueMessage(input: {
    deliveryId: string;
    eventId: string;
    applicationId: string;
    event: OutboxEventPayload;
}) {
    return syncQueueMessageSchema.parse({
        schemaVersion: 1,
        ...input
    });
}