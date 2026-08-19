import {
    and,
    eq,
    gt,
    isNull
} from "drizzle-orm";

import { db } from "../../db/client.js";
import {
    groups,
    ssoSessions,
    userGroups,
    users
} from "../../db/schema/index.js";
import { AppError } from "../../http/errors.js";
import { hashOpaqueValue } from "../../security/token.js";

export const ADMIN_GROUP_NAME = "administrators";

export type AdminPrincipal = {
    userId: string;
    sessionId: string;
    name: string;
    email: string;
};

export async function requireAdmin(
    rawToken: string | undefined
): Promise<AdminPrincipal> {
    if (!rawToken) {
        throwUnauthenticated();
    }

    const sessionTokenHash =
        hashOpaqueValue(rawToken);

    const now = new Date();

    const adminMemberships = db
        .select({
            userId: userGroups.userId
        })
        .from(userGroups)
        .innerJoin(
            groups,
            eq(
                userGroups.groupId,
                groups.id
            )
        )
        .where(
            eq(
                groups.name,
                ADMIN_GROUP_NAME
            )
        )
        .as("admin_memberships");

    const [result] = await db
        .select({
            sessionId: ssoSessions.id,
            userId: users.id,
            name: users.name,
            email: users.email,
            adminUserId:
                adminMemberships.userId
        })
        .from(ssoSessions)
        .innerJoin(
            users,
            eq(
                ssoSessions.userId,
                users.id
            )
        )
        .leftJoin(
            adminMemberships,
            eq(
                adminMemberships.userId,
                users.id
            )
        )
        .where(
            and(
                eq(
                    ssoSessions.sessionTokenHash,
                    sessionTokenHash
                ),
                eq(
                    ssoSessions.status,
                    "active"
                ),
                gt(
                    ssoSessions.expiresAt,
                    now
                ),
                isNull(
                    ssoSessions.revokedAt
                ),
                eq(
                    users.status,
                    "active"
                )
            )
        )
        .limit(1);

    if (!result) {
        throwUnauthenticated();
    }

    if (!result.adminUserId) {
        throw new AppError(
            403,
            "FORBIDDEN",
            "Akses Control Panel tidak diizinkan"
        );
    }

    return {
        userId: result.userId,
        sessionId: result.sessionId,
        name: result.name,
        email: result.email
    };
}

function throwUnauthenticated(): never {
    throw new AppError(
        401,
        "UNAUTHORIZED",
        "Authentication diperlukan"
    );
}