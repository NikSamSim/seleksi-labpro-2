import type { FastifyInstance } from "fastify";

import { AppError } from "../../http/errors.js";

import { getObservabilitySnapshot } from "./service.js";

export async function observabilityRoutes(
    app: FastifyInstance
) {
    app.get("/", async (request) => {
        try {
            return await getObservabilitySnapshot();
        } catch (error) {
            request.log.warn(
                {
                    errorType:
                        error instanceof Error
                            ? error.name
                            : "UnknownError"
                },
                "Prometheus observability query failed"
            );

            throw new AppError(
                503,
                "INTERNAL_ERROR",
                "Metrics sementara tidak tersedia"
            );
        }
    });
}