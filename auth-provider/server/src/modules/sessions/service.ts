import {
    and,
    eq,
    gt,
    isNull
} from "drizzle-orm";

import { env } from "../../config/env.js";
import { db } from "../../db/client.js";
import {
    ssoSessions,
    users
} from "../../db/schema/index.js";
import {
    generateOpaqueValue,
    hashOpaqueValue
} from "../../security/token.js";

type SessionExecutor =
    Pick<typeof db, "insert">;

export type SessionMfaMethod =
    "totp" | "recovery_code";

type CreateCentralSessionInput = {
    userId: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    mfaMethod?: SessionMfaMethod | null;
};

const safeSessionColumns = {
    id: ssoSessions.id,
    userId: ssoSessions.userId,
    status: ssoSessions.status,
    createdAt: ssoSessions.createdAt,
    expiresAt: ssoSessions.expiresAt,
    lastActivityAt: ssoSessions.lastActivityAt,
    mfaVerifiedAt: ssoSessions.mfaVerifiedAt,
    mfaMethod: ssoSessions.mfaMethod,
    revokedAt: ssoSessions.revokedAt,
    revokeReason: ssoSessions.revokeReason,
    ipAddress: ssoSessions.ipAddress,
    userAgent: ssoSessions.userAgent
};

export async function createCentralSession(
    input: CreateCentralSessionInput,
    executor: SessionExecutor = db
) {
    const rawToken = generateOpaqueValue();
    const sessionTokenHash =
        hashOpaqueValue(rawToken);

    const now = new Date();

    const expiresAt = new Date(
        now.getTime() +
        env.SSO_SESSION_TTL_SECONDS * 1000
    );

    const [session] = await executor
        .insert(ssoSessions)
        .values({
            userId: input.userId,
            sessionTokenHash,
            status: "active",
            expiresAt,
            lastActivityAt: now,
            mfaVerifiedAt: input.mfaMethod ? now : null,
            mfaMethod: input.mfaMethod ?? null,
            ipAddress: input.ipAddress ?? null,
            userAgent: input.userAgent ?? null
        })
        .returning(safeSessionColumns);

    return {
        rawToken,
        session
    };
}

export async function getCentralSessionByRawToken(
    rawToken: string
) {
    const sessionTokenHash =
        hashOpaqueValue(rawToken);

    const [session] = await db
        .select(safeSessionColumns)
        .from(ssoSessions)
        .where(
            eq(
                ssoSessions.sessionTokenHash,
                sessionTokenHash
            )
        )
        .limit(1);

    return session ?? null;
}

export async function validateCentralSession(
    rawToken: string
) {
    const sessionTokenHash =
        hashOpaqueValue(rawToken);

    const now = new Date();

    const [result] = await db
        .select({
            sessionId: ssoSessions.id,
            sessionUserId: ssoSessions.userId,
            sessionStatus: ssoSessions.status,
            sessionCreatedAt: ssoSessions.createdAt,
            sessionExpiresAt: ssoSessions.expiresAt,
            sessionLastActivityAt:
                ssoSessions.lastActivityAt,
            sessionMfaVerifiedAt:
                ssoSessions.mfaVerifiedAt,
            sessionMfaMethod:
                ssoSessions.mfaMethod,

            userId: users.id,
            userName: users.name,
            userEmail: users.email,
            userStatus: users.status
        })
        .from(ssoSessions)
        .innerJoin(
            users,
            eq(ssoSessions.userId, users.id)
        )
        .where(
            and(
                eq(
                    ssoSessions.sessionTokenHash,
                    sessionTokenHash
                ),
                eq(ssoSessions.status, "active"),
                gt(ssoSessions.expiresAt, now),
                isNull(ssoSessions.revokedAt),
                eq(users.status, "active")
            )
        )
        .limit(1);

    if (!result) {
        return null;
    }

    return {
        session: {
            id: result.sessionId,
            userId: result.sessionUserId,
            status: result.sessionStatus,
            createdAt: result.sessionCreatedAt,
            expiresAt: result.sessionExpiresAt,
            lastActivityAt:
                result.sessionLastActivityAt,
            mfaVerifiedAt:
                result.sessionMfaVerifiedAt,
            mfaMethod:
                result.sessionMfaMethod
        },
        user: {
            id: result.userId,
            name: result.userName,
            email: result.userEmail,
            status: result.userStatus
        }
    };
}

export function hasRecentMfaVerification(
    session: {
        mfaVerifiedAt: Date | null;
        mfaMethod: string | null;
    }
) {
    if (
        !session.mfaVerifiedAt ||
        (
            session.mfaMethod !== "totp" &&
            session.mfaMethod !== "recovery_code"
        )
    ) {
        return false;
    }

    const ageMs =
        Date.now() - session.mfaVerifiedAt.getTime();

    return (
        ageMs >= 0 &&
        ageMs <= env.MFA_RECENT_VERIFICATION_SECONDS * 1000
    );
}