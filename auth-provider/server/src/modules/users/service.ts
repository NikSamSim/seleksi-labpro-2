import { eq } from "drizzle-orm";

import { db } from "../../db/client.js";
import { users } from "../../db/schema/index.js";
import { AppError } from "../../http/errors.js";
import { hashPassword } from "../../security/password.js";


import type {
    CreateUserInput,
    UpdateUserInput,
    UpdateUserStatusInput,
    UpdateUserPasswordInput
} from "./schemas.js";

const safeUserColumns = {
    id: users.id,
    name: users.name,
    email: users.email,
    status: users.status,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt
};

type PostgresErrorLike = {
    code?: string;
    constraint_name?: string;
};

function getPostgresError(
    error: unknown
): PostgresErrorLike | null {
    if (typeof error !== "object" || error === null) {
        return null;
    }

    const current = error as PostgresErrorLike;

    if (current.code !== undefined) {
        return current;
    }

    if ("cause" in error) {
        return getPostgresError(error.cause);
    }

    return null;
}

function isUserEmailConflict(error: unknown) {
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

export async function getUserById(userId: string) {
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

export async function createUser(input: CreateUserInput) {
    const email = input.email
        .trim()
        .toLowerCase();

    const passwordHash =
        await hashPassword(input.password);

    try {
        const [user] = await db
            .insert(users)
            .values({
                name: input.name.trim(),
                email,
                passwordHash,
                status: "active"
            })
            .returning(safeUserColumns);

        return user;
    } catch (error) {
        if (isUserEmailConflict(error)) {
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
    input: UpdateUserInput
) {
    const updateData: {
        name?: string;
        email?: string;
        updatedAt: Date;
    } = {
        updatedAt: new Date()
    };

    if (input.name !== undefined) {
        updateData.name = input.name.trim();
    }

    if (input.email !== undefined) {
        updateData.email = input.email
            .trim()
            .toLowerCase();
    }

    try {
        const [user] = await db
            .update(users)
            .set(updateData)
            .where(eq(users.id, userId))
            .returning(safeUserColumns);

        if (!user) {
            throw new AppError(
                404,
                "NOT_FOUND",
                "User tidak ditemukan"
            );
        }

        return user;
    } catch (error) {
        if (isUserEmailConflict(error)) {
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
    input: UpdateUserStatusInput
) {
    const [user] = await db
        .update(users)
        .set({
            status: input.status,
            updatedAt: new Date()
        })
        .where(eq(users.id, userId))
        .returning(safeUserColumns);

    if (!user) {
        throw new AppError(
            404,
            "NOT_FOUND",
            "User tidak ditemukan"
        );
    }

    return user;
}

export async function updateUserPassword(
    userId: string,
    input: UpdateUserPasswordInput
) {
    const passwordHash =
        await hashPassword(input.password);

    const [user] = await db
        .update(users)
        .set({
            passwordHash,
            updatedAt: new Date()
        })
        .where(eq(users.id, userId))
        .returning(safeUserColumns);

    if (!user) {
        throw new AppError(
            404,
            "NOT_FOUND",
            "User tidak ditemukan"
        );
    }

    return user;
}