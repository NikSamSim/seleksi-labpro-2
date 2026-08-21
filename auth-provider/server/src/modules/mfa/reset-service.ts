import { and, eq, isNotNull, isNull } from "drizzle-orm";

import { db } from "../../db/client.js";
import {
    mfaChallenges,
    mfaEnrollments,
    mfaRecoveryCodes,
    userMfaMethods,
    users
} from "../../db/schema/index.js";

import { writeAudit } from "../audit/service.js";
import {
    writeGlobalOutboxEvent
} from "../events/service.js";
import {
    revokeAllUserSessions
} from "../revocation/service.js";

import { AppError } from "../../http/errors.js";
import { verifyPassword } from "../../security/password.js";
import { hasRecentMfaVerification } from "../sessions/service.js";

const MFA_TYPE = "totp";

export type ResetUserMfaReason =
    | "mfa_disabled"
    | "mfa_admin_reset";

type ResetUserMfaInput = {
    userId: string;
    actorId: string;
    reason: ResetUserMfaReason;
    sessionId?: string | null;
    ipAddress?: string | null;
};

type DisableOwnMfaInput = {
    userId: string;
    sessionId: string;
    currentPassword: string;
    session: {
        mfaVerifiedAt: Date | null;
        mfaMethod: string | null;
    };
    ipAddress?: string | null;
};

export async function resetUserMfa(
    input: ResetUserMfaInput
) {
    return db.transaction(async (tx) => {
        const [activeMethod] = await tx
            .select({
                id: userMfaMethods.id
            })
            .from(userMfaMethods)
            .where(
                and(
                    eq(
                        userMfaMethods.userId,
                        input.userId
                    ),
                    eq(
                        userMfaMethods.type,
                        MFA_TYPE
                    ),
                    isNotNull(
                        userMfaMethods.enabledAt
                    )
                )
            )
            .for("update")
            .limit(1);

        if (!activeMethod) {
            return {
                changed: false
            };
        }

        await tx
            .delete(mfaRecoveryCodes)
            .where(
                eq(
                    mfaRecoveryCodes.mfaMethodId,
                    activeMethod.id
                )
            );

        await tx
            .delete(mfaEnrollments)
            .where(
                and(
                    eq(
                        mfaEnrollments.userId,
                        input.userId
                    ),
                    eq(
                        mfaEnrollments.type,
                        MFA_TYPE
                    )
                )
            );

        const now = new Date();

        await tx
            .update(mfaChallenges)
            .set({
                consumedAt: now
            })
            .where(
                and(
                    eq(
                        mfaChallenges.userId,
                        input.userId
                    ),
                    isNull(
                        mfaChallenges.consumedAt
                    )
                )
            );

        const [deletedMethod] = await tx
            .delete(userMfaMethods)
            .where(
                and(
                    eq(
                        userMfaMethods.id,
                        activeMethod.id
                    ),
                    eq(
                        userMfaMethods.userId,
                        input.userId
                    ),
                    eq(
                        userMfaMethods.type,
                        MFA_TYPE
                    ),
                    isNotNull(
                        userMfaMethods.enabledAt
                    )
                )
            )
            .returning({
                id: userMfaMethods.id
            });

        if (!deletedMethod) {
            throw new Error(
                "Active MFA method changed during reset"
            );
        }

        const revocation =
            await revokeAllUserSessions(
                {
                    userId: input.userId,
                    reason: input.reason
                },
                tx
            );

        await writeGlobalOutboxEvent(
            {
                eventType: "SessionRevoked",
                userId: input.userId,
                centralSessionId: null,
                reason: input.reason
            },
            tx
        );

        await writeAudit(
            {
                eventType: input.reason,
                actorId: input.actorId,
                userId: input.userId,
                sessionId:
                    input.sessionId ?? null,
                result: "success",
                metadata: {
                    method: MFA_TYPE,
                    revokedSessionCount:
                        revocation.revokedSessionCount,
                    revokedTokenCount:
                        revocation.revokedTokenCount
                },
                ipAddress:
                    input.ipAddress ?? null
            },
            tx
        );

        return {
            changed: true,
            revokedSessionCount:
                revocation.revokedSessionCount,
            revokedTokenCount:
                revocation.revokedTokenCount
        };
    });
}

export async function disableOwnMfa(input: DisableOwnMfaInput) {
    if (!hasRecentMfaVerification(input.session)) {
        throw new AppError(
            403,
            "FORBIDDEN",
            "Verifikasi MFA terbaru diperlukan"
        );
    }

    const [user] = await db
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .innerJoin(
            userMfaMethods,
            and(
                eq(userMfaMethods.userId, users.id),
                eq(userMfaMethods.type, MFA_TYPE),
                isNotNull(userMfaMethods.enabledAt)
            )
        )
        .where(
            and(
                eq(users.id, input.userId),
                eq(users.status, "active")
            )
        )
        .limit(1);

    if (!user) {
        throw new AppError(409, "CONFLICT", "MFA tidak aktif");
    }

    const passwordValid = await verifyPassword(
        user.passwordHash,
        input.currentPassword
    );

    if (!passwordValid) {
        throw new AppError(
            401,
            "UNAUTHORIZED",
            "Password saat ini tidak valid"
        );
    }

    const result = await resetUserMfa({
        userId: input.userId,
        actorId: input.userId,
        reason: "mfa_disabled",
        sessionId: input.sessionId,
        ipAddress: input.ipAddress ?? null
    });

    if (!result.changed) {
        throw new AppError(409, "CONFLICT", "MFA tidak aktif");
    }

    return result;
}