import { eq } from "drizzle-orm";

import { db } from "../../db/client.js";
import {
    users
} from "../../db/schema/index.js";
import { AppError } from "../../http/errors.js";
import {
    verifyPassword
} from "../../security/password.js";

import {
    getUserMfaStatus
} from "../mfa/service.js";
import {
    hasRecentMfaVerification
} from "../sessions/service.js";
import {
    updateUserPassword
} from "../users/service.js";

import type {
    ChangeOwnPasswordInput
} from "./schemas.js";

type ChangeOwnPasswordContext = {
    userId: string;
    session: {
        mfaVerifiedAt: Date | null;
        mfaMethod: string | null;
    };
    ipAddress?: string | null;
};

export async function changeOwnPassword(
    input: ChangeOwnPasswordInput,
    context: ChangeOwnPasswordContext
) {
    const [user] = await db
        .select({
            passwordHash:
                users.passwordHash
        })
        .from(users)
        .where(
            eq(
                users.id,
                context.userId
            )
        )
        .limit(1);

    if (!user) {
        throw new AppError(
            404,
            "NOT_FOUND",
            "User tidak ditemukan"
        );
    }

    const currentPasswordValid =
        await verifyPassword(
            user.passwordHash,
            input.currentPassword
        );

    if (!currentPasswordValid) {
        throw new AppError(
            401,
            "UNAUTHORIZED",
            "Password saat ini tidak valid"
        );
    }

    const mfaStatus =
        await getUserMfaStatus(
            context.userId
        );

    if (
        mfaStatus.enabled &&
        !hasRecentMfaVerification(
            context.session
        )
    ) {
        throw new AppError(
            403,
            "FORBIDDEN",
            "Verifikasi MFA terbaru diperlukan"
        );
    }

    return updateUserPassword(
        context.userId,
        {
            password:
                input.newPassword
        },
        {
            actorId:
                context.userId,
            ipAddress:
                context.ipAddress ??
                null
        }
    );
}