import { randomUUID } from "node:crypto";

import { db } from "../../db/client.js";
import {
    applications,
    eventDeliveries,
    events
} from "../../db/schema/index.js";

type OutboxExecutor =
    Pick<typeof db, "insert" | "select">;

export type OutboxEventType =
    | "SessionRevoked"
    | "PasswordChanged"
    | "AccessPolicyChanged";

type GlobalOutboxEventType =
    | "SessionRevoked"
    | "PasswordChanged";

type ApplicationOutboxEventType =
    "AccessPolicyChanged";

type BaseOutboxEventInput = {
    userId: string;
    centralSessionId?: string | null;
    reason: string;
    metadata?: Record<string, unknown>;
};

export type WriteGlobalOutboxEventInput =
    BaseOutboxEventInput & {
        eventType: GlobalOutboxEventType;
    };

export type WriteApplicationOutboxEventInput =
    BaseOutboxEventInput & {
        eventType:
            ApplicationOutboxEventType;
        applicationId: string;
    };

export type OutboxEventPayload = {
    schemaVersion: 1;
    eventId: string;
    eventType: OutboxEventType;
    userId: string;
    centralSessionId: string | null;
    applicationId: string | null;
    reason: string;
    occurredAt: string;
    metadata: Record<string, unknown>;
};

async function writeGlobalOutboxEventWithExecutor(
    input: WriteGlobalOutboxEventInput,
    executor: OutboxExecutor
) {
    const eventId = randomUUID();
    const occurredAt = new Date();

    const payload: OutboxEventPayload = {
        schemaVersion: 1,
        eventId,
        eventType: input.eventType,
        userId: input.userId,
        centralSessionId:
            input.centralSessionId ?? null,
        applicationId: null,
        reason: input.reason,
        occurredAt:
            occurredAt.toISOString(),
        metadata: input.metadata ?? {}
    };

    await executor
        .insert(events)
        .values({
            id: eventId,
            eventType: input.eventType,
            userId: input.userId,
            centralSessionId:
                input.centralSessionId ?? null,
            applicationId: null,
            payload,
            status: "pending",
            createdAt: occurredAt
        });

    const targetApplications =
        await executor
            .select({
                applicationId:
                    applications.id
            })
            .from(applications);

    if (targetApplications.length > 0) {
        await executor
            .insert(eventDeliveries)
            .values(
                targetApplications.map(
                    ({ applicationId }) => ({
                        eventId,
                        applicationId,
                        status: "pending",
                        attemptCount: 0
                    })
                )
            );
    }

    return {
        eventId,
        payload,
        deliveryCount:
            targetApplications.length
    };
}

async function writeApplicationOutboxEventsWithExecutor(
    inputs: WriteApplicationOutboxEventInput[],
    executor: OutboxExecutor
) {
    if (inputs.length === 0) {
        return {
            eventIds: [] as string[],
            payloads:
                [] as OutboxEventPayload[],
            eventCount: 0,
            deliveryCount: 0
        };
    }

    const occurredAt = new Date();

    const preparedEvents =
        inputs.map((input) => {
            const eventId =
                randomUUID();

            const payload:
                OutboxEventPayload = {
                    schemaVersion: 1,
                    eventId,
                    eventType:
                        input.eventType,
                    userId:
                        input.userId,
                    centralSessionId:
                        input.centralSessionId ??
                        null,
                    applicationId:
                        input.applicationId,
                    reason:
                        input.reason,
                    occurredAt:
                        occurredAt.toISOString(),
                    metadata:
                        input.metadata ?? {}
                };

            return {
                eventId,
                payload,
                input
            };
        });

    await executor
        .insert(events)
        .values(
            preparedEvents.map(
                ({
                    eventId,
                    payload,
                    input
                }) => ({
                    id: eventId,
                    eventType:
                        input.eventType,
                    userId:
                        input.userId,
                    centralSessionId:
                        input.centralSessionId ??
                        null,
                    applicationId:
                        input.applicationId,
                    payload,
                    status: "pending",
                    createdAt:
                        occurredAt
                })
            )
        );

    await executor
        .insert(eventDeliveries)
        .values(
            preparedEvents.map(
                ({
                    eventId,
                    input
                }) => ({
                    eventId,
                    applicationId:
                        input.applicationId,
                    status: "pending",
                    attemptCount: 0
                })
            )
        );

    return {
        eventIds:
            preparedEvents.map(
                ({ eventId }) =>
                    eventId
            ),
        payloads:
            preparedEvents.map(
                ({ payload }) =>
                    payload
            ),
        eventCount:
            preparedEvents.length,
        deliveryCount:
            preparedEvents.length
    };
}

async function writeApplicationOutboxEventWithExecutor(
    input: WriteApplicationOutboxEventInput,
    executor: OutboxExecutor
) {
    const result =
        await writeApplicationOutboxEventsWithExecutor(
            [input],
            executor
        );

    return {
        eventId: result.eventIds[0]!,
        payload: result.payloads[0]!,
        deliveryCount: 1
    };
}

export async function writeGlobalOutboxEvent(
    input: WriteGlobalOutboxEventInput,
    executor?: OutboxExecutor
) {
    if (executor) {
        return writeGlobalOutboxEventWithExecutor(
            input,
            executor
        );
    }

    return db.transaction(async (tx) =>
        writeGlobalOutboxEventWithExecutor(
            input,
            tx
        )
    );
}

export async function writeApplicationOutboxEvent(
    input: WriteApplicationOutboxEventInput,
    executor?: OutboxExecutor
) {
    if (executor) {
        return writeApplicationOutboxEventWithExecutor(
            input,
            executor
        );
    }

    return db.transaction(async (tx) =>
        writeApplicationOutboxEventWithExecutor(
            input,
            tx
        )
    );
}

export async function writeApplicationOutboxEvents(
    inputs: WriteApplicationOutboxEventInput[],
    executor?: OutboxExecutor
) {
    if (executor) {
        return writeApplicationOutboxEventsWithExecutor(
            inputs,
            executor
        );
    }

    return db.transaction(async (tx) =>
        writeApplicationOutboxEventsWithExecutor(
            inputs,
            tx
        )
    );
}