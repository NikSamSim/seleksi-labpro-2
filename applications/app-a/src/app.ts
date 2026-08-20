import cookie from "@fastify/cookie";
import Fastify from "fastify";
import formbody from "@fastify/formbody";

import { checkDatabase } from "./db/client.js";
import { registerOAuthRoutes } from "./modules/oauth/routes.js";

import { registerHomeRoutes } from "./modules/home/routes.js";
import { registerSessionRoutes } from "./modules/sessions/routes.js";
import { registerInternalLogoutRoutes } from "./modules/internal-logout/routes.js";

export function buildApp() {
    const app = Fastify({
        logger: true
    });

    app.register(cookie);
    app.register(formbody);

    app.get("/health/live", async () => {
        return {
            status: "alive"
        };
    });

    app.get("/health/ready", async (_request, reply) => {
        try {
            await checkDatabase();

            return reply.code(200).send({
                status: "ready",
                components: {
                    database: "up"
                }
            });
        } catch {
            app.log.warn(
                "App A database readiness check failed"
            );

            return reply.code(503).send({
                status: "not_ready",
                components: {
                    database: "down"
                }
            });
        }
    });

    registerHomeRoutes(app);
    registerOAuthRoutes(app);
    registerSessionRoutes(app);
    registerInternalLogoutRoutes(app);

    return app;
}