import Fastify from "fastify";
import cors from "@fastify/cors";

import { ZodError } from "zod";

import { AppError, createErrorResponse } from "./http/errors.js";
import { env } from "./config/env.js";
import { checkDatabase } from "./db/client.js";
import { checkRabbitMQ } from "./messaging/rabbitmq.js";
import { userRoutes } from "./modules/users/routes.js";

function isFastifyValidationError(
    error: unknown
): error is { validation: unknown } {
    return (
        typeof error === "object" &&
        error !== null &&
        "validation" in error
    );
}

export function buildApp() {
    const app = Fastify({
        logger: true
    });

    app.setErrorHandler((error, request, reply) => {
        if (error instanceof AppError) {
            request.log.warn(
                {
                    requestId: request.id,
                    code: error.code,
                    statusCode: error.statusCode
                },
                "Request failed with application error"
            );

            return reply
                .status(error.statusCode)
                .send(
                    createErrorResponse(
                        error.code,
                        error.message,
                        request.id
                    )
                );
        }

        if (error instanceof ZodError || isFastifyValidationError(error)) {
            request.log.warn(
                {
                    requestId: request.id
                },
                "Request validation failed"
            );

            return reply
                .status(400)
                .send(
                    createErrorResponse(
                        "VALIDATION_ERROR",
                        "Request tidak valid",
                        request.id
                    )
                );
        }

        request.log.error(
            {
                err: error,
                requestId: request.id
            },
            "Unhandled request error"
        );

        return reply
            .status(500)
            .send(
                createErrorResponse(
                    "INTERNAL_ERROR",
                    "Terjadi kesalahan internal",
                    request.id
                )
            );
    });

    app.setNotFoundHandler((request, reply) => {
        return reply
            .status(404)
            .send(
                createErrorResponse(
                    "NOT_FOUND",
                    "Resource tidak ditemukan",
                    request.id
                )
            );
    });

    app.register(cors, {
        origin: env.CONTROL_PANEL_ORIGIN
    });

    app.register(userRoutes, {
        prefix: "/admin/users"
    });

    app.get("/health/live", async () => {
        return {
            status: "alive"
        };
    });

    app.get("/health/ready", async (_request, reply) => {
        let database: "up" | "down" = "down";
        let messageBroker: "up" | "down" = "down";

        try {
            await checkDatabase();
            database = "up";
        } catch {
            database = "down";
            app.log.warn("Primary database readiness check failed");
        }

        try {
            await checkRabbitMQ();
            messageBroker = "up";
        } catch {
            messageBroker = "down";
            app.log.warn("RabbitMQ readiness check failed");
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