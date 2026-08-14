import Fastify from "fastify";

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

        try {
            await checkRabbitMQ();

            return reply.code(200).send({
                status: "ready",
                components: {
                    messageBroker: "up"
                }
            });
        }
        catch {
            app.log.warn("Sync worker RabbitMQ readiness check failed");
            
            return reply.code(503).send({
                status: "not_ready",
                components: {
                    messageBroker: "down"
                }
            });
        }
    });

    return app;
}