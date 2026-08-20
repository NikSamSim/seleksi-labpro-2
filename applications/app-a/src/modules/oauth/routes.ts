import type { FastifyInstance } from "fastify";

import { applicationConfig } from "../../config/application.js";
import { db } from "../../db/client.js";
import { writeActivity } from "../activity/service.js";
import { validateLocalSession } from "../sessions/service.js";
import {
    cleanupExpiredOAuthTransactions,
    createOAuthTransaction
} from "./service.js";

export function registerOAuthRoutes(
    app: FastifyInstance
) {
    app.get("/login", async (request, reply) => {
        const rawSessionToken =
            request.cookies[
                applicationConfig.cookieName
            ];

        if (rawSessionToken) {
            const localSession =
                await validateLocalSession(
                    rawSessionToken
                );

            if (localSession) {
                return reply.redirect("/");
            }
        }

        const authorization =
            await db.transaction(async (tx) => {
                await cleanupExpiredOAuthTransactions(
                    tx
                );

                const oauthTransaction =
                    await createOAuthTransaction(tx);

                await writeActivity(
                    {
                        eventType:
                            "authorization_started",
                        message:
                            "Authorization flow started",
                        requestId: request.id
                    },
                    tx
                );

                return oauthTransaction;
            });

        return reply.redirect(
            authorization.authorizationUrl
        );
    });
}