import { db } from "../../db/client.js";
import {
    auditLogs
} from "../../db/schema/index.js";

type AuditExecutor =
    Pick<typeof db, "insert">;

export type AuditLogger = {
    error(
        bindings: Record<string, unknown>,
        message: string
    ): void;
};

export type AuditEventType =
    | "login_success"
    | "login_failed"
    | "policy_denied"
    | "authorization_code_issued"
    | "token_issued"
    | "logout"
    | "password_changed"
    | "user_created"
    | "user_updated"
    | "user_status_changed"
    | "group_changed"
    | "membership_changed"
    | "application_changed"
    | "policy_changed"
    | "mfa_enrolled"
    | "mfa_success"
    | "mfa_failed";

export type AuditResult =
    | "success"
    | "failure"
    | "denied";

export type WriteAuditInput = {
    eventType: AuditEventType;
    actorId?: string | null;
    userId?: string | null;
    applicationId?: string | null;
    sessionId?: string | null;
    result: AuditResult;
    metadata?: Record<string, unknown> | null;
    ipAddress?: string | null;
};

export async function writeAudit(
    input: WriteAuditInput,
    executor: AuditExecutor = db
) {
    const [auditLog] = await executor
        .insert(auditLogs)
        .values({
            eventType: input.eventType,
            actorId: input.actorId ?? null,
            userId: input.userId ?? null,
            applicationId:
                input.applicationId ?? null,
            sessionId:
                input.sessionId ?? null,
            result: input.result,
            metadata: input.metadata ?? null,
            ipAddress:
                input.ipAddress ?? null
        })
        .returning({
            id: auditLogs.id,
            createdAt: auditLogs.createdAt
        });

    return auditLog;
}

export async function writeAuditBestEffort(
    input: WriteAuditInput,
    logger: AuditLogger
) {
    try {
        await writeAudit(input);
    } catch (error) {
        logger.error(
            {
                eventType: input.eventType,
                errorType:
                    error instanceof Error
                        ? error.name
                        : "UnknownError"
            },
            "Failed to write audit log"
        );
    }
}