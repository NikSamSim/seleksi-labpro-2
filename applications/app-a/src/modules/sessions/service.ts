import {
    and,
    eq,
    gt,
    isNull
} from "drizzle-orm";

import { applicationConfig } from "../../config/application.js";
import { db } from "../../db/client.js";
import {
    localSessions,
    profileCache
} from "../../db/schema.js";
import {
    generateOpaqueValue,
    hashOpaqueValue
} from "../../security/token.js";

type SessionWriteExecutor =
    Pick<typeof db, "insert" | "update">;

type CreateLocalSessionInput = {
    externalUserId: string;
    centralSessionId: string;
};

const safeSessionColumns = {
    id: localSessions.id,
    externalUserId: localSessions.externalUserId,
    centralSessionId: localSessions.centralSessionId,
    status: localSessions.status,
    createdAt: localSessions.createdAt,
    expiresAt: localSessions.expiresAt,
    lastActivityAt: localSessions.lastActivityAt,
    revokedAt: localSessions.revokedAt,
    revokeReason: localSessions.revokeReason
};

export async function createLocalSession(
    input: CreateLocalSessionInput,
    executor: SessionWriteExecutor = db
) {
    const rawToken = generateOpaqueValue();
    const sessionTokenHash = hashOpaqueValue(rawToken);
    const now = new Date();
    const expiresAt = new Date(
        now.getTime() +
        applicationConfig.sessionTtlSeconds * 1000
    );

    const [session] = await executor
        .insert(localSessions)
        .values({
            sessionTokenHash,
            externalUserId: input.externalUserId,
            centralSessionId: input.centralSessionId,
            status: "active",
            expiresAt,
            lastActivityAt: now
        })
        .returning(safeSessionColumns);

    if (!session) {
        throw new Error("Failed to create local session");
    }

    return {
        rawToken,
        session
    };
}

export async function getLocalSessionByRawToken(
    rawToken: string
) {
    const sessionTokenHash = hashOpaqueValue(rawToken);

    const [session] = await db
        .select(safeSessionColumns)
        .from(localSessions)
        .where(
            eq(
                localSessions.sessionTokenHash,
                sessionTokenHash
            )
        )
        .limit(1);

    return session ?? null;
}

export async function validateLocalSession(
    rawToken: string
) {
    const sessionTokenHash = hashOpaqueValue(rawToken);
    const now = new Date();

    const [result] = await db
        .select({
            sessionId: localSessions.id,
            externalUserId: localSessions.externalUserId,
            centralSessionId: localSessions.centralSessionId,
            sessionStatus: localSessions.status,
            sessionCreatedAt: localSessions.createdAt,
            sessionExpiresAt: localSessions.expiresAt,
            sessionLastActivityAt:
                localSessions.lastActivityAt,

            profileName: profileCache.name,
            profileEmail: profileCache.email,
            profileGroups: profileCache.groups,
            profileSyncedAt: profileCache.syncedAt
        })
        .from(localSessions)
        .innerJoin(
            profileCache,
            eq(
                profileCache.externalUserId,
                localSessions.externalUserId
            )
        )
        .where(
            and(
                eq(
                    localSessions.sessionTokenHash,
                    sessionTokenHash
                ),
                eq(localSessions.status, "active"),
                gt(localSessions.expiresAt, now),
                isNull(localSessions.revokedAt)
            )
        )
        .limit(1);

    if (!result) {
        return null;
    }

    return {
        session: {
            id: result.sessionId,
            externalUserId: result.externalUserId,
            centralSessionId: result.centralSessionId,
            status: result.sessionStatus,
            createdAt: result.sessionCreatedAt,
            expiresAt: result.sessionExpiresAt,
            lastActivityAt:
                result.sessionLastActivityAt
        },
        profile: {
            externalUserId: result.externalUserId,
            name: result.profileName,
            email: result.profileEmail,
            groups: result.profileGroups,
            syncedAt: result.profileSyncedAt
        }
    };
}

export async function revokeLocalSessionByRawToken(
    rawToken: string,
    reason = "local_logout",
    executor: SessionWriteExecutor = db
) {
    const sessionTokenHash = hashOpaqueValue(rawToken);
    const now = new Date();

    const revoked = await executor
        .update(localSessions)
        .set({
            status: "revoked",
            revokedAt: now,
            revokeReason: reason
        })
        .where(
            and(
                eq(
                    localSessions.sessionTokenHash,
                    sessionTokenHash
                ),
                eq(localSessions.status, "active"),
                isNull(localSessions.revokedAt)
            )
        )
        .returning({
            id: localSessions.id
        });

    return revoked.length;
}

export async function revokeSessionsByCentralSessionId(
    centralSessionId: string,
    reason: string,
    executor: SessionWriteExecutor = db
) {
    const now = new Date();

    const revoked = await executor
        .update(localSessions)
        .set({
            status: "revoked",
            revokedAt: now,
            revokeReason: reason
        })
        .where(
            and(
                eq(
                    localSessions.centralSessionId,
                    centralSessionId
                ),
                eq(localSessions.status, "active"),
                isNull(localSessions.revokedAt)
            )
        )
        .returning({
            id: localSessions.id
        });

    return revoked.length;
}

export async function revokeAllUserLocalSessions(
    externalUserId: string,
    reason: string,
    executor: SessionWriteExecutor = db
) {
    const now = new Date();

    const revoked = await executor
        .update(localSessions)
        .set({
            status: "revoked",
            revokedAt: now,
            revokeReason: reason
        })
        .where(
            and(
                eq(
                    localSessions.externalUserId,
                    externalUserId
                ),
                eq(localSessions.status, "active"),
                isNull(localSessions.revokedAt)
            )
        )
        .returning({
            id: localSessions.id
        });

    return revoked.length;
}