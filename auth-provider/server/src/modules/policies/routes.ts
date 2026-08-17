import type { FastifyInstance } from "fastify";

import {
    applicationPolicyIdParamsSchema,
    applicationPolicyParamsSchema,
    createApplicationPolicyBodySchema
} from "./schemas.js";

import {
    createApplicationPolicy,
    listApplicationPolicies,
    removeApplicationPolicy
} from "./service.js";

export async function policyRoutes(
    app: FastifyInstance
) {
    app.get(
        "/:applicationId/policies",
        async (request) => {
            const { applicationId } =
                applicationPolicyParamsSchema.parse(
                    request.params
                );

            const policies =
                await listApplicationPolicies(
                    applicationId
                );

            return {
                policies
            };
        }
    );

    app.post(
        "/:applicationId/policies",
        async (request, reply) => {
            const { applicationId } =
                applicationPolicyParamsSchema.parse(
                    request.params
                );

            const input =
                createApplicationPolicyBodySchema.parse(
                    request.body
                );

            const policy =
                await createApplicationPolicy(
                    applicationId,
                    input
                );

            return reply
                .code(201)
                .send({
                    policy
                });
        }
    );

    app.delete(
        "/:applicationId/policies/:policyId",
        async (request) => {
            const {
                applicationId,
                policyId
            } =
                applicationPolicyIdParamsSchema.parse(
                    request.params
                );

            const policy =
                await removeApplicationPolicy(
                    applicationId,
                    policyId
                );

            return {
                policy
            };
        }
    );
}