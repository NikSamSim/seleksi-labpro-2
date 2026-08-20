import { z } from "zod";

export const internalLogoutHeadersSchema = z.object({
    "x-event-id": z.string().uuid(),
    "x-timestamp": z.string().regex(/^\d+$/),
    "x-signature": z.string().regex(/^[0-9a-fA-F]{64}$/)
});

export const internalLogoutEventSchema = z.object({
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
    occurredAt: z.string().datetime({ offset: true }),
    metadata: z.record(
        z.string(),
        z.unknown()
    )
}).strict();

export type InternalLogoutEvent =
    z.infer<typeof internalLogoutEventSchema>;