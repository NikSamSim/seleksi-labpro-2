import { db } from "../../db/client.js";
import { activityLogs } from "../../db/schema.js";

export type ActivityEventType =
    | "authorization_started"
    | "callback_received"
    | "authorization_denied"
    | "oauth_state_invalid"
    | "token_exchange_succeeded"
    | "token_exchange_failed"
    | "userinfo_fetched"
    | "userinfo_failed"
    | "profile_synced"
    | "local_session_created"
    | "local_logout"
    | "internal_logout_processed"
    | "internal_logout_duplicate";

type ActivityWriteExecutor =
    Pick<typeof db, "insert">;

type WriteActivityInput = {
    eventType: ActivityEventType;
    message: string;
    externalUserId?: string | null;
    requestId?: string | null;
    metadata?: Record<string, unknown>;
};

const SENSITIVE_METADATA_KEY_PATTERN =
    /password|secret|token|authorization|code|verifier|state/i;

function sanitizeMetadata(
    metadata: Record<string, unknown>
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(metadata).filter(
            ([key]) =>
                !SENSITIVE_METADATA_KEY_PATTERN.test(key)
        )
    );
}

export async function writeActivity(
    input: WriteActivityInput,
    executor: ActivityWriteExecutor = db
) {
    const [activity] = await executor
        .insert(activityLogs)
        .values({
            eventType: input.eventType,
            message: input.message,
            externalUserId:
                input.externalUserId ?? null,
            requestId: input.requestId ?? null,
            metadata: sanitizeMetadata(
                input.metadata ?? {}
            )
        })
        .returning({
            id: activityLogs.id,
            createdAt: activityLogs.createdAt
        });

    if (!activity) {
        throw new Error("Failed to write activity log");
    }

    return activity;
}