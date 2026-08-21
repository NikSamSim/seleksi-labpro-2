import type { FastifyInstance } from "fastify";

import { metricsRegistry, registerHttpMetrics } from "./metrics.js";
import { refreshRabbitMQQueueMetrics } from "./queue-metrics.js";

export function registerMetricsRoutes(app: FastifyInstance) {
    registerHttpMetrics(app);

    app.get("/metrics", async (request, reply) => {
        try {
            await refreshRabbitMQQueueMetrics();
        } catch {
            request.log.warn(
                "RabbitMQ queue metrics collection failed"
            );
        }

        const metrics = await metricsRegistry.metrics();

        return reply
            .header("Content-Type", metricsRegistry.contentType)
            .send(metrics);
    });
}