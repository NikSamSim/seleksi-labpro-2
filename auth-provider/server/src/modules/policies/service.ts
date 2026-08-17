import { and, eq } from "drizzle-orm";

import { db } from "../../db/client.js";
import {
    applicationGroupPolicies,
    applications,
    groups
} from "../../db/schema/index.js";
import { AppError } from "../../http/errors.js";

import type {
    CreateApplicationPolicyInput
} from "./schemas.js";

const policyColumns = {
    id: applicationGroupPolicies.id,
    applicationId:
        applicationGroupPolicies.applicationId,
    groupId:
        applicationGroupPolicies.groupId,
    effect:
        applicationGroupPolicies.effect,
    createdAt:
        applicationGroupPolicies.createdAt
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

function isPolicyConflict(error: unknown) {
    const databaseError = getPostgresError(error);

    return (
        databaseError?.code === "23505" &&
        databaseError.constraint_name ===
            "application_group_policies_application_id_group_id_effect_uniqu"
    );
}

function isMissingPolicyApplication(
    error: unknown
) {
    const databaseError = getPostgresError(error);

    return (
        databaseError?.code === "23503" &&
        databaseError.constraint_name ===
            "application_group_policies_application_id_applications_id_fk"
    );
}

function isMissingPolicyGroup(
    error: unknown
) {
    const databaseError = getPostgresError(error);

    return (
        databaseError?.code === "23503" &&
        databaseError.constraint_name ===
            "application_group_policies_group_id_groups_id_fk"
    );
}

export async function listApplicationPolicies(
    applicationId: string
) {
    const rows = await db
        .select({
            applicationId: applications.id,

            policyId:
                applicationGroupPolicies.id,

            groupId:
                applicationGroupPolicies.groupId,

            groupName:
                groups.name,

            effect:
                applicationGroupPolicies.effect,

            createdAt:
                applicationGroupPolicies.createdAt
        })
        .from(applications)
        .leftJoin(
            applicationGroupPolicies,
            eq(
                applicationGroupPolicies.applicationId,
                applications.id
            )
        )
        .leftJoin(
            groups,
            eq(
                groups.id,
                applicationGroupPolicies.groupId
            )
        )
        .where(
            eq(
                applications.id,
                applicationId
            )
        );

    if (rows.length === 0) {
        throw new AppError(
            404,
            "NOT_FOUND",
            "Application tidak ditemukan"
        );
    }

    return rows.flatMap((row) => {
        if (
            row.policyId === null ||
            row.groupId === null ||
            row.groupName === null ||
            row.effect === null ||
            row.createdAt === null
        ) {
            return [];
        }

        return [
            {
                id: row.policyId,
                applicationId: row.applicationId,
                groupId: row.groupId,
                groupName: row.groupName,
                effect: row.effect,
                createdAt: row.createdAt
            }
        ];
    });
}

export async function createApplicationPolicy(
    applicationId: string,
    input: CreateApplicationPolicyInput
) {
    try {
        const [policy] = await db
            .insert(applicationGroupPolicies)
            .values({
                applicationId,
                groupId: input.groupId,
                effect: input.effect
            })
            .returning(policyColumns);

        return policy;
    } catch (error) {
        if (isPolicyConflict(error)) {
            throw new AppError(
                409,
                "CONFLICT",
                "Policy sudah terdaftar"
            );
        }

        if (isMissingPolicyApplication(error)) {
            throw new AppError(
                404,
                "NOT_FOUND",
                "Application tidak ditemukan"
            );
        }

        if (isMissingPolicyGroup(error)) {
            throw new AppError(
                404,
                "NOT_FOUND",
                "Group tidak ditemukan"
            );
        }

        throw error;
    }
}

export async function removeApplicationPolicy(
    applicationId: string,
    policyId: string
) {
    const [policy] = await db
        .delete(applicationGroupPolicies)
        .where(
            and(
                eq(
                    applicationGroupPolicies.id,
                    policyId
                ),
                eq(
                    applicationGroupPolicies.applicationId,
                    applicationId
                )
            )
        )
        .returning(policyColumns);

    if (!policy) {
        throw new AppError(
            404,
            "NOT_FOUND",
            "Policy tidak ditemukan"
        );
    }

    return policy;
}