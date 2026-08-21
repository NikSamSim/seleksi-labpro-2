import { and, eq, gt, isNotNull, isNull, lt, sql } from "drizzle-orm";

import { env } from "../../config/env.js";
import { db } from "../../db/client.js";
import {
    mfaChallenges,
    mfaEnrollments,
    mfaRecoveryCodes,
    userMfaMethods,
    users
} from "../../db/schema/index.js";
import { AppError } from "../../http/errors.js";
import { decryptValue, encryptValue } from "../../security/encryption.js";
import {
    generateRecoveryCodes,
    hashRecoveryCode
} from "../../security/recovery-code.js";
import {
    generateOpaqueValue,
    hashOpaqueValue
} from "../../security/token.js";
import {
    createTotpUri,
    generateTotpSecret,
    verifyTotpCode
} from "../../security/totp.js";
import { writeAudit } from "../audit/service.js";
import {
    createCentralSession,
    hasRecentMfaVerification
} from "../sessions/service.js";
import {
    verifyPassword
} from "../../security/password.js";
import { writeGlobalOutboxEvent } from "../events/service.js";
import { revokeAllUserSessions } from "../revocation/service.js";

const MFA_TYPE = "totp";
const MAX_MFA_ATTEMPTS = 5;
const MFA_REPLACEMENT_PURPOSE = "replace";
const MAX_MFA_REPLACEMENT_ATTEMPTS = 5;

type StartTotpEnrollmentInput = {
    userId: string;
    accountLabel: string;
};

type ConfirmTotpEnrollmentInput = {
    userId: string;
    code: string;
    sessionId?: string | null;
    ipAddress?: string | null;
};

type CreateMfaChallengeInput = {
    userId: string;
    returnTo?: string;
};

type VerifyMfaInput = {
    rawToken: string;
    code: string;
    ipAddress?: string | null;
    userAgent?: string | null;
};

type RecordFailedMfaAttemptInput = {
    challengeId: string;
    rawToken: string;
    method: "totp" | "recovery_code";
    ipAddress?: string | null;
};

type StartTotpReplacementInput = {
    userId: string;
    sessionId: string;
    accountLabel: string;
    currentPassword: string;
    session: {
        mfaVerifiedAt: Date | null;
        mfaMethod: string | null;
    };
};

type ConfirmTotpReplacementInput = {
    userId: string;
    sessionId: string;
    code: string;
    ipAddress?: string | null;
};

class InvalidRecoveryCodeError extends Error {}

export async function getUserMfaStatus(userId: string) {
    const [method] = await db
        .select({
            id: userMfaMethods.id,
            enabledAt: userMfaMethods.enabledAt
        })
        .from(userMfaMethods)
        .where(
            and(
                eq(userMfaMethods.userId, userId),
                eq(userMfaMethods.type, MFA_TYPE)
            )
        )
        .limit(1);

    return {
        enabled: method !== undefined && method.enabledAt !== null,
        enabledAt: method?.enabledAt ?? null
    };
}

export async function startTotpReplacement(
    input: StartTotpReplacementInput
) {
    if (
        !hasRecentMfaVerification(
            input.session
        )
    ) {
        throw new AppError(
            403,
            "FORBIDDEN",
            "Verifikasi MFA terbaru diperlukan"
        );
    }

    const [user] = await db
        .select({
            passwordHash:
                users.passwordHash
        })
        .from(users)
        .innerJoin(
            userMfaMethods,
            and(
                eq(
                    userMfaMethods.userId,
                    users.id
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
        .where(
            and(
                eq(
                    users.id,
                    input.userId
                ),
                eq(
                    users.status,
                    "active"
                )
            )
        )
        .limit(1);

    if (!user) {
        throw new AppError(
            409,
            "CONFLICT",
            "MFA tidak aktif"
        );
    }

    const passwordValid =
        await verifyPassword(
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

    const secret =
        generateTotpSecret();

    const otpauthUri =
        createTotpUri(
            input.accountLabel,
            secret
        );

    const encryptedSecret =
        encryptValue(secret);

    const now = new Date();

    const expiresAt =
        new Date(
            now.getTime() + env.MFA_ENROLLMENT_TTL_SECONDS * 1000
        );

    const [enrollment] = await db
        .insert(mfaEnrollments)
        .values({
            userId:
                input.userId,

            sessionId:
                input.sessionId,

            type:
                MFA_TYPE,

            purpose:
                MFA_REPLACEMENT_PURPOSE,

            secretCiphertext:
                encryptedSecret.ciphertext,

            secretIv:
                encryptedSecret.iv,

            secretAuthTag:
                encryptedSecret.authTag,

            attemptCount:
                0,

            expiresAt,

            createdAt:
                now
        })
        .onConflictDoUpdate({
            target: [
                mfaEnrollments.userId,
                mfaEnrollments.type,
                mfaEnrollments.purpose
            ],
            set: {
                sessionId:
                    input.sessionId,

                secretCiphertext:
                    encryptedSecret.ciphertext,

                secretIv:
                    encryptedSecret.iv,

                secretAuthTag:
                    encryptedSecret.authTag,

                attemptCount:
                    0,

                expiresAt,
                createdAt:
                    now
            }
        })
        .returning({
            id:
                mfaEnrollments.id,
            expiresAt:
                mfaEnrollments.expiresAt
        });

    return {
        enrollmentId:
            enrollment.id,
        secret,
        otpauthUri,
        expiresAt:
            enrollment.expiresAt
    };
}

export async function confirmTotpReplacement(
    input: ConfirmTotpReplacementInput
) {
    const now = new Date();

    const [pending] = await db
        .select({
            enrollmentId: mfaEnrollments.id,

            secretCiphertext:
                mfaEnrollments.secretCiphertext,
            secretIv:
                mfaEnrollments.secretIv,
            secretAuthTag:
                mfaEnrollments.secretAuthTag,

            activeMethodId:
                userMfaMethods.id
        })
        .from(mfaEnrollments)
        .innerJoin(
            userMfaMethods,
            and(
                eq(
                    userMfaMethods.userId,
                    mfaEnrollments.userId
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
        .where(
            and(
                eq(
                    mfaEnrollments.userId,
                    input.userId
                ),
                eq(
                    mfaEnrollments.sessionId,
                    input.sessionId
                ),
                eq(
                    mfaEnrollments.type,
                    MFA_TYPE
                ),
                eq(
                    mfaEnrollments.purpose,
                    MFA_REPLACEMENT_PURPOSE
                ),
                gt(
                    mfaEnrollments.expiresAt,
                    now
                ),
                lt(
                    mfaEnrollments.attemptCount,
                    MAX_MFA_REPLACEMENT_ATTEMPTS
                )
            )
        )
        .limit(1);

    if (!pending) {
        return {
            status: "invalid_enrollment" as const
        };
    }

    const newSecret = decryptValue({
        ciphertext:
            pending.secretCiphertext,
        iv:
            pending.secretIv,
        authTag:
            pending.secretAuthTag
    });

    if (
        !verifyTotpCode(
            newSecret,
            input.code
        )
    ) {
        return recordFailedTotpReplacementAttempt({
            enrollmentId:
                pending.enrollmentId,
            userId:
                input.userId,
            sessionId:
                input.sessionId,
            ipAddress:
                input.ipAddress
        });
    }

    const recoveryCodes =
        generateRecoveryCodes();

    return db.transaction(async (tx) => {
        const replacedAt = new Date();

        const [claimed] = await tx
            .delete(mfaEnrollments)
            .where(
                and(
                    eq(
                        mfaEnrollments.id,
                        pending.enrollmentId
                    ),
                    eq(
                        mfaEnrollments.userId,
                        input.userId
                    ),
                    eq(
                        mfaEnrollments.sessionId,
                        input.sessionId
                    ),
                    eq(
                        mfaEnrollments.type,
                        MFA_TYPE
                    ),
                    eq(
                        mfaEnrollments.purpose,
                        MFA_REPLACEMENT_PURPOSE
                    ),
                    eq(
                        mfaEnrollments.secretCiphertext,
                        pending.secretCiphertext
                    ),
                    eq(
                        mfaEnrollments.secretIv,
                        pending.secretIv
                    ),
                    eq(
                        mfaEnrollments.secretAuthTag,
                        pending.secretAuthTag
                    ),
                    gt(
                        mfaEnrollments.expiresAt,
                        replacedAt
                    ),
                    lt(
                        mfaEnrollments.attemptCount,
                        MAX_MFA_REPLACEMENT_ATTEMPTS
                    )
                )
            )
            .returning({
                id: mfaEnrollments.id
            });

        if (!claimed) {
            throw new AppError(
                409,
                "CONFLICT",
                "Replacement MFA telah berubah atau kedaluwarsa"
            );
        }

        const [activeMethod] = await tx
            .update(userMfaMethods)
            .set({
                secretCiphertext:
                    pending.secretCiphertext,
                secretIv:
                    pending.secretIv,
                secretAuthTag:
                    pending.secretAuthTag,
                updatedAt:
                    replacedAt
            })
            .where(
                and(
                    eq(
                        userMfaMethods.id,
                        pending.activeMethodId
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

        if (!activeMethod) {
            throw new AppError(
                409,
                "CONFLICT",
                "MFA aktif telah berubah"
            );
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
            .insert(mfaRecoveryCodes)
            .values(
                recoveryCodes.map(
                    (code) => ({
                        mfaMethodId:
                            activeMethod.id,
                        codeHash:
                            hashRecoveryCode(code)
                    })
                )
            );

        await tx
            .update(mfaChallenges)
            .set({
                consumedAt:
                    replacedAt
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

        await revokeAllUserSessions(
            {
                userId:
                    input.userId,
                reason:
                    "mfa_replaced"
            },
            tx
        );

        await writeGlobalOutboxEvent(
            {
                eventType:
                    "SessionRevoked",
                userId:
                    input.userId,
                centralSessionId:
                    null,
                reason:
                    "mfa_replaced"
            },
            tx
        );

        await writeAudit(
            {
                eventType:
                    "mfa_replaced",
                actorId:
                    input.userId,
                userId:
                    input.userId,
                sessionId:
                    input.sessionId,
                result:
                    "success",
                metadata: {
                    method: "totp"
                },
                ipAddress:
                    input.ipAddress ??
                    null
            },
            tx
        );

        return {
            status:
                "replaced" as const,
            recoveryCodes
        };
    });
}

export async function createMfaChallenge(input: CreateMfaChallengeInput) {
    const rawToken = generateOpaqueValue();
    const challengeTokenHash = hashOpaqueValue(rawToken);
    const now = new Date();
    const expiresAt = new Date(
        now.getTime() + env.MFA_CHALLENGE_TTL_SECONDS * 1000
    );

    const [challenge] = await db
        .insert(mfaChallenges)
        .values({
            userId: input.userId,
            challengeTokenHash,
            returnTo: input.returnTo ?? null,
            expiresAt
        })
        .returning({
            id: mfaChallenges.id,
            userId: mfaChallenges.userId,
            returnTo: mfaChallenges.returnTo,
            attemptCount: mfaChallenges.attemptCount,
            expiresAt: mfaChallenges.expiresAt,
            consumedAt: mfaChallenges.consumedAt,
            createdAt: mfaChallenges.createdAt
        });

    return { rawToken, challenge };
}

export async function getMfaChallenge(rawToken: string) {
    const challengeTokenHash = hashOpaqueValue(rawToken);
    const now = new Date();

    const [result] = await db
        .select({
            challengeId: mfaChallenges.id,
            challengeUserId: mfaChallenges.userId,
            returnTo: mfaChallenges.returnTo,
            attemptCount: mfaChallenges.attemptCount,
            expiresAt: mfaChallenges.expiresAt,
            createdAt: mfaChallenges.createdAt,
            userId: users.id,
            userName: users.name,
            userEmail: users.email,
            mfaMethodId: userMfaMethods.id,
            secretCiphertext: userMfaMethods.secretCiphertext,
            secretIv: userMfaMethods.secretIv,
            secretAuthTag: userMfaMethods.secretAuthTag
        })
        .from(mfaChallenges)
        .innerJoin(users, eq(mfaChallenges.userId, users.id))
        .innerJoin(
            userMfaMethods,
            and(
                eq(userMfaMethods.userId, mfaChallenges.userId),
                eq(userMfaMethods.type, MFA_TYPE)
            )
        )
        .where(
            and(
                eq(mfaChallenges.challengeTokenHash, challengeTokenHash),
                gt(mfaChallenges.expiresAt, now),
                isNull(mfaChallenges.consumedAt),
                lt(mfaChallenges.attemptCount, MAX_MFA_ATTEMPTS),
                eq(users.status, "active"),
                isNotNull(userMfaMethods.enabledAt)
            )
        )
        .limit(1);

    if (!result) {
        return null;
    }

    return {
        challenge: {
            id: result.challengeId,
            userId: result.challengeUserId,
            returnTo: result.returnTo,
            attemptCount: result.attemptCount,
            expiresAt: result.expiresAt,
            createdAt: result.createdAt
        },
        user: {
            id: result.userId,
            name: result.userName,
            email: result.userEmail
        },
        mfaMethod: {
            id: result.mfaMethodId,
            secretCiphertext: result.secretCiphertext,
            secretIv: result.secretIv,
            secretAuthTag: result.secretAuthTag
        }
    };
}

async function recordFailedTotpReplacementAttempt(input: {
    enrollmentId: string;
    userId: string;
    sessionId: string;
    ipAddress?: string | null;
}) {
    return db.transaction(async (tx) => {
        const now = new Date();

        const [enrollment] = await tx
            .update(mfaEnrollments)
            .set({
                attemptCount: sql`${mfaEnrollments.attemptCount} + 1`
            })
            .where(
                and(
                    eq(mfaEnrollments.id, input.enrollmentId),
                    eq(mfaEnrollments.userId, input.userId),
                    eq(mfaEnrollments.sessionId, input.sessionId),
                    eq(mfaEnrollments.type, MFA_TYPE),
                    eq(
                        mfaEnrollments.purpose,
                        MFA_REPLACEMENT_PURPOSE
                    ),
                    gt(mfaEnrollments.expiresAt, now),
                    lt(
                        mfaEnrollments.attemptCount,
                        MAX_MFA_REPLACEMENT_ATTEMPTS
                    )
                )
            )
            .returning({
                id: mfaEnrollments.id,
                attemptCount: mfaEnrollments.attemptCount
            });

        if (!enrollment) {
            return {
                status: "invalid_enrollment" as const
            };
        }

        const locked =
            enrollment.attemptCount >=
            MAX_MFA_REPLACEMENT_ATTEMPTS;

        if (locked) {
            await tx
                .delete(mfaEnrollments)
                .where(
                    eq(
                        mfaEnrollments.id,
                        enrollment.id
                    )
                );
        }

        await writeAudit(
            {
                eventType: "mfa_failed",
                actorId: input.userId,
                userId: input.userId,
                sessionId: input.sessionId,
                result: "failure",
                metadata: {
                    method: "totp",
                    operation: "replace",
                    locked
                },
                ipAddress: input.ipAddress ?? null
            },
            tx
        );

        return {
            status: "invalid_code" as const,
            locked
        };
    });
}

async function recordFailedMfaAttempt(input: RecordFailedMfaAttemptInput) {
    return db.transaction(async (tx) => {
        const now = new Date();

        const [challenge] = await tx
            .update(mfaChallenges)
            .set({
                attemptCount: sql`${mfaChallenges.attemptCount} + 1`
            })
            .where(
                and(
                    eq(mfaChallenges.id, input.challengeId),
                    eq(
                        mfaChallenges.challengeTokenHash,
                        hashOpaqueValue(input.rawToken)
                    ),
                    gt(mfaChallenges.expiresAt, now),
                    isNull(mfaChallenges.consumedAt),
                    lt(mfaChallenges.attemptCount, MAX_MFA_ATTEMPTS)
                )
            )
            .returning({
                id: mfaChallenges.id,
                userId: mfaChallenges.userId,
                attemptCount: mfaChallenges.attemptCount
            });

        if (!challenge) {
            return { status: "invalid_challenge" as const };
        }

        const locked = challenge.attemptCount >= MAX_MFA_ATTEMPTS;

        if (locked) {
            await tx
                .update(mfaChallenges)
                .set({ consumedAt: now })
                .where(
                    and(
                        eq(mfaChallenges.id, challenge.id),
                        isNull(mfaChallenges.consumedAt)
                    )
                );
        }

        await writeAudit(
            {
                eventType: "mfa_failed",
                actorId: challenge.userId,
                userId: challenge.userId,
                result: "failure",
                metadata: { method: input.method },
                ipAddress: input.ipAddress ?? null
            },
            tx
        );

        return {
            status: "invalid_factor" as const,
            locked
        };
    });
}

export async function verifyMfaTotp(input: VerifyMfaInput) {
    const pending = await getMfaChallenge(input.rawToken);

    if (!pending) {
        return { status: "invalid_challenge" as const };
    }

    const secret = decryptValue({
        ciphertext: pending.mfaMethod.secretCiphertext,
        iv: pending.mfaMethod.secretIv,
        authTag: pending.mfaMethod.secretAuthTag
    });

    if (!verifyTotpCode(secret, input.code)) {
        return recordFailedMfaAttempt({
            challengeId: pending.challenge.id,
            rawToken: input.rawToken,
            method: "totp",
            ipAddress: input.ipAddress
        });
    }

    return db.transaction(async (tx) => {
        const now = new Date();

        const [challenge] = await tx
            .update(mfaChallenges)
            .set({ consumedAt: now })
            .where(
                and(
                    eq(mfaChallenges.id, pending.challenge.id),
                    eq(
                        mfaChallenges.challengeTokenHash,
                        hashOpaqueValue(input.rawToken)
                    ),
                    gt(mfaChallenges.expiresAt, now),
                    isNull(mfaChallenges.consumedAt),
                    lt(mfaChallenges.attemptCount, MAX_MFA_ATTEMPTS)
                )
            )
            .returning({
                userId: mfaChallenges.userId,
                returnTo: mfaChallenges.returnTo
            });

        if (!challenge) {
            return { status: "invalid_challenge" as const };
        }

        const centralSession = await createCentralSession(
            {
                userId: challenge.userId,
                ipAddress: input.ipAddress,
                userAgent: input.userAgent,
                mfaMethod: "totp"
            },
            tx
        );

        await writeAudit(
            {
                eventType: "mfa_success",
                actorId: challenge.userId,
                userId: challenge.userId,
                sessionId: centralSession.session.id,
                result: "success",
                metadata: { method: "totp" },
                ipAddress: input.ipAddress ?? null
            },
            tx
        );

        await writeAudit(
            {
                eventType: "login_success",
                actorId: challenge.userId,
                userId: challenge.userId,
                sessionId: centralSession.session.id,
                result: "success",
                ipAddress: input.ipAddress ?? null
            },
            tx
        );

        return {
            status: "authenticated" as const,
            user: pending.user,
            session: centralSession.session,
            rawToken: centralSession.rawToken,
            returnTo: challenge.returnTo
        };
    });
}

export async function verifyMfaRecovery(input: VerifyMfaInput) {
    const pending = await getMfaChallenge(input.rawToken);

    if (!pending) {
        return { status: "invalid_challenge" as const };
    }

    const codeHash = hashRecoveryCode(input.code);

    try {
        return await db.transaction(async (tx) => {
            const now = new Date();

            const [challenge] = await tx
                .update(mfaChallenges)
                .set({ consumedAt: now })
                .where(
                    and(
                        eq(mfaChallenges.id, pending.challenge.id),
                        eq(
                            mfaChallenges.challengeTokenHash,
                            hashOpaqueValue(input.rawToken)
                        ),
                        gt(mfaChallenges.expiresAt, now),
                        isNull(mfaChallenges.consumedAt),
                        lt(mfaChallenges.attemptCount, MAX_MFA_ATTEMPTS)
                    )
                )
                .returning({
                    userId: mfaChallenges.userId,
                    returnTo: mfaChallenges.returnTo
                });

            if (!challenge) {
                return { status: "invalid_challenge" as const };
            }

            const [recoveryCode] = await tx
                .update(mfaRecoveryCodes)
                .set({ usedAt: now })
                .where(
                    and(
                        eq(
                            mfaRecoveryCodes.mfaMethodId,
                            pending.mfaMethod.id
                        ),
                        eq(mfaRecoveryCodes.codeHash, codeHash),
                        isNull(mfaRecoveryCodes.usedAt)
                    )
                )
                .returning({ id: mfaRecoveryCodes.id });

            if (!recoveryCode) {
                throw new InvalidRecoveryCodeError();
            }

            const centralSession = await createCentralSession(
                {
                    userId: challenge.userId,
                    ipAddress: input.ipAddress,
                    userAgent: input.userAgent,
                    mfaMethod: "recovery_code"
                },
                tx
            );

            await writeAudit(
                {
                    eventType: "mfa_success",
                    actorId: challenge.userId,
                    userId: challenge.userId,
                    sessionId: centralSession.session.id,
                    result: "success",
                    metadata: { method: "recovery_code" },
                    ipAddress: input.ipAddress ?? null
                },
                tx
            );

            await writeAudit(
                {
                    eventType: "login_success",
                    actorId: challenge.userId,
                    userId: challenge.userId,
                    sessionId: centralSession.session.id,
                    result: "success",
                    ipAddress: input.ipAddress ?? null
                },
                tx
            );

            return {
                status: "authenticated" as const,
                user: pending.user,
                session: centralSession.session,
                rawToken: centralSession.rawToken,
                returnTo: challenge.returnTo
            };
        });
    } catch (error) {
        if (!(error instanceof InvalidRecoveryCodeError)) {
            throw error;
        }

        return recordFailedMfaAttempt({
            challengeId: pending.challenge.id,
            rawToken: input.rawToken,
            method: "recovery_code",
            ipAddress: input.ipAddress
        });
    }
}

export async function startTotpEnrollment(input: StartTotpEnrollmentInput) {
    const secret = generateTotpSecret();
    const otpauthUri = createTotpUri(input.accountLabel, secret);
    const encryptedSecret = encryptValue(secret);
    const now = new Date();

    const [method] = await db
        .insert(userMfaMethods)
        .values({
            userId: input.userId,
            type: MFA_TYPE,
            secretCiphertext: encryptedSecret.ciphertext,
            secretIv: encryptedSecret.iv,
            secretAuthTag: encryptedSecret.authTag,
            updatedAt: now
        })
        .onConflictDoUpdate({
            target: [userMfaMethods.userId, userMfaMethods.type],
            set: {
                secretCiphertext: encryptedSecret.ciphertext,
                secretIv: encryptedSecret.iv,
                secretAuthTag: encryptedSecret.authTag,
                updatedAt: now
            },
            setWhere: isNull(userMfaMethods.enabledAt)
        })
        .returning({ id: userMfaMethods.id });

    if (!method) {
        throw new AppError(409, "CONFLICT", "MFA sudah aktif");
    }

    return {
        methodId: method.id,
        secret,
        otpauthUri
    };
}

export async function confirmTotpEnrollment(
    input: ConfirmTotpEnrollmentInput
) {
    const [method] = await db
        .select({
            id: userMfaMethods.id,
            secretCiphertext: userMfaMethods.secretCiphertext,
            secretIv: userMfaMethods.secretIv,
            secretAuthTag: userMfaMethods.secretAuthTag
        })
        .from(userMfaMethods)
        .where(
            and(
                eq(userMfaMethods.userId, input.userId),
                eq(userMfaMethods.type, MFA_TYPE),
                isNull(userMfaMethods.enabledAt)
            )
        )
        .limit(1);

    if (!method) {
        throw new AppError(
            400,
            "INVALID_REQUEST",
            "Enrollment MFA tidak tersedia"
        );
    }

    const secret = decryptValue({
        ciphertext: method.secretCiphertext,
        iv: method.secretIv,
        authTag: method.secretAuthTag
    });

    if (!verifyTotpCode(secret, input.code)) {
        throw new AppError(
            400,
            "INVALID_REQUEST",
            "Kode MFA tidak valid"
        );
    }

    return db.transaction(async (tx) => {
        const now = new Date();

        const [enabledMethod] = await tx
            .update(userMfaMethods)
            .set({
                enabledAt: now,
                updatedAt: now
            })
            .where(
                and(
                    eq(userMfaMethods.id, method.id),
                    isNull(userMfaMethods.enabledAt),
                    eq(
                        userMfaMethods.secretCiphertext,
                        method.secretCiphertext
                    ),
                    eq(userMfaMethods.secretIv, method.secretIv),
                    eq(
                        userMfaMethods.secretAuthTag,
                        method.secretAuthTag
                    )
                )
            )
            .returning({ id: userMfaMethods.id });

        if (!enabledMethod) {
            throw new AppError(
                409,
                "CONFLICT",
                "Enrollment MFA telah berubah. Mulai ulang enrollment."
            );
        }

        const recoveryCodes = generateRecoveryCodes();

        await tx
            .delete(mfaRecoveryCodes)
            .where(eq(mfaRecoveryCodes.mfaMethodId, method.id));

        await tx
            .insert(mfaRecoveryCodes)
            .values(
                recoveryCodes.map((code) => ({
                    mfaMethodId: method.id,
                    codeHash: hashRecoveryCode(code)
                }))
            );

        await writeAudit(
            {
                eventType: "mfa_enrolled",
                actorId: input.userId,
                userId: input.userId,
                sessionId: input.sessionId ?? null,
                result: "success",
                metadata: { method: "totp" },
                ipAddress: input.ipAddress ?? null
            },
            tx
        );

        return {
            enabledAt: now,
            recoveryCodes
        };
    });
}