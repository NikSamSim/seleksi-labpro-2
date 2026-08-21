import {
    and,
    asc,
    eq,
    ilike,
    inArray,
    sql
} from "drizzle-orm";

import { db } from "../../db/client.js";
import {
    applicationGroupPolicies,
    applications,
    groups,
    userGroups
} from "../../db/schema/index.js";
import { AppError } from "../../http/errors.js";
import {
    createPaginationMeta,
    getPaginationOffset
} from "../../http/pagination.js";

import { writeAudit } from "../audit/service.js";
import {
    writeApplicationOutboxEvents
} from "../events/service.js";
import {
    revokeUsersApplicationAccess
} from "../revocation/service.js";

import type {
    CreateApplicationPolicyInput,
    ListApplicationPoliciesQuery
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

type PolicyMutationContext = {
    actorId: string;
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

function isPolicyConflict(
    error: unknown
) {
    const databaseError =
        getPostgresError(error);

    return (
        databaseError?.code === "23505" &&
        databaseError.constraint_name ===
            "application_group_policies_application_id_group_id_effect_uniqu"
    );
}

function isMissingPolicyApplication(
    error: unknown
) {
    const databaseError =
        getPostgresError(error);

    return (
        databaseError?.code === "23503" &&
        databaseError.constraint_name ===
            "application_group_policies_application_id_applications_id_fk"
    );
}

function isMissingPolicyGroup(
    error: unknown
) {
    const databaseError =
        getPostgresError(error);

    return (
        databaseError?.code === "23503" &&
        databaseError.constraint_name ===
            "application_group_policies_group_id_groups_id_fk"
    );
}

export async function listApplicationPolicies(
    applicationId: string,
    query: ListApplicationPoliciesQuery
) {
    const where = and(
        eq(
            applicationGroupPolicies.applicationId,
            applicationId
        ),
        query.search
            ? ilike(
                groups.name,
                `%${query.search}%`
            )
            : undefined
    );

    const offset = getPaginationOffset(
        query.page,
        query.pageSize
    );

    const [
        [application],
        policyRows,
        [countRow]
    ] = await Promise.all([
        db
            .select({
                id: applications.id
            })
            .from(applications)
            .where(
                eq(
                    applications.id,
                    applicationId
                )
            )
            .limit(1),

        db
            .select({
                id:
                    applicationGroupPolicies.id,
                applicationId:
                    applicationGroupPolicies.applicationId,
                groupId:
                    applicationGroupPolicies.groupId,
                groupName:
                    groups.name,
                effect:
                    applicationGroupPolicies.effect,
                createdAt:
                    applicationGroupPolicies.createdAt
            })
            .from(applicationGroupPolicies)
            .innerJoin(
                groups,
                eq(
                    groups.id,
                    applicationGroupPolicies.groupId
                )
            )
            .where(where)
            .orderBy(
                asc(groups.name),
                asc(applicationGroupPolicies.id)
            )
            .limit(query.pageSize)
            .offset(offset),

        db
            .select({
                totalItems:
                    sql<number>`count(*)::int`
            })
            .from(applicationGroupPolicies)
            .innerJoin(
                groups,
                eq(
                    groups.id,
                    applicationGroupPolicies.groupId
                )
            )
            .where(where)
    ]);

    if (!application) {
        throw new AppError(
            404,
            "NOT_FOUND",
            "Application tidak ditemukan"
        );
    }

    const totalItems =
        countRow?.totalItems ?? 0;

    return {
        policies: policyRows,
        pagination: createPaginationMeta(
            query.page,
            query.pageSize,
            totalItems
        )
    };
}

export async function createApplicationPolicy(
    applicationId: string,
    input: CreateApplicationPolicyInput,
    context: PolicyMutationContext
) {
    try {
        return await db.transaction(
            async (tx) => {
                const [policy] = await tx
                    .insert(
                        applicationGroupPolicies
                    )
                    .values({
                        applicationId,
                        groupId:
                            input.groupId,
                        effect:
                            input.effect
                    })
                    .returning(
                        policyColumns
                    );

                await writeAudit(
                    {
                        eventType:
                            "policy_changed",
                        actorId: context.actorId,
                        applicationId,
                        result: "success",
                        metadata: {
                            action:
                                "created",
                            policyId:
                                policy.id,
                            groupId:
                                policy.groupId,
                            effect:
                                policy.effect
                        },
                        ipAddress:
                            context.ipAddress ??
                            null
                    },
                    tx
                );

                return policy;
            }
        );
    } catch (error) {
        if (isPolicyConflict(error)) {
            throw new AppError(
                409,
                "CONFLICT",
                "Policy sudah terdaftar"
            );
        }

        if (
            isMissingPolicyApplication(
                error
            )
        ) {
            throw new AppError(
                404,
                "NOT_FOUND",
                "Application tidak ditemukan"
            );
        }

        if (
            isMissingPolicyGroup(error)
        ) {
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
    policyId: string,
    context: PolicyMutationContext
) {
    return db.transaction(async (tx) => {
        const [policy] = await tx
            .delete(
                applicationGroupPolicies
            )
            .where(
                and(
                    eq(
                        applicationGroupPolicies
                            .id,
                        policyId
                    ),
                    eq(
                        applicationGroupPolicies
                            .applicationId,
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

        let affectedUserIds:
            string[] = [];

        /*
         * Hanya penghapusan ALLOW policy
         * yang dapat menghilangkan access.
         */
        if (policy.effect === "allow") {
            const candidateUsers =
                await tx
                    .select({
                        userId:
                            userGroups.userId
                    })
                    .from(userGroups)
                    .where(
                        eq(
                            userGroups.groupId,
                            policy.groupId
                        )
                    )
                    .groupBy(
                        userGroups.userId
                    );

            const candidateUserIds =
                candidateUsers.map(
                    ({ userId }) =>
                        userId
                );

            if (
                candidateUserIds.length >
                0
            ) {
                /*
                 * Policy yang dihapus sudah tidak
                 * terlihat di transaction ini.
                 *
                 * Cari candidate user yang masih
                 * mempunyai ALLOW path lain ke
                 * application yang sama.
                 */
                const remainingUsers =
                    await tx
                        .select({
                            userId:
                                userGroups
                                    .userId
                        })
                        .from(userGroups)
                        .innerJoin(
                            applicationGroupPolicies,
                            eq(
                                applicationGroupPolicies
                                    .groupId,
                                userGroups
                                    .groupId
                            )
                        )
                        .where(
                            and(
                                inArray(
                                    userGroups
                                        .userId,
                                    candidateUserIds
                                ),
                                eq(
                                    applicationGroupPolicies
                                        .applicationId,
                                    applicationId
                                ),
                                eq(
                                    applicationGroupPolicies
                                        .effect,
                                    "allow"
                                )
                            )
                        )
                        .groupBy(
                            userGroups.userId
                        );

                const remainingUserIds =
                    new Set(
                        remainingUsers.map(
                            ({ userId }) =>
                                userId
                        )
                    );

                affectedUserIds =
                    candidateUserIds.filter(
                        (userId) =>
                            !remainingUserIds
                                .has(userId)
                    );
            }
        }

        const revocation =
            await revokeUsersApplicationAccess(
                {
                    userIds:
                        affectedUserIds,
                    applicationId
                },
                tx
            );

        await writeApplicationOutboxEvents(
            affectedUserIds.map(
                (userId) => ({
                    eventType:
                        "AccessPolicyChanged",
                    userId,
                    centralSessionId:
                        null,
                    applicationId,
                    reason:
                        "policy_removed",
                    metadata: {
                        policyId:
                            policy.id,
                        groupId:
                            policy.groupId
                    }
                })
            ),
            tx
        );

        await writeAudit(
            {
                eventType:
                    "policy_changed",
                actorId: context.actorId,
                applicationId,
                result: "success",
                metadata: {
                    action: "removed",
                    policyId: policy.id,
                    groupId: policy.groupId,
                    effect: policy.effect,
                    affectedUserIds,
                    revokedTokenCount:
                        revocation
                            .revokedTokenCount
                },
                ipAddress:
                    context.ipAddress ??
                    null
            },
            tx
        );

        return policy;
    });
}