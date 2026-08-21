import {
    and,
    asc,
    eq,
    ilike,
    ne,
    or,
    sql
} from "drizzle-orm";

import { db } from "../../db/client.js";
import {
    applicationRedirectUris,
    applications
} from "../../db/schema/index.js";
import { AppError } from "../../http/errors.js";
import {
    createPaginationMeta,
    getPaginationOffset
} from "../../http/pagination.js";
import {
    generateClientSecret,
    hashClientSecret
} from "../../security/client-secret.js";

import { writeAudit } from "../audit/service.js";
import { writeApplicationOutboxEvents } from "../events/service.js";
import { revokeApplicationAccess } from "../revocation/service.js";

import type {
    CreateApplicationInput,
    CreateRedirectUriInput,
    ListApplicationsQuery,
    UpdateApplicationInput,
    UpdateApplicationStatusInput
} from "./schemas.js";

const safeApplicationColumns = {
    id: applications.id,
    name: applications.name,
    clientId: applications.clientId,
    status: applications.status,
    launchUrl: applications.launchUrl,
    logoutNotificationUrl:
        applications.logoutNotificationUrl,
    createdAt: applications.createdAt,
    updatedAt: applications.updatedAt
};

const redirectUriColumns = {
    id: applicationRedirectUris.id,
    applicationId:
        applicationRedirectUris.applicationId,
    redirectUri:
        applicationRedirectUris.redirectUri,
    createdAt:
        applicationRedirectUris.createdAt
};

type ApplicationMutationContext = {
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

function isClientIdConflict(error: unknown) {
    const databaseError = getPostgresError(error);

    return (
        databaseError?.code === "23505" &&
        databaseError.constraint_name ===
            "applications_client_id_unique"
    );
}

function isRedirectUriConflict(error: unknown) {
    const databaseError = getPostgresError(error);

    return (
        databaseError?.code === "23505" &&
        databaseError.constraint_name ===
            "application_redirect_uris_application_id_redirect_uri_unique"
    );
}

function isMissingRedirectUriApplication(
    error: unknown
) {
    const databaseError = getPostgresError(error);

    return (
        databaseError?.code === "23503" &&
        databaseError.constraint_name ===
            "application_redirect_uris_application_id_applications_id_fk"
    );
}

export async function listApplications(
    query: ListApplicationsQuery
) {
    const where = and(
        query.search
            ? or(
                ilike(
                    applications.name,
                    `%${query.search}%`
                ),
                ilike(
                    applications.clientId,
                    `%${query.search}%`
                )
            )
            : undefined,

        query.status
            ? eq(
                applications.status,
                query.status
            )
            : undefined
    );

    const offset = getPaginationOffset(
        query.page,
        query.pageSize
    );

    const [
        applicationRows,
        [countRow]
    ] = await Promise.all([
        db
            .select(safeApplicationColumns)
            .from(applications)
            .where(where)
            .orderBy(
                asc(applications.name),
                asc(applications.id)
            )
            .limit(query.pageSize)
            .offset(offset),

        db
            .select({
                totalItems:
                    sql<number>`count(*)::int`
            })
            .from(applications)
            .where(where)
    ]);

    const totalItems =
        countRow?.totalItems ?? 0;

    return {
        applications: applicationRows,

        pagination: createPaginationMeta(
            query.page,
            query.pageSize,
            totalItems
        )
    };
}

export async function getApplicationById(
    applicationId: string
) {
    const [application] = await db
        .select(safeApplicationColumns)
        .from(applications)
        .where(eq(applications.id, applicationId))
        .limit(1);

    if (!application) {
        throw new AppError(
            404,
            "NOT_FOUND",
            "Application tidak ditemukan"
        );
    }

    return application;
}

export async function createApplication(
    input: CreateApplicationInput,
    context: ApplicationMutationContext
) {
    const clientSecret = generateClientSecret();
    const clientSecretHash =
        hashClientSecret(clientSecret);

    try {
        const application =
            await db.transaction(async (tx) => {
                const [createdApplication] =
                    await tx
                        .insert(applications)
                        .values({
                            name: input.name.trim(),
                            clientId:
                                input.clientId.trim(),
                            clientSecretHash,
                            status: "active",
                            launchUrl:
                                input.launchUrl ===
                                undefined
                                    ? null
                                    : input.launchUrl,
                            logoutNotificationUrl:
                                input.logoutNotificationUrl
                        })
                        .returning(
                            safeApplicationColumns
                        );

                await writeAudit(
                    {
                        eventType:
                            "application_changed",
                        actorId: context.actorId,
                        applicationId:
                            createdApplication.id,
                        result: "success",
                        metadata: {
                            action: "created",
                            status:
                                createdApplication.status
                        },
                        ipAddress:
                            context.ipAddress ?? null
                    },
                    tx
                );

                return createdApplication;
            });

        return {
            application,
            clientSecret
        };
    } catch (error) {
        if (isClientIdConflict(error)) {
            throw new AppError(
                409,
                "CONFLICT",
                "Client ID sudah digunakan"
            );
        }

        throw error;
    }
}

export async function updateApplication(
    applicationId: string,
    input: UpdateApplicationInput,
    context: ApplicationMutationContext
) {
    const updateData: {
        name?: string;
        clientId?: string;
        launchUrl?: string | null;
        logoutNotificationUrl?: string;
        updatedAt: Date;
    } = {
        updatedAt: new Date()
    };

    if (input.name !== undefined) {
        updateData.name = input.name.trim();
    }

    if (input.clientId !== undefined) {
        updateData.clientId =
            input.clientId.trim();
    }

    if (input.launchUrl !== undefined) {
        updateData.launchUrl = input.launchUrl;
    }

    if (
        input.logoutNotificationUrl !==
        undefined
    ) {
        updateData.logoutNotificationUrl =
            input.logoutNotificationUrl;
    }

    const changedFields: string[] = [];

    if (input.name !== undefined) {
        changedFields.push("name");
    }

    if (input.clientId !== undefined) {
        changedFields.push("clientId");
    }

    if (input.launchUrl !== undefined) {
        changedFields.push("launchUrl");
    }

    if (
        input.logoutNotificationUrl !==
        undefined
    ) {
        changedFields.push(
            "logoutNotificationUrl"
        );
    }

    try {
        return await db.transaction(
            async (tx) => {
                const [application] =
                    await tx
                        .update(applications)
                        .set(updateData)
                        .where(
                            eq(
                                applications.id,
                                applicationId
                            )
                        )
                        .returning(
                            safeApplicationColumns
                        );

                if (!application) {
                    throw new AppError(
                        404,
                        "NOT_FOUND",
                        "Application tidak ditemukan"
                    );
                }

                await writeAudit(
                    {
                        eventType:
                            "application_changed",
                        actorId: context.actorId,
                        applicationId:
                            application.id,
                        result: "success",
                        metadata: {
                            action: "updated",
                            changedFields
                        },
                        ipAddress:
                            context.ipAddress ?? null
                    },
                    tx
                );

                return application;
            }
        );
    } catch (error) {
        if (isClientIdConflict(error)) {
            throw new AppError(
                409,
                "CONFLICT",
                "Client ID sudah digunakan"
            );
        }

        throw error;
    }
}

export async function updateApplicationStatus(
    applicationId: string,
    input: UpdateApplicationStatusInput,
    context: ApplicationMutationContext
) {
    return db.transaction(async (tx) => {
        const [application] = await tx
            .update(applications)
            .set({
                status: input.status,
                updatedAt: new Date()
            })
            .where(
                and(
                    eq(applications.id, applicationId),
                    ne(applications.status, input.status)
                )
            )
            .returning(safeApplicationColumns);

        if (!application) {
            const [existingApplication] = await tx
                .select(safeApplicationColumns)
                .from(applications)
                .where(eq(applications.id, applicationId))
                .limit(1);

            if (!existingApplication) {
                throw new AppError(
                    404,
                    "NOT_FOUND",
                    "Application tidak ditemukan"
                );
            }

            return existingApplication;
        }

        let affectedUserIds: string[] = [];
        let revokedTokenCount = 0;

        if (application.status === "inactive") {
            const revocation = await revokeApplicationAccess(
                {
                    applicationId: application.id
                },
                tx
            );

            affectedUserIds = revocation.affectedUserIds;
            revokedTokenCount = revocation.revokedTokenCount;

            await writeApplicationOutboxEvents(
                affectedUserIds.map((userId) => ({
                    eventType: "AccessPolicyChanged",
                    userId,
                    centralSessionId: null,
                    applicationId: application.id,
                    reason: "application_inactive",
                    metadata: {
                        status: "inactive"
                    }
                })),
                tx
            );
        }

        await writeAudit(
            {
                eventType: "application_changed",
                actorId: context.actorId,
                applicationId: application.id,
                result: "success",
                metadata: {
                    action: "status_changed",
                    status: application.status,
                    affectedUserIds,
                    revokedTokenCount
                },
                ipAddress: context.ipAddress ?? null
            },
            tx
        );

        return application;
    });
}

export async function listApplicationRedirectUris(
    applicationId: string
) {
    const rows = await db
        .select({
            applicationId: applications.id,

            redirectUriId:
                applicationRedirectUris.id,

            redirectUri:
                applicationRedirectUris.redirectUri,

            createdAt:
                applicationRedirectUris.createdAt
        })
        .from(applications)
        .leftJoin(
            applicationRedirectUris,
            eq(
                applicationRedirectUris.applicationId,
                applications.id
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

    return rows
        .filter(
            (row) =>
                row.redirectUriId !== null
        )
        .map((row) => ({
            id: row.redirectUriId,
            applicationId: row.applicationId,
            redirectUri: row.redirectUri,
            createdAt: row.createdAt
        }));
}

export async function addApplicationRedirectUri(
    applicationId: string,
    input: CreateRedirectUriInput,
    context: ApplicationMutationContext
) {
    try {
        return await db.transaction(
            async (tx) => {
                const [redirectUri] =
                    await tx
                        .insert(
                            applicationRedirectUris
                        )
                        .values({
                            applicationId,
                            redirectUri:
                                input.redirectUri
                        })
                        .returning(
                            redirectUriColumns
                        );

                await writeAudit(
                    {
                        eventType:
                            "application_changed",
                        actorId: context.actorId,
                        applicationId,
                        result: "success",
                        metadata: {
                            action:
                                "redirect_uri_added",
                            redirectUriId:
                                redirectUri.id
                        },
                        ipAddress:
                            context.ipAddress ?? null
                    },
                    tx
                );

                return redirectUri;
            }
        );
    } catch (error) {
        if (isRedirectUriConflict(error)) {
            throw new AppError(
                409,
                "CONFLICT",
                "Redirect URI sudah terdaftar"
            );
        }

        if (
            isMissingRedirectUriApplication(
                error
            )
        ) {
            throw new AppError(
                404,
                "NOT_FOUND",
                "Application tidak ditemukan"
            );
        }

        throw error;
    }
}

export async function removeApplicationRedirectUri(
    applicationId: string,
    redirectUriId: string,
    context: ApplicationMutationContext
) {
    return db.transaction(async (tx) => {
        const [redirectUri] = await tx
            .delete(applicationRedirectUris)
            .where(
                and(
                    eq(
                        applicationRedirectUris.id,
                        redirectUriId
                    ),
                    eq(
                        applicationRedirectUris.applicationId,
                        applicationId
                    )
                )
            )
            .returning(redirectUriColumns);

        if (!redirectUri) {
            throw new AppError(
                404,
                "NOT_FOUND",
                "Redirect URI tidak ditemukan"
            );
        }

        await writeAudit(
            {
                eventType:
                    "application_changed",
                actorId: context.actorId,
                applicationId,
                result: "success",
                metadata: {
                    action:
                        "redirect_uri_removed",
                    redirectUriId:
                        redirectUri.id
                },
                ipAddress:
                    context.ipAddress ?? null
            },
            tx
        );

        return redirectUri;
    });
}