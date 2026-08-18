import { eq } from "drizzle-orm";

import { db } from "../../db/client.js";
import { users } from "../../db/schema/index.js";
import { AppError } from "../../http/errors.js";
import { hashPassword, verifyPassword } from "../../security/password.js";
import {
    writeAudit,
    writeAuditBestEffort
} from "../audit/service.js";
import type {
    AuditLogger
} from "../audit/service.js";
import { createCentralSession } from "../sessions/service.js";

import type { LoginInput } from "./schemas.js";

type LoginContext = {
    ipAddress?: string | null;
    userAgent?: string | null;
    logger: AuditLogger;
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

    const {
        rawToken,
        session
    } = await db.transaction(async (tx) => {
        const centralSession =
            await createCentralSession(
                {
                    userId: user.id,
                    ipAddress: context.ipAddress,
                    userAgent: context.userAgent
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
        user: {
            id: user.id,
            name: user.name,
            email: user.email
        },
        session,
        rawToken
    };
}

function throwInvalidCredentials(): never {
    throw new AppError(
        401,
        "UNAUTHORIZED",
        "Email atau password tidak valid"
    );
}