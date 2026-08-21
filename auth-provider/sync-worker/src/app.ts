import Fastify from "fastify";

import { checkRabbitMQ } from "./messaging/rabbitmq.js";
import { checkDatabase } from "./db/client.js";
import {
    isConsumerActive
} from "./worker/consumer.js";
import { registerMetricsRoutes } from "./observability/routes.js";

export function buildApp(
    isShuttingDown: () => boolean = () => false
) {
    const app = Fastify({
        logger: true
    });

    registerMetricsRoutes(app);

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

        const [
            databaseResult,
            messageBrokerResult
        ] = await Promise.allSettled([
            checkDatabase(),
            checkRabbitMQ()
        ]);

        const databaseUp =
            databaseResult.status === "fulfilled";

        const messageBrokerUp =
            messageBrokerResult.status === "fulfilled";
        const consumerUp =
            isConsumerActive();

        if (databaseUp && messageBrokerUp && consumerUp) {
            return reply.code(200).send({
                status: "ready",
                components: {
                    database: "up",
                    messageBroker: "up",
                    consumer: "up"
                }
            });
        }

        app.log.warn(
            {
                database: databaseUp ? "up" : "down",
                messageBroker:
                    messageBrokerUp ? "up" : "down",
                consumer: consumerUp ? "up" : "down"
            },
            "Sync worker readiness check failed"
        );

        return reply.code(503).send({
            status: "not_ready",
            components: {
                database: databaseUp ? "up" : "down",
                messageBroker:
                    messageBrokerUp ? "up" : "down",
                consumer: consumerUp ? "up" : "down"
            }
        });
    });

    return app;
}