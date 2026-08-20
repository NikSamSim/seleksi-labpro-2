import cookie from "@fastify/cookie";
import Fastify from "fastify";

import { checkDatabase } from "./db/client.js";
import { registerOAuthRoutes } from "./modules/oauth/routes.js";

export function buildApp() {
    const app = Fastify({
        logger: true
    });

    app.register(cookie);

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

    registerOAuthRoutes(app);

    return app;
}