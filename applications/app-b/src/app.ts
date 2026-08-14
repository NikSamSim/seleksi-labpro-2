import Fastify from "fastify";
import { checkDatabase } from "./db/client.js";

export function buildApp() {
    const app = Fastify({
        logger: true
    });

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
            return reply.code(503).send({
                status: "not_ready",
                components: {
                    database: "down"
                }
            });
        }
    });

    return app;
}