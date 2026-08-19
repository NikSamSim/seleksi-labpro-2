import { eq } from "drizzle-orm";

import { db } from "../../db/client.js";
import { users } from "../../db/schema/index.js";
import { AppError } from "../../http/errors.js";
import {
    hashPassword,
    verifyPassword
} from "../../security/password.js";
import {
    writeAudit,
    writeAuditBestEffort
} from "../audit/service.js";
import type {
    AuditLogger
} from "../audit/service.js";
import {
    writeGlobalOutboxEvent
} from "../events/service.js";
import {
    revokeCentralSession
} from "../revocation/service.js";
import {
    createCentralSession,
    getCentralSessionByRawToken
} from "../sessions/service.js";

import {
    createMfaChallenge,
    getUserMfaStatus
} from "../mfa/service.js";

import type { LoginInput } from "./schemas.js";

type LoginContext = {
    ipAddress?: string | null;
    userAgent?: string | null;
    returnTo?: string;
    logger: AuditLogger;
};

type LogoutSsoContext = {
    ipAddress?: string | null;
};

const dummyPasswordHashPromise =
    hashPassword("dummy-password-not-used");

export async function login(
    input: LoginInput,
    context: LoginContext
) {
    const email = input.email
        .trim()
        .toLowerCase();

    const [user] = await db
        .select({
            id: users.id,
            name: users.name,
            email: users.email,
            passwordHash: users.passwordHash,
            status: users.status
        })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

    const passwordHash = user
        ? user.passwordHash
        : await dummyPasswordHashPromise;

    const passwordValid =
        await verifyPassword(
            passwordHash,
            input.password
        );

    if (
        !user ||
        !passwordValid ||
        user.status !== "active"
    ) {
        await writeAuditBestEffort(
            {
                eventType: "login_failed",
                actorId: user?.id ?? null,
                userId: user?.id ?? null,
                result: "failure",
                ipAddress:
                    context.ipAddress ?? null
            },
            context.logger
        );

        throwInvalidCredentials();
    }

    const mfaStatus = await getUserMfaStatus(user.id);

    if (mfaStatus.enabled) {
        const {
            rawToken: rawChallengeToken
        } = await createMfaChallenge({
            userId: user.id,
            returnTo: context.returnTo
        });

        return {
            status: "mfa_required" as const,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            },
            rawChallengeToken
        };
    }

    const {
        rawToken,
        session
    } = await db.transaction(async (tx) => {
        const centralSession =
            await createCentralSession(
                {
                    userId: user.id,
                    ipAddress:
                        context.ipAddress,
                    userAgent:
                        context.userAgent
                },
                tx
            );

        await writeAudit(
            {
                eventType: "login_success",
                actorId: user.id,
                userId: user.id,
                sessionId:
                    centralSession.session.id,
                result: "success",
                ipAddress:
                    context.ipAddress ?? null
            },
            tx
        );

        return centralSession;
    });

    return {
        status: "authenticated" as const,
        user: {
            id: user.id,
            name: user.name,
            email: user.email
        },
        session,
        rawToken
    };
}

export async function logoutSso(
    rawToken: string | undefined,
    context: LogoutSsoContext
) {
    if (!rawToken) {
        return {
            revoked: false
        };
    }

    const session =
        await getCentralSessionByRawToken(
            rawToken
        );

    if (
        !session ||
        session.status !== "active" ||
        session.revokedAt !== null
    ) {
        return {
            revoked: false
        };
    }

    return db.transaction(async (tx) => {
        const revocation =
            await revokeCentralSession(
                {
                    sessionId: session.id,
                    reason: "sso_logout"
                },
                tx
            );

        if (
            revocation.revokedSessionCount > 0
        ) {
            await writeGlobalOutboxEvent(
                {
                    eventType:
                        "SessionRevoked",
                    userId: session.userId,
                    centralSessionId:
                        session.id,
                    reason: "sso_logout"
                },
                tx
            );

            await writeAudit(
                {
                    eventType: "logout",
                    actorId: session.userId,
                    userId: session.userId,
                    sessionId: session.id,
                    result: "success",
                    metadata: {
                        reason: "sso_logout"
                    },
                    ipAddress:
                        context.ipAddress ??
                        null
                },
                tx
            );
        }

        return {
            revoked:
                revocation.revokedSessionCount >
                0
        };
    });
}

function throwInvalidCredentials(): never {
    throw new AppError(
        401,
        "UNAUTHORIZED",
        "Email atau password tidak valid"
    );
}