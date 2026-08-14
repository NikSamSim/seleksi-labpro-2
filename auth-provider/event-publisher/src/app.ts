import Fastify from "fastify";

import { checkDatabase } from "./db/client.js";
import { checkRabbitMQ } from "./messaging/rabbitmq.js";

export function buildApp(
    isShuttingDown: () => boolean = () => false
) {
    const app = Fastify({
        logger: true
    });

    app.get("/health/live", async () => {
        return {
            status: "alive"
        };
    });

    app.get("/health/ready", async (_request, reply) => {
        if (isShuttingDown()) {
            return reply.code(503).send({
                status: "not_ready",
                reason: "shutting_down"
            });
        }

        let database: "up" | "down" = "down";
        let messageBroker: "up" | "down" = "down";

        try {
            await checkDatabase();
            database = "up";
        } catch {
            database = "down";
        }

        try {
            await checkRabbitMQ();
            messageBroker = "up";
        } catch {
            messageBroker = "down";
        }

        const ready = database === "up" && messageBroker === "up";

        return reply.code(ready ? 200 : 503).send({
            status: ready ? "ready" : "not_ready",
            components: {
                database,
                messageBroker
            }
        });
    });

    return app;
}