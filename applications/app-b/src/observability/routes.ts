import type { FastifyInstance } from "fastify";

import { metricsRegistry, registerHttpMetrics } from "./metrics.js";

export function registerMetricsRoutes(app: FastifyInstance) {
    registerHttpMetrics(app);

    app.get("/metrics", async (_request, reply) => {
        const metrics = await metricsRegistry.metrics();

        return reply
            .header("Content-Type", metricsRegistry.contentType)
            .send(metrics);
    });
}