import type { FastifyInstance } from "fastify";
import { env } from "../../config/env.js";
import {
    adminResetUserMfa,
    getAdminUserMfaStatus
} from "../mfa/reset-service.js";

import {
    createUserBodySchema,
    listUsersQuerySchema,
    updateUserBodySchema,
    updateUserPasswordBodySchema,
    updateUserStatusBodySchema,
    userIdParamsSchema
} from "./schemas.js";

import {
    createUser,
    getUserById,
    listUsers,
    updateUser,
    updateUserPassword,
    updateUserStatus
} from "./service.js";

export async function userRoutes(app: FastifyInstance) {
    app.get("/", async (request) => {
        const query = listUsersQuerySchema.parse(request.query);
        const result = await listUsers(query);

        return result;
    });

    app.get("/:userId", async (request) => {
        const { userId } =
            userIdParamsSchema.parse(request.params);

        const user = await getUserById(userId);

        return {
            user
        };
    });

    app.get("/:userId/mfa", async (request) => {
        const { userId } = userIdParamsSchema.parse(request.params);
        const mfa = await getAdminUserMfaStatus(userId);

        return { mfa };
    });

    app.post("/:userId/mfa/reset", async (request, reply) => {
        const { userId } = userIdParamsSchema.parse(request.params);
        const admin = request.admin!;

        const reset = await adminResetUserMfa({
            userId,
            actorId: admin.userId,
            sessionId: admin.sessionId,
            ipAddress: request.ip
        });

        if (userId === admin.userId && reset.changed) {
            reply.clearCookie(env.SSO_COOKIE_NAME, { path: "/" });
            reply.clearCookie(env.MFA_PENDING_COOKIE_NAME, { path: "/" });
        }

        return {
            mfa: {
                enabled: false,
                enabledAt: null
            },
            reset
        };
    });

    app.post("/", async (request, reply) => {
        const input =
            createUserBodySchema.parse(request.body);

        const user = await createUser(
            input,
            {
                actorId: request.admin!.userId,
                ipAddress: request.ip
            }
        );

        return reply
            .code(201)
            .send({
                user
            });
    });

    app.patch("/:userId", async (request) => {
        const { userId } =
            userIdParamsSchema.parse(request.params);

        const input =
            updateUserBodySchema.parse(request.body);

        const user =
            await updateUser(
                userId,
                input,
                {
                    actorId: request.admin!.userId,
                    ipAddress: request.ip
                }
            );

        return {
            user
        };
    });

    app.patch("/:userId/status", async (request) => {
        const { userId } =
            userIdParamsSchema.parse(request.params);

        const input =
            updateUserStatusBodySchema.parse(request.body);

        const user =
            await updateUserStatus(
                userId,
                input,
                {
                    actorId: request.admin!.userId,
                    ipAddress: request.ip
                }
            );

        return {
            user
        };
    });

    app.put("/:userId/password", async (request) => {
        const { userId } =
            userIdParamsSchema.parse(request.params);

        const input =
            updateUserPasswordBodySchema.parse(request.body);

        const user =
            await updateUserPassword(
                userId,
                input,
                {
                    actorId: request.admin!.userId,
                    ipAddress: request.ip
                }
            );

        return {
            user
        };
    });
}