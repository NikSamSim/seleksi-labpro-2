import type { FastifyInstance } from "fastify";

import { applicationConfig } from "../../config/application.js";
import { db } from "../../db/client.js";
import { writeActivity } from "../activity/service.js";
import { revokeLocalSessionByRawToken } from "./service.js";

export function registerSessionRoutes(
    app: FastifyInstance
) {
    app.post("/logout", async (request, reply) => {
        const rawSessionToken =
            request.cookies[
                applicationConfig.cookieName
            ];

        if (rawSessionToken) {
            await db.transaction(async (tx) => {
                const revoked =
                    await revokeLocalSessionByRawToken(
                        rawSessionToken,
                        "local_logout",
                        tx
                    );

                if (revoked) {
                    await writeActivity(
                        {
                            eventType:
                                "local_logout",
                            message:
                                "Local session logged out",
                            externalUserId:
                                revoked.externalUserId,
                            requestId:
                                request.id
                        },
                        tx
                    );
                }
            });
        }

        reply.clearCookie(
            applicationConfig.cookieName,
            {
                path: "/",
                httpOnly: true,
                sameSite: "lax",
                secure:
                    applicationConfig.nodeEnv ===
                    "production"
            }
        );

        return reply
            .code(303)
            .redirect("/");
    });
}