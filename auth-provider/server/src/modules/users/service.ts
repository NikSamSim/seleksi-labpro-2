import {
    and,
    eq,
    ne
} from "drizzle-orm";

import { db } from "../../db/client.js";
import { users } from "../../db/schema/index.js";
import { AppError } from "../../http/errors.js";
import { hashPassword } from "../../security/password.js";

import { writeAudit } from "../audit/service.js";
import {
    writeGlobalOutboxEvent
} from "../events/service.js";
import {
    revokeAllUserSessions
} from "../revocation/service.js";

import type {
    CreateUserInput,
    UpdateUserInput,
    UpdateUserPasswordInput,
    UpdateUserStatusInput
} from "./schemas.js";

const safeUserColumns = {
    id: users.id,
    name: users.name,
    email: users.email,
    status: users.status,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt
};

type UserMutationContext = {
    ipAddress?: string | null;
};

type PostgresErrorLike = {
    code?: string;
    constraint_name?: string;
};

function getPostgresError(
    error: unknown
): PostgresErrorLike | null {
    if (
        typeof error !== "object" ||
        error === null
    ) {
        return null;
    }

    const current =
        error as PostgresErrorLike;

    if (current.code !== undefined) {
        return current;
    }

    if ("cause" in error) {
        return getPostgresError(
            error.cause
        );
    }

    return null;
}

function isUserEmailConflict(
    error: unknown
) {
    const databaseError = getPostgresError(error);

    return (
        databaseError?.code === "23505" &&
        databaseError.constraint_name === "users_email_unique"
    );
}

export async function listUsers() {
    return db
        .select(safeUserColumns)
        .from(users);
}

export async function getUserById(
    userId: string
) {
    const [user] = await db
        .select(safeUserColumns)
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (!user) {
        throw new AppError(
            404,
            "NOT_FOUND",
            "User tidak ditemukan"
        );
    }

    return user;
}

export async function createUser(
    input: CreateUserInput,
    context: UserMutationContext
) {
    const email = input.email
        .trim()
        .toLowerCase();

    const passwordHash =
        await hashPassword(
            input.password
        );

    try {
        return await db.transaction(
            async (tx) => {
                const [user] = await tx
                    .insert(users)
                    .values({
                        name:
                            input.name.trim(),
                        email,
                        passwordHash,
                        status: "active"
                    })
                    .returning(
                        safeUserColumns
                    );

                await writeAudit(
                    {
                        eventType:
                            "user_created",
                        actorId: null,
                        userId: user.id,
                        result: "success",
                        metadata: {
                            status:
                                user.status
                        },
                        ipAddress:
                            context.ipAddress ??
                            null
                    },
                    tx
                );

                return user;
            }
        );
    } catch (error) {
        if (
            isUserEmailConflict(error)
        ) {
            throw new AppError(
                409,
                "CONFLICT",
                "Email sudah digunakan"
            );
        }

        throw error;
    }
}

export async function updateUser(
    userId: string,
    input: UpdateUserInput,
    context: UserMutationContext
) {
    const updateData: {
        name?: string;
        email?: string;
        updatedAt: Date;
    } = {
        updatedAt: new Date()
    };

    if (input.name !== undefined) {
        updateData.name =
            input.name.trim();
    }

    if (input.email !== undefined) {
        updateData.email =
            input.email
                .trim()
                .toLowerCase();
    }

    const changedFields: string[] = [];

    if (input.name !== undefined) {
        changedFields.push("name");
    }

    if (input.email !== undefined) {
        changedFields.push("email");
    }

    try {
        return await db.transaction(
            async (tx) => {
                const [user] = await tx
                    .update(users)
                    .set(updateData)
                    .where(
                        eq(
                            users.id,
                            userId
                        )
                    )
                    .returning(
                        safeUserColumns
                    );

                if (!user) {
                    throw new AppError(
                        404,
                        "NOT_FOUND",
                        "User tidak ditemukan"
                    );
                }

                await writeAudit(
                    {
                        eventType:
                            "user_updated",
                        actorId: null,
                        userId: user.id,
                        result: "success",
                        metadata: {
                            changedFields
                        },
                        ipAddress:
                            context.ipAddress ??
                            null
                    },
                    tx
                );

                return user;
            }
        );
    } catch (error) {
        if (
            isUserEmailConflict(error)
        ) {
            throw new AppError(
                409,
                "CONFLICT",
                "Email sudah digunakan"
            );
        }

        throw error;
    }
}

export async function updateUserStatus(
    userId: string,
    input: UpdateUserStatusInput,
    context: UserMutationContext
) {
    return db.transaction(async (tx) => {
        const [changedUser] = await tx
            .update(users)
            .set({
                status: input.status,
                updatedAt: new Date()
            })
            .where(
                and(
                    eq(users.id, userId),
                    ne(
                        users.status,
                        input.status
                    )
                )
            )
            .returning(safeUserColumns);

        if (!changedUser) {
            const [existingUser] =
                await tx
                    .select(
                        safeUserColumns
                    )
                    .from(users)
                    .where(
                        eq(
                            users.id,
                            userId
                        )
                    )
                    .limit(1);

            if (!existingUser) {
                throw new AppError(
                    404,
                    "NOT_FOUND",
                    "User tidak ditemukan"
                );
            }

            return existingUser;
        }

        if (
            changedUser.status ===
            "inactive"
        ) {
            await revokeAllUserSessions(
                {
                    userId:
                        changedUser.id,
                    reason:
                        "user_inactive"
                },
                tx
            );

            await writeGlobalOutboxEvent(
                {
                    eventType:
                        "SessionRevoked",
                    userId:
                        changedUser.id,
                    centralSessionId: null,
                    reason:
                        "user_inactive"
                },
                tx
            );
        }

        await writeAudit(
            {
                eventType:
                    "user_status_changed",
                actorId: null,
                userId:
                    changedUser.id,
                result: "success",
                metadata: {
                    status:
                        changedUser.status
                },
                ipAddress:
                    context.ipAddress ??
                    null
            },
            tx
        );

        return changedUser;
    });
}

export async function updateUserPassword(
    userId: string,
    input: UpdateUserPasswordInput,
    context: UserMutationContext
) {
    const passwordHash =
        await hashPassword(
            input.password
        );

    return db.transaction(async (tx) => {
        const [user] = await tx
            .update(users)
            .set({
                passwordHash,
                updatedAt: new Date()
            })
            .where(
                eq(
                    users.id,
                    userId
                )
            )
            .returning(
                safeUserColumns
            );

        if (!user) {
            throw new AppError(
                404,
                "NOT_FOUND",
                "User tidak ditemukan"
            );
        }

        await revokeAllUserSessions(
            {
                userId: user.id,
                reason:
                    "password_changed"
            },
            tx
        );

        await writeGlobalOutboxEvent(
            {
                eventType:
                    "PasswordChanged",
                userId: user.id,
                centralSessionId: null,
                reason:
                    "password_changed"
            },
            tx
        );

        await writeAudit(
            {
                eventType:
                    "password_changed",
                actorId: null,
                userId: user.id,
                result: "success",
                ipAddress:
                    context.ipAddress ??
                    null
            },
            tx
        );

        return user;
    });
}