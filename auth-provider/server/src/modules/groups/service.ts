import {
    and,
    asc,
    eq,
    ilike,
    inArray,
    or,
    sql
} from "drizzle-orm";

import { db } from "../../db/client.js";
import {
    applicationGroupPolicies,
    groups,
    userGroups,
    users
} from "../../db/schema/index.js";
import { AppError } from "../../http/errors.js";
import {
    createPaginationMeta,
    getPaginationOffset
} from "../../http/pagination.js";

import { writeAudit } from "../audit/service.js";

import type {
    CreateGroupInput,
    ListGroupsQuery,
    ListGroupUsersQuery,
    UpdateGroupInput
} from "./schemas.js";

import {
    writeApplicationOutboxEvents
} from "../events/service.js";
import {
    revokeUserApplicationsAccess
} from "../revocation/service.js";

const groupColumns = {
    id: groups.id,
    name: groups.name,
    description: groups.description,
    createdAt: groups.createdAt,
    updatedAt: groups.updatedAt
};

type GroupMutationContext = {
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

function isGroupNameConflict(error: unknown) {
    const databaseError = getPostgresError(error);

    return (
        databaseError?.code === "23505" &&
        databaseError.constraint_name ===
            "groups_name_unique"
    );
}

function isMembershipConflict(error: unknown) {
    const databaseError = getPostgresError(error);

    return (
        databaseError?.code === "23505" &&
        databaseError.constraint_name ===
            "user_groups_user_id_group_id_unique"
    );
}

function isMissingMembershipUser(error: unknown) {
    const databaseError = getPostgresError(error);

    return (
        databaseError?.code === "23503" &&
        databaseError.constraint_name ===
            "user_groups_user_id_users_id_fk"
    );
}

function isMissingMembershipGroup(error: unknown) {
    const databaseError = getPostgresError(error);

    return (
        databaseError?.code === "23503" &&
        databaseError.constraint_name ===
            "user_groups_group_id_groups_id_fk"
    );
}

export async function listGroups(
    query: ListGroupsQuery
) {
    const where = query.search
        ? or(
            ilike(groups.name, `%${query.search}%`),
            ilike(groups.description, `%${query.search}%`)
        )
        : undefined;

    const offset = getPaginationOffset(
        query.page,
        query.pageSize
    );

    const [groupRows, [countRow]] =
        await Promise.all([
            db
                .select(groupColumns)
                .from(groups)
                .where(where)
                .orderBy(
                    asc(groups.name),
                    asc(groups.id)
                )
                .limit(query.pageSize)
                .offset(offset),
            db
                .select({
                    totalItems:
                        sql<number>`count(*)::int`
                })
                .from(groups)
                .where(where)
        ]);

    const totalItems =
        countRow?.totalItems ?? 0;

    return {
        groups: groupRows,
        pagination: createPaginationMeta(
            query.page,
            query.pageSize,
            totalItems
        )
    };
}

export async function getGroupById(
    groupId: string
) {
    const [group] = await db
        .select(groupColumns)
        .from(groups)
        .where(eq(groups.id, groupId))
        .limit(1);

    if (!group) {
        throw new AppError(
            404,
            "NOT_FOUND",
            "Group tidak ditemukan"
        );
    }

    return group;
}

export async function createGroup(
    input: CreateGroupInput,
    context: GroupMutationContext
) {
    try {
        return await db.transaction(async (tx) => {
            const [group] = await tx
                .insert(groups)
                .values({
                    name: input.name.trim(),
                    description:
                        input.description === undefined
                            ? null
                            : input.description
                })
                .returning(groupColumns);

            await writeAudit(
                {
                    eventType: "group_changed",
                    actorId: context.actorId,
                    result: "success",
                    metadata: {
                        action: "created",
                        groupId: group.id
                    },
                    ipAddress:
                        context.ipAddress ?? null
                },
                tx
            );

            return group;
        });
    } catch (error) {
        if (isGroupNameConflict(error)) {
            throw new AppError(
                409,
                "CONFLICT",
                "Nama group sudah digunakan"
            );
        }

        throw error;
    }
}

export async function updateGroup(
    groupId: string,
    input: UpdateGroupInput,
    context: GroupMutationContext
) {
    const updateData: {
        name?: string;
        description?: string | null;
        updatedAt: Date;
    } = {
        updatedAt: new Date()
    };

    if (input.name !== undefined) {
        updateData.name = input.name.trim();
    }

    if (input.description !== undefined) {
        updateData.description =
            input.description;
    }

    const changedFields: string[] = [];

    if (input.name !== undefined) {
        changedFields.push("name");
    }

    if (input.description !== undefined) {
        changedFields.push("description");
    }

    try {
        return await db.transaction(async (tx) => {
            const [group] = await tx
                .update(groups)
                .set(updateData)
                .where(eq(groups.id, groupId))
                .returning(groupColumns);

            if (!group) {
                throw new AppError(
                    404,
                    "NOT_FOUND",
                    "Group tidak ditemukan"
                );
            }

            await writeAudit(
                {
                    eventType: "group_changed",
                    actorId: context.actorId,
                    result: "success",
                    metadata: {
                        action: "updated",
                        groupId: group.id,
                        changedFields
                    },
                    ipAddress:
                        context.ipAddress ?? null
                },
                tx
            );

            return group;
        });
    } catch (error) {
        if (isGroupNameConflict(error)) {
            throw new AppError(
                409,
                "CONFLICT",
                "Nama group sudah digunakan"
            );
        }

        throw error;
    }
}

export async function listUserGroups(
    userId: string
) {
    const rows = await db
        .select({
            userId: users.id,
            groupId: groups.id,
            name: groups.name,
            description: groups.description,
            createdAt: groups.createdAt,
            updatedAt: groups.updatedAt
        })
        .from(users)
        .leftJoin(
            userGroups,
            eq(userGroups.userId, users.id)
        )
        .leftJoin(
            groups,
            eq(groups.id, userGroups.groupId)
        )
        .where(eq(users.id, userId));

    if (rows.length === 0) {
        throw new AppError(
            404,
            "NOT_FOUND",
            "User tidak ditemukan"
        );
    }

    return rows
        .filter((row) => row.groupId !== null)
        .map((row) => ({
            id: row.groupId,
            name: row.name,
            description: row.description,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        }));
}

export async function addUserToGroup(
    userId: string,
    groupId: string,
    context: GroupMutationContext
) {
    try {
        return await db.transaction(async (tx) => {
            const [membership] = await tx
                .insert(userGroups)
                .values({
                    userId,
                    groupId
                })
                .returning({
                    id: userGroups.id,
                    userId: userGroups.userId,
                    groupId: userGroups.groupId,
                    createdAt:
                        userGroups.createdAt
                });

            await writeAudit(
                {
                    eventType:
                        "membership_changed",
                    actorId: context.actorId,
                    userId,
                    result: "success",
                    metadata: {
                        action: "added",
                        groupId
                    },
                    ipAddress:
                        context.ipAddress ?? null
                },
                tx
            );

            return membership;
        });
    } catch (error) {
        if (isMembershipConflict(error)) {
            throw new AppError(
                409,
                "CONFLICT",
                "User sudah menjadi anggota group"
            );
        }

        if (isMissingMembershipUser(error)) {
            throw new AppError(
                404,
                "NOT_FOUND",
                "User tidak ditemukan"
            );
        }

        if (isMissingMembershipGroup(error)) {
            throw new AppError(
                404,
                "NOT_FOUND",
                "Group tidak ditemukan"
            );
        }

        throw error;
    }
}

export async function removeUserFromGroup(
    userId: string,
    groupId: string,
    context: GroupMutationContext
) {
    return db.transaction(async (tx) => {
        const [membership] = await tx
            .delete(userGroups)
            .where(
                and(
                    eq(
                        userGroups.userId,
                        userId
                    ),
                    eq(
                        userGroups.groupId,
                        groupId
                    )
                )
            )
            .returning({
                id: userGroups.id,
                userId:
                    userGroups.userId,
                groupId:
                    userGroups.groupId
            });

        if (!membership) {
            throw new AppError(
                404,
                "NOT_FOUND",
                "Membership tidak ditemukan"
            );
        }

        const candidateApplications =
            await tx
                .select({
                    applicationId:
                        applicationGroupPolicies
                            .applicationId
                })
                .from(
                    applicationGroupPolicies
                )
                .where(
                    and(
                        eq(
                            applicationGroupPolicies
                                .groupId,
                            groupId
                        ),
                        eq(
                            applicationGroupPolicies
                                .effect,
                            "allow"
                        )
                    )
                )
                .groupBy(
                    applicationGroupPolicies
                        .applicationId
                );

        const candidateApplicationIds =
            candidateApplications.map(
                ({ applicationId }) =>
                    applicationId
            );

        let lostApplicationIds:
            string[] = [];

        if (
            candidateApplicationIds.length >
            0
        ) {
            const remainingApplications =
                await tx
                    .select({
                        applicationId:
                            applicationGroupPolicies
                                .applicationId
                    })
                    .from(userGroups)
                    .innerJoin(
                        applicationGroupPolicies,
                        eq(
                            applicationGroupPolicies
                                .groupId,
                            userGroups.groupId
                        )
                    )
                    .where(
                        and(
                            eq(
                                userGroups.userId,
                                userId
                            ),
                            eq(
                                applicationGroupPolicies
                                    .effect,
                                "allow"
                            ),
                            inArray(
                                applicationGroupPolicies
                                    .applicationId,
                                candidateApplicationIds
                            )
                        )
                    )
                    .groupBy(
                        applicationGroupPolicies
                            .applicationId
                    );

            const remainingApplicationIds =
                new Set(
                    remainingApplications.map(
                        ({
                            applicationId
                        }) =>
                            applicationId
                    )
                );

            lostApplicationIds =
                candidateApplicationIds.filter(
                    (applicationId) =>
                        !remainingApplicationIds
                            .has(
                                applicationId
                            )
                );
        }

        const revocation =
            await revokeUserApplicationsAccess(
                {
                    userId,
                    applicationIds:
                        lostApplicationIds
                },
                tx
            );

        await writeApplicationOutboxEvents(
            lostApplicationIds.map(
                (applicationId) => ({
                    eventType:
                        "AccessPolicyChanged",
                    userId,
                    centralSessionId: null,
                    applicationId,
                    reason:
                        "membership_removed",
                    metadata: {
                        groupId
                    }
                })
            ),
            tx
        );

        await writeAudit(
            {
                eventType:
                    "membership_changed",
                actorId: context.actorId,
                userId,
                result: "success",
                metadata: {
                    action: "removed",
                    groupId,
                    lostApplicationIds,
                    revokedTokenCount:
                        revocation
                            .revokedTokenCount
                },
                ipAddress:
                    context.ipAddress ?? null
            },
            tx
        );

        return membership;
    });
}

export async function listGroupUsers(
    groupId: string,
    query: ListGroupUsersQuery
) {
    const where = and(
        eq(userGroups.groupId, groupId),
        query.search
            ? or(
                ilike(users.name, `%${query.search}%`),
                ilike(users.email, `%${query.search}%`)
            )
            : undefined,
        query.status
            ? eq(users.status, query.status)
            : undefined
    );

    const offset = getPaginationOffset(
        query.page,
        query.pageSize
    );

    const [
        [group],
        userRows,
        [countRow]
    ] = await Promise.all([
        db
            .select({
                id: groups.id
            })
            .from(groups)
            .where(eq(groups.id, groupId))
            .limit(1),

        db
            .select({
                id: users.id,
                name: users.name,
                email: users.email,
                status: users.status,
                createdAt: users.createdAt,
                updatedAt: users.updatedAt
            })
            .from(userGroups)
            .innerJoin(
                users,
                eq(users.id, userGroups.userId)
            )
            .where(where)
            .orderBy(
                asc(users.name),
                asc(users.id)
            )
            .limit(query.pageSize)
            .offset(offset),

        db
            .select({
                totalItems:
                    sql<number>`count(*)::int`
            })
            .from(userGroups)
            .innerJoin(
                users,
                eq(users.id, userGroups.userId)
            )
            .where(where)
    ]);

    if (!group) {
        throw new AppError(
            404,
            "NOT_FOUND",
            "Group tidak ditemukan"
        );
    }

    const totalItems =
        countRow?.totalItems ?? 0;

    return {
        users: userRows,
        pagination: createPaginationMeta(
            query.page,
            query.pageSize,
            totalItems
        )
    };
}