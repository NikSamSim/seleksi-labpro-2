import type { FastifyInstance } from "fastify";

import {
    applicationIdParamsSchema,
    applicationRedirectUriParamsSchema,
    createApplicationBodySchema,
    createRedirectUriBodySchema,
    updateApplicationBodySchema,
    updateApplicationStatusBodySchema
} from "./schemas.js";

import {
    addApplicationRedirectUri,
    createApplication,
    getApplicationById,
    listApplicationRedirectUris,
    listApplications,
    removeApplicationRedirectUri,
    updateApplication,
    updateApplicationStatus
} from "./service.js";

export async function applicationRoutes(
    app: FastifyInstance
) {
    app.get("/", async () => {
        const applications =
            await listApplications();

        return {
            applications
        };
    });

    app.get("/:applicationId", async (request) => {
        const { applicationId } =
            applicationIdParamsSchema.parse(
                request.params
            );

        const application =
            await getApplicationById(
                applicationId
            );

        return {
            application
        };
    });

    app.post("/", async (request, reply) => {
        const input =
            createApplicationBodySchema.parse(
                request.body
            );

        const result =
            await createApplication(
                input,
                {
                    ipAddress: request.ip
                }
            );

        return reply
            .code(201)
            .send(result);
    });

    app.patch(
        "/:applicationId",
        async (request) => {
            const { applicationId } =
                applicationIdParamsSchema.parse(
                    request.params
                );

            const input =
                updateApplicationBodySchema.parse(
                    request.body
                );

            const application =
                await updateApplication(
                    applicationId,
                    input,
                    {
                        ipAddress: request.ip
                    }
                );

            return {
                application
            };
        }
    );

    app.patch(
        "/:applicationId/status",
        async (request) => {
            const { applicationId } =
                applicationIdParamsSchema.parse(
                    request.params
                );

            const input =
                updateApplicationStatusBodySchema.parse(
                    request.body
                );

            const application =
                await updateApplicationStatus(
                    applicationId,
                    input,
                    {
                        ipAddress: request.ip
                    }
                );

            return {
                application
            };
        }
    );

    app.get(
        "/:applicationId/redirect-uris",
        async (request) => {
            const { applicationId } =
                applicationIdParamsSchema.parse(
                    request.params
                );

            const redirectUris =
                await listApplicationRedirectUris(
                    applicationId
                );

            return {
                redirectUris
            };
        }
    );

    app.post(
        "/:applicationId/redirect-uris",
        async (request, reply) => {
            const { applicationId } =
                applicationIdParamsSchema.parse(
                    request.params
                );

            const input =
                createRedirectUriBodySchema.parse(
                    request.body
                );

            const redirectUri =
                await addApplicationRedirectUri(
                    applicationId,
                    input,
                    {
                        ipAddress: request.ip
                    }
                );

            return reply
                .code(201)
                .send({
                    redirectUri
                });
        }
    );

    app.delete(
        "/:applicationId/redirect-uris/:redirectUriId",
        async (request) => {
            const {
                applicationId,
                redirectUriId
            } =
                applicationRedirectUriParamsSchema.parse(
                    request.params
                );

            const redirectUri =
                await removeApplicationRedirectUri(
                    applicationId,
                    redirectUriId,
                    {
                        ipAddress: request.ip
                    }
                );

            return {
                redirectUri
            };
        }
    );
}