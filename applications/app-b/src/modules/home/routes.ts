import type { FastifyInstance } from "fastify";

import { applicationConfig } from "../../config/application.js";
import { validateLocalSession } from "../sessions/service.js";
import {
    getRecentActivityLogs,
    getRecentProcessedEvents
} from "./service.js";
import {
    renderAuthenticatedHome,
    renderUnauthenticatedHome
} from "./view.js";

export function registerHomeRoutes(
    app: FastifyInstance
) {
    app.get("/", async (request, reply) => {
        const rawSessionToken =
            request.cookies[
                applicationConfig.cookieName
            ];

        if (!rawSessionToken) {
            return reply
                .type("text/html; charset=utf-8")
                .send(
                    renderUnauthenticatedHome(
                        applicationConfig.name
                    )
                );
        }

        const authenticatedSession =
            await validateLocalSession(
                rawSessionToken
            );

        if (!authenticatedSession) {
            return reply
                .type("text/html; charset=utf-8")
                .send(
                    renderUnauthenticatedHome(
                        applicationConfig.name
                    )
                );
        }

        const [
            activities,
            processedEvents
        ] = await Promise.all([
            getRecentActivityLogs(),
            getRecentProcessedEvents()
        ]);

        return reply
            .type("text/html; charset=utf-8")
            .send(
                renderAuthenticatedHome({
                    applicationName:
                        applicationConfig.name,
                    authenticatedSession,
                    activities,
                    processedEvents
                })
            );
    });
}