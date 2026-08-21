import type { FastifyInstance } from "fastify";

import {
    addUserGroupBodySchema,
    listGroupsQuerySchema,
    listGroupUsersQuerySchema,
    createGroupBodySchema,
    groupIdParamsSchema,
    updateGroupBodySchema,
    userGroupMembershipParamsSchema,
    userMembershipParamsSchema
} from "./schemas.js";

import {
    addUserToGroup,
    getGroupById,
    createGroup,
    listGroups,
    listGroupUsers,
    listUserGroups,
    removeUserFromGroup,
    updateGroup
} from "./service.js";

export async function groupRoutes(app: FastifyInstance) {
    app.get("/", async (request) => {
        const query =
            listGroupsQuerySchema.parse(
                request.query
            );

        return listGroups(query);
    });

    app.get(
        "/:groupId/users",
        async (request) => {
            const { groupId } =
                groupIdParamsSchema.parse(
                    request.params
                );

            const query =
                listGroupUsersQuerySchema.parse(
                    request.query
                );

            return listGroupUsers(
                groupId,
                query
            );
        }
    );

    app.get(
        "/:groupId",
        async (request) => {
            const { groupId } =
                groupIdParamsSchema.parse(
                    request.params
                );

            const group =
                await getGroupById(groupId);

            return {
                group
            };
        }
    );

    app.post("/", async (request, reply) => {
        const input =
            createGroupBodySchema.parse(request.body);

        const group = await createGroup(
            input,
            {
                actorId: request.admin!.userId,
                ipAddress: request.ip
            }
        );

        return reply
            .code(201)
            .send({
                group
            });
    });

    app.patch("/:groupId", async (request) => {
        const { groupId } =
            groupIdParamsSchema.parse(request.params);

        const input =
            updateGroupBodySchema.parse(request.body);

        const group =
            await updateGroup(
                groupId,
                input,
                {
                    actorId: request.admin!.userId,
                    ipAddress: request.ip
                }
            );

        return {
            group
        };
    });
}

export async function membershipRoutes(
    app: FastifyInstance
) {
    app.get("/:userId/groups", async (request) => {
        const { userId } =
            userMembershipParamsSchema.parse(
                request.params
            );

        const groups =
            await listUserGroups(userId);

        return {
            groups
        };
    });

    app.post(
        "/:userId/groups",
        async (request, reply) => {
            const { userId } =
                userMembershipParamsSchema.parse(
                    request.params
                );

            const input =
                addUserGroupBodySchema.parse(
                    request.body
                );

            const membership =
                await addUserToGroup(
                    userId,
                    input.groupId,
                    {
                        actorId: request.admin!.userId,
                        ipAddress: request.ip
                    }
                );

            return reply
                .code(201)
                .send({
                    membership
                });
        }
    );

    app.delete(
        "/:userId/groups/:groupId",
        async (request) => {
            const {
                userId,
                groupId
            } =
                userGroupMembershipParamsSchema.parse(
                    request.params
                );

            const membership =
                await removeUserFromGroup(
                    userId,
                    groupId,
                    {
                        actorId: request.admin!.userId,
                        ipAddress: request.ip
                    }
                );

            return {
                membership
            };
        }
    );
}